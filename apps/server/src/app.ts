import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { prismaPlugin } from './plugins/prisma.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { matchRoutes } from './routes/matches.js';
import { queueRoutes } from './routes/queue.js';
import { rankingsRoutes } from './routes/rankings.js';
import { privateRoomRoutes } from './routes/rooms.js';
import { adminRoutes } from './routes/admin.js';
import { monitoringRoutes } from './routes/monitoring.js';
import { MatchmakingQueue } from './services/matchmaking.js';
import { MonitoringService } from './services/monitoring.js';
import fp from 'fastify-plugin';
import type { PrismaClient } from '@prisma/client';

export interface AppOptions {
  logger?: boolean;
  jwtSecret?: string;
  /** Provide a mock PrismaClient for testing — skips the real DB plugin */
  prisma?: PrismaClient;
  /**
   * Injectable Colyseus room factory for testing.
   * In production, this is left undefined and rooms.ts uses the real matchMaker.
   */
  createColyseusRoom?: (type: string, opts: Record<string, unknown>) => Promise<{ roomId: string }>;
}

declare module 'fastify' {
  interface FastifyInstance {
    matchmakingQueue: MatchmakingQueue;
    createColyseusRoom: ((type: string, opts: Record<string, unknown>) => Promise<{ roomId: string }>) | undefined;
  }
}

export async function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: opts.logger ?? true,
  });

  // ---------------------------------------------------------------------------
  // Plugins
  // ---------------------------------------------------------------------------

  await app.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  });

  await app.register(jwt, {
    secret: opts.jwtSecret ?? process.env['JWT_SECRET'] ?? 'change-me-in-production',
  });

  if (opts.prisma) {
    // Test mode: inject the mock directly
    await app.register(fp(async (instance) => {
      instance.decorate('prisma', opts.prisma!);
    }));
  } else {
    await app.register(prismaPlugin);
  }

  // ---------------------------------------------------------------------------
  // Auth decorator
  // ---------------------------------------------------------------------------

  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      await reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  // ---------------------------------------------------------------------------
  // Matchmaking queue
  // ---------------------------------------------------------------------------

  const queue = new MatchmakingQueue(async (players, matchId) => {
    app.log.info({ players: players.map(p => p.userId), matchId }, 'Match created by matchmaking queue');
    return new Map(); // Placeholder — replaced by index.ts once Colyseus is ready
  });
  app.decorate('matchmakingQueue', queue);
  app.decorate('createColyseusRoom', opts.createColyseusRoom ?? undefined);

  // ---------------------------------------------------------------------------
  // Monitoring service
  // ---------------------------------------------------------------------------

  const monitoringService = new MonitoringService();
  app.decorate('monitoringService', monitoringService);

  // Track request metrics for monitoring
  app.addHook('onResponse', (request, reply, done) => {
    const duration = reply.elapsedTime ?? 0;
    monitoringService.recordRequest({
      method: request.method,
      route: request.routeOptions?.url ?? request.url,
      statusCode: reply.statusCode,
      durationMs: Math.round(duration),
      timestamp: Date.now(),
    });
    done();
  });

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(matchRoutes, { prefix: '/api/matches' });
  await app.register(queueRoutes, { prefix: '/api/matches' });
  await app.register(privateRoomRoutes, { prefix: '/api/rooms' });
  await app.register(rankingsRoutes);
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(monitoringRoutes, { prefix: '/api/monitoring' });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
