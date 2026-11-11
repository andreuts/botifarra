import { buildApp } from './app.js';
import { Server, matchMaker } from 'colyseus';
import { BotifarraRoom, setPrismaForRooms } from './rooms/BotifarraRoom.js';
import { PracticeRoom } from './rooms/PracticeRoom.js';
import { TournamentRoom } from './rooms/TournamentRoom.js';
import type { MatchPlayer, SeatReservationData } from './services/matchmaking.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function main() {
  const app = await buildApp({ logger: true });

  // ---------------------------------------------------------------------------
  // Colyseus — attach to the same HTTP server as Fastify
  // ---------------------------------------------------------------------------

  const gameServer = new Server({ server: app.server });

  gameServer.define('botifarra', BotifarraRoom);
  gameServer.define('practice', PracticeRoom);
  gameServer.define('tournament', TournamentRoom);

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  try {
    await app.listen({ port: PORT, host: HOST });

    // Wire Prisma into room persistence
    setPrismaForRooms(app.prisma);

    // Wire matchmaking → Colyseus room creation with pre-reserved seats.
    // All 4 seats are reserved atomically before any client connects, so the
    // room is already "full" (locked) from Colyseus's perspective.  Clients
    // use consumeSeatReservation() which bypasses the room.locked check.
    app.matchmakingQueue.setOnMatchCreated(async (players: MatchPlayer[], matchId: string, ranked: boolean) => {
      // Build seat assignments map: userId → seat
      const seatAssignments: Record<string, number> = {};
      for (const p of players) {
        seatAssignments[p.userId] = p.seat;
      }

      let roomId: string | undefined;
      let matchRecordCreated = false;
      try {
        // Create Colyseus room (seatReservationTime is set to 120 s inside onCreate)
        const roomListing = await matchMaker.createRoom('botifarra', {
          matchId,
          targetScore: 101,
          seatAssignments,
          ranked,
          persistMatch: true,
        });
        roomId = roomListing.roomId;

        // Reserve every seat before publishing reservations to the queue.
        const reservations = new Map<string, SeatReservationData>();
        for (const p of players) {
          const reservation = await matchMaker.reserveSeatFor(roomListing, {
            userId: p.userId,
            username: p.username,
            seat: p.seat,
          });
          reservations.set(p.userId, {
            sessionId: reservation.sessionId,
            room: {
              roomId: reservation.room.roomId,
              name: (reservation.room as any).name ?? 'botifarra',
              processId: (reservation.room as any).processId ?? '',
            },
          });
        }

        // Persist only after room creation and all reservations succeed. A
        // failed attempt cannot leave a dead IN_PROGRESS match in history.
        await app.prisma.match.create({
          data: {
            id: matchId,
            status: 'IN_PROGRESS',
            mode: ranked ? 'RANKED' : 'PUBLIC',
            ranked,
            players: {
              create: players.map((p) => ({ userId: p.userId, seat: p.seat })),
            },
          },
        });
        matchRecordCreated = true;

        app.log.info(
          { matchId, roomId, playerIds: players.map((p) => p.userId) },
          'Match created — all seats pre-reserved, clients will use consumeSeatReservation',
        );
        return reservations;
      } catch (err) {
        if (roomId) {
          try {
            await matchMaker.remoteRoomCall(roomId, 'disconnect');
          } catch (cleanupError) {
            app.log.error(
              { err: cleanupError, matchId, roomId },
              'Failed to dispose an incomplete matchmaking room',
            );
          }
        }
        if (matchRecordCreated) {
          try {
            await app.prisma.match.deleteMany({ where: { id: matchId } });
          } catch (cleanupError) {
            app.log.error(
              { err: cleanupError, matchId },
              'Failed to remove an incomplete matchmaking record',
            );
          }
        }
        throw err;
      }
    });

    console.log(`Server listening on http://${HOST}:${PORT}`);
    console.log(`Colyseus WebSocket ready on ws://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
