import { describe, it, expect } from 'vitest';
import {
  createDeck,
  shuffleDeck,
  dealHands,
  cardPointValue,
  cardTrumpPower,
  cardSuitPower,
} from './deck.js';
import type { Card, Rank, Suit } from './types.js';

// ---------------------------------------------------------------------------
// createDeck
// ---------------------------------------------------------------------------

describe('createDeck', () => {
  it('creates exactly 48 cards', () => {
    expect(createDeck()).toHaveLength(48);
  });

  it('contains all 4 suits', () => {
    const deck = createDeck();
    const suits = new Set(deck.map((c) => c.suit));
    expect([...suits].sort()).toEqual(['bastos', 'copes', 'espases', 'oros']);
  });

  it('contains all 12 ranks for each suit', () => {
    const deck = createDeck();
    for (const suit of ['oros', 'copes', 'espases', 'bastos'] as Suit[]) {
      const ranks = deck
        .filter((c) => c.suit === suit)
        .map((c) => c.rank)
        .sort((a, b) => a - b);
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    }
  });

  it('has no duplicate cards', () => {
    const deck = createDeck();
    const ids = deck.map((c) => `${c.suit}-${c.rank}`);
    expect(new Set(ids).size).toBe(48);
  });
});

// ---------------------------------------------------------------------------
// shuffleDeck
// ---------------------------------------------------------------------------

describe('shuffleDeck', () => {
  it('returns a new array with the same 48 cards', () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    expect(shuffled).toHaveLength(48);
    // same cards regardless of order
    const sortKey = (c: Card) => `${c.suit}-${c.rank}`;
    expect([...shuffled].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))).toEqual(
      [...deck].sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
    );
  });

  it('does not mutate the original deck', () => {
    const deck = createDeck();
    const copy = [...deck];
    shuffleDeck(deck);
    expect(deck).toEqual(copy);
  });

  it('produces a different order with overwhelming probability', () => {
    // Running this once has a 1/48! chance of failing — effectively zero.
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    const sameOrder = deck.every((c, i) => shuffled[i]?.suit === c.suit && shuffled[i]?.rank === c.rank);
    expect(sameOrder).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dealHands
// ---------------------------------------------------------------------------

describe('dealHands', () => {
  it('deals exactly 12 cards to each of the 4 seats', () => {
    const deck = createDeck();
    const hands = dealHands(deck);
    for (const seat of [0, 1, 2, 3] as const) {
      expect(hands[seat]).toHaveLength(12);
    }
  });

  it('deals all 48 cards without repetition', () => {
    const deck = createDeck();
    const hands = dealHands(deck);
    const all = [...hands[0], ...hands[1], ...hands[2], ...hands[3]];
    const ids = all.map((c) => `${c.suit}-${c.rank}`);
    expect(new Set(ids).size).toBe(48);
  });

  it('deals from the top of the deck (index 0 first)', () => {
    const deck = createDeck();
    const hands = dealHands(deck);
    // Standard deal: one at a time clockwise starting at seat 0
    expect(hands[0][0]).toEqual(deck[0]);
    expect(hands[1][0]).toEqual(deck[1]);
    expect(hands[2][0]).toEqual(deck[2]);
    expect(hands[3][0]).toEqual(deck[3]);
  });
});

// ---------------------------------------------------------------------------
// cardPointValue
// ---------------------------------------------------------------------------

describe('cardPointValue', () => {
  const cases: [Rank, number][] = [
    [1, 4],   // As
    [9, 5],   // Manilla
    [12, 3],  // Rei (King)
    [11, 2],  // Cavall (Horse)
    [10, 1],  // Sota (Jack)
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
    [6, 0],
    [7, 0],
    [8, 0],
  ];

  it.each(cases)('rank %i is worth %i points', (rank, points) => {
    const card: Card = { suit: 'oros', rank };
    expect(cardPointValue(card)).toBe(points);
  });

  it('total deck point value is 60', () => {
    const total = createDeck().reduce((sum, c) => sum + cardPointValue(c), 0);
    expect(total).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// cardTrumpPower — relative strength when card IS trump
// ---------------------------------------------------------------------------

describe('cardTrumpPower', () => {
  it('Manilla (9) beats Ace (1) in trump', () => {
    expect(cardTrumpPower({ suit: 'oros', rank: 9 })).toBeGreaterThan(
      cardTrumpPower({ suit: 'oros', rank: 1 }),
    );
  });

  it('Ace (1) beats King (12) in trump', () => {
    expect(cardTrumpPower({ suit: 'oros', rank: 1 })).toBeGreaterThan(
      cardTrumpPower({ suit: 'oros', rank: 12 }),
    );
  });

  it('trump power order: 9 > 1 > 12 > 11 > 10 > 8 > 7 > 6 > 5 > 4 > 3 > 2', () => {
    const order: Rank[] = [9, 1, 12, 11, 10, 8, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < order.length - 1; i++) {
      const higher = cardTrumpPower({ suit: 'copes', rank: order[i]! });
      const lower = cardTrumpPower({ suit: 'copes', rank: order[i + 1]! });
      expect(higher).toBeGreaterThan(lower);
    }
  });
});

// ---------------------------------------------------------------------------
// cardSuitPower — relative strength in non-trump suit led
// ---------------------------------------------------------------------------

describe('cardSuitPower', () => {
  it('non-trump suit power order is identical to trump power order', () => {
    const order: Rank[] = [9, 1, 12, 11, 10, 8, 7, 6, 5, 4, 3, 2];
    for (let i = 0; i < order.length - 1; i++) {
      const higher = cardSuitPower({ suit: 'espases', rank: order[i]! });
      const lower = cardSuitPower({ suit: 'espases', rank: order[i + 1]! });
      expect(higher).toBeGreaterThan(lower);
    }
  });
});
