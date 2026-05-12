import { describe, it, expect } from 'vitest';
import { scoreRound } from './scoring.js';
import type { CompletedTrick, TrickCard } from './types.js';

const tc = (seat: TrickCard['seat'], suit: TrickCard['card']['suit'], rank: TrickCard['card']['rank']): TrickCard =>
  ({ seat, card: { suit, rank } });

const trick = (winner: CompletedTrick['winner'], cards: [TrickCard, TrickCard, TrickCard, TrickCard]): CompletedTrick =>
  ({ leader: cards[0]!.seat, winner, cards });

function makeZeroTricks(winnerPattern?: (0|1|2|3)[]): CompletedTrick[] {
  const pattern: (0|1|2|3)[] = winnerPattern ?? Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? 0 : 1) as 0|1|2|3);
  return pattern.map((w) => trick(w, [tc(0, 'oros', 2), tc(1, 'oros', 3), tc(2, 'oros', 4), tc(3, 'oros', 5)]));
}

describe('scoreRound — teamPoints', () => {
  it('team winning a trick earns 1 trick point', () => {
    const all0 = makeZeroTricks(Array(12).fill(0) as (0|1|2|3)[]);
    const result = scoreRound(all0, 'oros');
    expect(result.teamPoints[0]).toBe(12);
    expect(result.teamPoints[1]).toBe(0);
  });

  it('correctly accumulates card values (Manilla=5, As=4, Rei=3, Cavall=2, Sota=1)', () => {
    const valuedTrick = trick(0, [
      tc(0, 'oros', 1),   // As = 4
      tc(1, 'copes', 9),  // Manilla = 5
      tc(2, 'bastos', 12),// Rei = 3
      tc(3, 'espases', 11),// Cavall = 2
    ]);
    const rest = makeZeroTricks(Array(11).fill(1) as (0|1|2|3)[]);
    const result = scoreRound([valuedTrick, ...rest], 'oros');
    expect(result.teamPoints[0]).toBe(1 + 4 + 5 + 3 + 2); // 1 trick + 4 cards
  });
});

describe('scoreRound — matchPoints', () => {
  it('matchPoints formula: (teamPoints - 36) * multiplier for winner', () => {
    const allTeam0 = Array.from({ length: 12 }, () =>
      trick(0, [tc(0, 'oros', 9), tc(1, 'oros', 1), tc(2, 'oros', 12), tc(3, 'oros', 11)])
    );
    const result = scoreRound(allTeam0, 'oros');
    expect(result.teamPoints[0]).toBeGreaterThan(36);
    expect(result.matchPoints[0]).toBe((result.teamPoints[0] - 36) * result.multiplier);
    expect(result.matchPoints[1]).toBe(0);
  });

  it('multiplier is 1 for a normal suit trump', () => {
    expect(scoreRound(makeZeroTricks(), 'oros').multiplier).toBe(1);
  });

  it('multiplier is 2 for botifarra', () => {
    expect(scoreRound(makeZeroTricks(), 'botifarra').multiplier).toBe(2);
  });

  it('multiplier doubles with each contra level', () => {
    const tricks = makeZeroTricks();
    expect(scoreRound(tricks, 'oros', 0).multiplier).toBe(1);
    expect(scoreRound(tricks, 'oros', 1).multiplier).toBe(2);
    expect(scoreRound(tricks, 'oros', 2).multiplier).toBe(4);
    expect(scoreRound(tricks, 'oros', 3).multiplier).toBe(8);
    expect(scoreRound(tricks, 'botifarra', 1).multiplier).toBe(4);
  });

  it('neither team scores on a tie (both = 36)', () => {
    const all0 = makeZeroTricks(Array(12).fill(0) as (0|1|2|3)[]);
    const result = scoreRound(all0, 'oros');
    // 12 trick pts for team 0, no card pts ? 12 < 36, neither scores
    expect(result.matchPoints[0]).toBe(0);
    expect(result.matchPoints[1]).toBe(0);
  });

  it('requires exactly 12 completed tricks', () => {
    const tooFew = Array.from({ length: 11 }, () =>
      trick(0, [tc(0, 'oros', 2), tc(1, 'oros', 3), tc(2, 'oros', 4), tc(3, 'oros', 5)]),
    );
    expect(() => scoreRound(tooFew as CompletedTrick[], 'oros')).toThrow();
  });
});

describe('scoreRound — capot', () => {
  it('capot is true when one team wins all 12 tricks', () => {
    const all0 = makeZeroTricks(Array(12).fill(0) as (0|1|2|3)[]);
    expect(scoreRound(all0, 'oros').capot).toBe(true);
  });

  it('capot is false when tricks are split', () => {
    expect(scoreRound(makeZeroTricks(), 'oros').capot).toBe(false);
  });
});
