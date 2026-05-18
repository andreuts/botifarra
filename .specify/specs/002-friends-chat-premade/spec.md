# Feature Specification: Friends System, Game Chat & Premade Partner Queue

**Feature Branch**: `002-friends-chat-premade`

**Created**: 2026-05-14

**Status**: Draft

**Input**: User request for social features — friend system with accept/reject, friend game observation, in-game chat, and premade partner matchmaking.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Friend Request System (Priority: P1)

A player can send a friend request to another user by username. The recipient can accept or reject the petition. Both users can see their friends list and pending requests.

**Why this priority**: Friends are the foundation for observation and premade partner queue features.

**Independent Test**: User A sends a friend request to User B. User B accepts. Both see each other in their friends list.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they send a friend request to another user by username, **Then** the request is created with status `PENDING`
2. **Given** a pending friend request, **When** the recipient accepts, **Then** both users appear in each other's friends list
3. **Given** a pending friend request, **When** the recipient rejects, **Then** the request is deleted and no friendship exists
4. **Given** a user, **When** they view their friends page, **Then** they see accepted friends, incoming requests, and outgoing requests
5. **Given** user A and user B are friends, **When** either cancels the friendship, **Then** both are removed from each other's friends list
6. **Given** a user tries to befriend themselves, **When** the request is sent, **Then** the server returns an error

---

### User Story 2 - Observe Friend's Game (Priority: P2)

When two users are friends, either can see the other's live game as a spectator (observer). Observers see the public game state (current trick, completed tricks, scores) but NOT any player's hand.

**Why this priority**: Core social feature that gives value to the friends system.

**Independent Test**: User A (friend of User B) navigates to observe User B's active game and sees the game state updating in real-time.

**Acceptance Scenarios**:

1. **Given** a user's friend is playing a game, **When** the user checks their friends list, **Then** they see the friend's status as "in game" with a spectate button
2. **Given** a user clicks spectate, **When** they join the room as observer, **Then** they see the game state without any player's hand
3. **Given** an observer is watching, **When** a card is played, **Then** the observer sees the update in real-time
4. **Given** an observer, **When** the game ends, **Then** the observer sees the final result
5. **Given** a non-friend, **When** they try to observe a game, **Then** they are denied access

---

### User Story 3 - Game Room Chat (Priority: P1)

Players in a game room can send short text messages visible to all players (and observers) in that room. Messages are ephemeral (not persisted to DB).

**Why this priority**: Essential social interaction during gameplay.

**Independent Test**: Player A sends a chat message, all other players and observers in the room see it immediately.

**Acceptance Scenarios**:

1. **Given** a player in a game room, **When** they send a chat message, **Then** all players in the room receive it with the sender's username
2. **Given** a message longer than 200 characters, **When** sent, **Then** the server rejects it
3. **Given** an observer, **When** a chat message is sent, **Then** the observer also sees it
4. **Given** a player, **When** they send messages too rapidly (>5 per 3 seconds), **Then** the server rate-limits them
5. **Given** the game ends, **When** the room closes, **Then** chat history is lost (ephemeral)

---

### User Story 4 - Premade Partner Queue (Priority: P1)

A player can invite a friend to queue together as a pair for matchmaking. Both players must confirm before entering the queue. They are placed on the same team (seats 0,2).

**Why this priority**: Major gameplay feature enabling coordinated team play.

**Independent Test**: User A invites friend User B to queue as a pair. User B accepts. Both enter the queue. When matched with 2 others, they are on the same team.

**Acceptance Scenarios**:

1. **Given** two friends, **When** user A invites user B to queue as a pair, **Then** a pair invite is created
2. **Given** a pair invite, **When** user B accepts, **Then** both are added to the matchmaking queue as a pair
3. **Given** a pair invite, **When** user B rejects, **Then** the invite is cancelled and neither enters the queue
4. **Given** a paired queue entry, **When** matched with 2 singles or another pair, **Then** the pair is placed on the same team (seats 0, 2)
5. **Given** user A is not friends with user B, **When** user A tries to pair-queue with user B, **Then** the server returns an error

---

## Technical Approach

### Database Changes
- New `Friendship` model in Prisma schema with `PENDING`/`ACCEPTED` status
- Relations to `User` model for requester and addressee

### Shared Package Changes  
- New DTOs for friendship operations and chat
- New WebSocket events for chat messages and pair invites
- New commands for chat and pair queue

### Server Changes
- New `/api/friends/*` REST routes for CRUD on friendships
- Chat command handler in `BotifarraRoom`
- Observer join mode in `BotifarraRoom` 
- Pair invite system via REST (leverages existing matchmaking pair support)

### Frontend Changes
- New `FriendsPage` component with friend list, requests, search
- `ChatPanel` component for in-game chat
- Updated `HomePage` with pair queue flow via friend selection
- Observer mode in `GamePage`
- New API client methods for friends endpoints
