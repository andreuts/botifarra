import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type {
  PairInviteDTO,
  SendPairInvitePayload,
  PairInviteActionPayload,
} from '@botifarra/shared';

// ---------------------------------------------------------------------------
// In-memory pair invite store (ephemeral — like matchmaking queue)
// ---------------------------------------------------------------------------

interface PairInvite {
  inviteId: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  ranked: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  createdAt: number;
}

const pairInvites = new Map<string, PairInvite>();

/** Clean up invites older than 2 minutes */
function cleanupStaleInvites() {
  const now = Date.now();
  for (const [id, invite] of pairInvites) {
    if (now - invite.createdAt > 2 * 60 * 1000) {
      pairInvites.delete(id);
    }
  }
}

function generateInviteId(): string {
  return `pair_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const pairInviteRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/pair-invite/send — invite a friend to queue as a pair
  app.post('/send', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId, username } = (request as any).user as {
      sub: string;
      username: string;
    };
    const body = request.body as SendPairInvitePayload;

    if (!body.friendUserId) {
      return reply.status(400).send({ error: 'friendUserId is required' });
    }

    // Verify friendship exists
    const friendship = await app.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId, addresseeId: body.friendUserId },
          { requesterId: body.friendUserId, addresseeId: userId },
        ],
      },
    });

    if (!friendship) {
      return reply.status(403).send({ error: 'You must be friends to send a pair invite' });
    }

    // Check for existing pending invite between these two
    cleanupStaleInvites();
    for (const [, invite] of pairInvites) {
      if (
        invite.status === 'pending' &&
        ((invite.fromUserId === userId && invite.toUserId === body.friendUserId) ||
          (invite.fromUserId === body.friendUserId && invite.toUserId === userId))
      ) {
        return reply.status(409).send({ error: 'A pair invite already exists between you two' });
      }
    }

    // Look up friend's username
    const friendUser = await app.prisma.user.findUnique({
      where: { id: body.friendUserId },
      select: { username: true },
    });

    if (!friendUser) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const invite: PairInvite = {
      inviteId: generateInviteId(),
      fromUserId: userId,
      fromUsername: username,
      toUserId: body.friendUserId,
      toUsername: friendUser.username,
      ranked: body.ranked === true,
      status: 'pending',
      createdAt: Date.now(),
    };

    pairInvites.set(invite.inviteId, invite);

    const dto: PairInviteDTO = {
      inviteId: invite.inviteId,
      fromUserId: invite.fromUserId,
      fromUsername: invite.fromUsername,
      toUserId: invite.toUserId,
      toUsername: invite.toUsername,
      ranked: invite.ranked,
      status: invite.status,
      createdAt: new Date(invite.createdAt).toISOString(),
    };

    return reply.status(201).send(dto);
  });

  // POST /api/pair-invite/respond — accept or reject a pair invite
  app.post('/respond', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string };
    const body = request.body as PairInviteActionPayload;

    if (!body.inviteId || !body.action) {
      return reply.status(400).send({ error: 'inviteId and action are required' });
    }

    const invite = pairInvites.get(body.inviteId);
    if (!invite) {
      return reply.status(404).send({ error: 'Pair invite not found or expired' });
    }

    if (invite.toUserId !== userId) {
      return reply.status(403).send({ error: 'Only the invitee can respond' });
    }

    if (invite.status !== 'pending') {
      return reply.status(409).send({ error: 'Invite already resolved' });
    }

    if (body.action === 'reject') {
      invite.status = 'rejected';
      pairInvites.delete(invite.inviteId);
      return reply.send({ message: 'Pair invite rejected' });
    }

    // Accept — add both to the matchmaking queue as a pair
    invite.status = 'accepted';

    // Compute average rating for ranked pair matchmaking
    let pairRating = 0;
    if (invite.ranked) {
      const [fromStats, toStats] = await Promise.all([
        app.prisma.userStats.findUnique({ where: { userId: invite.fromUserId } }),
        app.prisma.userStats.findUnique({ where: { userId: invite.toUserId } }),
      ]);
      pairRating = ((fromStats?.individualRating ?? 1000) + (toStats?.individualRating ?? 1000)) / 2;
    }

    try {
      app.matchmakingQueue.enqueuePair(
        { userId: invite.fromUserId, username: invite.fromUsername },
        { userId: invite.toUserId, username: invite.toUsername },
        invite.ranked,
        pairRating,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to join queue';
      return reply.status(409).send({ error: msg });
    }

    // Clean up the invite
    pairInvites.delete(invite.inviteId);

    return reply.send({
      message: 'Pair invite accepted, both players added to queue',
      queueSize: app.matchmakingQueue.size,
    });
  });

  // GET /api/pair-invite/pending — get pending invites for the current user
  app.get('/pending', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string };

    cleanupStaleInvites();
    const pendingInvites: PairInviteDTO[] = [];

    for (const [, invite] of pairInvites) {
      if (invite.status === 'pending' && (invite.fromUserId === userId || invite.toUserId === userId)) {
        pendingInvites.push({
          inviteId: invite.inviteId,
          fromUserId: invite.fromUserId,
          fromUsername: invite.fromUsername,
          toUserId: invite.toUserId,
          toUsername: invite.toUsername,
          ranked: invite.ranked,
          status: invite.status,
          createdAt: new Date(invite.createdAt).toISOString(),
        });
      }
    }

    return reply.send(pendingInvites);
  });

  // DELETE /api/pair-invite/:inviteId — cancel a pair invite (sender only)
  app.delete<{ Params: { inviteId: string } }>(
    '/:inviteId',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };
      const invite = pairInvites.get(request.params.inviteId);

      if (!invite) {
        return reply.status(404).send({ error: 'Pair invite not found' });
      }

      if (invite.fromUserId !== userId) {
        return reply.status(403).send({ error: 'Only the sender can cancel the invite' });
      }

      pairInvites.delete(invite.inviteId);
      return reply.send({ message: 'Pair invite cancelled' });
    },
  );
};
