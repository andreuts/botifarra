import type { FastifyInstance } from 'fastify';

export async function rankingsRoutes(app: FastifyInstance) {
  // GET /api/rankings — paginated standings ordered by the selected statistic
  app.get('/api/rankings', async (req, reply) => {
    const query = req.query as { sort?: string; page?: string; pageSize?: string };
    const requestedSort = query.sort;
    const sort = requestedSort === 'wins' || requestedSort === 'games' || requestedSort === 'winRate'
      ? requestedSort
      : 'rating';
    const requestedPageSize = Number(query.pageSize);
    const pageSize = requestedPageSize === 50 || requestedPageSize === 100 ? requestedPageSize : 20;
    const totalResult = typeof app.prisma.userStats.count === 'function'
      ? await app.prisma.userStats.count()
      : undefined;
    const total = typeof totalResult === 'number' && Number.isSafeInteger(totalResult) && totalResult >= 0
      ? totalResult
      : undefined;
    const requestedPage = Number(query.page);
    const maxPage = total === undefined ? Number.MAX_SAFE_INTEGER : Math.max(1, Math.ceil(total / pageSize));
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, maxPage)
      : 1;
    const skip = (page - 1) * pageSize;
    let rows: any[];
    if (typeof app.prisma.$queryRaw === 'function') {
      rows = await app.prisma.$queryRaw<any[]>`
      SELECT
        stats."userId" AS "userId",
        users.username AS username,
        stats."individualRating" AS "individualRating",
        stats."matchesPlayed" AS "matchesPlayed",
        stats."matchesWon" AS "matchesWon",
        stats."matchesLost" AS "matchesLost"
      FROM "user_stats" AS stats
      INNER JOIN "users" AS users ON users.id = stats."userId"
      ORDER BY
        CASE WHEN ${sort} = 'rating' THEN stats."individualRating"::double precision END DESC NULLS LAST,
        CASE WHEN ${sort} = 'wins' THEN stats."matchesWon"::double precision END DESC NULLS LAST,
        CASE WHEN ${sort} = 'games' THEN stats."matchesPlayed"::double precision END DESC NULLS LAST,
        CASE
          WHEN ${sort} = 'winRate' THEN
            CASE
              WHEN stats."matchesPlayed" > 0
                THEN stats."matchesWon"::double precision / stats."matchesPlayed"
              ELSE 0
            END
        END DESC NULLS LAST,
        stats."individualRating" DESC,
        stats."matchesWon" DESC,
        users.username ASC
      LIMIT ${pageSize}
      OFFSET ${skip}
    `;
    } else {
      const orderBy = sort === 'wins'
        ? [{ matchesWon: 'desc' as const }, { individualRating: 'desc' as const }]
        : sort === 'games'
          ? [{ matchesPlayed: 'desc' as const }, { individualRating: 'desc' as const }]
          : [{ individualRating: 'desc' as const }, { matchesWon: 'desc' as const }];
      const fallbackRows = await app.prisma.userStats.findMany({
        orderBy,
        ...(sort !== 'winRate' ? { skip, take: pageSize } : {}),
        include: { user: { select: { id: true, username: true } } },
      });
      rows = sort === 'winRate'
        ? [...fallbackRows]
            .sort((a: any, b: any) => {
              const aRate = a.matchesPlayed > 0 ? a.matchesWon / a.matchesPlayed : 0;
              const bRate = b.matchesPlayed > 0 ? b.matchesWon / b.matchesPlayed : 0;
              return bRate - aRate || b.individualRating - a.individualRating;
            })
            .slice(skip, skip + pageSize)
        : fallbackRows;
    }

    reply.header('X-Total-Count', String(total ?? rows.length));

    const rankings = rows.map((r: any, index: number) => ({
      rank: skip + index + 1,
      userId: r.user?.id ?? r.userId,
      username: r.user?.username ?? r.username,
      rating: Math.round(r.individualRating),
      matchesPlayed: r.matchesPlayed,
      matchesWon: r.matchesWon,
      matchesLost: r.matchesLost,
      winRate: r.matchesPlayed > 0 ? Math.round((r.matchesWon / r.matchesPlayed) * 100) : 0,
    }));

    return reply.send(rankings);
  });
}
