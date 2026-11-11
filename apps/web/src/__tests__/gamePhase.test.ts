import { describe, expect, it } from 'vitest';
import { getContraDecidingTeam } from '../gamePhase.js';

describe('getContraDecidingTeam', () => {
  const undecidedRound = {
    trump: 'oros' as const,
    contraLevel: 0,
    currentTrick: [],
    completedTricks: [],
    declarantSeat: 1 as const,
  };

  it('honors an explicit pass before the first card is played', () => {
    expect(getContraDecidingTeam({ ...undecidedRound, contraDecidingTeam: null })).toBeNull();
  });

  it('uses the server-provided team when a decision is pending', () => {
    expect(getContraDecidingTeam({ ...undecidedRound, contraDecidingTeam: 0 })).toBe(0);
  });

  it('derives the pending team for older state payloads', () => {
    expect(getContraDecidingTeam(undecidedRound)).toBe(0);
  });
});
