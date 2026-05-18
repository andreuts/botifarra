import { describe, it, expect } from 'vitest';
import { heuristicBotMove, heuristicBotDeclareTrump } from './heuristic-bot.js';
import { randomBotMove } from './bot.js';
import { createDeck, shuffleDeck, dealHands } from './deck.js';
import { createRound, declareTrump, playCard, currentPlayerSeat } from './round.js';
import { legalMoves } from './legal-moves.js';
import { scoreRound } from './scoring.js';
import type { RoundState, Seat } from './types.js';

function freshRound(): RoundState {
  const hands = dealHands(shuffleDeck(createDeck()));
  return declareTrump(createRound({ dealerSeat: 0, hands }), 'oros');
}

describe('heuristicBotDeclareTrump', () => {
  it('returns a valid declaration', () => {
    for (let i = 0; i < 20; i++) {
      const hands = dealHands(shuffleDeck(createDeck()));
      const r = createRound({ dealerSeat: 0, hands });
      const decl = heuristicBotDeclareTrump(r, r.declarantSeat);
      const valid = ['oros', 'copes', 'espases', 'bastos', 'botifarra'];
      expect(valid).toContain(decl);
    }
  });
});

describe('heuristicBotMove', () => {
  it('always returns a legal card', () => {
    for (let i = 0; i < 10; i++) {
      const r = freshRound();
      const seat = currentPlayerSeat(r) as Seat;
      const card = heuristicBotMove(r, seat);
      const legal = legalMoves({
        hand: r.hands[seat],
        currentTrick: r.currentTrick,
        trump: r.trump!,
        playerSeat: seat,
      });
      expect(legal.some((c) => c.suit === card.suit && c.rank === card.rank)).toBe(true);
    }
  });

  it('plays a full round — 48 cards, all legal', () => {
    let r = freshRound();
    for (let i = 0; i < 48; i++) {
      const seat = currentPlayerSeat(r) as Seat;
      const card = heuristicBotMove(r, seat);
      const legal = legalMoves({
        hand: r.hands[seat],
        currentTrick: r.currentTrick,
        trump: r.trump!,
        playerSeat: seat,
      });
      expect(legal.some((c) => c.suit === card.suit && c.rank === card.rank)).toBe(true);
      r = playCard(r, seat, card);
    }
    expect(r.completedTricks).toHaveLength(12);
  });

  it('throws when called outside playing phase', () => {
    const hands = dealHands(shuffleDeck(createDeck()));
    const r = createRound({ dealerSeat: 0, hands });
    expect(() => heuristicBotMove(r, 0)).toThrow();
  });

  it('throws when called on wrong seat', () => {
    const r = freshRound();
    const seat = currentPlayerSeat(r) as Seat;
    const wrongSeat = ((seat + 1) % 4) as Seat;
    expect(() => heuristicBotMove(r, wrongSeat)).toThrow();
  });

  it('heuristic bot scores at least as many card-points as random over 30 rounds (statistical)', () => {
    let heuristicCardPoints = 0;
    let randomCardPoints = 0;

    for (let g = 0; g < 30; g++) {
      let r = freshRound();
      while (r.completedTricks.length < 12) {
        const seat = currentPlayerSeat(r) as Seat;
        // Heuristic = team 0 (seats 0 & 2), random = team 1 (seats 1 & 3)
        const card = seat === 0 || seat === 2 ? heuristicBotMove(r, seat) : randomBotMove(r, seat);
        r = playCard(r, seat, card);
      }
      const score = scoreRound(r.completedTricks, r.trump!);
      heuristicCardPoints += score.teamPoints[0];
      randomCardPoints += score.teamPoints[1];
    }

    // Over 30 rounds the heuristic team should outscore random. Allow some variance.
    expect(heuristicCardPoints).toBeGreaterThan(randomCardPoints * 0.75);
  });
});
