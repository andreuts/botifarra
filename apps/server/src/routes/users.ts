import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { MeResponse, UserProfileDTO, PlayerStatsDTO } from '@botifarra/shared';
import { computePlayerStats } from '../services/stats.js';

export const userRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/users/me — own profile (authenticated)
  app.get('/me', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string };

    const user = await app.prisma.user.findUnique({
      where: { id: userId },
      include: { stats: true },
    });

    if (!user) return reply.status(404).send({ error: 'User not found' });

    const response: MeResponse = {
      userId: user.id,
      username: user.username,
      createdAt: user.createdAt.toISOString(),
    };
    return reply.send(response);
  });

  // GET /api/users/me/stats — own player statistics (authenticated)
  app.get('/me/stats', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string };
    const stats: PlayerStatsDTO = await computePlayerStats(userId, app.prisma);
    return reply.send(stats);
  });

  // GET /api/users/:userId — public profile
  app.get<{ Params: { userId: string } }>('/:userId', async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.params.userId },
      include: { stats: true },
    });

    if (!user) return reply.status(404).send({ error: 'User not found' });

    const stats = user.stats;
    const response: UserProfileDTO = {
      userId: user.id,
      username: user.username,
      createdAt: user.createdAt.toISOString(),
      stats: {
        matchesPlayed: stats?.matchesPlayed ?? 0,
        matchesWon: stats?.matchesWon ?? 0,
        matchesLost: stats?.matchesLost ?? 0,
        individualRating: stats?.individualRating ?? 1000,
      },
    };
    return reply.send(response);
  });
};
