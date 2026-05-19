import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { MatchDTO, MatchMode, MatchPlayerDTO, RecentGameDTO, GameOutcome } from '@botifarra/shared';
import type { Seat } from '@botifarra/core';
import type { SerializableRoomSnapshot } from '../services/persistence.js';

interface MatchPlayerRow {
  userId: string;
  seat: number;
  user: { username: string };
}

function toPlayerDTO(p: MatchPlayerRow): MatchPlayerDTO {
  return {
    userId: p.userId,
    username: p.user.username,
    seat: p.seat as Seat,
    connected: false,
  };
}

function computeOutcome(
  match: { status: string; winner: number | null },
  playerSeat: number | undefined,
): GameOutcome {
  if (match.status === 'IN_PROGRESS') return 'in-progress';
  if (match.status === 'ABANDONED') return 'abandoned';
  if (match.status === 'WAITING') return 'in-progress';
  if (match.winner === null || playerSeat === undefined) return 'draw';
  const playerTeam = playerSeat % 2 === 0 ? 0 : 1;
  if (playerTeam === match.winner) return 'won';
  return 'lost';
}

export const matchRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/matches — list recent matches for the authenticated user (max 30)
  app.get('/', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string };

    const matches = await app.prisma.match.findMany({
      where: {
        players: { some: { userId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { players: { include: { user: true } } },
    });

    const dtos: RecentGameDTO[] = matches.map((m: any) => {
      const myPlayer = (m.players as MatchPlayerRow[]).find((p) => p.userId === userId);
      const outcome = computeOutcome(m, myPlayer?.seat);
      const myTeam: 0 | 1 | null =
        myPlayer ? (myPlayer.seat % 2 === 0 ? 0 : 1) : null;

      return {
        matchId: m.id as string,
        mode: (m.mode as string).toLowerCase() as MatchMode,
        status: (m.status as string).toLowerCase() as MatchDTO['status'],
        players: (m.players as MatchPlayerRow[]).map(toPlayerDTO),
        scores: [m.score0 as number, m.score1 as number] as [number, number],
        targetScore: m.targetScore as number,
        ranked: m.ranked as boolean,
        createdAt: (m.createdAt as Date).toISOString(),
        outcome,
        myTeam,
        finishedAt: m.finishedAt ? (m.finishedAt as Date).toISOString() : null,
        hasSnapshot: m.lastSnapshot != null,
      };
    });

    return reply.send(dtos);
  });

  // GET /api/matches/:matchId
  app.get<{ Params: { matchId: string } }>(
    '/:matchId',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const match = await app.prisma.match.findUnique({
        where: { id: request.params.matchId },
        include: { players: { include: { user: true } } },
      });

      if (!match) return reply.status(404).send({ error: 'Match not found' });

      const dto: MatchDTO = {
        matchId: match.id,
        mode: match.mode.toLowerCase() as MatchMode,
        status: match.status.toLowerCase() as MatchDTO['status'],
        players: (match.players as unknown as MatchPlayerRow[]).map(toPlayerDTO),
        scores: [match.score0, match.score1],
        targetScore: match.targetScore,
        ranked: match.ranked,
        createdAt: match.createdAt.toISOString(),
      };

      return reply.send(dto);
    },
  );

  // POST /api/matches/:matchId/resume — resume an in-progress game
  app.post<{ Params: { matchId: string } }>(
    '/:matchId/resume',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };
      const { matchId } = request.params;

      const match = await app.prisma.match.findUnique({
        where: { id: matchId },
        include: { players: { include: { user: true } } },
      });

      if (!match) return reply.status(404).send({ error: 'Match not found' });

      // Must be a participant
      const myPlayer = (match.players as any[]).find((p: any) => p.userId === userId);
      if (!myPlayer) return reply.status(403).send({ error: 'Not a participant' });

      // Must be in-progress
      if (match.status !== 'IN_PROGRESS') {
        return reply.status(409).send({ error: 'Match is not in-progress' });
      }

      // Refuse to resume matches older than 4 hours — they are considered expired
      const GAME_TIMEOUT_MS = 4 * 60 * 60 * 1000;
      if (Date.now() - match.createdAt.getTime() >= GAME_TIMEOUT_MS) {
        // Mark as finished so it no longer shows as in-progress
        await app.prisma.match.update({
          where: { id: matchId },
          data: { status: 'FINISHED', endReason: 'timeout_expired', finishedAt: new Date() },
        });
        return reply.status(410).send({ error: 'Match has expired (exceeded 4-hour limit)' });
      }

      // Check if there is an existing live Colyseus room for this match
      // (try matchMaker.query — not available in test mode, so we wrap in try-catch)
      try {
        const { matchMaker } = await import('colyseus');
        const rooms = await matchMaker.query({ matchId: match.id });
        if (rooms && rooms.length > 0 && rooms[0]) {
          return reply.send({ roomId: rooms[0].roomId });
        }
      } catch {
        // matchMaker not available (test env) or no live room found
      }

      // Validate snapshot exists
      if (!match.lastSnapshot) {
        return reply.status(422).send({ error: 'No snapshot available for this match' });
      }

      const snapshot = match.lastSnapshot as unknown as SerializableRoomSnapshot;

      // Create a new Colyseus room with the restored snapshot
      const matchCreatedAt = match.createdAt.getTime();
      let roomId: string;
      if (app.createColyseusRoom) {
        // Test-injectable factory
        const result = await app.createColyseusRoom('botifarra', {
          matchId: match.id,
          targetScore: match.targetScore,
          ranked: match.ranked,
          matchCreatedAt,
          initialSnapshot: snapshot,
        });
        roomId = result.roomId;
      } else {
        const { matchMaker } = await import('colyseus');
        const roomListing = await matchMaker.createRoom('botifarra', {
          matchId: match.id,
          targetScore: match.targetScore,
          ranked: match.ranked,
          matchCreatedAt,
          initialSnapshot: snapshot,
        });
        roomId = roomListing.roomId;
      }

      return reply.send({ roomId });
    },
  );
};
