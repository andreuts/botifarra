import { describe, it, expect } from 'vitest';
import { resolveTrick } from './trick.js';
import type { TrickCard } from './types.js';

const tc = (
  seat: TrickCard['seat'],
  suit: TrickCard['card']['suit'],
  rank: TrickCard['card']['rank'],
): TrickCard => ({ seat, card: { suit, rank } });

describe('resolveTrick — trump wins over off-suit', () => {
  it('the single trump card beats all non-trump cards', () => {
    const trick: [TrickCard, TrickCard, TrickCard, TrickCard] = [
      tc(0, 'copes', 1), // led suit
      tc(1, 'copes', 9), // highest non-trump
      tc(2, 'oros', 2), // lowest trump
      tc(3, 'copes', 12),
    ];
    expect(resolveTrick(trick, 'oros').winner).toBe(2);
  });

  it('highest trump wins when multiple trumps played', () => {
    const trick: [TrickCard, TrickCard, TrickCard, TrickCard] = [
      tc(0, 'oros', 2), // trump
      tc(1, 'oros', 9), // Manilla (highest trump)
      tc(2, 'oros', 1), // As (second highest trump)
      tc(3, 'copes', 7),
    ];
    expect(resolveTrick(trick, 'oros').winner).toBe(1);
  });
});

describe('resolveTrick — no trump played', () => {
  it('highest card of led suit wins', () => {
    const trick: [TrickCard, TrickCard, TrickCard, TrickCard] = [
      tc(0, 'copes', 3), // led
      tc(1, 'espases', 9), // different suit — doesn't win
      tc(2, 'copes', 9), // highest copes card
      tc(3, 'bastos', 1),
    ];
    expect(resolveTrick(trick, 'oros').winner).toBe(2);
  });

  it('off-suit cards never win even if high', () => {
    const trick: [TrickCard, TrickCard, TrickCard, TrickCard] = [
      tc(0, 'copes', 2), // led — lowest
      tc(1, 'oros', 9), // off-suit high card
      tc(2, 'oros', 1), // off-suit high card
      tc(3, 'copes', 3), // follows suit, higher than led
    ];
    expect(resolveTrick(trick, 'espases').winner).toBe(3);
  });
});

describe('resolveTrick — botifarra (no trump)', () => {
  it('highest card of led suit wins, no trump concept', () => {
    const trick: [TrickCard, TrickCard, TrickCard, TrickCard] = [
      tc(0, 'bastos', 3),
      tc(1, 'bastos', 9), // highest bastos
      tc(2, 'bastos', 1), // second
      tc(3, 'copes', 12),
    ];
    expect(resolveTrick(trick, 'botifarra').winner).toBe(1);
  });
});
