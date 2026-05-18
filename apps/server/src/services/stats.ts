import type { PrismaClient } from '@prisma/client';
import type { PlayerStatsDTO, EloSnapshotDTO, TopPlayerEntryDTO } from '@botifarra/shared';

// ---------------------------------------------------------------------------
// computePlayerStats — aggregate stats for one player from the last 30 games
// ---------------------------------------------------------------------------

export async function computePlayerStats(
  userId: string,
  prisma: PrismaClient,
): Promise<PlayerStatsDTO> {
  // Fetch last 30 matches the player participated in (finished only for win/loss)
  const matchPlayers = await prisma.matchPlayer.findMany({
    where: { userId },
    include: {
      match: {
        include: { players: { include: { user: { select: { id: true, username: true } } } } },
      },
    },
    orderBy: { match: { createdAt: 'desc' } },
    take: 30,
  });

  let wins = 0;
  let losses = 0;
  let totalGames = 0;

  for (const mp of matchPlayers) {
    const m = mp.match;
    if (m.status === 'FINISHED' && m.winner !== null) {
      totalGames++;
      const playerTeam = mp.seat % 2 === 0 ? 0 : 1;
      if (playerTeam === m.winner) wins++;
      else losses++;
    } else if (m.status === 'IN_PROGRESS' || m.status === 'WAITING') {
      totalGames++;
    }
  }

  const winRate = totalGames > 0 ? wins / totalGames : 0;

  // ELO history (last 30 overall)
  const eloRows = await prisma.eloHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const eloHistory: EloSnapshotDTO[] = eloRows.reverse().map((row) => ({
    matchId: row.matchId,
    eloAfter: row.eloAfter,
    eloChange: row.eloChange,
    isRanked: row.isRanked,
    createdAt: row.createdAt.toISOString(),
  }));

  // Ranked-only ELO history (last 30 ranked)
  const rankedEloRows = await prisma.eloHistory.findMany({
    where: { userId, isRanked: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const rankedEloHistory: EloSnapshotDTO[] = rankedEloRows.reverse().map((row) => ({
    matchId: row.matchId,
    eloAfter: row.eloAfter,
    eloChange: row.eloChange,
    isRanked: row.isRanked,
    createdAt: row.createdAt.toISOString(),
  }));

  const averageEloChange =
    eloHistory.length > 0
      ? eloHistory.reduce((sum, e) => sum + e.eloChange, 0) / eloHistory.length
      : 0;

  const userStats = await prisma.userStats.findUnique({ where: { userId } });
  const currentElo = userStats?.individualRating ?? 1000;

  // Top players
  const [topPlayedWith, topPlayedAgainst] = await Promise.all([
    computeTopOpponents(userId, prisma, 'with'),
    computeTopOpponents(userId, prisma, 'against'),
  ]);

  return {
    totalGames,
    wins,
    losses,
    winRate,
    currentElo,
    averageEloChange,
    eloHistory,
    rankedEloHistory,
    topPlayedWith,
    topPlayedAgainst,
  };
}

// ---------------------------------------------------------------------------
// computeTopOpponents — top-5 co-players or opponents for a given player
// ---------------------------------------------------------------------------

export async function computeTopOpponents(
  userId: string,
  prisma: PrismaClient,
  type: 'with' | 'against',
): Promise<TopPlayerEntryDTO[]> {
  // Get the last 30 finished matches the player participated in
  const userMatches = await prisma.matchPlayer.findMany({
    where: { userId, match: { status: 'FINISHED' } },
    include: { match: { include: { players: { include: { user: { select: { id: true, username: true } } } } } } },
    orderBy: { match: { createdAt: 'desc' } },
    take: 30,
  });

  const counts = new Map<string, { username: string; games: number; wins: number }>();

  for (const mp of userMatches) {
    const m = mp.match;
    if (m.winner === null) continue;

    const myTeam = mp.seat % 2 === 0 ? 0 : 1;
    const myWon = myTeam === m.winner;

    for (const opp of m.players as Array<{ userId: string; seat: number; user: { id: string; username: string } }>) {
      if (opp.userId === userId) continue;

      const oppTeam = opp.seat % 2 === 0 ? 0 : 1;
      const isSameTeam = oppTeam === myTeam;

      const include = type === 'with' ? isSameTeam : !isSameTeam;
      if (!include) continue;

      const entry = counts.get(opp.userId) ?? { username: opp.user.username, games: 0, wins: 0 };
      entry.games++;
      if (myWon) entry.wins++;
      counts.set(opp.userId, entry);
    }
  }

  return Array.from(counts.entries())
    .map(([oppUserId, data]) => ({
      userId: oppUserId,
      username: data.username,
      gamesPlayed: data.games,
      winRateVsOpponent: data.games > 0 ? data.wins / data.games : 0,
    }))
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
    .slice(0, 5);
}
