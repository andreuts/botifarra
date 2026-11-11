import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { OnlinePresenceService } from '../services/online-presence.js';

declare module 'fastify' {
  interface FastifyInstance {
    onlinePresence: OnlinePresenceService;
  }
}

export const presenceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/heartbeat', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string };
    if (!userId) return reply.status(401).send({ error: 'Authentication required' });

    return reply.send({ onlineUsers: app.onlinePresence.heartbeat(userId) });
  });
};
