import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Prisma } from '@prisma/client';
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

function resumeGameMode(matchMode: string, snapshot: SerializableRoomSnapshot | null, fallbackPlayerCount: number) {
  if (matchMode !== 'PRACTICE') return 'botifarra';
  const humanCount = snapshot?.seats?.filter(([, player]) => !player.userId.startsWith('bot-')).length
    ?? fallbackPlayerCount;
  return humanCount > 1 ? 'practice-duo' : 'practice';
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

      let match = await app.prisma.match.findUnique({
        where: { id: matchId },
        include: { players: { include: { user: true } } },
      });

      // Older clients stored the transient Colyseus room ID instead of the
      // persistent match ID. Resolve that legacy value through the current
      // user's active matches while the room is still live.
      if (!match) {
        const candidates = await app.prisma.match.findMany({
          where: { status: 'IN_PROGRESS', players: { some: { userId } } },
          include: { players: { include: { user: true } } },
        });
        try {
          const { matchMaker } = await import('colyseus');
          for (const candidate of candidates) {
            const rooms = await matchMaker.query({ matchId: candidate.id });
            if (rooms.some((room) => room.roomId === matchId)) {
              match = candidate;
              break;
            }
          }
        } catch {
          // Legacy room IDs can only be resolved while Colyseus is available.
        }
      }

      if (!match) return reply.status(404).send({ error: 'Match not found' });

      // Must be a participant
      const myPlayer = (match.players as any[]).find((p: any) => p.userId === userId);
      if (!myPlayer) return reply.status(403).send({ error: 'Not a participant' });

      // A game can be entered before the first snapshot write finishes. Permit
      // a waiting record only when its live room can be rejoined directly.
      if (match.status !== 'IN_PROGRESS' && match.status !== 'WAITING') {
        return reply.status(409).send({ error: 'Match is not in-progress' });
      }

      // Refuse to resume matches older than 4 hours — they are considered expired
      const GAME_TIMEOUT_MS = 4 * 60 * 60 * 1000;
      if (Date.now() - match.createdAt.getTime() >= GAME_TIMEOUT_MS) {
        // Mark as finished so it no longer shows as in-progress
        await app.prisma.match.update({
          where: { id: match.id },
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
          return reply.send({
            roomId: rooms[0].roomId,
            mode: resumeGameMode(
              match.mode,
              match.lastSnapshot as unknown as SerializableRoomSnapshot | null,
              match.players.length,
            ),
          });
        }
      } catch {
        // matchMaker not available (test env) or no live room found
      }

      if (match.status !== 'IN_PROGRESS') {
        return reply.status(409).send({ error: 'Match is not in-progress' });
      }

      // Validate snapshot exists
      if (!match.lastSnapshot) {
        return reply.status(422).send({ error: 'No snapshot available for this match' });
      }

      const snapshot = match.lastSnapshot as unknown as SerializableRoomSnapshot;

      // Create a new Colyseus room with the restored snapshot
      const matchCreatedAt = match.createdAt.getTime();
      const roomType = match.mode === 'PRACTICE' ? 'practice' : 'botifarra';
      const humanPlayers = Math.max(
        1,
        snapshot.seats.filter(([, player]) => !player.userId.startsWith('bot-')).length,
      );
      const roomOptions = {
        matchId: match.id,
        targetScore: match.targetScore,
        ranked: match.ranked,
        matchCreatedAt,
        initialSnapshot: snapshot,
        matchMode: match.mode,
        persistMatch: true,
        ...(match.mode === 'PRACTICE' ? { fillBots: true, humanPlayers } : {}),
      };
      let roomId: string;
      if (app.createColyseusRoom) {
        // Test-injectable factory
        const result = await app.createColyseusRoom(roomType, roomOptions);
        roomId = result.roomId;
      } else {
        const { matchMaker } = await import('colyseus');
        const roomListing = await matchMaker.createRoom(roomType, roomOptions);
        roomId = roomListing.roomId;
      }

      return reply.send({ roomId, mode: resumeGameMode(match.mode, snapshot, match.players.length) });
    },
  );

  // POST /api/matches/:matchId/abandon — explicitly end a bot-practice game
  app.post<{ Params: { matchId: string } }>(
    '/:matchId/abandon',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };
      const { matchId } = request.params;
      const match = await app.prisma.match.findUnique({
        where: { id: matchId },
        include: { players: true },
      });

      if (!match) return reply.status(404).send({ error: 'Match not found' });
      if (!match.players.some((player) => player.userId === userId)) {
        return reply.status(403).send({ error: 'Not a participant' });
      }
      if (match.mode !== 'PRACTICE') {
        return reply.status(403).send({ error: 'Only bot-practice games can be ended this way' });
      }
      if (match.status === 'ABANDONED') return reply.send({ abandoned: true });
      if (match.status !== 'IN_PROGRESS') {
        return reply.status(409).send({ error: 'Match is not in-progress' });
      }

      const { abandonLivePracticeMatch } = await import('../rooms/BotifarraRoom.js');
      const liveResult = await abandonLivePracticeMatch(matchId, userId);
      if (liveResult === 'abandoned') {
        await app.prisma.match.update({
          where: { id: matchId },
          data: {
            status: 'ABANDONED',
            endReason: 'abandoned',
            finishedAt: new Date(),
            lastSnapshot: Prisma.JsonNull,
          },
        });
        return reply.send({ abandoned: true });
      }
      if (liveResult === 'not-active') {
        return reply.status(409).send({ error: 'Match is no longer in-progress' });
      }

      await app.prisma.match.update({
        where: { id: matchId },
        data: {
          status: 'ABANDONED',
          endReason: 'abandoned',
          finishedAt: new Date(),
          lastSnapshot: Prisma.JsonNull,
        },
      });
      return reply.send({ abandoned: true });
    },
  );
};
