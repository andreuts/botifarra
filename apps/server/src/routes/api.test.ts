import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------

function makeMockPrisma(overrides: Record<string, any> = {}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'user-test-id',
        username: 'testuser',
        passwordHash: '$argon2id$...mocked',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    userStats: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    match: { findMany: vi.fn().mockResolvedValue([]) },
    matchPlayer: {},
    matchEvent: {},
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    ...overrides,
  } as any;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;

beforeEach(async () => {
  app = await buildApp({
    logger: false,
    jwtSecret: 'test-secret',
    prisma: makeMockPrisma(),
  });
  await app.ready();
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------

describe('POST /api/auth/register', () => {
  it('rejects short username', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'ab', password: 'password123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects short password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'validuser', password: '123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when username is taken', async () => {
    const mockPrisma = makeMockPrisma({
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'existing', username: 'taken' }),
        create: vi.fn(),
      },
    });
    const a = await buildApp({ logger: false, jwtSecret: 'test-secret', prisma: mockPrisma });
    await a.ready();
    const res = await a.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { username: 'taken', password: 'password123' },
    });
    expect(res.statusCode).toBe(409);
    await a.close();
  });
});

describe('POST /api/auth/login', () => {
  it('returns 401 for unknown user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'nobody', password: 'pass' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Protected routes — no token
// ---------------------------------------------------------------------------

describe('Protected routes without token', () => {
  it('GET /api/users/me returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/users/me' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/matches returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/matches' });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/matches/queue/join returns 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/matches/queue/join' });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Protected routes — with valid token
// ---------------------------------------------------------------------------

describe('Protected routes with valid token', () => {
  function tokenFor(userId: string, username: string, a: FastifyInstance) {
    return a.jwt.sign({ sub: userId, username }, { expiresIn: '1h' });
  }

  it('GET /api/matches returns 200 with empty array', async () => {
    const token = tokenFor('u1', 'Alice', app);
    const res = await app.inject({
      method: 'GET',
      url: '/api/matches',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('POST /api/matches/queue/join returns 202', async () => {
    const token = tokenFor('u1', 'Alice', app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/queue/join',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(202);
  });

  it('POST /api/matches/queue/join twice returns 409', async () => {
    const token = tokenFor('u2', 'Bob', app);
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

  it('POST /api/matches/queue/leave returns 200', async () => {
    const token = tokenFor('u3', 'Carol', app);
    // Join first
    await app.inject({
      method: 'POST',
      url: '/api/matches/queue/join',
      headers: { authorization: `Bearer ${token}` },
    });
    // Then leave
    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/queue/leave',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('POST /api/matches/queue/leave without joining returns 404', async () => {
    const token = tokenFor('u4', 'Dave', app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/matches/queue/leave',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Rankings
// ---------------------------------------------------------------------------

describe('GET /api/rankings', () => {
  it('returns empty array when no stats exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/rankings' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns ranked list with correct shape', async () => {
    const statsRow = {
      matchesPlayed: 10,
      matchesWon: 7,
      matchesLost: 3,
      individualRating: 1120.5,
      user: { id: 'u1', username: 'alice' },
    };
    const app2 = await (await import('../app.js')).buildApp({
      logger: false,
      jwtSecret: 'test-secret',
      prisma: makeMockPrisma({
        userStats: { findMany: vi.fn().mockResolvedValue([statsRow]) },
      }),
    });
    await app2.ready();
    const res = await app2.inject({ method: 'GET', url: '/api/rankings' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      rank: 1,
      username: 'alice',
      rating: 1121,
      matchesPlayed: 10,
      matchesWon: 7,
      winRate: 70,
    });
  });
});
