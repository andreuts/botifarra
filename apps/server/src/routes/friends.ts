import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type {
  FriendDTO,
  FriendRequestDTO,
  FriendsListResponse,
  SendFriendRequestPayload,
  FriendRequestActionPayload,
} from '@botifarra/shared';

// ---------------------------------------------------------------------------
// In-memory active-game tracker — populated by BotifarraRoom lifecycle hooks
// ---------------------------------------------------------------------------

/** Maps userId → Colyseus roomId for users currently in a game */
const activeGameMap = new Map<string, string>();

export function setUserActiveGame(userId: string, roomId: string) {
  activeGameMap.set(userId, roomId);
}

export function clearUserActiveGame(userId: string) {
  activeGameMap.delete(userId);
}

export function getUserActiveGame(userId: string): string | undefined {
  return activeGameMap.get(userId);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const friendsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/friends — list friends, incoming requests, outgoing requests
  app.get('/', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string };

    // Accepted friendships (either direction)
    const acceptedFriendships = await app.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
    });

    const friends: FriendDTO[] = acceptedFriendships.map((f) => {
      const friendUser = f.requesterId === userId ? f.addressee : f.requester;
      const activeRoomId = activeGameMap.get(friendUser.id);
      return {
        userId: friendUser.id,
        username: friendUser.username,
        inGame: !!activeRoomId,
        ...(activeRoomId ? { activeRoomId } : {}),
      };
    });

    // Incoming pending requests
    const incomingPending = await app.prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      include: {
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
    });

    const incoming: FriendRequestDTO[] = incomingPending.map((f) => ({
      friendshipId: f.id,
      fromUserId: f.requester.id,
      fromUsername: f.requester.username,
      toUserId: f.addressee.id,
      toUsername: f.addressee.username,
      status: 'pending',
      createdAt: f.createdAt.toISOString(),
    }));

    // Outgoing pending requests
    const outgoingPending = await app.prisma.friendship.findMany({
      where: { requesterId: userId, status: 'PENDING' },
      include: {
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
    });

    const outgoing: FriendRequestDTO[] = outgoingPending.map((f) => ({
      friendshipId: f.id,
      fromUserId: f.requester.id,
      fromUsername: f.requester.username,
      toUserId: f.addressee.id,
      toUsername: f.addressee.username,
      status: 'pending',
      createdAt: f.createdAt.toISOString(),
    }));

    const response: FriendsListResponse = { friends, incoming, outgoing };
    return reply.send(response);
  });

  // POST /api/friends/request — send a friend request by username
  app.post('/request', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string };
    const body = request.body as SendFriendRequestPayload;

    if (!body.username || typeof body.username !== 'string') {
      return reply.status(400).send({ error: 'Username is required' });
    }

    const targetUser = await app.prisma.user.findUnique({
      where: { username: body.username },
    });

    if (!targetUser) {
      return reply.status(404).send({ error: 'User not found' });
    }

    if (targetUser.id === userId) {
      return reply.status(400).send({ error: 'Cannot send a friend request to yourself' });
    }

    // Check if a friendship already exists (either direction)
    const existing = await app.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: userId, addresseeId: targetUser.id },
          { requesterId: targetUser.id, addresseeId: userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return reply.status(409).send({ error: 'Already friends' });
      }
      return reply.status(409).send({ error: 'Friend request already exists' });
    }

    const friendship = await app.prisma.friendship.create({
      data: {
        requesterId: userId,
        addresseeId: targetUser.id,
        status: 'PENDING',
      },
      include: {
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
    });

    const dto: FriendRequestDTO = {
      friendshipId: friendship.id,
      fromUserId: friendship.requester.id,
      fromUsername: friendship.requester.username,
      toUserId: friendship.addressee.id,
      toUsername: friendship.addressee.username,
      status: 'pending',
      createdAt: friendship.createdAt.toISOString(),
    };

    return reply.status(201).send(dto);
  });

  // POST /api/friends/respond — accept or reject a friend request
  app.post('/respond', { onRequest: [(app as any).authenticate] }, async (request, reply) => {
    const { sub: userId } = (request as any).user as { sub: string };
    const body = request.body as FriendRequestActionPayload;

    if (!body.friendshipId || !body.action) {
      return reply.status(400).send({ error: 'friendshipId and action are required' });
    }

    if (body.action !== 'accept' && body.action !== 'reject') {
      return reply.status(400).send({ error: 'action must be "accept" or "reject"' });
    }

    const friendship = await app.prisma.friendship.findUnique({
      where: { id: body.friendshipId },
    });

    if (!friendship) {
      return reply.status(404).send({ error: 'Friend request not found' });
    }

    // Only the addressee can respond
    if (friendship.addresseeId !== userId) {
      return reply.status(403).send({ error: 'Only the recipient can respond to a friend request' });
    }

    if (friendship.status !== 'PENDING') {
      return reply.status(409).send({ error: 'Friend request already resolved' });
    }

    if (body.action === 'accept') {
      const updated = await app.prisma.friendship.update({
        where: { id: body.friendshipId },
        data: { status: 'ACCEPTED' },
      });
      return reply.send({ message: 'Friend request accepted', friendshipId: updated.id });
    } else {
      await app.prisma.friendship.delete({
        where: { id: body.friendshipId },
      });
      return reply.send({ message: 'Friend request rejected' });
    }
  });

  // DELETE /api/friends/:friendUserId — remove a friendship
  app.delete<{ Params: { friendUserId: string } }>(
    '/:friendUserId',
    { onRequest: [(app as any).authenticate] },
    async (request, reply) => {
      const { sub: userId } = (request as any).user as { sub: string };
      const { friendUserId } = request.params;

      const friendship = await app.prisma.friendship.findFirst({
        where: {
          status: 'ACCEPTED',
          OR: [
            { requesterId: userId, addresseeId: friendUserId },
            { requesterId: friendUserId, addresseeId: userId },
          ],
        },
      });

      if (!friendship) {
        return reply.status(404).send({ error: 'Friendship not found' });
      }

      await app.prisma.friendship.delete({
        where: { id: friendship.id },
      });

      return reply.send({ message: 'Friendship removed' });
    },
  );
};
