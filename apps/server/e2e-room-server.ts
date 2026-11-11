import { createServer } from 'node:http';
import { matchMaker, Server } from 'colyseus';
import { currentPlayerSeat, legalMoves } from '@botifarra/core';
import {
  BotifarraRoom,
  PlayerSchema,
  type BotifarraRoomOptions,
} from './src/rooms/BotifarraRoom.js';
import { PracticeRoom } from './src/rooms/PracticeRoom.js';
import {
  assignSpecificSeat,
  createRoomState,
  handleDeclareTrump,
  handlePlayCard,
  startRound,
} from './src/rooms/game-logic.js';

class E2EPracticeRoom extends PracticeRoom {
  override onCreate(options: BotifarraRoomOptions) {
    // A low target keeps the browser scenario focused on one complete round.
    super.onCreate({ ...options, targetScore: 1 });

    // Reserve seat 1 for the human: seat 1 deals the first round and must
    // declare trump. Bots occupy the remaining seats and play automatically.
    this.gameState = createRoomState(1);
    this.state.players.clear();
    this.botSeeds.clear();

    const bots = [
      { seat: 0, username: 'Bot-Alpha' },
      { seat: 2, username: 'Bot-Beta' },
      { seat: 3, username: 'Bot-Gamma' },
    ] as const;

    for (const { seat, username } of bots) {
      const sessionId = `e2e-bot-${seat}-${this.roomId}`;
      this.gameState = assignSpecificSeat(
        this.gameState,
        sessionId,
        sessionId,
        username,
        seat,
      ).state;
      this.botSeeds.add(sessionId);

      const player = new PlayerSchema();
      player.userId = sessionId;
      player.username = username;
      player.seat = seat;
      player.connected = true;
      this.state.players.set(sessionId, player);
    }
  }
}

const port = Number(process.env['E2E_ROOM_PORT'] ?? 3001);
const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (request.url === '/e2e/resume-room') {
    void (async () => {
      try {
        const room = await matchMaker.createRoom('botifarra', {
          matchId: 'e2e-resume-match',
          initialSnapshot: createResumeSnapshot(),
        });
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ roomId: room.roomId }));
      } catch (error) {
        response.writeHead(500, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: String(error) }));
      }
    })();
    return;
  }

  response.writeHead(404);
  response.end();
});

const gameServer = new Server({ server: httpServer });
gameServer.define('botifarra', BotifarraRoom);
gameServer.define('practice', E2EPracticeRoom);

httpServer.listen(port, '127.0.0.1');

function createResumeSnapshot() {
  let state = createRoomState(101);
  const sessions: Record<0 | 1 | 2 | 3, string> = {} as Record<0 | 1 | 2 | 3, string>;
  const players = [
    { seat: 0, userId: 'e2e-player-id', username: 'e2e-player' },
    { seat: 1, userId: 'snapshot-player-1', username: 'Partner' },
    { seat: 2, userId: 'snapshot-player-2', username: 'Opponent A' },
    { seat: 3, userId: 'snapshot-player-3', username: 'Opponent B' },
  ] as const;

  for (const { seat, userId, username } of players) {
    const sessionId = `snapshot-session-${seat}`;
    state = assignSpecificSeat(state, sessionId, userId, username, seat).state;
    sessions[seat] = sessionId;
  }

  state = startRound(state);
  state = handleDeclareTrump(state, sessions[1], 'oros').state;

  // Save after a complete trick so resume must restore both the declared
  // trump and the in-progress round's trick count and reduced hand.
  for (let cardIndex = 0; cardIndex < 4; cardIndex++) {
    const round = state.round!;
    const seat = currentPlayerSeat(round);
    if (seat === null) throw new Error('Expected card-play phase in resume snapshot');
    const legal = legalMoves({
      hand: round.hands[seat],
      currentTrick: round.currentTrick,
      trump: round.trump!,
      playerSeat: seat,
    });
    const card = legal[0];
    if (!card) throw new Error(`No legal card available for seat ${seat}`);
    state = handlePlayCard(state, sessions[seat], card).state;
  }

  return {
    seats: Array.from(state.seats.entries()),
    game: state.game,
    round: state.round,
    phase: state.phase,
  };
}
