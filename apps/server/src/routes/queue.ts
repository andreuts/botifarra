import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { MatchmakingQueue } from '../services/matchmaking.js';

declare module 'fastify' {
  interface FastifyInstance {
    matchmakingQueue: MatchmakingQueue;
  }
}

export const queueRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/matches/queue/join
  app.post(
    '/queue/join',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
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

      const body = request.body as { mode?: string; partnerId?: string; partnerUsername?: string } | undefined;
      const mode = body?.mode === 'pair' ? 'pair' : 'single';

      try {
        if (mode === 'pair') {
          const partnerId = body?.partnerId;
          const partnerUsername = body?.partnerUsername;
          if (!partnerId || !partnerUsername) {
            return reply.status(400).send({ error: 'partnerId and partnerUsername are required for pair queue' });
          }
          app.matchmakingQueue.enqueuePair(
            { userId, username },
            { userId: partnerId, username: partnerUsername },
          );
        } else {
          app.matchmakingQueue.enqueueSingle(userId, username);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to join queue';
        return reply.status(409).send({ error: msg });
      }

      return reply.status(202).send({
        message: 'Joined queue',
        mode,
        queueSize: app.matchmakingQueue.size,
      });
    },
  );

  // POST /api/matches/queue/leave
  app.post(
    '/queue/leave',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };

      if (!app.matchmakingQueue) {
        return reply.status(503).send({ error: 'Matchmaking not available' });
      }

      const removed = app.matchmakingQueue.dequeue(userId);
      if (!removed) {
        return reply.status(404).send({ error: 'Not in queue' });
      }
      return reply.send({ message: 'Left queue' });
    },
  );

  // GET /api/matches/queue/status
  app.get(
    '/queue/status',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };

      const inQueue = app.matchmakingQueue?.isQueued(userId) ?? false;
      const reservation = app.matchmakingQueue?.popResolvedReservation(userId);
      return reply.send({
        inQueue,
        queueSize: app.matchmakingQueue?.size ?? 0,
        ...(reservation ? { reservation } : {}),
      });
    },
  );
};
