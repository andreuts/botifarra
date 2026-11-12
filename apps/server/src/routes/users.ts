import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getTownLabel, isGameAvatarId, isKnownTownId } from '@botifarra/shared';
import type {
  HandSortDirection,
  MeResponse,
  PlayerStatsDTO,
  UpdateUserPreferencesRequest,
  UpdateUserPreferencesResponse,
  UpdateUserAvatarRequest,
  UpdateUserAvatarResponse,
  UpdateUserTownRequest,
  UpdateUserTownResponse,
  UserProfileDTO,
} from '@botifarra/shared';
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
      handSortDirection: user.handSortDirection as HandSortDirection,
      avatarId: isGameAvatarId(user.avatarId) ? user.avatarId : null,
      townId: user.townId,
      townLabel: getTownLabel(user.townId),
    };
    return reply.send(response);
  });

  // PATCH /api/users/me/preferences — update the authenticated player's preferences
  app.patch<{ Body: UpdateUserPreferencesRequest }>(
    '/me/preferences',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const handSortDirection = (request.body as Partial<UpdateUserPreferencesRequest> | undefined)
        ?.handSortDirection;
      if (handSortDirection !== 'left-to-right' && handSortDirection !== 'right-to-left') {
        return reply.status(400).send({ error: 'Invalid hand sort direction' });
      }

      const { sub: userId } = (request as any).user as { sub: string };
      const user = await app.prisma.user.update({
        where: { id: userId },
        data: { handSortDirection },
        select: { handSortDirection: true },
      });

      const response: UpdateUserPreferencesResponse = {
        handSortDirection: user.handSortDirection as HandSortDirection,
      };
      return reply.send(response);
    },
  );

  // PATCH /api/users/me/avatar — update the authenticated player's avatar
  app.patch<{ Body: UpdateUserAvatarRequest }>(
    '/me/avatar',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const avatarId = request.body?.avatarId;
      if (avatarId !== null && !isGameAvatarId(avatarId)) {
        return reply.status(400).send({ error: 'Invalid avatar selection' });
      }

      const { sub: userId } = (request as any).user as { sub: string };
      const user = await app.prisma.user.update({
        where: { id: userId },
        data: { avatarId },
        select: { avatarId: true },
      });

      const response: UpdateUserAvatarResponse = {
        avatarId: isGameAvatarId(user.avatarId) ? user.avatarId : null,
      };
      return reply.send(response);
    },
  );

  // PATCH /api/users/me/town — update the authenticated player's public town
  app.patch<{ Body: UpdateUserTownRequest }>(
    '/me/town',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const townId = request.body?.townId;
      if (!isKnownTownId(townId)) {
        return reply.status(400).send({ error: 'Town must be selected from the list' });
      }

      const { sub: userId } = (request as any).user as { sub: string };
      await app.prisma.user.update({
        where: { id: userId },
        data: { townId },
      });

      const response: UpdateUserTownResponse = {
        townId,
        townLabel: getTownLabel(townId)!,
      };
      return reply.send(response);
    },
  );

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
