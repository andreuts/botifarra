# Implementation Plan: Resume Recent Games

**Branch**: `001-add-spec` | **Date**: 2026-05-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-resume-recent-games/spec.md`

## Summary

Enable players to resume in-progress games from the Recent Games list, add color-coded win/loss visual indicators, and enhance "Historial de Partides" with aggregated player statistics, dual ELO graphs, and top-opponent lists — limited to the 30 most recent games. See `research.md` for key decisions and `data-model.md` for entity definitions.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS

**Primary Dependencies**: Fastify 4, Colyseus 0.15, Prisma 5, React 18, TanStack Query 5, Zustand 4, Vite 5, i18next

**Storage**: PostgreSQL via Prisma ORM — new `EloHistory` table + `Match.lastSnapshot` JSON column

**Testing**: Vitest (unit + integration), Playwright (E2E) — per constitution §IV

**Target Platform**: Responsive PWA (browser); server on Railway (Node.js)

**Project Type**: Full-stack monorepo — web application (Fastify REST + Colyseus WS + React PWA)

**Performance Goals**: History page loads within 2 seconds on a typical consumer connection (SC-003); API responses for `/api/matches` <200ms p95

**Constraints**: Max 30 game entries per page load (FR-008, SC-005); WCAG 2.1 AA accessibility (FR-009); no additional runtime dependencies beyond what the constitution already permits

**Scale/Scope**: Single-user history view; small dataset (≤30 games rendered); stats computed in-process on the server (no separate analytics service)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Simplicity First | PASS | Snapshot stored in existing `Match` row; no new microservice; stats computed in existing routes |
| II — Shared Game Engine | PASS | No game-rule logic added outside `botifarra-core`; snapshot serialization is infrastructure, not rules |
| III — Server-Authoritative | PASS | Resume flow: server reconstructs room from snapshot before client connects; client never self-validates |
| IV — TDD | PASS | New services and API changes must be covered by Vitest unit + integration tests before shipping |
| V — Monorepo Boundaries | PASS | New DTOs added to `packages/shared`; snapshot logic lives in `apps/server`; no circular deps |
| VII — Catalan Identity | PASS | All new i18n keys added to `ca.json` and `es.json` |
| VIII — Accessibility | PASS | FR-009 mandates text labels + icons alongside color; implemented in UI components |
| X — Loyal to Architecture | PASS | Fastify REST for stats; existing Colyseus room mechanism reused for resume |

**Post-design re-check**: No violations introduced. The `lastSnapshot` column approach avoids a new table and aligns with Principle I.

## Project Structure

### Documentation (this feature)

```text
specs/001-resume-recent-games/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions and rationale
├── data-model.md        # Phase 1 — entity definitions and migrations
├── quickstart.md        # Phase 1 — developer setup for this feature
├── contracts/
│   └── api.md           # Phase 1 — REST API contract changes
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/server/
├── prisma/
│   ├── schema.prisma                          MODIFY — add EloHistory model, Match.lastSnapshot col
│   └── migrations/
│       └── <timestamp>_resume_recent_games/   CREATE — new Prisma migration
├── src/
│   ├── routes/
│   │   ├── matches.ts                         MODIFY — user-specific list, limit 30, outcome field, resume endpoint
│   │   └── users.ts                           MODIFY — add GET /api/users/me/stats
│   ├── services/
│   │   ├── persistence.ts                     MODIFY — add saveGameSnapshot(), saveEloHistory()
│   │   ├── persistence.test.ts                MODIFY — tests for new functions
│   │   └── stats.ts                           CREATE — computePlayerStats(), computeTopOpponents()
│   └── rooms/
│       └── BotifarraRoom.ts                   MODIFY — call saveGameSnapshot() after every state change; restore from snapshot on room creation

packages/shared/
└── src/
    ├── match.dto.ts                           MODIFY — add RecentGameDTO, PlayerStatsDTO, EloSnapshotDTO, TopPlayerEntryDTO
    └── index.ts                               MODIFY — re-export new DTOs

apps/web/
├── src/
│   ├── api/
│   │   └── client.ts                         MODIFY — add matches.resume(), users.myStats() calls
│   ├── components/
│   │   ├── EloGraph.tsx                       CREATE — line chart for ELO history (uses canvas or SVG, no new dep)
│   │   ├── RecentGameRow.tsx                  CREATE — color-coded game row with status label + resume button
│   │   └── PlayerStatsSummary.tsx             CREATE — aggregated stats block for history page
│   ├── pages/
│   │   ├── MatchHistoryPage.tsx               MODIFY — add stats panel, ELO graphs, top players, 30-game limit
│   │   └── HomePage.tsx                       MODIFY — show in-progress games with Resume button; color-code recent games
│   └── i18n/
│       ├── locales/ca.json                    MODIFY — add keys for resume, outcome labels, stats, graphs
│       └── locales/es.json                    MODIFY — mirror new keys in Spanish
└── src/__tests__/
    ├── RecentGameRow.test.tsx                 CREATE — color/label rendering tests
    └── PlayerStatsSummary.test.tsx            CREATE — stats computation display tests

tests/e2e/
└── resume-game.spec.ts                        CREATE — Playwright E2E: resume in-progress game flow
```

**Structure Decision**: This is a web application with a separate backend and frontend. The existing `apps/server` / `apps/web` split is retained. No new packages or apps are introduced — all changes stay within existing boundaries.

## Complexity Tracking

No constitution violations requiring justification. No new packages, no new frameworks, no abstractions beyond those already present in the codebase.
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
