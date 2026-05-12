import type { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Match event persistence
// ---------------------------------------------------------------------------

export async function saveMatchEvent(
  prisma: PrismaClient,
  matchId: string,
  seq: number,
  eventType: string,
  payload: unknown,
): Promise<void> {
  await prisma.matchEvent.create({
    data: {
      matchId,
      seq,
      type: eventType,
      payload: JSON.stringify(payload),
    },
  });
}

// ---------------------------------------------------------------------------
// Finalise a match: record scores, winner, timestamps
// ---------------------------------------------------------------------------

export async function finalizeMatch(
  prisma: PrismaClient,
  matchId: string,
  score0: number,
  score1: number,
  winner: 0 | 1,
): Promise<void> {
  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: 'FINISHED',
      score0,
      score1,
      winner,
      finishedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Update per-user win/loss stats
// ---------------------------------------------------------------------------

export async function updateUserStats(
  prisma: PrismaClient,
  matchId: string,
  winnerTeam: 0 | 1,
): Promise<void> {
  const players = await prisma.matchPlayer.findMany({ where: { matchId } });

  for (const mp of players) {
    const playerTeam = mp.seat % 2 === 0 ? 0 : 1;
    const won = playerTeam === winnerTeam;

    const updateData: Record<string, unknown> = {
      matchesPlayed: { increment: 1 },
    };
    if (won) {
      updateData['matchesWon'] = { increment: 1 };
    } else {
      updateData['matchesLost'] = { increment: 1 };
    }

    await prisma.userStats.upsert({
      where: { userId: mp.userId },
      update: updateData as any,
      create: {
        userId: mp.userId,
        matchesPlayed: 1,
        matchesWon: won ? 1 : 0,
        matchesLost: won ? 0 : 1,
        individualRating: 1000,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Simple Elo-style rating update
// ---------------------------------------------------------------------------

const K = 32;

function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export async function updateRatings(
  prisma: PrismaClient,
  matchId: string,
  winnerTeam: 0 | 1,
): Promise<void> {
  const players = await prisma.matchPlayer.findMany({
    where: { matchId },
    include: { user: { include: { stats: true } } },
  });

  for (const mp of players) {
    const stats = mp.user.stats;
    if (!stats) continue;

    const currentRating = stats.individualRating;
    const playerTeam = mp.seat % 2 === 0 ? 0 : 1;
    const won = playerTeam === winnerTeam;

    // Average opponent rating
    const opponents = players.filter((opp: typeof mp & { user: { stats: { individualRating: number } | null } }) => {
      const oppTeam = opp.seat % 2 === 0 ? 0 : 1;
      return oppTeam !== playerTeam && opp.user.stats;
    });
    const opponentRating =
      opponents.reduce(
        (sum: number, opp: typeof mp & { user: { stats: { individualRating: number } | null } }) =>
          sum + (opp.user.stats?.individualRating ?? 1000),
        0,
      ) / 2;

    const expected = expectedScore(currentRating, opponentRating);
    const actual = won ? 1 : 0;
    const newRating = Math.max(0, currentRating + K * (actual - expected));

    await prisma.userStats.update({
      where: { userId: mp.userId },
      data: { individualRating: newRating },
    });
  }
}
