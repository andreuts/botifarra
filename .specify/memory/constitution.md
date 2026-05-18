# Botifarra Online — Constitution

## Core Principles

### I. Simplicity First

Every design decision defaults to the simplest viable approach. No premature abstractions, no over-engineering, no micro-services until proven necessary. YAGNI governs all: if a feature is not needed now, it does not exist. Code must be readable and maintainable by a single human developer. Complexity must be explicitly justified in writing before introduction.

### II. Shared Game Engine (NON-NEGOTIABLE)

The Botifarra rules engine lives in `packages/botifarra-core` as a **zero-dependency, pure-functional TypeScript library**. It has no UI, database, network, or framework dependencies. Every function takes state in and returns new state out — deterministic and side-effect-free. This package is the foundation: deck, tricks, rounds, scoring, legal moves, bots, and game state transitions. It is shared across server and client. **No game rule logic may exist outside this package.**

### III. Server-Authoritative Multiplayer (NON-NEGOTIABLE)

The server is the single source of truth. Clients never validate their own moves, compute scores, or decide turn order. The flow is always: client command → server validation → state transition → persist event → broadcast safe state. Clients only see their own hand — hidden information is never leaked. This prevents cheating and guarantees consistency.

### IV. Test-Driven Development (NON-NEGOTIABLE)

All development follows strict TDD: **RED → GREEN → REFACTOR**. Write a failing test first, implement the minimum code to pass, then refactor. No game logic, API endpoint, or business rule ships without tests. Coverage emphasis (in priority order): game rules, scoring, legal moves, trick resolution, matchmaking, reconnect handling, rankings, persistence, API routes. Testing stack: **Vitest** (unit + integration), **Playwright** (E2E). Tests are the primary documentation of expected behavior.

### V. Monorepo with Clear Boundaries

The project is a pnpm monorepo with strict package boundaries:

```
packages/botifarra-core  →  Zero-dependency game engine
packages/shared          →  DTOs, commands, events (depends on core types)
apps/server              →  Fastify + Colyseus backend (depends on shared, core)
apps/web                 →  React + Vite PWA frontend (depends on shared)
```

Dependencies flow **one direction only**: `web → shared → core` and `server → shared → core`. No circular dependencies. No type duplication. All DTOs, events, and commands are defined once in `packages/shared`.

### VI. Observability & Debuggability

Every layer must be debuggable in development and observable in production:
- **Structured logging** (pino via Fastify) with request IDs and game room context
- **Telemetry** for game events, matchmaking metrics, and error rates
- **Admin panel** endpoint for inspecting active rooms, connected players, queue state
- **Health checks** and monitoring routes (`/api/health`, `/api/monitoring`)
- Error tracking with stack traces in dev, sanitized messages in production

### VII. Catalan Identity & Internationalization

Botifarra is a Catalan tradition. The game UI is **entirely in Catalan** as the default language. All card names, suit names, game terms, and UI labels use Catalan terminology (Oros, Copes, Espases, Bastos; Butifarra, Trumfo, Basa, etc.). The architecture must support i18n from day one — all user-facing strings are externalized and ready for translation to Spanish, English, and other languages. Cultural authenticity is non-negotiable: the rules strictly follow traditional Botifarra.

### VIII. Cross-Platform & Accessibility

The primary target is a **responsive, mobile-first Progressive Web App** running in any modern browser. The architecture is ready to bundle as:
- **Android** via Capacitor
- **macOS desktop** via Tauri

The UI must be accessible (WCAG 2.1 AA): proper semantic HTML, ARIA labels, keyboard navigation, sufficient color contrast, screen reader support. The game must be easy to use — clear visual hierarchy, intuitive card interactions, readable scoreboard.

### IX. Zero-Cost Infrastructure

The entire project stack must be **free and open-source**. No paid services, no proprietary dependencies, no vendor lock-in at the library level. Deployment targets free-tier platforms (Railway, Render, Vercel, Cloudflare Pages). Database: PostgreSQL (free tier or self-hosted). All tooling (IDE, CI, testing, linting) must be freely available to any contributor.

### X. Loyal to the Architecture

The canonical architecture is documented in `ARCHITECTURE.md` and `INSTRUCTIONS.md`. All implementation must conform to these documents. Deviations require explicit amendment through a PR that updates the architecture docs **first**, then implements the change. The architecture is: Fastify (REST) + Colyseus (WebSocket rooms) + PostgreSQL (Prisma) + React (Vite) + Zustand + TanStack Query. No alternative frameworks or libraries without constitutional amendment.

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Language | TypeScript (strict mode) | Full-stack type safety, shared types |
| Frontend | React + Vite | Fast builds, HMR, ecosystem |
| State | Zustand (auth, game) + TanStack Query (REST) | Minimal boilerplate, cache management |
| Styling | CSS custom properties + responsive design | No runtime overhead, themeable |
| Backend | Node.js + Fastify | Fast, plugin-based, TypeScript-native |
| Real-time | Colyseus | Purpose-built game rooms, reconnect, WebSocket |
| Database | PostgreSQL + Prisma ORM | Type-safe queries, migration management |
| Package manager | pnpm (monorepo workspaces) | Fast, disk-efficient, strict |
| Testing | Vitest (unit/integration) + Playwright (E2E) | ESM-native, fast, compatible |
| Linting | ESLint + Prettier (or Biome) | Consistent code style |
| CI/CD | GitHub Actions | Free for public repos, native integration |
| Containerization | Docker + docker-compose | Reproducible local dev (PostgreSQL, Redis) |

---

## Development Workflow

### Branch Strategy

- `main` — stable, deployable at all times
- `feature/<name>` — new features, branched from main
- `fix/<name>` — bug fixes
- `docs/<name>` — documentation changes

### Commit Convention

Conventional commits enforced:
```
feat(core): add capot detection in scoring
fix(server): handle reconnect race condition
test(matchmaking): add pair queue edge cases
docs: update architecture for Redis addition
```

### Quality Gates (CI/CD)

Every PR must pass before merge:
1. **All tests pass** — `pnpm test` (unit + integration across all packages)
2. **Build succeeds** — `pnpm build` (full TypeScript compilation, no errors)
3. **Lint passes** — `pnpm lint` (zero warnings, zero errors)
4. **No `any` types** — unless explicitly justified with a comment
5. **New code has tests** — no untested business logic
6. **PR description** explains *what* and *why*

### Code Style

- TypeScript strict mode — no implicit `any`, strict null checks
- ESM imports with `.js` extensions (Node.js ESM compatibility)
- Functional style in `botifarra-core` — pure functions, immutable transitions, no classes
- Colyseus rooms use classes (framework requirement)
- 2-space indentation, semicolons, single quotes
- Naming: `kebab-case` files, `PascalCase` types, `camelCase` functions, `SCREAMING_SNAKE_CASE` constants

---

## Documentation Requirements

The following documents must be kept current with every significant change:

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview, setup, commands, structure |
| `ARCHITECTURE.md` | System design, data flow, design decisions |
| `CONTRIBUTING.md` | Developer setup, workflow, coding standards |
| `INSTRUCTIONS.md` | Full technical vision and development guide |

Test files serve as living documentation of expected behavior. When in doubt, read the tests.

---

## Game Rules Compliance

The implementation must faithfully follow traditional Botifarra rules:
- 48-card Catalan deck (Oros, Copes, Espases, Bastos; ranks 1-9 + 10/sota, 11/cavall, 12/rei)
- 4 players, 2 teams (seats 0,2 vs seats 1,3)
- 12 cards dealt per player
- Trump declaration phase (dealer's team chooses suit or calls "Butifarra")
- Delegació (partner declares if dealer delegates)
- Trick-taking: must follow suit, must overtrump if possible
- Scoring: point cards have fixed values, game to target score
- Capot (sweep) detection and bonus

**Any ambiguity in rules must be resolved by consulting traditional Catalan Botifarra references, not by inventing rules.**

---

## Governance

This constitution is the supreme governing document for the Botifarra Online project. It supersedes all other practices, conventions, or ad-hoc decisions.

- All code contributions must comply with these principles
- All PRs and reviews must verify constitutional compliance
- Amendments require: (1) a written proposal, (2) update to this document via PR, (3) approval by the project maintainer
- Added complexity must be justified against Principle I (Simplicity First)
- Every spec, plan, and task produced under spec-kit must conform to this constitution
- When in doubt, refer to `INSTRUCTIONS.md` and `ARCHITECTURE.md` for architectural guidance

**Version**: 1.0.0 | **Ratified**: 2026-05-13 | **Last Amended**: 2026-05-13
