import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { MatchmakingQueue } from '../services/matchmaking.js';

declare module 'fastify' {
  interface FastifyInstance {
    matchmakingQueue: MatchmakingQueue;
  }
}

export const queueRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/matches/queue/join
  app.post('/queue/join', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId, username } = (request as any).user as {
      sub: string;
      username: string;
    };

    if (!app.matchmakingQueue) {
      return reply.status(503).send({ error: 'Matchmaking not available' });
    }

    if (app.matchmakingQueue.isQueued(userId)) {
      return reply.status(409).send({ error: 'Already in queue' });
    }

    const body = request.body as { mode?: unknown; ranked?: unknown } | undefined;
    if (body?.mode === 'pair') {
      return reply.status(400).send({
        error: 'Pair matchmaking requires an accepted pair invite',
      });
    }
    if (body?.mode !== undefined && body.mode !== 'single') {
      return reply.status(400).send({ error: 'mode must be "single" or "pair"' });
    }
    const ranked = body?.ranked === true;

    // Fetch rating for ranked matchmaking
    let rating = 1000;
    if (ranked) {
      const stats = await app.prisma.userStats.findUnique({ where: { userId } });
      rating = stats?.individualRating ?? 1000;
    }

    try {
      app.matchmakingQueue.enqueueSingle(userId, username, ranked, rating);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to join queue';
      return reply.status(409).send({ error: msg });
    }

    return reply.status(202).send({
      message: 'Joined queue',
      mode: 'single',
      ranked,
      queueSize: app.matchmakingQueue.sizeForMode(ranked),
    });
  });

  // POST /api/matches/queue/leave
  app.post('/queue/leave', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string };

    if (!app.matchmakingQueue) {
      return reply.status(503).send({ error: 'Matchmaking not available' });
    }

    const removed = app.matchmakingQueue.dequeue(userId);
    if (!removed) {
      return reply.status(404).send({ error: 'Not in queue' });
    }
    return reply.send({ message: 'Left queue' });
  });

  // GET /api/matches/queue/status
  app.get('/queue/status', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string };

    const inQueue = app.matchmakingQueue?.isQueued(userId) ?? false;
    const reservation = app.matchmakingQueue?.popResolvedReservation(userId);
    const mode = inQueue ? app.matchmakingQueue?.getModeForUser(userId) : undefined;
    // Return the count for the same ranked pool the player is in (or total if not in queue)
    const ranked = inQueue ? (app.matchmakingQueue?.getRankedForUser(userId) ?? false) : false;
    const queueSize = inQueue
      ? (app.matchmakingQueue?.sizeForMode(ranked) ?? 0)
      : (app.matchmakingQueue?.size ?? 0);
    return reply.send({
      inQueue,
      ...(mode ? { mode } : {}),
      ranked,
      queueSize,
      ...(reservation ? { reservation } : {}),
    });
  });
};
