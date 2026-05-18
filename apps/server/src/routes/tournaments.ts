import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import * as argon2 from 'argon2';
import type {
  CreateTournamentPayload,
  RegisterCouplePayload,
  SubmitMatchResultPayload,
  TournamentDTO,
  TournamentCoupleDTO,
  TournamentMatchDTO,
  TournamentRoundDTO,
  TournamentDetailDTO,
  TournamentListDTO,
} from '@botifarra/shared';
import {
  generateEliminatoryFirstRound,
  generateEliminatoryNextRound,
  generateSwissPairings,
} from '../services/tournament-pairing.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapTournamentDTO(t: any): TournamentDTO {
  const coupleCount = t._count?.couples ?? t.couples?.length ?? 0;
  const soloCount = t._count?.soloRegs ?? t.soloRegs?.length ?? 0;
  return {
    id: t.id,
    name: t.name,
    format: t.format.toLowerCase(),
    status: t.status.toLowerCase().replace(/_/g, '_') as any,
    createdById: t.createdById,
    createdByUsername: t.createdBy?.username ?? '',
    activeRound: t.activeRound,
    championId: t.championId,
    coupleCount,
    registeredUsersCount: coupleCount * 2 + soloCount,
    hasPassword: !!t.passwordHash,
    createdAt: t.createdAt.toISOString(),
    startedAt: t.startedAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
  };
}

function mapStatusEnum(status: string): string {
  // Convert DB enum like "REGISTRATION_OPEN" to dto "registration_open"
  return status.toLowerCase();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const tournamentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/tournaments — list all tournaments
  app.get('/', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const tournaments = await app.prisma.tournament.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { username: true } },
        _count: { select: { couples: true, soloRegs: true } },
      },
    });

    const dto: TournamentListDTO = {
      tournaments: tournaments.map(mapTournamentDTO),
    };
    return reply.send(dto);
  });

  // POST /api/tournaments — create a tournament
  app.post('/', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string };
    const body = request.body as CreateTournamentPayload;

    if (!body.name || !body.format) {
      return reply.status(400).send({ error: 'name and format are required' });
    }
    if (body.format !== 'eliminatory' && body.format !== 'swiss') {
      return reply.status(400).send({ error: 'format must be "eliminatory" or "swiss"' });
    }

    let passwordHash: string | null = null;
    if (body.password) {
      passwordHash = await argon2.hash(body.password);
    }

    const tournament = await app.prisma.tournament.create({
      data: {
        name: body.name.trim(),
        format: body.format === 'eliminatory' ? 'ELIMINATORY' : 'SWISS',
        createdById: userId,
        ...(passwordHash ? { passwordHash } : {}),
      },
      include: {
        createdBy: { select: { username: true } },
        _count: { select: { couples: true, soloRegs: true } },
      },
    });

    return reply.status(201).send(mapTournamentDTO(tournament));
  });

  // GET /api/tournaments/:id — tournament detail with classification
  app.get<{ Params: { id: string } }>(
    '/:id',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const tournament = await app.prisma.tournament.findUnique({
        where: { id: request.params.id },
        include: {
          createdBy: { select: { username: true } },
          couples: {
            include: {
              user1: { select: { id: true, username: true } },
              user2: { select: { id: true, username: true } },
            },
            orderBy: { points: 'desc' },
          },
          soloRegs: true,
          rounds: {
            orderBy: { roundNumber: 'asc' },
            include: {
              matches: {
                include: {
                  couple0: {
                    include: {
                      user1: { select: { username: true } },
                      user2: { select: { username: true } },
                    },
                  },
                  couple1: {
                    include: {
                      user1: { select: { username: true } },
                      user2: { select: { username: true } },
                    },
                  },
                },
              },
            },
          },
          _count: { select: { couples: true, soloRegs: true } },
        },
      });

      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found' });
      }

      // Build a version of the tournament with all fields needed by mapTournamentDTO
      const tournamentWithMeta = {
        ...tournament,
        _count: {
          couples: tournament.couples.length,
          soloRegs: tournament.soloRegs?.length ?? 0,
        },
      };

      const couples: TournamentCoupleDTO[] = tournament.couples.map((c, idx) => ({
        id: c.id,
        user1Id: c.user1Id,
        user1Username: c.user1.username,
        user2Id: c.user2Id,
        user2Username: c.user2.username,
        status: mapStatusEnum(c.status) as any,
        points: c.points,
        matchesWon: c.matchesWon,
        matchesLost: c.matchesLost,
        position: idx + 1,
      }));

      const rounds: TournamentRoundDTO[] = tournament.rounds.map((r) => ({
        roundNumber: r.roundNumber,
        matches: r.matches.map(
          (m): TournamentMatchDTO => ({
            id: m.id,
            roundNumber: r.roundNumber,
            couple0: {
              id: m.couple0.id,
              user1Username: m.couple0.user1.username,
              user2Username: m.couple0.user2.username,
            },
            couple1: m.couple1
              ? {
                  id: m.couple1.id,
                  user1Username: m.couple1.user1.username,
                  user2Username: m.couple1.user2.username,
                }
              : null,
            isFinal: m.isFinal,
            status: mapStatusEnum(m.status) as any,
            score0: m.score0,
            score1: m.score1,
            roundsPlayed: m.roundsPlayed,
            winnerId: m.winnerId,
            roomId: m.roomId,
            startedAt: m.startedAt?.toISOString() ?? null,
            finishedAt: m.finishedAt?.toISOString() ?? null,
          }),
        ),
      }));

      const detail: TournamentDetailDTO = {
        tournament: mapTournamentDTO(tournamentWithMeta),
        couples,
        rounds,
      };

      return reply.send(detail);
    },
  );

  // POST /api/tournaments/:id/register-couple — register as a couple
  app.post<{ Params: { id: string } }>(
    '/:id/register-couple',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };
      const body = request.body as RegisterCouplePayload;

      if (!body.partnerUserId) {
        return reply.status(400).send({ error: 'partnerUserId is required' });
      }

      if (body.partnerUserId === userId) {
        return reply.status(400).send({ error: 'Cannot register with yourself' });
      }

      const tournament = await app.prisma.tournament.findUnique({
        where: { id: request.params.id },
      });

      if (!tournament || tournament.status !== 'REGISTRATION_OPEN') {
        return reply.status(400).send({ error: 'Tournament is not open for registration' });
      }

      // Password check
      if (tournament.passwordHash) {
        if (!body.password) {
          return reply.status(403).send({ error: 'This tournament requires a password' });
        }
        const valid = await argon2.verify(tournament.passwordHash, body.password);
        if (!valid) {
          return reply.status(403).send({ error: 'Incorrect tournament password' });
        }
      }

      // Check neither user is already registered
      const existing = await app.prisma.tournamentCouple.findFirst({
        where: {
          tournamentId: tournament.id,
          OR: [
            { user1Id: userId },
            { user2Id: userId },
            { user1Id: body.partnerUserId },
            { user2Id: body.partnerUserId },
          ],
        },
      });
      if (existing) {
        return reply.status(409).send({ error: 'One or both users are already registered' });
      }

      // Also check solo registrations
      const soloExisting = await app.prisma.tournamentSoloReg.findFirst({
        where: {
          tournamentId: tournament.id,
          OR: [{ userId }, { userId: body.partnerUserId }],
        },
      });
      if (soloExisting) {
        return reply
          .status(409)
          .send({ error: 'One or both users have a solo registration' });
      }

      // Verify partner user exists
      const partner = await app.prisma.user.findUnique({
        where: { id: body.partnerUserId },
      });
      if (!partner) {
        return reply.status(404).send({ error: 'Partner user not found' });
      }

      const couple = await app.prisma.tournamentCouple.create({
        data: {
          tournamentId: tournament.id,
          user1Id: userId,
          user2Id: body.partnerUserId,
        },
      });

      return reply.status(201).send({ coupleId: couple.id });
    },
  );

  // POST /api/tournaments/:id/register-solo — register alone
  app.post<{ Params: { id: string } }>(
    '/:id/register-solo',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };

      const tournament = await app.prisma.tournament.findUnique({
        where: { id: request.params.id },
      });

      if (!tournament || tournament.status !== 'REGISTRATION_OPEN') {
        return reply.status(400).send({ error: 'Tournament is not open for registration' });
      }

      // Password check
      const soloBody = (request.body ?? {}) as { password?: string };
      if (tournament.passwordHash) {
        if (!soloBody.password) {
          return reply.status(403).send({ error: 'This tournament requires a password' });
        }
        const valid = await argon2.verify(tournament.passwordHash, soloBody.password);
        if (!valid) {
          return reply.status(403).send({ error: 'Incorrect tournament password' });
        }
      }

      // Check if already registered as couple or solo
      const existingCouple = await app.prisma.tournamentCouple.findFirst({
        where: {
          tournamentId: tournament.id,
          OR: [{ user1Id: userId }, { user2Id: userId }],
        },
      });
      if (existingCouple) {
        return reply.status(409).send({ error: 'Already registered as a couple' });
      }

      const existingSolo = await app.prisma.tournamentSoloReg.findFirst({
        where: { tournamentId: tournament.id, userId },
      });
      if (existingSolo) {
        return reply.status(409).send({ error: 'Already registered as solo' });
      }

      await app.prisma.tournamentSoloReg.create({
        data: { tournamentId: tournament.id, userId },
      });

      return reply.status(201).send({ message: 'Registered as solo' });
    },
  );

  // POST /api/tournaments/:id/pair-solos — pair solo registrations into couples (admin/creator)
  app.post<{ Params: { id: string } }>(
    '/:id/pair-solos',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };

      const tournament = await app.prisma.tournament.findUnique({
        where: { id: request.params.id },
      });

      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found' });
      }
      if (tournament.createdById !== userId) {
        return reply.status(403).send({ error: 'Only the tournament creator can pair solos' });
      }

      const soloRegs = await app.prisma.tournamentSoloReg.findMany({
        where: { tournamentId: tournament.id },
        orderBy: { createdAt: 'asc' },
      });

      const paired: string[] = [];
      for (let i = 0; i + 1 < soloRegs.length; i += 2) {
        await app.prisma.tournamentCouple.create({
          data: {
            tournamentId: tournament.id,
            user1Id: soloRegs[i]!.userId,
            user2Id: soloRegs[i + 1]!.userId,
          },
        });
        paired.push(soloRegs[i]!.userId, soloRegs[i + 1]!.userId);
      }

      // Remove paired solo registrations
      if (paired.length > 0) {
        await app.prisma.tournamentSoloReg.deleteMany({
          where: {
            tournamentId: tournament.id,
            userId: { in: paired },
          },
        });
      }

      const remaining = soloRegs.length - paired.length;
      return reply.send({ pairedCount: paired.length / 2, remainingSolos: remaining });
    },
  );

  // POST /api/tournaments/:id/start — start the tournament
  app.post<{ Params: { id: string } }>(
    '/:id/start',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };

      const tournament = await app.prisma.tournament.findUnique({
        where: { id: request.params.id },
        include: {
          couples: true,
          soloRegs: true,
        },
      });

      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found' });
      }
      if (tournament.createdById !== userId) {
        return reply.status(403).send({ error: 'Only the tournament creator can start it' });
      }
      if (tournament.status !== 'REGISTRATION_OPEN' && tournament.status !== 'READY') {
        return reply.status(400).send({ error: 'Tournament cannot be started in current state' });
      }

      // Auto-pair any remaining solo registrations before starting
      if (tournament.soloRegs.length > 0) {
        if (tournament.soloRegs.length % 2 !== 0) {
          return reply
            .status(400)
            .send({ error: 'Odd number of solo registrations — remove or add one more player before starting' });
        }
        const soloRegs = tournament.soloRegs;
        const pairedUserIds: string[] = [];
        for (let i = 0; i + 1 < soloRegs.length; i += 2) {
          await app.prisma.tournamentCouple.create({
            data: {
              tournamentId: tournament.id,
              user1Id: soloRegs[i]!.userId,
              user2Id: soloRegs[i + 1]!.userId,
            },
          });
          pairedUserIds.push(soloRegs[i]!.userId, soloRegs[i + 1]!.userId);
        }
        await app.prisma.tournamentSoloReg.deleteMany({
          where: { tournamentId: tournament.id, userId: { in: pairedUserIds } },
        });
        // Reload couples after pairing
        tournament.couples = await app.prisma.tournamentCouple.findMany({
          where: { tournamentId: tournament.id },
        });
      }

      if (tournament.couples.length < 2) {
        return reply.status(400).send({ error: 'Need at least 2 couples to start' });
      }

      // Generate first round pairings
      const coupleIds = tournament.couples.map((c) => c.id);
      let pairings;

      if (tournament.format === 'ELIMINATORY') {
        pairings = generateEliminatoryFirstRound(coupleIds);
      } else {
        // Swiss: all start at 0 points
        const standings = coupleIds.map((id) => ({ coupleId: id, points: 0 }));
        pairings = generateSwissPairings(standings, []);
      }

      // Create the round and matches in a transaction
      await app.prisma.$transaction(async (tx) => {
        const round = await tx.tournamentRound.create({
          data: {
            tournamentId: tournament.id,
            roundNumber: 1,
          },
        });

        for (const p of pairings) {
          await tx.tournamentMatch.create({
            data: {
              roundId: round.id,
              couple0Id: p.couple0Id,
              couple1Id: p.couple1Id,
              isFinal: false,
            },
          });

          // Auto-advance bye matches
          if (!p.couple1Id) {
            await tx.tournamentMatch.updateMany({
              where: { roundId: round.id, couple0Id: p.couple0Id, couple1Id: null },
              data: { status: 'FINISHED', winnerId: p.couple0Id },
            });
            await tx.tournamentCouple.update({
              where: { id: p.couple0Id },
              data: { points: { increment: 3 }, matchesWon: { increment: 1 } },
            });
          }
        }

        await tx.tournament.update({
          where: { id: tournament.id },
          data: {
            status: 'IN_PROGRESS',
            activeRound: 1,
            startedAt: new Date(),
          },
        });
      });

      return reply.send({ message: 'Tournament started', activeRound: 1 });
    },
  );

  // POST /api/tournaments/:id/submit-result — submit a match result
  app.post<{ Params: { id: string } }>(
    '/:id/submit-result',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };
      const body = request.body as SubmitMatchResultPayload;

      if (!body.matchId || body.score0 === undefined || body.score1 === undefined) {
        return reply.status(400).send({ error: 'matchId, score0, score1 are required' });
      }

      const match = await app.prisma.tournamentMatch.findUnique({
        where: { id: body.matchId },
        include: {
          round: { include: { tournament: true } },
        },
      });

      if (!match) {
        return reply.status(404).send({ error: 'Match not found' });
      }

      const tournament = match.round.tournament;
      if (tournament.createdById !== userId) {
        return reply.status(403).send({ error: 'Only the tournament creator can submit results' });
      }

      if (match.status === 'FINISHED') {
        return reply.status(409).send({ error: 'Match already resolved' });
      }

      // Determine winner
      let winnerId: string | null = null;
      let finalStatus: 'FINISHED' | 'UNRESOLVED' = 'FINISHED';

      if (body.score0 > body.score1) {
        winnerId = match.couple0Id;
      } else if (body.score1 > body.score0) {
        winnerId = match.couple1Id;
      } else {
        // Tied — check if this was already a tiebreak
        if (match.status === 'TIEBREAK') {
          // Still tied after tiebreak — unresolved, or use manual winnerId
          if (body.winnerId) {
            winnerId = body.winnerId;
          } else {
            finalStatus = 'UNRESOLVED';
          }
        } else {
          // Enter tiebreak phase
          await app.prisma.tournamentMatch.update({
            where: { id: match.id },
            data: {
              status: 'TIEBREAK',
              score0: body.score0,
              score1: body.score1,
              roundsPlayed: body.score0 + body.score1, // approximate
            },
          });
          return reply.send({ message: 'Match entered tiebreak phase', status: 'tiebreak' });
        }
      }

      // Update match
      await app.prisma.tournamentMatch.update({
        where: { id: match.id },
        data: {
          status: finalStatus,
          score0: body.score0,
          score1: body.score1,
          winnerId,
          finishedAt: new Date(),
        },
      });

      // Update couple stats
      if (winnerId && match.couple1Id) {
        const loserId = winnerId === match.couple0Id ? match.couple1Id : match.couple0Id;
        await app.prisma.tournamentCouple.update({
          where: { id: winnerId },
          data: { points: { increment: 3 }, matchesWon: { increment: 1 } },
        });
        await app.prisma.tournamentCouple.update({
          where: { id: loserId },
          data: { matchesLost: { increment: 1 } },
        });

        // For eliminatory: mark loser as eliminated (unless it's a non-final Swiss)
        if (tournament.format === 'ELIMINATORY') {
          await app.prisma.tournamentCouple.update({
            where: { id: loserId },
            data: { status: 'ELIMINATED' },
          });
        }
      }

      return reply.send({ message: 'Result submitted', winnerId, status: finalStatus.toLowerCase() });
    },
  );

  // POST /api/tournaments/:id/next-round — generate the next round
  app.post<{ Params: { id: string } }>(
    '/:id/next-round',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };

      const tournament = await app.prisma.tournament.findUnique({
        where: { id: request.params.id },
        include: {
          couples: true,
          rounds: {
            orderBy: { roundNumber: 'desc' },
            take: 1,
            include: { matches: true },
          },
        },
      });

      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found' });
      }
      if (tournament.createdById !== userId) {
        return reply.status(403).send({ error: 'Only the tournament creator can advance rounds' });
      }
      if (tournament.status !== 'IN_PROGRESS') {
        return reply.status(400).send({ error: 'Tournament is not in progress' });
      }

      const lastRound = tournament.rounds[0];
      if (!lastRound) {
        return reply.status(400).send({ error: 'No rounds exist' });
      }

      // Check all matches in last round are finished
      const unfinished = lastRound.matches.filter(
        (m) => m.status !== 'FINISHED' && m.couple1Id !== null,
      );
      if (unfinished.length > 0) {
        return reply.status(400).send({ error: 'Not all matches in the current round are finished' });
      }

      const nextRoundNumber = tournament.activeRound + 1;

      // Get active couples
      const activeCouples = tournament.couples.filter((c) => c.status === 'ACTIVE' || c.status === 'FINALIST');

      // Check if we're down to 2 — this is the final
      if (activeCouples.length === 2) {
        // Mark as finalists
        await app.prisma.tournamentCouple.updateMany({
          where: { id: { in: activeCouples.map((c) => c.id) } },
          data: { status: 'FINALIST' },
        });

        const round = await app.prisma.tournamentRound.create({
          data: { tournamentId: tournament.id, roundNumber: nextRoundNumber },
        });

        await app.prisma.tournamentMatch.create({
          data: {
            roundId: round.id,
            couple0Id: activeCouples[0]!.id,
            couple1Id: activeCouples[1]!.id,
            isFinal: true,
          },
        });

        await app.prisma.tournament.update({
          where: { id: tournament.id },
          data: { activeRound: nextRoundNumber },
        });

        return reply.send({ message: 'Final round created', activeRound: nextRoundNumber, isFinal: true });
      }

      // Generate pairings
      let pairings;
      if (tournament.format === 'ELIMINATORY') {
        const winnerIds = lastRound.matches
          .filter((m) => m.winnerId)
          .map((m) => m.winnerId!);
        pairings = generateEliminatoryNextRound(winnerIds);
      } else {
        // Swiss — use current standings
        const standings = activeCouples.map((c) => ({
          coupleId: c.id,
          points: c.points,
        }));
        // Get all previous matchups
        const allRounds = await app.prisma.tournamentRound.findMany({
          where: { tournamentId: tournament.id },
          include: { matches: true },
        });
        const previousMatchups = allRounds.flatMap((r) =>
          r.matches
            .filter((m) => m.couple1Id)
            .map((m) => ({ couple0Id: m.couple0Id, couple1Id: m.couple1Id! })),
        );
        pairings = generateSwissPairings(standings, previousMatchups);
      }

      // Create round
      await app.prisma.$transaction(async (tx) => {
        const round = await tx.tournamentRound.create({
          data: { tournamentId: tournament.id, roundNumber: nextRoundNumber },
        });

        for (const p of pairings) {
          await tx.tournamentMatch.create({
            data: {
              roundId: round.id,
              couple0Id: p.couple0Id,
              couple1Id: p.couple1Id,
              isFinal: false,
            },
          });

          // Auto-advance bye
          if (!p.couple1Id) {
            await tx.tournamentMatch.updateMany({
              where: { roundId: round.id, couple0Id: p.couple0Id, couple1Id: null },
              data: { status: 'FINISHED', winnerId: p.couple0Id },
            });
            await tx.tournamentCouple.update({
              where: { id: p.couple0Id },
              data: { points: { increment: 3 }, matchesWon: { increment: 1 } },
            });
          }
        }

        await tx.tournament.update({
          where: { id: tournament.id },
          data: { activeRound: nextRoundNumber },
        });
      });

      return reply.send({ message: 'Next round created', activeRound: nextRoundNumber });
    },
  );

  // POST /api/tournaments/:id/finalize — declare tournament champion (after final is played)
  app.post<{ Params: { id: string } }>(
    '/:id/finalize',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };

      const tournament = await app.prisma.tournament.findUnique({
        where: { id: request.params.id },
        include: {
          rounds: {
            orderBy: { roundNumber: 'desc' },
            take: 1,
            include: { matches: { where: { isFinal: true } } },
          },
        },
      });

      if (!tournament) {
        return reply.status(404).send({ error: 'Tournament not found' });
      }
      if (tournament.createdById !== userId) {
        return reply.status(403).send({ error: 'Only the tournament creator can finalize' });
      }

      const finalMatch = tournament.rounds[0]?.matches[0];
      if (!finalMatch || !finalMatch.isFinal || finalMatch.status !== 'FINISHED') {
        return reply.status(400).send({ error: 'Final match not finished' });
      }
      if (!finalMatch.winnerId) {
        return reply.status(400).send({ error: 'Final has no winner' });
      }

      await app.prisma.tournamentCouple.update({
        where: { id: finalMatch.winnerId },
        data: { status: 'CHAMPION' },
      });

      await app.prisma.tournament.update({
        where: { id: tournament.id },
        data: {
          status: 'COMPLETED',
          championId: finalMatch.winnerId,
          completedAt: new Date(),
        },
      });

      return reply.send({ message: 'Tournament completed', championId: finalMatch.winnerId });
    },
  );
};
