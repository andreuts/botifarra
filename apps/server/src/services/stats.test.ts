import { describe, it, expect, vi } from 'vitest';
import { computePlayerStats, computeTopOpponents } from './stats.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeMatchPlayer(userId: string, seat: number, matchOverrides: Record<string, any> = {}) {
  return {
    userId,
    seat,
    match: {
      id: `match-${Math.random().toString(36).slice(2)}`,
      status: 'FINISHED',
      winner: 0,
      players: [
        { userId, seat, user: { id: userId, username: `user-${seat}` } },
        { userId: 'opp-1', seat: 1, user: { id: 'opp-1', username: 'Opp1' } },
        { userId: 'ally-2', seat: 2, user: { id: 'ally-2', username: 'Ally2' } },
        { userId: 'opp-3', seat: 3, user: { id: 'opp-3', username: 'Opp3' } },
      ],
      createdAt: new Date(),
      ...matchOverrides,
    },
  };
}

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    matchPlayer: {
      findMany: vi.fn().mockResolvedValue([
        makeMatchPlayer('u1', 0, { winner: 0 }), // won
        makeMatchPlayer('u1', 0, { winner: 1 }), // lost
        makeMatchPlayer('u1', 0, { winner: 0 }), // won
      ]),
    },
    eloHistory: {
      findMany: vi.fn().mockResolvedValue([
        { matchId: 'm1', eloAfter: 1020, eloChange: 20, isRanked: true, createdAt: new Date() },
        { matchId: 'm2', eloAfter: 1005, eloChange: -15, isRanked: true, createdAt: new Date() },
      ]),
    },
    userStats: {
      findUnique: vi.fn().mockResolvedValue({ individualRating: 1005 }),
    },
    ...overrides,
  } as any;
}

// ---------------------------------------------------------------------------
// computePlayerStats
// ---------------------------------------------------------------------------

describe('computePlayerStats', () => {
  it('computes correct totalGames, wins, losses', async () => {
    const prisma = makePrisma();
    const stats = await computePlayerStats('u1', prisma);
    expect(stats.totalGames).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
  });

  it('computes winRate correctly', async () => {
    const prisma = makePrisma();
    const stats = await computePlayerStats('u1', prisma);
    expect(stats.winRate).toBeCloseTo(2 / 3, 5);
  });

  it('returns eloHistory from prisma (reversed to oldest-first for graph)', async () => {
    const prisma = makePrisma();
    const stats = await computePlayerStats('u1', prisma);
    expect(stats.eloHistory).toHaveLength(2);
    // Mock returns [m1, m2] in DESC order → reverse() → [m2, m1] (oldest first)
    expect(stats.eloHistory[0].matchId).toBe('m2');
    expect(stats.eloHistory[1].matchId).toBe('m1');
  });

  it('returns currentElo from userStats', async () => {
    const prisma = makePrisma();
    const stats = await computePlayerStats('u1', prisma);
    expect(stats.currentElo).toBe(1005);
  });

  it('returns zero stats when no games played', async () => {
    const prisma = makePrisma({
      matchPlayer: { findMany: vi.fn().mockResolvedValue([]) },
      eloHistory: { findMany: vi.fn().mockResolvedValue([]) },
    });
    const stats = await computePlayerStats('u1', prisma);
    expect(stats.totalGames).toBe(0);
    expect(stats.wins).toBe(0);
    expect(stats.winRate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeTopOpponents
// ---------------------------------------------------------------------------

describe('computeTopOpponents', () => {
  it('returns opponents sorted by gamesPlayed desc', async () => {
    const prisma = makePrisma({
      matchPlayer: {
        findMany: vi.fn().mockResolvedValue([
          makeMatchPlayer('u1', 0, { winner: 0 }),
          makeMatchPlayer('u1', 0, { winner: 0 }),
          makeMatchPlayer('u1', 0, { winner: 1 }),
        ]),
      },
    });
    const opponents = await computeTopOpponents('u1', prisma, 'against');
    // opp-1 and opp-3 are opponents; each played 3 times
    expect(opponents.length).toBeGreaterThan(0);
    expect(opponents[0].gamesPlayed).toBeGreaterThanOrEqual(opponents[opponents.length - 1].gamesPlayed);
  });

  it('returns at most 5 entries', async () => {
    const manyMatches = Array.from({ length: 20 }, (_, i) =>
      makeMatchPlayer('u1', 0, {
        winner: 0,
        players: [
          { userId: 'u1', seat: 0, user: { id: 'u1', username: 'Me' } },
          { userId: `opp-${i}`, seat: 1, user: { id: `opp-${i}`, username: `Opp${i}` } },
          { userId: `ally-${i}`, seat: 2, user: { id: `ally-${i}`, username: `Ally${i}` } },
          { userId: `opp2-${i}`, seat: 3, user: { id: `opp2-${i}`, username: `Opp2${i}` } },
        ],
      }),
    );
    const prisma = makePrisma({
      matchPlayer: { findMany: vi.fn().mockResolvedValue(manyMatches) },
    });
    const opponents = await computeTopOpponents('u1', prisma, 'against');
    expect(opponents.length).toBeLessThanOrEqual(5);
  });

  it('computes winRateVsOpponent correctly', async () => {
    // 2 wins out of 3 games → ~0.667
    const prisma = makePrisma({
      matchPlayer: {
        findMany: vi.fn().mockResolvedValue([
          makeMatchPlayer('u1', 0, { winner: 0 }), // won vs opp-1
          makeMatchPlayer('u1', 0, { winner: 0 }), // won vs opp-1
          makeMatchPlayer('u1', 0, { winner: 1 }), // lost vs opp-1
        ]),
      },
    });
    const opponents = await computeTopOpponents('u1', prisma, 'against');
    const opp1 = opponents.find((o) => o.userId === 'opp-1');
    expect(opp1).toBeDefined();
    expect(opp1!.winRateVsOpponent).toBeCloseTo(2 / 3, 5);
  });
});
