import { describe, it, expect, vi, beforeEach } from 'vitest';
import { finalizeMatch, updateUserStats, updateRatings, serializeSnapshot, deserializeSnapshot, saveGameSnapshot } from './persistence.js';
import type { RoomGameState } from '../rooms/game-logic.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlayer(seat: number, rating = 1000) {
  return {
    seat,
    userId: `user-${seat}`,
    user: {
      stats: { individualRating: rating },
    },
  };
}

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    match: {
      update: vi.fn().mockResolvedValue({}),
    },
    matchPlayer: {
      findMany: vi
        .fn()
        .mockResolvedValue([makePlayer(0), makePlayer(1), makePlayer(2), makePlayer(3)]),
    },
    userStats: {
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    eloHistory: {
      create: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as any;
}

// ---------------------------------------------------------------------------
// serializeSnapshot / deserializeSnapshot
// ---------------------------------------------------------------------------

function makeRoomGameState(): RoomGameState {
  const seats = new Map();
  seats.set(0, { userId: 'u1', username: 'Alice', sessionId: 's1', connected: true });
  seats.set(1, { userId: 'u2', username: 'Bob', sessionId: 's2', connected: false });
  return {
    seats,
    game: { roundNumber: 3, scores: [8, 6], targetScore: 101 } as any,
    round: null,
    phase: 'playing',
  };
}

describe('serializeSnapshot', () => {
  it('converts Map seats to array', () => {
    const state = makeRoomGameState();
    const snap = serializeSnapshot(state);
    expect(Array.isArray(snap.seats)).toBe(true);
    expect(snap.seats).toHaveLength(2);
    expect(snap.phase).toBe('playing');
  });

  it('preserves game and round data', () => {
    const state = makeRoomGameState();
    const snap = serializeSnapshot(state);
    expect((snap.game as any).roundNumber).toBe(3);
    expect(snap.round).toBeNull();
  });
});

describe('deserializeSnapshot', () => {
  it('converts array seats back to Map', () => {
    const state = makeRoomGameState();
    const snap = serializeSnapshot(state);
    const restored = deserializeSnapshot(snap);
    expect(restored.seats).toBeInstanceOf(Map);
    expect(restored.seats.size).toBe(2);
  });

  it('round-trips state losslessly', () => {
    const state = makeRoomGameState();
    const snap = serializeSnapshot(state);
    const restored = deserializeSnapshot(snap);
    expect(restored.phase).toBe(state.phase);
    expect(restored.seats.get(0)?.userId).toBe('u1');
    expect(restored.seats.get(1)?.connected).toBe(false);
    expect((restored.game as any).roundNumber).toBe(3);
  });
});

describe('saveGameSnapshot', () => {
  it('calls prisma.match.update with serialized snapshot', async () => {
    const state = makeRoomGameState();
    const prisma = makePrisma();
    await saveGameSnapshot(prisma, 'match-1', state);
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: expect.objectContaining({
        lastSnapshot: expect.objectContaining({ phase: 'playing' }),
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// finalizeMatch
// ---------------------------------------------------------------------------

describe('finalizeMatch', () => {
  it('updates match with FINISHED status, scores and winner', async () => {
    const prisma = makePrisma();
    await finalizeMatch(prisma, 'match-1', 12, 8, 0);
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: expect.objectContaining({
        status: 'FINISHED',
        score0: 12,
        score1: 8,
        winner: 0,
        finishedAt: expect.any(Date),
      }),
    });
  });
});

// ---------------------------------------------------------------------------
// updateUserStats
// ---------------------------------------------------------------------------

describe('updateUserStats', () => {
  it('upserts stats for all 4 players', async () => {
    const prisma = makePrisma();
    await updateUserStats(prisma, 'match-1', 0);
    expect(prisma.userStats.upsert).toHaveBeenCalledTimes(4);
  });

  it('marks seats 0 and 2 as won when winner is team 0', async () => {
    const prisma = makePrisma();
    await updateUserStats(prisma, 'match-1', 0);
    const calls = (prisma.userStats.upsert as ReturnType<typeof vi.fn>).mock.calls;

    // Seats 0 and 2 → team 0 → won=true
    for (const [call] of calls) {
      const userId = call.where.userId as string;
      const seat = parseInt(userId.replace('user-', ''));
      const isWinner = seat % 2 === 0;
      expect(call.create.matchesWon).toBe(isWinner ? 1 : 0);
      expect(call.create.matchesLost).toBe(isWinner ? 0 : 1);
    }
  });
});

// ---------------------------------------------------------------------------
// updateRatings
// ---------------------------------------------------------------------------

describe('updateRatings', () => {
  it('updates rating for each player that has stats', async () => {
    const prisma = makePrisma();
    await updateRatings(prisma, 'match-1', 0);
    expect(prisma.userStats.update).toHaveBeenCalledTimes(4);
  });

  it('increases rating for winners and decreases for losers', async () => {
    const prisma = makePrisma();
    await updateRatings(prisma, 'match-1', 0);
    const calls = (prisma.userStats.update as ReturnType<typeof vi.fn>).mock.calls;

    for (const [call] of calls) {
      const userId = call.where.userId as string;
      const seat = parseInt(userId.replace('user-', ''));
      const isWinner = seat % 2 === 0;
      const newRating = call.data.individualRating as number;
      if (isWinner) {
        expect(newRating).toBeGreaterThan(1000);
      } else {
        expect(newRating).toBeLessThan(1000);
      }
    }
  });
});
