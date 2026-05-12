import { describe, it, expect } from 'vitest';
import { legalMoves } from './legal-moves.js';
import type { Card, TrickCard } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank });

// ---------------------------------------------------------------------------
// Leading a trick (empty trick — any card is legal)
// ---------------------------------------------------------------------------

describe('legalMoves — leading a trick', () => {
  it('all cards in hand are legal when no cards have been played', () => {
    const hand: Card[] = [c('oros', 1), c('copes', 3), c('espases', 9)];
    const result = legalMoves({ hand, currentTrick: [], trump: 'oros' });
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Must follow suit
// ---------------------------------------------------------------------------

describe('legalMoves — must follow suit', () => {
  it('must play the led suit when holding it', () => {
    const hand: Card[] = [c('oros', 2), c('oros', 5), c('copes', 3)];
    const trick: TrickCard[] = [{ seat: 1, card: c('oros', 6) }];
    const result = legalMoves({ hand, currentTrick: trick, trump: 'copes' });
    expect(result).toHaveLength(2);
    expect(result.every((card) => card.suit === 'oros')).toBe(true);
  });

  it('when following a trump lead, must follow trump', () => {
    const hand: Card[] = [c('oros', 2), c('oros', 7), c('copes', 4)];
    const trick: TrickCard[] = [{ seat: 0, card: c('oros', 9) }]; // oros is trump, oros led
    const result = legalMoves({ hand, currentTrick: trick, trump: 'oros' });
    // hand has oros cards → must follow (even though they can't overtrump)
    expect(result.every((card) => card.suit === 'oros')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// No led suit → must trump (if available)
// ---------------------------------------------------------------------------

describe('legalMoves — must trump when void in led suit', () => {
  it('must play trump if void in led suit and trump available', () => {
    const hand: Card[] = [c('bastos', 3), c('oros', 2), c('oros', 8)];
    const trick: TrickCard[] = [{ seat: 1, card: c('copes', 5) }];
    // espases is trump, player has no copes, has oros (non-trump) and bastos (non-trump but bastos ≠ trump)
    // Actually let's use oros as trump and player has oros cards only (besides bastos)
    const result = legalMoves({ hand, currentTrick: trick, trump: 'oros' });
    // player has no copes, has oros (trump) → must play oros
    expect(result.map((c) => c.suit)).toEqual(expect.arrayContaining(['oros']));
    expect(result.every((c) => c.suit === 'oros')).toBe(true);
  });

  it('can play any card when void in led suit and no trump', () => {
    const hand: Card[] = [c('bastos', 3), c('espases', 7)];
    const trick: TrickCard[] = [{ seat: 1, card: c('copes', 5) }];
    const result = legalMoves({ hand, currentTrick: trick, trump: 'oros' });
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Overtrump obligation
// ---------------------------------------------------------------------------

describe('legalMoves — overtrump obligation', () => {
  it('must overtrump when opponent is winning with trump and player can beat it', () => {
    // trick: opponent played oros-8 (power 7), currently winning
    // player has oros-9 (Manilla, power 12) and oros-3 (power 2) — only oros-9 can overtrump
    const trick: TrickCard[] = [{ seat: 1, card: c('oros', 8) }]; // seat 1 is on team 1 (opponent of seat 0)
    const hand: Card[] = [c('oros', 9), c('oros', 3)];
    const result = legalMoves({ hand, currentTrick: trick, trump: 'oros' });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(c('oros', 9));
  });

  it('may play any trump if unable to overtrump', () => {
    // opponent winning with Manilla (9) — player has only lower trump
    const trick: TrickCard[] = [{ seat: 1, card: c('oros', 9) }];
    const hand: Card[] = [c('oros', 2), c('oros', 3)];
    const result = legalMoves({ hand, currentTrick: trick, trump: 'oros' });
    expect(result).toHaveLength(2);
  });

  it('partner winning the trick → exempt from overtrump obligation', () => {
    // Seats: 0 and 2 are partners. seat 2 led and is winning.
    // Player at seat 0 does not need to overtrump.
    const trick: TrickCard[] = [
      { seat: 2, card: c('oros', 9) }, // partner leading with Manilla
    ];
    const hand: Card[] = [c('oros', 2), c('oros', 3)];
    // No obligation to overtrump partner — can play any trump (or even discard if void in suit)
    const result = legalMoves({ hand, currentTrick: trick, trump: 'oros', playerSeat: 0 });
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Botifarra (no trump)
// ---------------------------------------------------------------------------

describe('legalMoves — botifarra (no trump)', () => {
  it('must follow suit; no trumping obligation', () => {
    const hand: Card[] = [c('copes', 3), c('oros', 5)];
    const trick: TrickCard[] = [{ seat: 1, card: c('copes', 7) }];
    const result = legalMoves({ hand, currentTrick: trick, trump: 'botifarra' });
    expect(result).toEqual([c('copes', 3)]);
  });

  it('can play any card when void in led suit (no trump to play)', () => {
    const hand: Card[] = [c('oros', 4), c('bastos', 2)];
    const trick: TrickCard[] = [{ seat: 1, card: c('copes', 7) }];
    const result = legalMoves({ hand, currentTrick: trick, trump: 'botifarra' });
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Must-kill rule (rule 12b): when opponent is winning non-trump led suit
// ---------------------------------------------------------------------------

describe('legalMoves — must-kill for non-trump led suit', () => {
  // trump = 'oros', led suit = 'copes'
  // Opponent (seat 1) is winning with copes-7

  it('must beat opponent winning led-suit card if possible', () => {
    const trickCards: TrickCard[] = [{ seat: 1, card: c('copes', 7) }];
    // hand has copes-4 (cannot beat 7) and copes-1 (As, can beat 7)
    const hand: Card[] = [c('copes', 4), c('copes', 1)];
    const result = legalMoves({ hand, currentTrick: trickCards, trump: 'oros', playerSeat: 2 });
    // Must play copes-1 (only card that beats)
    expect(result).toEqual([c('copes', 1)]);
  });

  it('if cannot beat, can play any led-suit card', () => {
    const trickCards: TrickCard[] = [{ seat: 1, card: c('copes', 9) }]; // Manilla = highest
    const hand: Card[] = [c('copes', 4), c('copes', 7)];
    const result = legalMoves({ hand, currentTrick: trickCards, trump: 'oros', playerSeat: 2 });
    // No card can beat Manilla → play any copes
    expect(result).toHaveLength(2);
    expect(result.every((card) => card.suit === 'copes')).toBe(true);
  });

  it('partner winning → no must-kill obligation (follow suit freely)', () => {
    // seat 0 and seat 2 are partners; seat 2 is winning
    const trickCards: TrickCard[] = [
      { seat: 2, card: c('copes', 9) }, // partner leading with Manilla
    ];
    const hand: Card[] = [c('copes', 4), c('copes', 7)];
    const result = legalMoves({ hand, currentTrick: trickCards, trump: 'oros', playerSeat: 0 });
    // Partner winning → no obligation to beat, play any copes
    expect(result).toHaveLength(2);
  });

  it('opponent winning with trump → no must-kill obligation on led-suit cards', () => {
    // led suit = copes, opponent sitting at 1 ruffed with oros (trump)
    const trickCards: TrickCard[] = [
      { seat: 3, card: c('copes', 4) }, // led
      { seat: 1, card: c('oros', 2) },  // opponent trumped
    ];
    const hand: Card[] = [c('copes', 2), c('copes', 1)];
    // Cannot beat a trump with a non-trump, so just follow suit freely
    const result = legalMoves({ hand, currentTrick: trickCards, trump: 'oros', playerSeat: 0 });
    expect(result).toHaveLength(2);
  });
});
