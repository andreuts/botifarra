import React from "react";
import ReactDOM from "react-dom/client";
import { create } from "zustand";

type Player = { id: string, name: string };
type Players = { [seat: number]: Player | undefined };

// Basic card and game types to match engine state we consume
type Suit = "OROS" | "COPES" | "ESPASES" | "BASTOS";
type Rank = "9" | "A" | "K" | "C" | "J" | "8" | "7" | "6" | "5" | "4" | "3" | "2";
type Trump = Suit | "BOTIFARRA";
type Card = { suit: Suit; rank: Rank };

type Game = {
  phase: "bidding" | "playing" | "round_finished" | "finished";
  dealer: number;
  turn: number;
  deal: { hands: Card[][] };
  bidding?: {
    bidder?: number;
    trump?: Trump;
    delegate?: boolean;
    doubles: 0 | 1 | 2 | 3;
    passes: number[];
  };
  contract?: {
    trump: Trump;
    delegated: boolean;
    doubles: number;
    bidder?: number;
  };
  currentTrick?: {
    leader: number;
    plays: { card: Card; seat: number }[];
  };
  scores: { NS: number; EW: number };
};

type S = {
  ws?: WebSocket;
  log: string[];
  roomId: string;
  you?: string;
  players: Players;
  name: string;
  game?: Game;
};

const useStore = create<S>(() => ({
  log: [],
  roomId: "demo",
  players: {},
  name: "Guest",
}));

function useWS() {
  const set = useStore.setState; const s = useStore.getState();
  React.useEffect(() => {
    const url = import.meta.env.VITE_WS_URL ?? "ws://localhost:3001/ws";
    const ws = new WebSocket(url);
    set({ ws });
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "Welcome") set({ you: msg.you });
      if (msg.type === "RoomState") set({
        players: msg.state.players,
        game: msg.state.game ?? useStore.getState().game
      });
      if (msg.type === "Error") alert(msg.message);
      if (msg.type === "StatePatch") set((s: any) => ({
        players: msg.patch.players ?? s.players,
        game: msg.patch.game ?? s.game
      }));
      set((x) => ({ log: [...x.log, e.data] }));
    };
    ws.onopen = () => ws.send(JSON.stringify({ type: "JoinRoom", roomId: s.roomId, name: s.name }));
    return () => ws.close();
  }, []);
}

function Controls() {
  const { ws, players, game } = useStore();
  if (!ws) return null;
  const seated = [0,1,2,3].every(s => !!players[s]);
  const canStart = seated && (!game || game.phase === "finished" || game.phase === "round_finished");
  const canNextRound = !!game && game.phase === "round_finished";
  return (
    <div style={{ display:"flex", gap:8, marginTop:12 }}>
      <button disabled={!canStart} onClick={()=>ws.send(JSON.stringify({ type:"StartHand" }))}>
        Start hand
      </button>
      <button disabled={!canNextRound} onClick={()=>ws.send(JSON.stringify({ type:"NextRound" }))}>
        Next round
      </button>
    </div>
  );
}

function BidPanel(){
  const [deleg, setDeleg] = React.useState(false);
  const { ws, you, players, game } = useStore();
  if (!ws) return null;

  const seatEntry = Object.entries(players).find(([_, p]) => p && p.id === you)?.[0];
  const mySeat = seatEntry ? parseInt(seatEntry, 10) : undefined;

  const bidding = game?.bidding;
  const bidder = bidding?.bidder;
  const bidderTeam = bidder != null ? (bidder % 2) : undefined;

  const canInBiddingPhase = game?.phase === "bidding";
  const myTurn = canInBiddingPhase && mySeat != null && game?.turn === mySeat;
  const canPass = !!myTurn && bidder == null;
  const canBid = !!myTurn && bidder == null;
  const canDouble =
    canInBiddingPhase && bidder != null && mySeat != null && bidderTeam != null &&
    (mySeat % 2) !== bidderTeam && bidding?.doubles === 0;
  const canRedouble =
    canInBiddingPhase && bidding?.doubles === 1 && mySeat != null && bidderTeam != null &&
    (mySeat % 2) === bidderTeam;
  const canSant =
    canInBiddingPhase && bidding?.doubles === 2 && mySeat != null && bidderTeam != null &&
    (mySeat % 2) !== bidderTeam;

  const send = (m: any) => ws.send(JSON.stringify(m));

  return (
    <div style={{ border:"1px solid #ddd", padding:12, borderRadius:8, marginTop:12, opacity: canInBiddingPhase ? 1 : 0.6 }}>
      <h3>Bidding</h3>
      <p style={{fontSize:14,opacity:0.8}}>
        Dealer: S{game?.dealer ?? "?"} · Turn: S{game?.turn ?? "?"}
      </p>
      <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
        <button disabled={!canPass} onClick={()=>send({type:"Pass"})}>Pass</button>
        <label style={{display:"flex",alignItems:"center",gap:6}}>
          <input type="checkbox" checked={deleg} onChange={(e)=>setDeleg(e.target.checked)} /> delegar
        </label>
        {(["OROS","COPES","ESPASES","BASTOS","BOTIFARRA"] as const).map(t=>(
          <button key={t} disabled={!canBid} onClick={()=>send({type:"Bid", trump: t, delegate: deleg})}>{t}</button>
        ))}
        <button disabled={!canDouble} onClick={()=>send({type:"Double", level:"CONTRAR"})}>Contro</button>
        <button disabled={!canRedouble} onClick={()=>send({type:"Double", level:"RECONTRAR"})}>Recontro</button>
        <button disabled={!canSant} onClick={()=>send({type:"Double", level:"SANT_VICENS"})}>Sant Vicenç</button>
      </div>
      <div style={{marginTop:8, fontSize:14}}>
        {bidder!=null
          ? <span>Contract: S{bidder} · {bidding?.trump} {bidding?.delegate ? "(delegat)" : ""}</span>
          : <span>No contract yet</span>}
        {" · "}Doubles: {bidding?.doubles ?? 0}
        {" · "}Passes: [{(bidding?.passes||[]).join(", ")}]
      </div>
    </div>
  );
}

function Seat({ seat }: { seat: number }){
  const { players, ws, you, game } = useStore();
  const occupant = players?.[seat];
  const takenByMe = occupant?.id === you;
  const label = ["North","East","South","West"][seat];
  const isDealer = game?.dealer === seat;
  const isTurn = game?.turn === seat;
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, minWidth: 160 }}>
      <div style={{ fontWeight: 700 }}>{label} {isDealer ? "· Dealer" : ""}</div>
      <div style={{ margin: "6px 0", minHeight: 22 }}>
        {occupant ? <span>{occupant.name} {takenByMe ? "(you)" : ""}</span> : <span style={{opacity:.6}}>empty</span>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button disabled={!!occupant && !takenByMe} onClick={() => ws?.send(JSON.stringify({ type: "Sit", seat }))}>
          {takenByMe ? "Re-sit" : "Sit"}
        </button>
        <button disabled={!takenByMe} onClick={() => ws?.send(JSON.stringify({ type: "Unsit" }))}>
          Unsit
        </button>
      </div>
      {isTurn && <div style={{marginTop:6, fontSize:12}}>← turn</div>}
    </div>
  );
}

// Compute legal plays client-side for UX (server still validates)
function getLegalPlaysLocal(game?: Game, seat?: number): Card[] {
  if (!game || game.phase !== "playing" || seat == null) return [];
  const hand = game.deal.hands[seat] || [];
  const trick = game.currentTrick;
  if (!trick || trick.plays.length === 0) return hand;
  const ledSuit = trick.plays[0].card.suit;
  const suitCards = hand.filter(c => c.suit === ledSuit);
  return suitCards.length > 0 ? suitCards : hand;
}

function Hand(){
  const { game, ws, you, players } = useStore();
  if (!game || !game.deal) return null;

  const seat = Object.entries(players).find(([_,p])=>p && p.id===you)?.[0];
  if (!seat) return null;
  const sSeat = parseInt(seat,10);
  const myHand = game.deal.hands[sSeat] || [];
  const legal = getLegalPlaysLocal(game, sSeat);
  const keyOf = (c: Card) => `${c.suit}-${c.rank}`;
  const legalSet = new Set(legal.map(keyOf));

  const canPlayNow = game.phase === "playing" && game.turn === sSeat;

  return (
    <div style={{marginTop:12}}>
      <h3>Les meves cartes</h3>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
        {myHand.map((c,i)=>{
          const isLegal = legalSet.has(keyOf(c));
          const disabled = !canPlayNow || !isLegal;
          return (
            <button key={i} disabled={disabled} onClick={()=>ws?.send(JSON.stringify({type:"PlayCard",card:c}))}>
              {c.rank} de {c.suit}
            </button>
          );
        })}
      </div>
      {game.phase !== "playing" && <div style={{marginTop:6, fontSize:12, opacity:.7}}>Waiting for bidding/play to start…</div>}
    </div>
  );
}

function TableView(){
  const { game, players } = useStore();
  if (!game) return null;
  const plays = game.currentTrick?.plays||[];
  return (
    <div style={{marginTop:16,border:"1px solid #ddd",padding:12,borderRadius:8}}>
      <h3>Taula</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12}}>
        {Object.entries(players).map(([s,p])=>(
          <div key={s} style={{border:"1px solid #ccc",borderRadius:6,padding:6}}>
            <b>Seu {s}</b>: {p? p.name: "buit"} {game.turn===parseInt(s)?" ← torn":""}
          </div>
        ))}
      </div>
      <div style={{marginTop:12}}>
        <b>Basa actual:</b>
        <div style={{display:"flex",gap:6,marginTop:4}}>
          {plays.map((pl,i)=>(<span key={i}>{pl.card.rank} de {pl.card.suit} (S{pl.seat})</span>))}
        </div>
      </div>
      {game.contract && (
        <div style={{marginTop:8,fontSize:14}}>
          Contracte: {game.contract.trump} {game.contract.delegated?"(delegat)":""} · Dobles: {game.contract.doubles}
        </div>
      )}
    </div>
  );
}

function FinishedView(){
  const { game, ws } = useStore();
  if (!game || game.phase!=="finished") return null;
  const winner = game.scores.NS>=101? "NS" : "EW";
  return (
    <div style={{marginTop:16,border:"2px solid red",padding:12,borderRadius:8}}>
      <h2>🎉 Ha guanyat la parella {winner}!</h2>
      <button onClick={()=>ws?.send(JSON.stringify({type:"StartHand"}))}>Nova partida</button>
    </div>
  );
}

function App(){
  useWS();
  const { log, roomId, you, name, game } = useStore();
  const set = useStore.setState;
  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1>Butifarra en línia</h1>
      <p style={{ opacity: 0.7, fontSize: 14 }}>room: {roomId} · you: {you ?? "…"} </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "8px 0 16px" }}>
        <label style={{ fontSize: 14 }}>Display name:</label>
        <input
          value={name}
          onChange={(e)=> set({ name: e.target.value })}
          style={{ padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6 }}
        />
        <small style={{ opacity: .7 }}>Change the text then refresh to rejoin with the new name.</small>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {[0,1,2,3].map(s => <Seat key={s} seat={s} />)}
      </div>

      <Controls />
      <BidPanel />
      <Hand />
      <TableView />
      <FinishedView />

      <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 8, padding: 8, height: 220, overflow: "auto", background: "#fafafa" }}>
        {log.map((l,i)=>(<pre key={i} style={{ margin: 0 }}>{l}</pre>))}
      </div>
      <div style={{marginTop:12}}>Marcador: NS {game?.scores?.NS??0} - EW {game?.scores?.EW??0} · Fase: {game?.phase}</div>
      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>Tip: obre una segona pestanya per veure actualitzacions en viu.</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App/>);
