# Contributing to Botifarra Online

Thank you for your interest in contributing! This document explains how to set up your environment, the development workflow, and how to submit changes.

---

## Prerequisites

| Tool          | Version | Notes                              |
|---------------|--------:|------------------------------------|
| **Node.js**   | ≥ 20    | v25 recommended                    |
| **pnpm**      | ≥ 10    | `npm i -g pnpm`                   |
| **Docker**    | latest  | For PostgreSQL & Redis via Compose |
| **Git**       | latest  |                                    |

---

## First-time setup

```bash
# 1. Clone & install
git clone https://github.com/<your-org>/botifarra.git
cd botifarra
pnpm install

# 2. Start infrastructure
docker compose up -d          # PostgreSQL :5432, Redis :6379

# 3. Set up the database
cp apps/server/.env.example apps/server/.env   # if it doesn't exist
pnpm --filter server exec prisma migrate dev

# 4. Verify everything works
pnpm test       # 165+ tests across all packages
pnpm build      # full TypeScript compilation
```

---

## Day-to-day development

```bash
pnpm dev        # runs server + web concurrently with hot-reload
```

The web app is served at **http://localhost:5173** with Vite's proxy forwarding `/api` and `/colyseus` to the Fastify server on port 3001.

### Useful commands

| Command                     | Description                                |
|-----------------------------|--------------------------------------------|
| `pnpm test`                | Run all tests (core + server)              |
| `pnpm build`               | Build every package                        |
| `pnpm dev`                 | Start dev servers (hot-reload)             |
| `pnpm --filter server test`| Run only server tests                      |
| `pnpm --filter core test`  | Run only game engine tests                 |
| `pnpm --filter server exec prisma studio` | Open Prisma Studio UI     |

---

## Project structure

```
botifarra/
├── packages/
│   ├── botifarra-core/     # Pure game engine (deck, tricks, rounds, scoring, bots)
│   └── shared/             # DTOs and type contracts shared between server & web
├── apps/
│   ├── server/             # Fastify + Colyseus backend
│   └── web/                # React + Vite PWA frontend
```

Each package is independently buildable and testable. The dependency flow is:

```
web → shared → botifarra-core
server → shared → botifarra-core
```

---

## Test-Driven Development (TDD)

This project follows TDD strictly. Every feature starts with a failing test.

### Test locations

| Package          | Test pattern              | Framework |
|------------------|---------------------------|-----------|
| `botifarra-core` | `src/*.test.ts`           | Vitest    |
| `server`         | `src/**/*.test.ts`        | Vitest    |
| `server`         | `src/integration/*.integration.test.ts` | Vitest |

### Writing tests

1. Create a `.test.ts` file next to the module you're testing
2. Write the failing test first — describe the expected behavior
3. Implement the minimal code to pass
4. Refactor with confidence

```typescript
// Example: src/rooms/game-logic.test.ts
import { describe, it, expect } from 'vitest';
import { createRoomState, assignSeat } from './game-logic.js';

describe('assignSeat', () => {
  it('assigns sequential seats', () => {
    let state = createRoomState(12);
    const result = assignSeat(state, 'sess1', 'user1', 'Alice');
    expect(result.seat).toBe(0);
  });
});
```

### Integration tests

Integration tests (`*.integration.test.ts`) test the full Fastify app with database access and API endpoints. They use Prisma with a test database.

---

## Code style

- **TypeScript strict mode** — no `any` unless absolutely necessary
- **ESM imports** with `.js` extensions (required for Node.js ESM + TypeScript)
- **Functional style** in `botifarra-core` — pure functions, immutable state transitions
- **No classes** in game logic — only plain objects and functions
- **Colyseus rooms** use classes (required by framework)
- **Tabs → 2 spaces**, semicolons, single quotes

### Naming conventions

| Element         | Convention              | Example                      |
|-----------------|-------------------------|------------------------------|
| Files           | kebab-case              | `game-logic.ts`              |
| Types/Interfaces| PascalCase              | `PlayerGameStateDTO`         |
| Functions       | camelCase               | `handlePlayCard`             |
| Constants       | SCREAMING_SNAKE_CASE    | `BOT_USERNAMES`              |
| React components| PascalCase              | `TrickArea.tsx`              |

---

## Submitting changes

### Branch naming

```
feature/private-rooms
fix/reconnect-timeout
docs/architecture-guide
```

### Commit messages

Use conventional commits:

```
feat(rooms): add private room invite codes
fix(core): correct overtrump validation for partner
test(server): add integration tests for matchmaking
docs: update roadmap in README
```

### Pull request checklist

- [ ] All existing tests pass (`pnpm test`)
- [ ] New code has tests
- [ ] Build succeeds (`pnpm build`)
- [ ] No `any` types introduced without justification
- [ ] PR description explains *what* and *why*

---

## Architecture decisions

Key decisions and their rationale:

| Decision | Rationale |
|----------|-----------|
| pnpm monorepo | Single repo, shared types, atomic changes |
| Colyseus for rooms | Handles WebSocket rooms, reconnect, state sync |
| Fastify for API | Fast, plugin-based, TypeScript-native |
| Prisma ORM | Type-safe queries, migration management |
| Vitest | Fast, ESM-native, compatible with TypeScript |
| Zustand for state | Minimal boilerplate, works well with React 19 |
| No Redux | Overkill for this app's state complexity |
| Server authoritative | Prevents cheating, single source of truth |

---

## Adding a new feature — walkthrough

### Example: adding a chat system

1. **Define types** in `packages/shared/src/events.ts`:
   ```typescript
   export interface ChatMessage { seat: Seat; text: string; timestamp: number; }
   ```

2. **Handle on server** in `BotifarraRoom.ts`:
   ```typescript
   this.onMessage('chat', (client, { text }) => {
     this.broadcast('chat_message', { seat: ..., text, timestamp: Date.now() });
   });
   ```

3. **Handle on client** in `useGameRoom.ts`:
   ```typescript
   room.onMessage('chat_message', (msg) => { /* update store */ });
   ```

4. **Build UI** component in `components/Chat.tsx`

5. **Write tests** for each layer

---

## Need help?

- Read `ARCHITECTURE.md` for system design details
- Read `INSTRUCTIONS.md` for the original project vision
- Check the test files — they're the best documentation of expected behavior
