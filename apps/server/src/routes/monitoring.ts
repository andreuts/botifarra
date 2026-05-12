/**
 * Monitoring API routes.
 *
 * Protected by admin secret (same as admin routes).
 * Serves real-time server metrics snapshot.
 *
 * Endpoints:
 *   GET /api/monitoring/snapshot — full server metrics snapshot
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import type { MonitoringService } from '../services/monitoring.js';

declare module 'fastify' {
  interface FastifyInstance {
    monitoringService: MonitoringService;
  }
}

const ADMIN_SECRET = process.env['ADMIN_SECRET'] ?? 'admin-dev-secret';

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const secret = request.headers['x-admin-secret'];
  if (secret !== ADMIN_SECRET) {
    return reply.status(403).send({ error: 'Forbidden — invalid admin secret' });
  }
}

export const monitoringRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.addHook('onRequest', requireAdmin);

  /** GET /api/monitoring/snapshot */
  app.get('/snapshot', async (_request, reply) => {
    // Get Colyseus room info if available
    let roomList: { roomId: string; name: string; clients: number; maxClients: number; createdAt: string }[] = [];
    try {
      const { matchMaker } = await import('colyseus');
      const rooms = await matchMaker.query({});
      roomList = rooms.map((r: any) => ({
        roomId: r.roomId,
        name: r.name ?? 'unknown',
        clients: r.clients ?? 0,
        maxClients: r.maxClients ?? 4,
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      }));
    } catch {
      // matchMaker not available (e.g. in tests)
    }

    const queueInfo = {
      size: app.matchmakingQueue?.size ?? 0,
      singles: app.matchmakingQueue?.singleCount ?? 0,
      pairs: app.matchmakingQueue?.pairCount ?? 0,
    };

    const snapshot = app.monitoringService.getSnapshot(queueInfo, roomList);
    return reply.send(snapshot);
  });
};
