import { describe, it, expect } from 'vitest';
import { randomBotMove, randomBotDeclareTrump } from './bot.js';
import { createRound, declareTrump, currentPlayerSeat } from './round.js';
import { createDeck, shuffleDeck, dealHands } from './deck.js';
import { legalMoves } from './legal-moves.js';
import type { RoundState, Seat } from './types.js';

function freshPlayingRound(): RoundState {
  const hands = dealHands(shuffleDeck(createDeck()));
  const r = createRound({ dealerSeat: 0, hands });
  return declareTrump(r, 'oros');
}

describe('randomBotDeclareTrump', () => {
  it('returns a valid TrumpDeclaration (suit or botifarra)', () => {
    const hands = dealHands(shuffleDeck(createDeck()));
    const r = createRound({ dealerSeat: 0, hands });
    const decl = randomBotDeclareTrump(r);
    const valid = ['oros', 'copes', 'espases', 'bastos', 'botifarra'];
    expect(valid).toContain(decl);
  });
});

describe('randomBotMove', () => {
  it('returns a card that is in the legal moves list', () => {
    const r = freshPlayingRound();
    const seat = currentPlayerSeat(r) as Seat;
    const card = randomBotMove(r, seat);
    const legal = legalMoves({
      hand: r.hands[seat],
      currentTrick: r.currentTrick,
      trump: r.trump!,
      playerSeat: seat,
    });
    const isLegal = legal.some((c) => c.suit === card.suit && c.rank === card.rank);
    expect(isLegal).toBe(true);
  });

  it('throws when called for wrong phase', () => {
    const hands = dealHands(shuffleDeck(createDeck()));
    const r = createRound({ dealerSeat: 0, hands }); // declaring phase
    expect(() => randomBotMove(r, 0)).toThrow();
  });

  it('always returns a card over many invocations', () => {
    const r = freshPlayingRound();
    const seat = currentPlayerSeat(r) as Seat;
    for (let i = 0; i < 50; i++) {
      const card = randomBotMove(r, seat);
      expect(card).toBeDefined();
      expect(card.suit).toBeDefined();
      expect(card.rank).toBeDefined();
    }
  });
});
