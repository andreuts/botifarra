# Architecture — Botifarra Online

This document describes the system architecture, data flow, and key design decisions for developers who need to understand how the pieces fit together.

---

## System Overview

```
┌──────────────────────────────────────────────────────────┐
│                    React PWA (Vite)                       │
│                                                          │
│  Pages:  Login · Register · Home · Game · History · Rank │
│  State:  Zustand (auth, game) · TanStack Query (REST)   │
│  Comms:  fetch (REST) · colyseus.js (WebSocket)         │
└────────────┬────────────────────┬────────────────────────┘
             │ REST /api/*        │ WebSocket /colyseus
             ▼                    ▼
┌──────────────────────────────────────────────────────────┐
│                  Fastify + Colyseus Server                │
│                                                          │
│  REST routes: auth · users · matches · rankings · rooms  │
│  Rooms:       BotifarraRoom · PracticeRoom               │
│  Services:    matchmaking · persistence                   │
└────────────┬────────────────────┬────────────────────────┘
             │                    │
             ▼                    ▼
     ┌──────────────┐    ┌──────────────┐
     │  PostgreSQL   │    │    Redis     │
     │  (Prisma)     │    │  (Colyseus)  │
     └──────────────┘    └──────────────┘
```

---

## Package Dependency Graph

```
apps/web ──────────► packages/shared ──────────► packages/botifarra-core
                          ▲
apps/server ──────────────┘
```

- **botifarra-core**: Zero-dependency pure TypeScript game engine. Deck, tricks, rounds, scoring, legal moves, bots.
- **shared**: DTOs, command types, and event types used by both server and client. Depends on core for Card/Seat/etc types.
- **server**: Fastify REST API + Colyseus WebSocket rooms. Imports shared and core.
- **web**: React SPA. Imports shared for types, uses colyseus.js SDK for real-time.

---

## Game Engine (`botifarra-core`)

The engine is pure functional — no side effects, no I/O, no randomness (except deck shuffle). Every function takes state in and returns new state out.

### Key modules

| Module             | Responsibility                                      |
| ------------------ | --------------------------------------------------- |
| `deck.ts`          | 48-card Catalan deck, shuffle                       |
| `trick.ts`         | Trick resolution (who wins a trick)                 |
| `legal-moves.ts`   | Which cards can be legally played                   |
| `round.ts`         | Round state machine (deal → declare → play → score) |
| `scoring.ts`       | Point counting, capot detection                     |
| `game.ts`          | Multi-round game (play to target score)             |
| `bot.ts`           | Random bot (Level 1)                                |
| `heuristic-bot.ts` | Rule-based bot (Level 2)                            |

### State hierarchy

```
GameState
├── scores: [teamA, teamB]
├── roundNumber: number
└── RoundState
    ├── dealerSeat: Seat (0-3)
    ├── declarantSeat: Seat
    ├── trump: Suit | 'botifarra' | null
    ├── hands: [Card[], Card[], Card[], Card[]]
    ├── currentTrick: PlayedCard[]
    ├── completedTricks: CompletedTrick[]
    ├── currentLeader: Seat
    └── roundScores: RoundScore[]
```

### Round lifecycle

```
deal() → declaring phase → trump declared →
  playing phase → 12 tricks → round scored →
    check game over? → next round or game finished
```

---

## Server Architecture

### Request handling

```
                              ┌─── /api/auth/*        → auth.ts
                              ├─── /api/users/*       → users.ts
Client ──── HTTP ────► Fastify┼─── /api/matches/*     → matches.ts
                              ├─── /api/rankings/*    → rankings.ts
                              ├─── /api/rooms/*       → rooms.ts (private rooms)
                              └─── /api/queue/*       → queue.ts (matchmaking)

Client ──── WS ──────► Colyseus ─── BotifarraRoom
                                └── PracticeRoom
```

### Authentication flow

1. Client sends `POST /api/auth/register` or `POST /api/auth/login`
2. Server validates credentials, returns JWT
3. Client stores JWT in Zustand `authStore` (persisted to localStorage)
4. All subsequent REST calls include `Authorization: Bearer <token>`
5. Colyseus room joins pass the token, userId, and username as options

### Colyseus rooms

#### `BotifarraRoom` (base class)

- Manages 4 human players
- Handles join/leave/reconnect
- Routes commands (`declare_trump`, `play_card`) through `game-logic.ts`
- Broadcasts personalized `game_state` to each player (hides opponents' hands)
- Persists match results to PostgreSQL on game end
- Sends player names (`playerNames: Record<Seat, string>`) in every state update

#### `PracticeRoom` (extends BotifarraRoom)

- `maxClients = 1` — single human
- Injects 3 heuristic bots via `injectBotSeat()`
- `driveBots()` runs on simulation tick — bots play automatically with 500ms delay

### Game logic layer (`game-logic.ts`)

Pure functions that operate on `RoomGameState`:

```typescript
createRoomState(targetScore) → RoomGameState
assignSeat(state, sessionId, userId, username) → { state, seat }
isRoomFull(state) → boolean
startRound(state) → RoomGameState
handleDeclareTrump(state, sessionId, declaration) → { state, events }
handlePlayCard(state, sessionId, card) → { state, events, roundEnded }
buildPlayerState(state, round, seat) → PlayerGameStateDTO
```

This layer is the boundary between Colyseus (framework-specific) and botifarra-core (pure logic). It translates between session IDs and seats.

### Private rooms

Private rooms use invite codes (6-char alphanumeric, e.g. `X7KN3P`):

1. Host calls `POST /api/rooms/create` → gets invite code
2. Host shares code with friends
3. Each player calls `POST /api/rooms/:code/join` → gets `roomId`
4. Players connect to Colyseus room using the `roomId`
5. Codes expire after 30 minutes

The Colyseus room is created lazily on first join (not at code creation time).

### Matchmaking

The matchmaking service maintains an in-memory queue:

1. Player calls `POST /api/queue/join`
2. Server adds player to queue, returns position
3. When 4 players are queued, server creates a Colyseus room
4. All 4 players receive room ID and navigate to the game

---

## Frontend Architecture

### State management

| Store       | Library             | Purpose                                      |
| ----------- | ------------------- | -------------------------------------------- |
| `authStore` | Zustand (persisted) | User session, JWT                            |
| `gameStore` | Zustand             | Active game state, toasts, connection status |
| REST data   | TanStack Query      | Match history, rankings (cached & refetched) |

### Real-time connection (`useGameRoom` hook)

```
useGameRoom(matchId, mode)
├── Creates colyseus.js Client
├── Joins room (botifarra or practice)
├── Listens for messages:
│   ├── game_state → updates gameStore
│   ├── trump_declared → toast notification
│   ├── trick_completed → toast with winner name
│   ├── game_ended → sets gameResult overlay
│   ├── player_connected → toast
│   └── player_disconnected → toast
└── Returns { connect, sendDeclareTrump, sendPlayCard }
```

### Page structure

| Route             | Page             | Description                                            |
| ----------------- | ---------------- | ------------------------------------------------------ |
| `/login`          | LoginPage        | Email/password login                                   |
| `/register`       | RegisterPage     | Account creation                                       |
| `/`               | HomePage         | Lobby with play options, private rooms, recent matches |
| `/match/:matchId` | GamePage         | Active game (multiplayer or private room)              |
| `/play`           | GamePage         | Practice mode (vs bots)                                |
| `/history`        | MatchHistoryPage | Past matches                                           |
| `/rankings`       | RankingsPage     | Global leaderboard                                     |

### Component hierarchy (GamePage)

```
GamePage
├── Scoreboard         (team scores, player names, trump indicator)
├── DeclareTrumpPanel  (suit selection during declaring phase)
├── TrickArea          (CSS grid: 4 seats + center, cards played)
├── HandComponent      (player's cards, clickable for legal moves)
└── Toast overlay      (ephemeral notifications)
```

### CSS design system

Global CSS variables in `index.css`:

```css
--color-bg: #0f1923 /* dark background */ --color-surface: #1a2634 /* card/panel bg */
  --color-surface-2: #243447 /* elevated surface */ --color-team0: #4fc3f7
  /* blue team (seats 0, 2) */ --color-team1: #ff8a65 /* orange team (seats 1, 3) */
  --color-accent: #e91e63 /* CTAs, links */ --color-success: #2ecc71 /* your turn, online */
  --color-danger: #e74c3c /* errors */;
```

---

## Database Schema (Prisma)

```
User
├── id: UUID
├── username: unique
├── passwordHash: argon2
├── rating: Int (default 1000)
├── matchesPlayed/Won/Lost: Int
└── createdAt/updatedAt

Match
├── id: UUID
├── mode: public | private | practice
├── status: waiting | in-progress | finished
├── scores: [Int, Int]
├── targetScore: Int
├── winner: Int (0 or 1)
└── players: MatchPlayer[]

MatchPlayer
├── matchId + userId (composite)
├── seat: 0-3
└── team: 0 or 1
```

---

## Key Design Decisions

### Why Colyseus?

- Purpose-built for game rooms with WebSocket transport
- Handles reconnection, room lifecycle, matchmaking primitives
- Schema-based state sync (we use it minimally — we send custom messages)

### Why server-authoritative?

- Prevents cheating (clients never validate their own moves)
- Single source of truth for game state
- Clients only see their own hand

### Why pure functions in botifarra-core?

- Easy to test (no mocking, no setup)
- Deterministic — same input always produces same output
- Reusable across server (Node.js) and client (browser)
- No framework coupling

### Why in-memory matchmaking/invite codes?

- Simple, fast, zero infrastructure
- Acceptable for single-server deployment
- Can be migrated to Redis when scaling horizontally

---

## Missing Features & Technical Debt

### High priority

- [ ] **Pair/team matchmaking** — queue as a pair, matched with another pair
- [ ] **Game timers** — per-turn time limit with auto-forfeit
- [ ] **Spectator mode** — observe games without playing
- [ ] **Chat** — in-game text chat between players

### Medium priority

- [ ] **Better reconnect UX** — show reconnecting spinner, replay missed state
- [ ] **Match replay** — store and replay trick-by-trick history
- [ ] **Sound effects** — card play, trick win, game over
- [ ] **Animations** — card dealing, trick collection
- [ ] **Level 3 bot** — Monte Carlo tree search or similar

### Low priority / future

- [ ] **Android app** via Capacitor
- [ ] **macOS app** via Tauri
- [ ] **Pair ratings** — rating for specific player pairs
- [ ] **Tournament mode** — bracket-style competitions
- [ ] **i18n** — Catalan, Spanish, English translations
- [ ] **Redis-backed matchmaking** — for horizontal scaling
- [ ] **Event sourcing** — persist every game event for replay/audit

---

## Extending the System

### Adding a new REST endpoint

1. Create route handler in `apps/server/src/routes/`
2. Register it in `apps/server/src/app.ts`
3. Add client method in `apps/web/src/api/client.ts`
4. Add types to `packages/shared/` if new DTOs are needed

### Adding a new game event

1. Define the event type in `packages/shared/src/events.ts`
2. Broadcast it from `BotifarraRoom.ts` or `game-logic.ts`
3. Handle it in `apps/web/src/hooks/useGameRoom.ts`
4. Update UI components as needed

### Adding a new Colyseus room type

1. Create a class extending `BotifarraRoom` in `apps/server/src/rooms/`
2. Register it in `apps/server/src/index.ts` (`gameServer.define(...)`)
3. Add join logic in the frontend (new mode in HomePage/GamePage)
