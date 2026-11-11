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
    expect(result).toEqual([c('oros', 2)]);
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

  it('must play the lowest card of each available suit when unable to win', () => {
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

  it('must play the lowest trump if unable to overtrump', () => {
    // opponent winning with Manilla (9) — player has only lower trump
    const trick: TrickCard[] = [{ seat: 1, card: c('oros', 9) }];
    const hand: Card[] = [c('oros', 2), c('oros', 3)];
    const result = legalMoves({ hand, currentTrick: trick, trump: 'oros' });
    expect(result).toEqual([c('oros', 2)]);
  });

  it('partner winning the trick → apply the lowest-card rule if not overtaking', () => {
    // Seats: 0 and 2 are partners. seat 2 led and is winning.
    // Player at seat 0 does not need to overtrump.
    const trick: TrickCard[] = [
      { seat: 2, card: c('oros', 9) }, // partner leading with Manilla
    ];
    const hand: Card[] = [c('oros', 2), c('oros', 3)];
    // No obligation to overtrump partner, but a non-winning play must be lowest or count.
    const result = legalMoves({ hand, currentTrick: trick, trump: 'oros', playerSeat: 0 });
    expect(result).toEqual([c('oros', 2)]);
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

  it('must play the lowest card of each available suit when void in the led suit', () => {
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

  it('if unable to beat, must play the lowest card in the led suit', () => {
    const trickCards: TrickCard[] = [{ seat: 1, card: c('copes', 9) }]; // Manilla = highest
    const hand: Card[] = [c('copes', 4), c('copes', 7)];
    const result = legalMoves({ hand, currentTrick: trickCards, trump: 'oros', playerSeat: 2 });
    // No card can beat Manilla → play the lowest copes
    expect(result).toEqual([c('copes', 4)]);
  });

  it('partner winning → may avoid overtaking only with a counting card or the lowest card', () => {
    // seat 0 and seat 2 are partners; seat 2 is winning
    const trickCards: TrickCard[] = [
      { seat: 2, card: c('copes', 9) }, // partner leading with Manilla
    ];
    const hand: Card[] = [c('copes', 4), c('copes', 7)];
    const result = legalMoves({ hand, currentTrick: trickCards, trump: 'oros', playerSeat: 0 });
    // Partner winning → the only non-winning play here is the lowest copes
    expect(result).toEqual([c('copes', 4)]);
  });

  it('opponent winning with trump → follow suit and play its lowest card if unable to win', () => {
    // led suit = copes, opponent sitting at 1 ruffed with oros (trump)
    const trickCards: TrickCard[] = [
      { seat: 3, card: c('copes', 4) }, // led
      { seat: 1, card: c('oros', 2) }, // opponent trumped
    ];
    const hand: Card[] = [c('copes', 2), c('copes', 1)];
    // Cannot beat a trump with a non-trump, so follow suit and play the lowest copes
    const result = legalMoves({ hand, currentTrick: trickCards, trump: 'oros', playerSeat: 0 });
    expect(result).toEqual([c('copes', 2)]);
  });
});
