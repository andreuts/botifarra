import type { FastifyInstance } from 'fastify';

export async function rankingsRoutes(app: FastifyInstance) {
  // GET /api/rankings — top 50 players by Elo rating
  app.get('/api/rankings', async (_req, reply) => {
    const rows = await app.prisma.userStats.findMany({
      orderBy: { individualRating: 'desc' },
      take: 50,
      include: { user: { select: { id: true, username: true } } },
    });

    const rankings = rows.map((r: any , index: number) => ({
      rank: index + 1,
      userId: r.user.id,
      username: r.user.username,
      rating: Math.round(r.individualRating),
      matchesPlayed: r.matchesPlayed,
      matchesWon: r.matchesWon,
      matchesLost: r.matchesLost,
      winRate:
        r.matchesPlayed > 0 ? Math.round((r.matchesWon / r.matchesPlayed) * 100) : 0,
    }));

    return reply.send(rankings);
  });
}
