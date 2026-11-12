import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import multipart from '@fastify/multipart';
import { join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { prismaPlugin } from './plugins/prisma.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { matchRoutes } from './routes/matches.js';
import { queueRoutes } from './routes/queue.js';
import { rankingsRoutes } from './routes/rankings.js';
import { privateRoomRoutes } from './routes/rooms.js';
import { adminRoutes } from './routes/admin.js';
import { monitoringRoutes } from './routes/monitoring.js';
import { friendsRoutes } from './routes/friends.js';
import { pairInviteRoutes } from './routes/pair-invite.js';
import { tournamentRoutes } from './routes/tournaments.js';
import { newsRoutes } from './routes/news.js';
import { bugReportRoutes } from './routes/bug-reports.js';
import { presenceRoutes } from './routes/presence.js';
import { MatchmakingQueue } from './services/matchmaking.js';
import { MonitoringService } from './services/monitoring.js';
import { OnlinePresenceService } from './services/online-presence.js';
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
    createColyseusRoom:
      | ((type: string, opts: Record<string, unknown>) => Promise<{ roomId: string }>)
      | undefined;
  }
}

export async function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: opts.logger ?? true,
  });

  // ---------------------------------------------------------------------------
  // Plugins
  // ---------------------------------------------------------------------------

  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });

  await app.register(cors, {
    origin:
      process.env['CORS_ORIGIN'] ??
      (process.env['NODE_ENV'] === 'production' ? true : 'http://localhost:5173'),
    credentials: true,
  });

  const jwtSecret = opts.jwtSecret ?? process.env['JWT_SECRET']?.trim();
  if (process.env['NODE_ENV'] === 'production' && !jwtSecret) {
    throw new Error('JWT_SECRET must be set in production');
  }
  await app.register(jwt, {
    secret: jwtSecret ?? 'change-me-in-production',
  });

  if (opts.prisma) {
    // Test mode: inject the mock directly
    await app.register(
      fp(async (instance) => {
        instance.decorate('prisma', opts.prisma!);
      }),
    );
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
    app.log.info(
      { players: players.map((p) => p.userId), matchId },
      'Match created by matchmaking queue',
    );
    return new Map(); // Placeholder — replaced by index.ts once Colyseus is ready
  });
  app.decorate('matchmakingQueue', queue);
  app.decorate('createColyseusRoom', opts.createColyseusRoom ?? undefined);

  // ---------------------------------------------------------------------------
  // Monitoring service
  // ---------------------------------------------------------------------------

  const monitoringService = new MonitoringService();
  app.decorate('monitoringService', monitoringService);

  const onlinePresence = new OnlinePresenceService();
  app.decorate('onlinePresence', onlinePresence);

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
  await app.register(friendsRoutes, { prefix: '/api/friends' });
  await app.register(pairInviteRoutes, { prefix: '/api/pair-invite' });
  await app.register(tournamentRoutes, { prefix: '/api/tournaments' });
  await app.register(rankingsRoutes);
  await app.register(adminRoutes, { prefix: '/api/admin' });
  await app.register(newsRoutes, { prefix: '/api/news' });
  await app.register(bugReportRoutes, { prefix: '/api/bugs' });
  await app.register(presenceRoutes, { prefix: '/api/presence' });
  await app.register(monitoringRoutes, { prefix: '/api/monitoring' });

  // Health check
  app.get('/health', async () => ({ status: 'ok' }));

  // ---------------------------------------------------------------------------
  // Static files — serve uploaded images from /uploads
  // ---------------------------------------------------------------------------

  const uploadsDir = resolve(process.env['UPLOADS_DIR'] ?? join(process.cwd(), 'uploads'));
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: uploadsDir,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // ---------------------------------------------------------------------------
  // Static files — serve the web app in production
  // ---------------------------------------------------------------------------

  if (process.env['NODE_ENV'] === 'production') {
    // In Docker the web build lives at /app/apps/web/dist
    // In a local production build it's at ../../web/dist relative to server dist
    const webDistDir = resolve(
      process.env['WEB_DIST_DIR'] ?? join(__dirname, '..', '..', 'web', 'dist'),
    );

    if (existsSync(webDistDir)) {
      // Revalidate stable app-shell and service-worker URLs after each deployment.
      // Vite's content-hashed bundles can be cached for a year safely.
      app.addHook('onSend', (request, reply, payload, done) => {
        const pathname = request.url.split('?')[0] ?? '';
        const isApi = pathname === '/api' || pathname.startsWith('/api/');
        const isRealtime = pathname === '/colyseus' || pathname.startsWith('/colyseus/');
        const isUpload = pathname === '/uploads' || pathname.startsWith('/uploads/');

        if (request.method !== 'GET' || isApi || isRealtime || isUpload) {
          done(null, payload);
          return;
        }

        reply.header(
          'Cache-Control',
          pathname.startsWith('/assets/')
            ? 'public, max-age=31536000, immutable'
            : 'no-cache, must-revalidate',
        );
        done(null, payload);
      });

      await app.register(fastifyStatic, {
        root: webDistDir,
        prefix: '/',
        wildcard: false,
      });

      // SPA fallback: any non-API, non-asset GET returns index.html
      app.setNotFoundHandler(async (request, reply) => {
        if (
          request.method === 'GET' &&
          !request.url.startsWith('/api') &&
          !request.url.startsWith('/colyseus')
        ) {
          return reply.sendFile('index.html');
        }
        return reply.status(404).send({ error: 'Not found' });
      });
    }
  }

  return app;
}
