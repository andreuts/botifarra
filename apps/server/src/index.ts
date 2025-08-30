import Fastify from "fastify";
import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";
import type { ServerMessage, ClientMessage, Trump } from "@buti/protocol";
import { BotifarraEngine } from "@buti/engine"; // uses engine logic

const app = Fastify({ logger: false });
const wss = new WebSocketServer({ noServer: true });

type Player = { id: string, name: string };
type Room = {
  players: Record<number, Player | undefined>;
  sockets: Set<any>;
  rev: number;
  game?: any; // GameState from engine; typed as any to avoid cross-package type friction
};

const rooms = new Map<string, Room>();

function makeRoom(): Room {
  return {
    players: { 0: undefined, 1: undefined, 2: undefined, 3: undefined },
    sockets: new Set(),
    rev: 0,
    game: undefined
  };
}

// helpers
function send(ws: any, msg: ServerMessage) { try { ws.send(JSON.stringify(msg)); } catch {} }
function broadcast(room: Room, msg: ServerMessage) {
  const payload = JSON.stringify(msg);
  for (const sock of room.sockets) { try { sock.send(payload); } catch {} }
}
function findSeat(room: Room, you: string): number | undefined {
  const entry = Object.entries(room.players).find(([, p]) => p && p.id === you)?.[0];
  return entry == null ? undefined : parseInt(entry, 10);
}

wss.on("connection", (ws) => {
  const you = randomUUID();
  let roomId = "";
  let yourName = "Player";

  send(ws, { type: "Welcome", you, roomId } as ServerMessage);

  ws.on("message", (buf) => {
    let msg: ClientMessage;
    try { msg = JSON.parse(String(buf)); } catch { return; }

    // JOIN
    if (msg.type === "JoinRoom") {
      roomId = msg.roomId;
      yourName = msg.name || yourName;
      if (!rooms.has(roomId)) rooms.set(roomId, makeRoom());
      let room = rooms.get(roomId)!;
      room.sockets.add(ws);

      // send current state
      send(ws, { type: "RoomState", state: { players: room.players, rev: room.rev, game: room.game } } as ServerMessage);
      return;
    }

    if (!roomId) return; // ignore until joined
    let room = rooms.get(roomId)!; if (!room) { room = makeRoom(); rooms.set(roomId, room); }

    // SIT
    if (msg.type === "Sit") {
      const seat = msg.seat;
      const current = room.players[seat];
      if (!current || current.id === you) {
        // ensure not sitting elsewhere
        for (const s of [0, 1, 2, 3]) {
          if (room.players[s]?.id === you && s !== seat) room.players[s] = undefined;
        }
        room.players[seat] = { id: you, name: yourName };
        room.rev += 1;
        broadcast(room, { type: "RoomState", state: { players: room.players, rev: room.rev, game: room.game } } as ServerMessage);
      } else {
        send(ws, { type: "Error", code: "SEAT_TAKEN", message: "Seat already taken." } as ServerMessage);
      }
      return;
    }

    // UNSIT
    if (msg.type === "Unsit") {
      for (const s of [0, 1, 2, 3]) {
        if (room.players[s]?.id === you) room.players[s] = undefined;
      }
      room.rev += 1;
      broadcast(room, { type: "RoomState", state: { players: room.players, rev: room.rev, game: room.game } } as ServerMessage);
      return;
    }

    // START HAND -> Engine startNewHand
    if (msg.type === "StartHand") {
      const seated = Object.values(room.players).filter(Boolean).length;
      if (seated < 4) { send(ws, { type: "Error", code: "NEED4", message: "Need 4 players" } as ServerMessage); return; }

      const prevDealer = room.game?.dealer ?? 0;
      room.game = BotifarraEngine.startNewHand(prevDealer);
      room.rev += 1;
      broadcast(room, { type: "RoomState", state: { players: room.players, rev: room.rev, game: room.game } } as ServerMessage);
      return;
    }

    // BIDDING: PASS
    if (msg.type === "Pass") {
      if (!room.game) return;
      if (room.game.phase !== "bidding") { send(ws, { type: "Error", code: "BadPhase", message: "Not in bidding" } as ServerMessage); return; }

      const seat = findSeat(room, you);
      if (seat == null) { send(ws, { type: "Error", code: "NotSeated", message: "You must sit to act" } as ServerMessage); return; }
      if (room.game.turn !== seat) { send(ws, { type: "Error", code: "NotYourTurn", message: "Not your turn" } as ServerMessage); return; }

      // apply with engine
      room.game = BotifarraEngine.applyBiddingAction(room.game, seat, { type: "pass" });
      room.rev += 1;
      broadcast(room, { type: "StatePatch", patch: { game: room.game }, rev: room.rev } as ServerMessage);
      return;
    }

    // BIDDING: BID
    if (msg.type === "Bid") {
      if (!room.game) return;
      if (room.game.phase !== "bidding") { send(ws, { type: "Error", code: "BadPhase", message: "Not in bidding" } as ServerMessage); return; }

      const seat = findSeat(room, you);
      if (seat == null) { send(ws, { type: "Error", code: "NotSeated", message: "You must sit to act" } as ServerMessage); return; }
      if (room.game.turn !== seat) { send(ws, { type: "Error", code: "NotYourTurn", message: "Not your turn" } as ServerMessage); return; }

      room.game = BotifarraEngine.applyBiddingAction(room.game, seat, {
        type: "bid",
        trump: msg.trump as Trump,
        delegate: !!msg.delegate
      });
      room.rev += 1;
      broadcast(room, { type: "StatePatch", patch: { game: room.game }, rev: room.rev } as ServerMessage);
      return;
    }

    // BIDDING: DOUBLE / RECONTRAR / SANT_VICENS
    if (msg.type === "Double") {
      if (!room.game) return;
      if (room.game.phase !== "bidding") { send(ws, { type: "Error", code: "BadPhase", message: "Not in bidding" } as ServerMessage); return; }

      const seat = findSeat(room, you);
      if (seat == null) { send(ws, { type: "Error", code: "NotSeated", message: "You must sit to act" } as ServerMessage); return; }
      if (room.game.turn !== seat) { send(ws, { type: "Error", code: "NotYourTurn", message: "Not your turn" } as ServerMessage); return; }

      room.game = BotifarraEngine.applyBiddingAction(room.game, seat, {
        type: "double",
        level: msg.level
      });
      room.rev += 1;
      broadcast(room, { type: "StatePatch", patch: { game: room.game }, rev: room.rev } as ServerMessage);
      return;
    }

    // PLAY CARD
    if (msg.type === "PlayCard") {
      if (!room.game) return;
      if (room.game.phase !== "playing") { send(ws, { type: "Error", code: "BadPhase", message: "Not in playing" } as ServerMessage); return; }

      const seat = findSeat(room, you);
      if (seat == null) { send(ws, { type: "Error", code: "NotSeated", message: "You must sit to play" } as ServerMessage); return; }
      if (room.game.turn !== seat) { send(ws, { type: "Error", code: "NotYourTurn", message: "Not your turn" } as ServerMessage); return; }

      const legal = BotifarraEngine.getLegalPlays(room.game, seat);
      const isLegal = legal.some(c => c.suit === msg.card.suit && c.rank === msg.card.rank);
      if (!isLegal) { send(ws, { type: "Error", code: "IllegalPlay", message: "Card not legal" } as ServerMessage); return; }

      room.game = BotifarraEngine.playCard(room.game, seat, msg.card);
      room.rev += 1;
      broadcast(room, { type: "StatePatch", patch: { game: room.game }, rev: room.rev } as ServerMessage);
      return;
    }

    // NEXT ROUND (after round_finished)
    if (msg.type === "NextRound") {
      if (!room.game) return;
      if (room.game.phase !== "round_finished") { send(ws, { type: "Error", code: "BadPhase", message: "Round not finished" } as ServerMessage); return; }
      room.game = BotifarraEngine.startNextRound(room.game);
      room.rev += 1;
      broadcast(room, { type: "RoomState", state: { players: room.players, rev: room.rev, game: room.game } } as ServerMessage);
      return;
    }
  });

  ws.on("close", () => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;

    // vacate seats owned by this player
    let changed = false;
    for (const s of [0, 1, 2, 3]) {
      if (room.players[s]?.id === you) { room.players[s] = undefined; changed = true; }
    }
    room.sockets.delete(ws);
    if (changed) {
      room.rev += 1;
      broadcast(room, { type: "RoomState", state: { players: room.players, rev: room.rev, game: room.game } } as ServerMessage);
    }
  });
});

const server = app.server;
server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/ws")) {
    wss.handleUpgrade(req, socket as any, head, (ws) => wss.emit("connection", ws, req));
  } else (socket as any).destroy();
});

app.get("/health", async () => ({ ok: true }));

app.listen({ port: Number(process.env.PORT ?? 3001), host: "0.0.0.0" }).then(() =>
  console.log("server on :3001")
);
