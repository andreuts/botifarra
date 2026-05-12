import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { MatchDTO, MatchMode, MatchPlayerDTO } from '@botifarra/shared';
import type { Seat } from '@botifarra/core';

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

export const matchRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/matches — list recent matches (authenticated)
  app.get(
    '/',
    { onRequest: [(app as any).authenticate] },
    async (_request, reply) => {
      const matches = await app.prisma.match.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { players: { include: { user: true } } },
      });

      const dtos: MatchDTO[] = matches.map((m: any) => ({
        matchId: m.id as string,
        mode: (m.mode as string).toLowerCase() as MatchMode,
        status: (m.status as string).toLowerCase() as MatchDTO['status'],
        players: (m.players as MatchPlayerRow[]).map(toPlayerDTO),
        scores: [m.score0 as number, m.score1 as number] as [number, number],
        targetScore: m.targetScore as number,
        createdAt: (m.createdAt as Date).toISOString(),
      }));

      return reply.send(dtos);
    },
  );

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
        createdAt: match.createdAt.toISOString(),
      };

      return reply.send(dto);
    },
  );
};
