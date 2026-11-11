import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

/**
 * Private room management routes.
 *
 * Players can create a private room and share a short invite code
 * with their friends. When the room fills up, the game starts automatically.
 */

type InviteMode = 'private' | 'practice-duo';
const INVITE_TTL_MS = 30 * 60 * 1000;

interface InviteEntry {
  roomId: string;
  creatingRoom?: Promise<string>;
  createdAt: number;
  hostUserId: string;
  mode: InviteMode;
}

// In-memory invite code → Colyseus room mapping
const inviteCodeMap = new Map<string, InviteEntry>();

/** Generate a 6-character random code */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusable chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Clean up codes older than 30 minutes */
function cleanupStaleInvites() {
  const now = Date.now();
  for (const [code, entry] of inviteCodeMap) {
    if (now - entry.createdAt > INVITE_TTL_MS) {
      inviteCodeMap.delete(code);
    }
  }
}

export const privateRoomRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/rooms/create — create a private room, get back invite code
  app.post<{ Body: { mode?: unknown } }>('/create', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string; username: string };
    const requestedMode = request.body?.mode ?? 'private';
    if (requestedMode !== 'private' && requestedMode !== 'practice-duo') {
      return reply.status(400).send({ error: 'Invalid room mode' });
    }
    const mode: InviteMode = requestedMode;

    cleanupStaleInvites();

    // Generate a unique invite code
    let code = generateInviteCode();
    let attempts = 0;
    while (inviteCodeMap.has(code) && attempts < 10) {
      code = generateInviteCode();
      attempts++;
    }

    // We'll create the Colyseus room lazily when the first player joins via the code.
    // For now, we just reserve the code and return it.
    inviteCodeMap.set(code, { roomId: '', createdAt: Date.now(), hostUserId: userId, mode });

    return reply.status(201).send({ inviteCode: code, mode });
  });

  // GET /api/rooms/:code — look up a room by invite code
  app.get<{ Params: { code: string } }>(
    '/:code',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      cleanupStaleInvites();
      const { code } = request.params;
      const entry = inviteCodeMap.get(code.toUpperCase());

      if (!entry) {
        return reply.status(404).send({ error: 'Invite code not found or expired' });
      }

      return reply.send({
        inviteCode: code.toUpperCase(),
        roomId: entry.roomId || null,
        hostUserId: entry.hostUserId,
        mode: entry.mode,
      });
    },
  );

  // POST /api/rooms/:code/start — resolve invite code to a Colyseus roomId
  // This is called by the client. On first call, it creates the Colyseus room.
  app.post<{ Params: { code: string } }>(
    '/:code/join',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      cleanupStaleInvites();
      const { code } = request.params;
      const upperCode = code.toUpperCase();
      const entry = inviteCodeMap.get(upperCode);

      if (!entry) {
        return reply.status(404).send({ error: 'Invite code not found or expired' });
      }

      // If room already created, return the roomId
      if (entry.roomId) {
        return reply.send({ roomId: entry.roomId, inviteCode: upperCode, mode: entry.mode });
      }

      // Create Colyseus room on demand
      try {
        if (!entry.creatingRoom) {
          const roomType = entry.mode === 'practice-duo' ? 'practice' : 'botifarra';
          const roomOptions: Record<string, unknown> = entry.mode === 'practice-duo'
            ? {
                matchId: `practice_${upperCode}`,
                targetScore: 101,
                fillBots: true,
                humanPlayers: 2,
                seatAssignments: { [entry.hostUserId]: 0 },
                lobbyTimeoutMs: Math.max(1, entry.createdAt + INVITE_TTL_MS - Date.now()),
              }
            : {
                matchId: `private_${upperCode}`,
                targetScore: 101,
              };

          entry.creatingRoom = (async () => {
            if (app.createColyseusRoom) {
              const roomData = await app.createColyseusRoom(roomType, roomOptions);
              return roomData.roomId;
            }
            // We import matchMaker dynamically to avoid circular deps at module level
            const { matchMaker } = await import('colyseus');
            const roomData = await matchMaker.createRoom(roomType, roomOptions);
            return roomData.roomId;
          })();
        }

        const roomCreation = entry.creatingRoom;
        if (!roomCreation) throw new Error('Failed to create room');
        const roomId = await roomCreation;
        entry.roomId = roomId;
        delete entry.creatingRoom;

        return reply.send({ roomId: entry.roomId, inviteCode: upperCode, mode: entry.mode });
      } catch (err) {
        delete entry.creatingRoom;
        const msg = err instanceof Error ? err.message : 'Failed to create room';
        return reply.status(500).send({ error: msg });
      }
    },
  );
};
