# Botifarra Online

[![CI](https://github.com/andreujuanc/botifarra/actions/workflows/ci.yml/badge.svg)](https://github.com/andreujuanc/botifarra/actions/workflows/ci.yml)

A modern, full-stack multiplayer implementation of the Catalan card game **Botifarra**, built as a PWA-first web application with a strongly-typed shared game engine.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Monorepo Structure](#monorepo-structure)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [Game Engine (`botifarra-core`)](#game-engine-botifarra-core)
- [Shared Package](#shared-package)
- [Backend (`server`)](#backend-server)
- [Frontend (`web`)](#frontend-web)
- [Database](#database)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

---

## Project Overview

Botifarra is a 4-player trick-taking card game played with the 48-card Catalan deck. This project implements it as:

- **Mobile-first Progressive Web App** (primary target)
- **Android app** via Capacitor (future)
- **macOS desktop** via Tauri (future)

Core design goals:

| Goal                      | Approach                                                       |
| ------------------------- | -------------------------------------------------------------- |
| Authoritative multiplayer | All game logic lives on the server — clients are thin          |
| Shared game logic         | Single `botifarra-core` package used on both client and server |
| Strong typing             | Full TypeScript across the entire monorepo                     |
| Correctness by default    | Test-Driven Development throughout                             |
| Incremental complexity    | Start simple, scale when needed                                |

---

## Architecture

```
                ┌─────────────────────────┐
                │  React/Vite PWA         │
                │  (Capacitor / Tauri)    │
                └─────────┬───────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
     REST API                       Colyseus Rooms
  auth · profile                   real-time game
  history · rankings                WebSocket
          │                               │
          └───────────────┬───────────────┘
                          │
                   Fastify Server
                   Node.js + TypeScript
                          │
          ┌───────────────┴───────────────┐
          │                               │
     PostgreSQL                     Redis / Valkey
   (Prisma ORM)                 (pub/sub, presence)
```

### Data flow during gameplay

```
Client Command  →  Colyseus Room  →  botifarra-core validation
                                  →  State transition
                                  →  Persist event (PostgreSQL)
                                  →  Broadcast safe state to all seats
```

---

## Monorepo Structure

```
botifarra/
├── apps/
│   ├── server/                 # Fastify + Colyseus backend
│   │   ├── prisma/
│   │   │   └── schema.prisma   # Database schema
│   │   └── src/
│   │       ├── index.ts        # Entry point
│   │       ├── app.ts          # Fastify app factory
│   │       ├── plugins/        # Fastify plugins (Prisma, JWT, …)
│   │       ├── routes/         # REST API route handlers
│   │       ├── rooms/          # Colyseus game rooms
│   │       └── services/       # Business logic (matchmaking, …)
│   └── web/                    # React + Vite PWA
│       └── src/
│           ├── main.tsx        # App entry point
│           ├── App.tsx         # Router
│           ├── api/            # Typed fetch client
│           ├── pages/          # Route page components
│           └── store/          # Zustand state stores
│
├── packages/
│   ├── botifarra-core/         # Pure game rules engine (no I/O)
│   │   └── src/
│   │       ├── types.ts        # All shared game types
│   │       ├── deck.ts         # Deck, shuffle, deal, card values
│   │       ├── legal-moves.ts  # Move validation
│   │       ├── trick.ts        # Trick resolution
│   │       ├── scoring.ts      # Round scoring & capot
│   │       ├── round.ts        # Round state machine
│   │       ├── game.ts         # Multi-round game state
│   │       └── bot.ts          # Random bot (Level 1)
│   └── shared/                 # DTOs, commands, events (no logic)
│       └── src/
│           ├── auth.dto.ts
│           ├── user.dto.ts
│           ├── match.dto.ts
│           ├── commands.ts     # Client → Server commands
│           └── events.ts       # Server → Client events
│
├── docker-compose.yml          # PostgreSQL + Redis for local dev
├── package.json                # Workspace root
└── pnpm-workspace.yaml
```

---

## Technology Stack

### Frontend

| Tool            | Purpose                       |
| --------------- | ----------------------------- |
| React 19        | UI framework                  |
| TypeScript      | Type safety                   |
| Vite            | Build tool & dev server       |
| React Router 7  | Client-side routing           |
| TanStack Query  | Server state & caching        |
| Zustand         | Client state (auth, game UI)  |
| vite-plugin-pwa | PWA manifest + service worker |

### Backend

| Tool           | Purpose                          |
| -------------- | -------------------------------- |
| Fastify 5      | HTTP framework                   |
| Colyseus       | Real-time game rooms (WebSocket) |
| Prisma 6       | ORM                              |
| PostgreSQL 17  | Primary database                 |
| Redis 8        | Pub/sub, presence (optional)     |
| argon2         | Password hashing                 |
| `@fastify/jwt` | JWT authentication               |

### Shared

| Tool                | Purpose                              |
| ------------------- | ------------------------------------ |
| `@botifarra/core`   | Pure game rules engine               |
| `@botifarra/shared` | Shared types, DTOs, events, commands |
| TypeScript          | End-to-end type safety               |

### Testing

| Tool       | Purpose                   |
| ---------- | ------------------------- |
| Vitest     | Unit + integration tests  |
| Playwright | End-to-end tests (future) |

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 10 (`npm install -g pnpm`)
- **Docker Desktop** (for PostgreSQL + Redis)

### 1. Clone & install

```bash
git clone <repo-url>
cd botifarra
pnpm install
```

### 2. Start infrastructure

```bash
docker compose up -d
```

This starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

### 3. Configure environment

```bash
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env if needed (defaults work with docker-compose)
```

### 4. Run database migrations

```bash
pnpm --filter @botifarra/server db:generate
pnpm --filter @botifarra/server db:migrate
```

### 5. Start development servers

```bash
pnpm dev
```

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000
- **Health check**: http://localhost:3000/health

---

## Development

### Commands

| Command                                      | Description                        |
| -------------------------------------------- | ---------------------------------- |
| `pnpm dev`                                   | Start all apps in watch mode       |
| `pnpm build`                                 | Build all packages and apps        |
| `pnpm test`                                  | Run all tests across the workspace |
| `pnpm test:e2e`                              | Run Playwright E2E browser tests   |
| `pnpm lint`                                  | ESLint across entire monorepo      |
| `pnpm format:check`                          | Prettier format check (CI)         |
| `pnpm --filter @botifarra/core test`         | Run only game engine tests         |
| `pnpm --filter @botifarra/core test:watch`   | Watch mode for game engine         |
| `pnpm --filter @botifarra/web test`          | Run only frontend component tests  |
| `pnpm --filter @botifarra/server db:migrate` | Run DB migrations                  |
| `pnpm --filter @botifarra/server db:studio`  | Open Prisma Studio                 |

### TDD workflow

This project follows strict **Test-Driven Development**:

```
RED → GREEN → REFACTOR
```

1. Write a failing test first
2. Implement the minimum code to make it pass
3. Refactor safely under test coverage

**No game logic should be written without a test first.** This is especially enforced in `botifarra-core`.

---

## Testing

### Current test suite

```
packages/botifarra-core  — 80 tests, 7 test files
  ✓ deck.test.ts          (27 tests)  deck creation, shuffle, deal, card values
  ✓ legal-moves.test.ts   (10 tests)  follow-suit, trump, overtrump rules
  ✓ trick.test.ts          (5 tests)  trick resolution, trump beats, botifarra
  ✓ scoring.test.ts        (5 tests)  card points, capot, round scoring
  ✓ round.test.ts         (19 tests)  state machine, phase transitions, play flow
  ✓ game.test.ts           (9 tests)  multi-round game, dealer rotation, winner
  ✓ bot.test.ts            (5 tests)  random bot always returns a legal move
```

### Run tests

```bash
# All tests
pnpm test

# Game engine only (fastest)
pnpm --filter @botifarra/core test

# Watch mode
pnpm --filter @botifarra/core test:watch

# Coverage
pnpm --filter @botifarra/core test:coverage
```

---

## Game Engine (`botifarra-core`)

The package `@botifarra/core` is the heart of the project. It is:

- **Pure** — no I/O, no UI, no network
- **Deterministic** — same inputs always produce the same outputs
- **Heavily tested** — TDD throughout
- **Used by both server and client** — shared via the monorepo

### Card system

The Catalan 48-card deck: 4 suits × 12 ranks.

| Suit      | Catalan name |
| --------- | ------------ |
| `oros`    | Coins        |
| `copes`   | Cups         |
| `espases` | Swords       |
| `bastos`  | Clubs        |

Ranks 1–12, where:

- `1` = As (Ace) — 11 points
- `9` = Manilla — 9 points (**highest trump power**)
- `12` = Rei (King) — 4 points
- `11` = Cavall (Horse) — 3 points
- `10` = Sota (Jack) — 2 points
- `2–8` = 0 points

Total card points per deck: **116**.

### Trump power order

```
9 (Manilla) > 1 (As) > 12 (Rei) > 11 (Cavall) > 10 (Sota) > 8 > 7 > 6 > 5 > 4 > 3 > 2
```

### Trump declarations

| Declaration                             | Meaning                    |
| --------------------------------------- | -------------------------- |
| `oros` / `copes` / `espases` / `bastos` | That suit is trump         |
| `botifarra`                             | No trump — all suits equal |

### Legal move rules

In order of priority:

1. **Leading** (empty trick) — any card
2. **Must follow suit** if you have it
3. **Must trump** if void in led suit and trump is available
4. **Must overtrump** if opponents are winning with trump and you can beat it
5. Partner winning the trick → overtrump obligation lifted
6. Void in led suit and no trump → any card
7. `botifarra` mode — follow suit only; no trump obligation

### Phase transition

```
createRound()
  └─► declaring phase
        └─► declareTrump()
              └─► playing phase
                    └─► playCard() × 48
                          └─► scoring phase
```

### Example usage

```typescript
import {
  createDeck,
  shuffleDeck,
  dealHands,
  createRound,
  declareTrump,
  playCard,
  currentPlayerSeat,
  legalMoves,
  scoreRound,
  createGame,
  startNextRound,
  applyRoundScore,
  randomBotMove,
  randomBotDeclareTrump,
} from '@botifarra/core';

// Set up a round
const hands = dealHands(shuffleDeck(createDeck()));
let round = createRound({ dealerSeat: 0, hands });

// Declare trump (done by declarant = partner of dealer)
round = declareTrump(round, 'oros');

// Play cards
while (round.completedTricks.length < 12) {
  const seat = currentPlayerSeat(round)!;
  const legal = legalMoves({
    hand: round.hands[seat],
    currentTrick: round.currentTrick,
    trump: round.trump!,
    playerSeat: seat,
  });
  round = playCard(round, seat, legal[0]!); // or use randomBotMove(round, seat)
}

// Score the round
const score = scoreRound(round.completedTricks, round.trump!);
console.log(score); // { cardPoints: [X, Y], capot: false, matchPoints: [1, 0] }
```

---

## Shared Package

`@botifarra/shared` contains types shared by both frontend and backend:

| File           | Contents                                                          |
| -------------- | ----------------------------------------------------------------- |
| `auth.dto.ts`  | `RegisterRequest/Response`, `LoginRequest/Response`, `MeResponse` |
| `user.dto.ts`  | `UserProfileDTO`, `UserStatsDTO`                                  |
| `match.dto.ts` | `MatchDTO`, `PlayerGameStateDTO`, `MatchHistoryItemDTO`           |
| `commands.ts`  | `DeclareTrumpCommand`, `PlayCardCommand`, `JoinQueueCommand`, …   |
| `events.ts`    | `GameStateEvent`, `CardPlayedEvent`, `TrickCompletedEvent`, …     |

**Rule**: Never duplicate these types in the frontend or backend. Always import from `@botifarra/shared`.

---

## Backend (`server`)

### REST API

| Method | Path                       | Auth | Description          |
| ------ | -------------------------- | ---- | -------------------- |
| `POST` | `/api/auth/register`       | —    | Create account       |
| `POST` | `/api/auth/login`          | —    | Sign in, receive JWT |
| `GET`  | `/api/users/me`            | ✓    | Own profile          |
| `GET`  | `/api/users/:userId`       | —    | Public profile       |
| `GET`  | `/api/matches`             | ✓    | Recent matches       |
| `GET`  | `/api/matches/:matchId`    | ✓    | Match details        |
| `POST` | `/api/matches/queue/join`  | ✓    | Join public queue    |
| `POST` | `/api/matches/queue/leave` | ✓    | Leave queue          |
| `GET`  | `/health`                  | —    | Health check         |

### Authentication

JWT-based. Include the token from `/api/auth/login` as a `Bearer` token:

```
Authorization: Bearer <accessToken>
```

### Real-time (Colyseus)

Game rooms are managed by Colyseus. The client connects via WebSocket to a `BotifarraRoom` and sends `ClientCommand` messages. The server validates every command using `@botifarra/core` and broadcasts `ServerEvent` messages to all connected seats.

### Environment variables

| Variable       | Default                  | Description                       |
| -------------- | ------------------------ | --------------------------------- |
| `PORT`         | `3000`                   | HTTP port                         |
| `DATABASE_URL` | —                        | PostgreSQL connection string      |
| `REDIS_URL`    | `redis://localhost:6379` | Redis URL                         |
| `JWT_SECRET`   | —                        | **Must be changed in production** |
| `CORS_ORIGIN`  | `http://localhost:5173`  | Allowed frontend origin           |

---

## Frontend (`web`)

### Routes

| Path              | Component      | Auth |
| ----------------- | -------------- | ---- |
| `/login`          | `LoginPage`    | —    |
| `/register`       | `RegisterPage` | —    |
| `/`               | `HomePage`     | ✓    |
| `/match/:matchId` | `GamePage`     | ✓    |

### State management

| Store                               | Purpose                        |
| ----------------------------------- | ------------------------------ |
| `useAuthStore` (Zustand, persisted) | JWT token, current user        |
| TanStack Query                      | Server data (matches, profile) |
| Colyseus `Room` state               | Live game state (future)       |

### PWA

The app ships with a full PWA manifest and auto-updating service worker via `vite-plugin-pwa`. It can be installed on mobile home screens and works offline for static pages.

---

## Database

### Schema overview

```
User ──── UserStats
  │
  └──── MatchPlayer ──── Match ──── MatchEvent
```

- **User** — authentication + profile
- **UserStats** — denormalised counters + rating
- **Match** — game lifecycle + scores
- **MatchPlayer** — seat assignments (0–3)
- **MatchEvent** — append-only event log (enables replay & debugging)

### Migrations

```bash
# Create and apply a new migration
pnpm --filter @botifarra/server db:migrate

# Generate Prisma client after schema changes
pnpm --filter @botifarra/server db:generate

# Open Prisma Studio (database browser)
pnpm --filter @botifarra/server db:studio
```

---

## Internationalisation (i18n)

The web app is fully internationalised using [i18next](https://www.i18next.com/) with **Catalan (`ca`) as the default language**.

| Language | File                                      | Status   |
| -------- | ----------------------------------------- | -------- |
| Catalan  | `apps/web/src/i18n/locales/ca.json`       | Complete |
| Spanish  | `apps/web/src/i18n/locales/es.json`       | Complete |

The browser language is auto-detected and cached in `localStorage`. To add a new language, create a matching JSON file and register it in `apps/web/src/i18n/index.ts`.

---

## Deployment

### MVP targets

| Component | Options                                  |
| --------- | ---------------------------------------- |
| Frontend  | Vercel · Netlify · Cloudflare Pages      |
| Backend   | Fly.io · Railway · Render · VPS          |
| Database  | Managed PostgreSQL (Supabase, Neon, RDS) |

### Environment checklist (production)

- [ ] Set a strong random `JWT_SECRET`
- [ ] Set `DATABASE_URL` to production PostgreSQL
- [ ] Set `CORS_ORIGIN` to the production frontend URL
- [ ] Run `prisma migrate deploy` (not `dev`) on deploy
- [ ] Enable HTTPS (TLS termination at proxy or PaaS)

---

## Roadmap

### ✅ Phase 0 — Foundation

- [x] pnpm monorepo
- [x] Docker Compose (PostgreSQL + Redis)
- [x] TypeScript throughout
- [x] Shared packages

### ✅ Phase 1 — Game Engine

- [x] 48-card Catalan deck
- [x] Legal move validation (follow-suit, trump, overtrump, partner exemption)
- [x] Trick resolution
- [x] Scoring & capot
- [x] Round state machine
- [x] Multi-round game state
- [x] Random bot (Level 1)
- [x] Heuristic bot (Level 2)
- [x] 87 tests, full TDD

### ✅ Phase 2 — Authentication & Backend

- [x] Fastify app skeleton
- [x] Prisma schema + migrations
- [x] Register / login (argon2 + JWT)
- [x] User profile routes
- [x] Match history routes
- [x] Server integration tests (Vitest)
- [x] 78 server tests

### ✅ Phase 3 — Real-time Multiplayer

- [x] Colyseus `BotifarraRoom` with full game loop
- [x] Matchmaking service (public queue)
- [x] Full game loop in room (declare → play → score)
- [x] Reconnect handling (60s timeout)
- [x] Hidden-information enforcement (send only own hand)
- [x] Player names visible to all seats

### ✅ Phase 4 — Persistence

- [x] Persist match results on game end
- [x] Match history display (REST + frontend page)
- [x] Stats update on match end (wins/losses/played)
- [x] Rating updates (Elo-style)

### ✅ Phase 5 — Matchmaking & Private Rooms

- [x] Public matchmaking queue
- [x] Private invite rooms with 6-char invite codes
- [x] Bot-filled practice games (PracticeRoom)

### ✅ Phase 6 — Rankings

- [x] Individual rating (Elo-style)
- [x] Global leaderboard page

### ✅ Phase 7 — UI Polish

- [x] Team-colored scoreboard with player names
- [x] CSS grid trick area with seat badges
- [x] Turn indicator with player names
- [x] Game-over overlay with team scores
- [x] Toast notifications for game events
- [x] Connection status indicator
- [x] Mobile-responsive layout
- [x] Dark theme design system

### ⬜ Phase 8 — Remaining Features

- [ ] Pair/team matchmaking (queue as a pair)
- [ ] Game timers (per-turn time limit)
- [ ] In-game chat
- [ ] Spectator mode
- [ ] Sound effects & animations
- [ ] Level 3 bot (Monte Carlo search)
- [ ] Match replay (trick-by-trick history)

### ⬜ Phase 9 — Packaging

- [ ] Android via Capacitor
- [ ] macOS via Tauri

See `ARCHITECTURE.md` for detailed technical documentation and `CONTRIBUTING.md` for development workflow.

---

## Development Philosophy

> Build it correct before building it fast. Build it tested before building it complete.

- **Simplicity** over cleverness
- **Shared logic** — write once, use everywhere
- **Authoritative server** — the client never decides if a move is valid
- **Event-driven** — commands in, events out, state is derived
- **TDD** — every rule has a test, every test has a rule
