import { describe, it, expect, vi, beforeEach } from 'vitest';
import { finalizeMatch, updateUserStats, updateRatings } from './persistence.js';

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
      findMany: vi.fn().mockResolvedValue([
        makePlayer(0),
        makePlayer(1),
        makePlayer(2),
        makePlayer(3),
      ]),
    },
    userStats: {
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as any;
}

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
