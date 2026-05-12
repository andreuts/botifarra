import { describe, it, expect } from 'vitest';
import { createGame, startNextRound, applyRoundScore, getGamePhase } from './game.js';
import type { RoundScore } from './types.js';

// A mock score used to drive game state
const mockScore = (mp0: number, mp1: number): RoundScore => ({
  cardPoints: [58, 58],
  capot: false,
  matchPoints: [mp0, mp1],
});

describe('createGame', () => {
  it('starts in the waiting phase', () => {
    const g = createGame({ targetScore: 12 });
    expect(getGamePhase(g)).toBe('waiting');
  });

  it('initialises scores at zero', () => {
    const g = createGame({ targetScore: 12 });
    expect(g.scores).toEqual([0, 0]);
  });

  it('dealer seat begins at 0', () => {
    const g = createGame({ targetScore: 12 });
    expect(g.dealerSeat).toBe(0);
  });
});

describe('startNextRound', () => {
  it('transitions game to in-progress', () => {
    const g = createGame({ targetScore: 12 });
    const g2 = startNextRound(g);
    expect(getGamePhase(g2)).toBe('in-progress');
  });

  it('dealer rotates clockwise each round', () => {
    let g = createGame({ targetScore: 12 });
    g = applyRoundScore(startNextRound(g), mockScore(1, 0));
    g = applyRoundScore(startNextRound(g), mockScore(1, 0));
    expect(g.dealerSeat).toBe(2);
  });
});

describe('applyRoundScore', () => {
  it('accumulates match points', () => {
    let g = createGame({ targetScore: 12 });
    g = applyRoundScore(startNextRound(g), mockScore(2, 0));
    expect(g.scores[0]).toBe(2);
    expect(g.scores[1]).toBe(0);
  });

  it('game ends when a team reaches target score', () => {
    let g = createGame({ targetScore: 4 });
    g = applyRoundScore(startNextRound(g), mockScore(4, 0));
    expect(getGamePhase(g)).toBe('finished');
    expect(g.winner).toBe(0);
  });

  it('both teams can score in the same round', () => {
    let g = createGame({ targetScore: 4 });
    g = applyRoundScore(startNextRound(g), mockScore(1, 1));
    expect(g.scores).toEqual([1, 1]);
  });

  it('throws if called when game is already finished', () => {
    let g = createGame({ targetScore: 1 });
    g = applyRoundScore(startNextRound(g), mockScore(1, 0));
    expect(() => applyRoundScore(startNextRound(g), mockScore(1, 0))).toThrow();
  });
});
