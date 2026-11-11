import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { OnlinePresenceService } from '../services/online-presence.js';

declare module 'fastify' {
  interface FastifyInstance {
    onlinePresence: OnlinePresenceService;
  }
}

export const presenceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/heartbeat', async (request, reply) => {
    const clientId = (request.body as { clientId?: unknown } | null)?.clientId;
    if (typeof clientId !== 'string' || clientId.length < 16 || clientId.length > 64) {
      return reply.status(400).send({ error: 'A valid clientId is required' });
    }

    return reply.send({ onlineUsers: app.onlinePresence.heartbeat(clientId) });
  });
};
