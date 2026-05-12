/**
 * Admin API routes.
 *
 * Protected by admin secret (env ADMIN_SECRET or 'admin-dev-secret' in dev).
 * Provides CRUD operations for users and matches administration.
 *
 * Endpoints:
 *   GET    /api/admin/users           — list all users (paginated)
 *   GET    /api/admin/users/:id       — get user details
 *   DELETE /api/admin/users/:id       — delete a user and cascade data
 *   GET    /api/admin/matches         — list matches with filters
 *   GET    /api/admin/matches/:id     — get match details
 *   DELETE /api/admin/matches/:id     — delete a match
 *   POST   /api/admin/matches/cleanup — delete stale IN_PROGRESS matches
 *   GET    /api/admin/stats           — aggregate server stats
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

const ADMIN_SECRET = process.env['ADMIN_SECRET'] ?? 'admin-dev-secret';

// ---------------------------------------------------------------------------
// Admin auth hook — checks X-Admin-Secret header
// ---------------------------------------------------------------------------

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const secret = request.headers['x-admin-secret'];
  if (secret !== ADMIN_SECRET) {
    return reply.status(403).send({ error: 'Forbidden — invalid admin secret' });
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const adminRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Apply admin guard to all routes in this plugin
  app.addHook('onRequest', requireAdmin);

  // -----------------------------------------------------------------------
  // Users
  // -----------------------------------------------------------------------

  /** GET /api/admin/users?page=1&limit=50&search=foo */
  app.get<{
    Querystring: { page?: string; limit?: string; search?: string };
  }>('/users', async (request, reply) => {
    const page = Math.max(1, parseInt(request.query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '50', 10)));
    const search = request.query.search?.trim();

    const where = search
      ? { username: { contains: search, mode: 'insensitive' as const } }
      : {};

    const [users, total] = await Promise.all([
      app.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { stats: true, matchPlayers: { select: { matchId: true } } },
      }),
      app.prisma.user.count({ where }),
    ]);

    return reply.send({
      users: users.map((u: typeof users[number]) => ({
        id: u.id,
        username: u.username,
        createdAt: u.createdAt.toISOString(),
        matchesPlayed: u.stats?.matchesPlayed ?? 0,
        matchesWon: u.stats?.matchesWon ?? 0,
        matchesLost: u.stats?.matchesLost ?? 0,
        rating: Math.round(u.stats?.individualRating ?? 1000),
        totalMatchRecords: u.matchPlayers.length,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  /** GET /api/admin/users/:id */
  app.get<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.params.id },
      include: {
        stats: true,
        matchPlayers: {
          include: { match: { select: { id: true, status: true, mode: true, createdAt: true, score0: true, score1: true } } },
          orderBy: { match: { createdAt: 'desc' } },
          take: 20,
        },
      },
    });

    if (!user) return reply.status(404).send({ error: 'User not found' });

    return reply.send({
      id: user.id,
      username: user.username,
      createdAt: user.createdAt.toISOString(),
      stats: user.stats
        ? {
            matchesPlayed: user.stats.matchesPlayed,
            matchesWon: user.stats.matchesWon,
            matchesLost: user.stats.matchesLost,
            rating: Math.round(user.stats.individualRating),
          }
        : null,
      recentMatches: user.matchPlayers.map((mp: typeof user.matchPlayers[number]) => ({
        matchId: mp.match.id,
        status: mp.match.status,
        mode: mp.match.mode,
        score: `${mp.match.score0} – ${mp.match.score1}`,
        createdAt: mp.match.createdAt.toISOString(),
      })),
    });
  });

  /** DELETE /api/admin/users/:id — cascade deletes stats + match participation */
  app.delete<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    const { id } = request.params;

    const existing = await app.prisma.user.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'User not found' });

    // Cascade: delete stats, match players, then user
    await app.prisma.matchPlayer.deleteMany({ where: { userId: id } });
    await app.prisma.userStats.deleteMany({ where: { userId: id } });
    await app.prisma.user.delete({ where: { id } });

    return reply.send({ message: `User ${existing.username} deleted`, userId: id });
  });

  // -----------------------------------------------------------------------
  // Matches
  // -----------------------------------------------------------------------

  /** GET /api/admin/matches?page=1&limit=50&status=IN_PROGRESS&mode=PUBLIC */
  app.get<{
    Querystring: { page?: string; limit?: string; status?: string; mode?: string };
  }>('/matches', async (request, reply) => {
    const page = Math.max(1, parseInt(request.query.page ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '50', 10)));

    const where: Record<string, unknown> = {};
    if (request.query.status) where.status = request.query.status;
    if (request.query.mode) where.mode = request.query.mode;

    const [matches, total] = await Promise.all([
      app.prisma.match.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          players: { include: { user: { select: { username: true } } } },
        },
      }),
      app.prisma.match.count({ where }),
    ]);

    return reply.send({
      matches: matches.map((m: typeof matches[number]) => ({
        id: m.id,
        mode: m.mode,
        status: m.status,
        score0: m.score0,
        score1: m.score1,
        winner: m.winner,
        targetScore: m.targetScore,
        createdAt: m.createdAt.toISOString(),
        finishedAt: m.finishedAt?.toISOString() ?? null,
        players: m.players.map((p: typeof m.players[number]) => ({
          userId: p.userId,
          username: p.user.username,
          seat: p.seat,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  /** GET /api/admin/matches/:id */
  app.get<{ Params: { id: string } }>('/matches/:id', async (request, reply) => {
    const match = await app.prisma.match.findUnique({
      where: { id: request.params.id },
      include: {
        players: { include: { user: { select: { id: true, username: true } } } },
        events: { orderBy: { seq: 'asc' }, take: 100 },
      },
    });

    if (!match) return reply.status(404).send({ error: 'Match not found' });

    return reply.send({
      id: match.id,
      mode: match.mode,
      status: match.status,
      score0: match.score0,
      score1: match.score1,
      winner: match.winner,
      targetScore: match.targetScore,
      createdAt: match.createdAt.toISOString(),
      finishedAt: match.finishedAt?.toISOString() ?? null,
      players: match.players.map((p: typeof match.players[number]) => ({
        userId: p.user.id,
        username: p.user.username,
        seat: p.seat,
      })),
      events: match.events.map((e: typeof match.events[number]) => ({
        seq: e.seq,
        type: e.type,
        payload: e.payload,
        createdAt: e.createdAt.toISOString(),
      })),
    });
  });

  /** DELETE /api/admin/matches/:id */
  app.delete<{ Params: { id: string } }>('/matches/:id', async (request, reply) => {
    const { id } = request.params;
    const existing = await app.prisma.match.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Match not found' });

    await app.prisma.match.delete({ where: { id } }); // cascade via schema
    return reply.send({ message: 'Match deleted', matchId: id });
  });

  /** POST /api/admin/matches/cleanup — remove stale IN_PROGRESS matches older than threshold */
  app.post<{
    Body: { olderThanMinutes?: number };
  }>('/matches/cleanup', async (request, reply) => {
    const minutes = (request.body as any)?.olderThanMinutes ?? 60;
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);

    const result = await app.prisma.match.deleteMany({
      where: {
        status: 'IN_PROGRESS',
        createdAt: { lt: cutoff },
      },
    });

    return reply.send({
      message: `Cleaned up ${result.count} stale match(es) older than ${minutes} minutes`,
      deletedCount: result.count,
    });
  });

  // -----------------------------------------------------------------------
  // Aggregate stats
  // -----------------------------------------------------------------------

  /** GET /api/admin/stats — dashboard summary */
  app.get('/stats', async (_request, reply) => {
    const [
      totalUsers,
      totalMatches,
      activeMatches,
      finishedMatches,
      recentUsers,
    ] = await Promise.all([
      app.prisma.user.count(),
      app.prisma.match.count(),
      app.prisma.match.count({ where: { status: 'IN_PROGRESS' } }),
      app.prisma.match.count({ where: { status: 'FINISHED' } }),
      app.prisma.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);

    return reply.send({
      totalUsers,
      totalMatches,
      activeMatches,
      finishedMatches,
      waitingMatches: totalMatches - activeMatches - finishedMatches,
      newUsersLast24h: recentUsers,
    });
  });
};
