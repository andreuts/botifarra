/**
 * Integration tests: API layer end-to-end flows.
 *
 * Tests the full HTTP request/response cycle through the Fastify app,
 * covering auth registration → login → queue → match flow.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Prisma mock — richer than the unit-test mock to support full flows
// ---------------------------------------------------------------------------

function makeMockPrisma() {
  const users = new Map<string, any>();
  const matches = new Map<string, any>();
  let userIdCounter = 0;

  return {
    user: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.username) return users.get(where.username) ?? null;
        if (where.id) {
          for (const u of users.values()) {
            if (u.id === where.id) return u;
          }
        }
        return null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const id = `user-${++userIdCounter}`;
        const user = {
          id,
          username: data.username,
          passwordHash: data.passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        users.set(data.username, user);
        return user;
      }),
    },
    userStats: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    match: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(async ({ where }: any) => matches.get(where.id) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const m = {
          id: data.id ?? `m-${Date.now()}`,
          mode: data.mode ?? 'PUBLIC',
          status: data.status ?? 'IN_PROGRESS',
          score0: 0,
          score1: 0,
          targetScore: 12,
          winner: null,
          createdAt: new Date(),
          finishedAt: null,
          players: data.players?.create?.map((p: any, i: number) => ({
            userId: p.userId,
            seat: p.seat ?? i,
            user: { username: `Player-${p.userId}` },
          })) ?? [],
        };
        matches.set(m.id, m);
        return m;
      }),
      update: vi.fn(),
    },
    matchPlayer: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    matchEvent: {
      create: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    _users: users,
    _matches: matches,
  } as any;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;
let mockPrisma: ReturnType<typeof makeMockPrisma>;

beforeEach(async () => {
  mockPrisma = makeMockPrisma();
  app = await buildApp({
    logger: false,
    jwtSecret: 'integration-test-secret',
    prisma: mockPrisma,
  });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tokenFor(userId: string, username: string) {
  return app.jwt.sign({ sub: userId, username }, { expiresIn: '1h' });
}

async function registerUser(username: string, password: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { username, password },
  });
  return { res, body: res.json() };
}

async function loginUser(username: string, password: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { username, password },
  });
  return { res, body: res.json() };
}

// ---------------------------------------------------------------------------
// Auth integration
// ---------------------------------------------------------------------------

describe('Integration: Auth flow', () => {
  it('registers a new user and returns userId + username', async () => {
    const { res, body } = await registerUser('testplayer', 'securepass123');
    expect(res.statusCode).toBe(201);
    expect(body).toHaveProperty('userId');
    expect(body).toHaveProperty('username', 'testplayer');
  });

  it('rejects duplicate registration', async () => {
    await registerUser('duplicate', 'password123');
    const { res } = await registerUser('duplicate', 'password123');
    expect(res.statusCode).toBe(409);
  });

  it('validates username length >= 3', async () => {
    const { res } = await registerUser('ab', 'password123');
    expect(res.statusCode).toBe(400);
  });

  it('validates password length >= 6', async () => {
    const { res } = await registerUser('validname', '123');
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Queue integration
// ---------------------------------------------------------------------------

describe('Integration: Queue flow', () => {
  it('join queue → poll status → leave queue', async () => {
    const token = tokenFor('u1', 'Alice');

    // Join (single mode — default)
    const joinRes = await app.inject({
      method: 'POST',
      url: '/api/matches/queue/join',
      headers: { authorization: `Bearer ${token}` },
      payload: { mode: 'single' },
    });
    expect(joinRes.statusCode).toBe(202);

    // Status
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/matches/queue/status',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(statusRes.statusCode).toBe(200);
    const status = statusRes.json();
    expect(status.inQueue).toBe(true);
    expect(status.queueSize).toBeGreaterThanOrEqual(1);
    expect(status.reservation).toBeUndefined();

    // Leave
    const leaveRes = await app.inject({
      method: 'POST',
      url: '/api/matches/queue/leave',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(leaveRes.statusCode).toBe(200);

    // Status after leaving
    const statusRes2 = await app.inject({
      method: 'GET',
      url: '/api/matches/queue/status',
      headers: { authorization: `Bearer ${token}` },
    });
    const status2 = statusRes2.json();
    expect(status2.inQueue).toBe(false);
  });

  it('4 singles joining triggers matchmaking', async () => {
    const tokens = [
      tokenFor('u1', 'Alice'),
      tokenFor('u2', 'Bob'),
      tokenFor('u3', 'Carol'),
      tokenFor('u4', 'Dave'),
    ];

    // All join as singles
    for (const token of tokens) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/matches/queue/join',
        headers: { authorization: `Bearer ${token}` },
        payload: { mode: 'single' },
      });
      expect(res.statusCode).toBe(202);
    }

    // Wait for async match creation
    await new Promise((r) => setTimeout(r, 100));

    // First player should have a reservation (match created with placeholder callback)
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/matches/queue/status',
      headers: { authorization: `Bearer ${tokens[0]}` },
    });
    const status = statusRes.json();
    // After match, player is no longer in queue
    expect(status.inQueue).toBe(false);
  });

  it('prevents double-joining', async () => {
    const token = tokenFor('u1', 'Alice');

    await app.inject({
      method: 'POST',
      url: '/api/matches/queue/join',
      headers: { authorization: `Bearer ${token}` },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/queue/join',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it('leaving without joining returns 404', async () => {
    const token = tokenFor('u1', 'Alice');
    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/queue/leave',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Protected route access
// ---------------------------------------------------------------------------

describe('Integration: Auth middleware', () => {
  const protectedEndpoints = [
    { method: 'GET' as const, url: '/api/matches' },
    { method: 'POST' as const, url: '/api/matches/queue/join' },
    { method: 'POST' as const, url: '/api/matches/queue/leave' },
    { method: 'GET' as const, url: '/api/matches/queue/status' },
    { method: 'GET' as const, url: '/api/users/me' },
  ];

  for (const { method, url } of protectedEndpoints) {
    it(`${method} ${url} returns 401 without token`, async () => {
      const res = await app.inject({ method, url });
      expect(res.statusCode).toBe(401);
    });
  }

  it('accepts valid JWT token', async () => {
    const token = tokenFor('u1', 'Alice');
    const res = await app.inject({
      method: 'GET',
      url: '/api/matches',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects expired token', async () => {
    // Create a token that expired 1 hour ago
    const expired = app.jwt.sign(
      { sub: 'u1', username: 'Alice', iat: Math.floor(Date.now() / 1000) - 7200 },
      { expiresIn: '1s' },
    );
    // Wait a tiny bit to ensure expiry (iat is 2h ago, expiresIn is 1s)
    const res = await app.inject({
      method: 'GET',
      url: '/api/matches',
      headers: { authorization: `Bearer ${expired}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects malformed token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/matches',
      headers: { authorization: 'Bearer invalid.token.here' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

describe('Integration: Rankings', () => {
  it('returns empty rankings when no stats exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/rankings' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns rankings sorted by rating', async () => {
    const statsData = [
      {
        matchesPlayed: 20,
        matchesWon: 15,
        matchesLost: 5,
        individualRating: 1200,
        user: { id: 'u1', username: 'topplayer' },
      },
      {
        matchesPlayed: 10,
        matchesWon: 3,
        matchesLost: 7,
        individualRating: 900,
        user: { id: 'u2', username: 'newbie' },
      },
    ];

    mockPrisma.userStats.findMany.mockResolvedValue(statsData);

    const res = await app.inject({ method: 'GET', url: '/api/rankings' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(2);
    expect(body[0].rank).toBe(1);
    expect(body[0].username).toBe('topplayer');
    expect(body[0].rating).toBe(1200);
    expect(body[1].rank).toBe(2);
    expect(body[1].username).toBe('newbie');
  });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

describe('Integration: Health', () => {
  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
