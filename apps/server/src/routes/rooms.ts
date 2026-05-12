import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

/**
 * Private room management routes.
 *
 * Players can create a private room and share a short invite code
 * with their friends. When the room fills up, the game starts automatically.
 */

// In-memory invite code → Colyseus roomId mapping
const inviteCodeMap = new Map<string, { roomId: string; createdAt: number; hostUserId: string }>();

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
    if (now - entry.createdAt > 30 * 60 * 1000) {
      inviteCodeMap.delete(code);
    }
  }
}

export const privateRoomRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/rooms/create — create a private room, get back invite code
  app.post(
    '/create',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string; username: string };

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
      inviteCodeMap.set(code, { roomId: '', createdAt: Date.now(), hostUserId: userId });

      return reply.status(201).send({ inviteCode: code });
    },
  );

  // GET /api/rooms/:code — look up a room by invite code
  app.get<{ Params: { code: string } }>(
    '/:code',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { code } = request.params;
      const entry = inviteCodeMap.get(code.toUpperCase());

      if (!entry) {
        return reply.status(404).send({ error: 'Invite code not found or expired' });
      }

      return reply.send({
        inviteCode: code.toUpperCase(),
        roomId: entry.roomId || null,
        hostUserId: entry.hostUserId,
      });
    },
  );

  // POST /api/rooms/:code/start — resolve invite code to a Colyseus roomId
  // This is called by the client. On first call, it creates the Colyseus room.
  app.post<{ Params: { code: string } }>(
    '/:code/join',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { code } = request.params;
      const upperCode = code.toUpperCase();
      const entry = inviteCodeMap.get(upperCode);

      if (!entry) {
        return reply.status(404).send({ error: 'Invite code not found or expired' });
      }

      // If room already created, return the roomId
      if (entry.roomId) {
        return reply.send({ roomId: entry.roomId, inviteCode: upperCode });
      }

      // Create Colyseus room on demand
      try {
        let roomId: string;
        if (app.createColyseusRoom) {
          const roomData = await app.createColyseusRoom('botifarra', {
            matchId: `private_${upperCode}`,
            targetScore: 101,
          });
          roomId = roomData.roomId;
        } else {
          // We import matchMaker dynamically to avoid circular deps at module level
          const { matchMaker } = await import('colyseus');
          const roomData = await matchMaker.createRoom('botifarra', {
            matchId: `private_${upperCode}`,
            targetScore: 101,
          });
          roomId = roomData.roomId;
        }
        entry.roomId = roomId;

        return reply.send({ roomId: entry.roomId, inviteCode: upperCode });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create room';
        return reply.status(500).send({ error: msg });
      }
    },
  );
};
