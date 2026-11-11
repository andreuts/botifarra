// ---------------------------------------------------------------------------
// Friendship DTOs
// ---------------------------------------------------------------------------

export type FriendshipStatus = 'pending' | 'accepted';

export interface FriendRequestDTO {
  friendshipId: string;
  fromUserId: string;
  fromUsername: string;
  fromTownLabel: string | null;
  toUserId: string;
  toUsername: string;
  toTownLabel: string | null;
  status: FriendshipStatus;
  createdAt: string;
}

export interface FriendDTO {
  userId: string;
  username: string;
  townLabel: string | null;
  /** Whether the friend is currently in a game room */
  inGame: boolean;
  /** The Colyseus room ID if the friend is in-game (for spectating) */
  activeRoomId?: string;
  /** Ranked ELO rating (undefined if they have never played ranked) */
  individualRating?: number;
  /** Global leaderboard rank position (1 = highest rating) */
  rankPosition?: number;
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
  fromTownLabel: string | null;
  toUserId: string;
  toUsername: string;
  toTownLabel: string | null;
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
