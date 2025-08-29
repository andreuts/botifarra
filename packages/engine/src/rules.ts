import type { Card, HandState, Trump } from "./types";

const order: Record<string, number> = { "9":12, A:11, K:10, C:9, J:8, "8":7, "7":6, "6":5, "5":4, "4":3, "3":2, "2":1 };
const points: Record<string, number> = { "9":5, A:4, K:3, C:2, J:1, "8":0, "7":0, "6":0, "5":0, "4":0, "3":0, "2":0 };

export function legalPlays(state: HandState, seat: number): Card[] {
  const trick = state.currentTrick;
  const hand = state.hands[seat];
  if (trick.plays.length === 0) return hand.slice();
  const led = trick.plays[0].card.suit;
  const follow = hand.filter(c => c.suit === led);
  return follow.length ? follow : hand.slice();
}

export function winnerOf(trick: HandState["currentTrick"], trump: Trump): number {
  const led = trick.plays[0].card.suit;
  let best = trick.plays[0];
  const isTrump = (c: Card) => trump !== "BOTIFARRA" && c.suit === trump;
  for (const p of trick.plays.slice(1)) {
    const a = p.card, b = best.card;
    if (isTrump(a) && !isTrump(b)) best = p;
    else if ((isTrump(a) === isTrump(b)) &&
             ((a.suit === b.suit) && order[a.rank] > order[b.rank]) ) best = p;
    else if (!isTrump(a) && !isTrump(b) && a.suit === led && b.suit !== led) best = p;
  }
  return best.seat;
}

export function trickPoints(plays: {card: Card}[]): number {
  return plays.reduce((s,p)=>s+points[p.card.rank],0) + 1; // +1 per trick
}
