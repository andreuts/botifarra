// ---------------------------------------------------------------------------
// Friendship DTOs
// ---------------------------------------------------------------------------

export type FriendshipStatus = 'pending' | 'accepted';

export interface FriendRequestDTO {
  friendshipId: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  status: FriendshipStatus;
  createdAt: string;
}

export interface FriendDTO {
  userId: string;
  username: string;
  /** Whether the friend is currently in a game room */
  inGame: boolean;
  /** The Colyseus room ID if the friend is in-game (for spectating) */
  activeRoomId?: string;
}

export interface SendFriendRequestPayload {
  username: string;
}

export interface FriendRequestActionPayload {
  friendshipId: string;
  action: 'accept' | 'reject';
}

export interface FriendsListResponse {
  friends: FriendDTO[];
  incoming: FriendRequestDTO[];
  outgoing: FriendRequestDTO[];
}

// ---------------------------------------------------------------------------
// Pair Invite DTOs (for premade partner queue)
// ---------------------------------------------------------------------------

export interface PairInviteDTO {
  inviteId: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  toUsername: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  ranked: boolean;
  createdAt: string;
}

export interface SendPairInvitePayload {
  friendUserId: string;
  ranked?: boolean;
}

export interface PairInviteActionPayload {
  inviteId: string;
  action: 'accept' | 'reject';
}
