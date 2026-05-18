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
      // Create DB match record
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

      // Build seat assignments map: userId → seat
      const seatAssignments: Record<string, number> = {};
      for (const p of players) {
        seatAssignments[p.userId] = p.seat;
      }

      // Create Colyseus room (seatReservationTime is set to 120 s inside onCreate)
      const roomListing = await matchMaker.createRoom('botifarra', {
        matchId,
        targetScore: 101,
        seatAssignments,
        ranked,
      });

      // Reserve a seat for every matched player atomically.
      // Because all reservations are made before any client connects, the room
      // immediately reaches maxClients and locks.  That is fine because clients
      // use consumeSeatReservation (direct sessionId handshake) not joinById.
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

      app.log.info(
        { matchId, roomId: roomListing.roomId, playerIds: players.map((p) => p.userId) },
        'Match created — all seats pre-reserved, clients will use consumeSeatReservation',
      );
      return reservations;
    });

    console.log(`Server listening on http://${HOST}:${PORT}`);
    console.log(`Colyseus WebSocket ready on ws://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
