# Tasks: Resume Recent Games

**Input**: Design documents from `specs/001-resume-recent-games/`

**Feature Branch**: `001-add-spec` | **Date**: 2026-05-18

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md) | **Data Model**: [data-model.md](data-model.md) | **API Contract**: [contracts/api.md](contracts/api.md)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to — [US1], [US2], [US3]
- Tests are **required** per FR-010 (state restoration, color/label rendering, stats computation, 30-game limit)

---

## Phase 1: Setup — Database Schema & Migration

**Purpose**: Apply the schema changes that EVERY other task depends on. Nothing else can proceed until the migration is applied and Prisma client is regenerated.

- [X] T001 Add `ABANDONED` to `MatchStatus` enum, add `lastSnapshot Json?` column to `Match`, add `EloHistory` model with `userId`/`matchId`/`eloAfter`/`eloChange`/`isRanked`/`createdAt` fields and back-relations on `User` and `Match` in `apps/server/prisma/schema.prisma`
- [X] T002 Generate and apply Prisma migration named `resume_recent_games` producing `apps/server/prisma/migrations/<timestamp>_resume_recent_games/` and regenerate Prisma client (`pnpm prisma migrate dev --name resume_recent_games && pnpm prisma generate`)

**Checkpoint**: `pnpm prisma studio` shows the new `elo_history` table, `Match.lastSnapshot` column, and `ABANDONED` enum value.

---

## Phase 2: Foundational — Shared DTOs

**Purpose**: DTO types in `packages/shared` are consumed by both the server and the web client. All user story phases depend on these types being published.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 Add `GameOutcome = 'won' | 'lost' | 'draw' | 'in-progress' | 'abandoned'` type to `packages/shared/src/match.dto.ts`
- [X] T004 Add `RecentGameDTO` interface (extends `MatchDTO`, adds `outcome: GameOutcome`, `myTeam: 0 | 1 | null`, `finishedAt: string | null`) to `packages/shared/src/match.dto.ts`
- [X] T005 [P] Add `EloSnapshotDTO` interface (`matchId`, `eloAfter`, `eloChange`, `isRanked`, `createdAt`) to `packages/shared/src/match.dto.ts`
- [X] T006 [P] Add `TopPlayerEntryDTO` interface (`userId`, `username`, `gamesPlayed`, `winRateVsOpponent`) to `packages/shared/src/match.dto.ts`
- [X] T007 Add `PlayerStatsDTO` interface (`totalGames`, `wins`, `losses`, `winRate`, `currentElo`, `averageEloChange`, `eloHistory: EloSnapshotDTO[]`, `rankedEloHistory: EloSnapshotDTO[]`, `topPlayedWith: TopPlayerEntryDTO[]`, `topPlayedAgainst: TopPlayerEntryDTO[]`) to `packages/shared/src/match.dto.ts`
- [X] T008 Re-export `GameOutcome`, `RecentGameDTO`, `EloSnapshotDTO`, `TopPlayerEntryDTO`, `PlayerStatsDTO` from `packages/shared/src/index.ts`

**Checkpoint**: `pnpm --filter @botifarra/shared build` passes with no type errors. All new types are importable from `@botifarra/shared`.

---

## Phase 3: User Story 1 — Resume In-Progress Game (Priority: P1) 🎯 MVP

**Goal**: A player can click Resume on an in-progress game in Recent Games and the board, hands, scores, and turn are restored exactly as when they left.

**Independent Test**: Navigate to Recent Games, click Resume on an in-progress entry. The game UI loads and the player can make the next legal move. Verified by E2E test `tests/e2e/resume-game.spec.ts`.

### Tests for User Story 1 ⚠️ Write failing tests FIRST

- [X] T009 Write failing unit tests for `serializeSnapshot()` (Map→Array), `deserializeSnapshot()` (Array→Map), and `saveGameSnapshot()` (Prisma update) in `apps/server/src/services/persistence.test.ts`
- [X] T010 [P] [US1] Write failing integration test covering `POST /api/matches/:matchId/resume` (200 with roomId, 403 for non-participant, 409 for non-in-progress, 422 for missing snapshot) in `apps/server/src/integration/api-flow.integration.test.ts`
- [X] T011 [P] [US1] Create failing Playwright E2E test for full resume flow (login → Recent Games → click Resume → board restored → make move) in `tests/e2e/resume-game.spec.ts`

### Implementation for User Story 1

- [X] T012 [US1] Add `SerializableRoomSnapshot` interface, `serializeSnapshot()`, and `deserializeSnapshot()` to `apps/server/src/services/persistence.ts` (makes T009 snapshot serialization tests pass)
- [X] T013 [US1] Add `saveGameSnapshot(matchId: string, state: RoomGameState): Promise<void>` to `apps/server/src/services/persistence.ts` using `prisma.match.update({ data: { lastSnapshot: serializeSnapshot(state) } })` (makes T009 saveGameSnapshot tests pass)
- [X] T014 [US1] Modify `apps/server/src/rooms/BotifarraRoom.ts` to call `saveGameSnapshot()` after each card play and round end (while status is `IN_PROGRESS`); clear `lastSnapshot` (set to `null`) when match reaches `FINISHED` or `ABANDONED`
- [X] T015 [US1] Modify `apps/server/src/rooms/BotifarraRoom.ts` to accept `initialState` option on room creation: call `deserializeSnapshot(match.lastSnapshot)` and inject the resulting `RoomGameState` before clients connect; re-add bot seats identified by `userId` prefix `bot-`
- [X] T016 [US1] Modify `GET /api/matches` in `apps/server/src/routes/matches.ts` to: filter by authenticated `userId` via `MatchPlayer`, compute `outcome` using `seat % 2 === match.winner`, handle `IN_PROGRESS`/`ABANDONED` cases, limit query to `take: 30` ordered `createdAt DESC`, return `RecentGameDTO[]`
- [X] T017 [US1] Add `POST /api/matches/:matchId/resume` route to `apps/server/src/routes/matches.ts`: verify participant, verify `IN_PROGRESS`, check live Colyseus room via `matchmaker.query`; if alive return its `roomId`; otherwise deserialize snapshot, create new `BotifarraRoom` with injected state, return new `roomId` (makes T010 pass)
- [X] T018 [US1] Add `matches.resume(matchId: string): Promise<{ roomId: string }>` to `apps/web/src/api/client.ts`
- [X] T019 [US1] Modify `apps/web/src/pages/HomePage.tsx` to detect `outcome === 'in-progress'` entries from `GET /api/matches`, show a "Reprèn" button that calls `matches.resume()` and navigates to `/match/:roomId?mode=botifarra` (makes T011 pass)

**Checkpoint**: `pnpm --filter @botifarra/server test --run` passes T009/T010. Playwright `resume-game.spec.ts` passes. An in-progress game can be resumed from the Home page.

---

## Phase 4: User Story 2 — Clear Win/Loss Visual Cues (Priority: P2)

**Goal**: Every finished game in Recent Games shows green (won) or red (lost) with a textual status label so outcome is scannable at a glance.

**Independent Test**: Render a list with at least one won and one lost game. Won entry has `background-color` in the green range and textual label "Victòria"; lost entry has `background-color` in the red range and textual label "Derrota". Verified by `apps/web/src/__tests__/RecentGameRow.test.tsx`.

### Tests for User Story 2 ⚠️ Write failing tests FIRST

- [X] T020 [US2] Write failing unit tests for `<RecentGameRow>` covering: green styling + "Victòria" label for `outcome='won'`, red styling + "Derrota" label for `outcome='lost'`, neutral styling + "En curs" label + Resume button for `outcome='in-progress'`, "Abandonada" label for `outcome='abandoned'` in `apps/web/src/__tests__/RecentGameRow.test.tsx`

### Implementation for User Story 2

- [X] T021 [US2] Create `apps/web/src/components/RecentGameRow.tsx`: color-coded row (`won`→green, `lost`→red, `in-progress`→neutral), textual status label using i18n key `history.outcome.*`, `aria-label` for screen readers, optional Resume button prop (FR-009 WCAG 2.1 AA) — makes T020 pass
- [X] T022 [US2] Modify `apps/web/src/pages/MatchHistoryPage.tsx` to replace current game row rendering with `<RecentGameRow>` for each entry from `GET /api/matches`
- [X] T023 [US2] Modify `apps/web/src/pages/HomePage.tsx` to use `<RecentGameRow>` for the Recent Games section (preserving the Resume button from T019, now via the component's prop)

**Checkpoint**: `pnpm --filter @botifarra/web test --run` passes T020. Recent Games on Home and History pages show green/red/neutral rows with text labels.

---

## Phase 5: User Story 3 — Historial de Partides: Player Statistics (Priority: P2)

**Goal**: The History page shows aggregated stats, two ELO line graphs, and top teammate/opponent lists, all computed from the last 30 games.

**Independent Test**: Open History page with a test dataset >30 games. Verify: only 30 game rows displayed, stats block shows correct totals and win rate, both ELO graphs render data points in correct sequence, top-5 teammate and opponent lists appear with correct counts. Verified by unit tests and integration test for `GET /api/users/me/stats`.

### Tests for User Story 3 ⚠️ Write failing tests FIRST

- [X] T024 [US3] Write failing unit tests for `computePlayerStats()` (correct totalGames/wins/losses/winRate/averageEloChange from fixture data) and `computeTopOpponents()` (correct rank order, max 5, correct winRateVsOpponent) in `apps/server/src/services/stats.test.ts` (new file)
- [X] T025 [P] [US3] Write failing unit tests for `<PlayerStatsSummary>`: displays all stats fields, renders heading, handles zero-games edge case in `apps/web/src/__tests__/PlayerStatsSummary.test.tsx`
- [X] T026 [P] [US3] Write failing integration test for `GET /api/users/me/stats` (200 with `PlayerStatsDTO` shape, correct 30-item cap on `eloHistory`) in `apps/server/src/integration/api-flow.integration.test.ts`

### Implementation for User Story 3

- [X] T027 [US3] Add `saveEloHistory(userId: string, matchId: string, eloAfter: number, eloChange: number, isRanked: boolean): Promise<void>` to `apps/server/src/services/persistence.ts`; call it from match finalization in `BotifarraRoom.ts` when status moves to `FINISHED` and `match.ranked === true`
- [X] T028 [US3] Create `apps/server/src/services/stats.ts` with `computePlayerStats(userId: string, prisma: PrismaClient): Promise<PlayerStatsDTO>` and `computeTopOpponents(userId: string, prisma: PrismaClient, type: 'with' | 'against'): Promise<TopPlayerEntryDTO[]>` — 30-item cap enforced via Prisma `take: 30` (makes T024 pass)
- [X] T029 [US3] Add `GET /api/users/me/stats` route to `apps/server/src/routes/users.ts` calling `computePlayerStats()`, returning `PlayerStatsDTO` (makes T026 pass)
- [X] T030 [US3] Add `users.myStats(): Promise<PlayerStatsDTO>` to `apps/web/src/api/client.ts`
- [X] T031 [P] [US3] Create `apps/web/src/components/EloGraph.tsx`: pure SVG polyline chart for an `EloSnapshotDTO[]` prop, `viewBox`-based responsive sizing, visually hidden `<table>` with same data for accessibility (WCAG 2.1 AA), no new runtime dependencies
- [X] T032 [P] [US3] Create `apps/web/src/components/PlayerStatsSummary.tsx`: displays `totalGames`, `wins`, `losses`, `winRate`, `currentElo`, `averageEloChange` using i18n keys `history.stats.*`; renders `<EloGraph>` for overall and ranked histories; renders top-played-with and top-played-against lists (makes T025 pass)
- [X] T033 [US3] Modify `apps/web/src/pages/MatchHistoryPage.tsx` to: fetch `GET /api/users/me/stats` via TanStack Query, render `<PlayerStatsSummary>` above the game list, enforce the 30-game display cap on the list

**Checkpoint**: `pnpm --filter @botifarra/server test --run` passes T024/T026. `pnpm --filter @botifarra/web test --run` passes T025. History page shows stats, two ELO graphs, and top opponent lists.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: i18n completeness, accessibility validation, and end-to-end smoke check.

- [X] T034 [P] Add all new i18n keys (`history.outcome.*`, `history.resume`, `history.resumeAriaLabel`, `history.stats.*`, `history.eloTableCaption`, `history.eloTableColGame`, `history.eloTableColElo`, `history.eloTableColChange`) to `apps/web/src/i18n/locales/ca.json`
- [X] T035 [P] Mirror all keys from T034 in Spanish to `apps/web/src/i18n/locales/es.json`
- [ ] T036 Accessibility audit: verify every visual outcome indicator has a text/icon alternative, `EloGraph` SVG has an `aria-label` and hidden `<table>`, Resume button has `aria-label` matching `history.resumeAriaLabel` — all per FR-009 and WCAG 2.1 AA
- [ ] T037 Run full quickstart.md validation: apply migration on clean DB (`pnpm prisma migrate reset`), `pnpm --filter @botifarra/core test --run`, `pnpm --filter @botifarra/server test --run`, `pnpm --filter @botifarra/web test --run`, then E2E `pnpm exec playwright test tests/e2e/resume-game.spec.ts`

**Checkpoint**: All unit, integration, and E2E tests pass. No missing i18n keys in either locale. Accessibility checks pass.

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup/Migration)
  └─► Phase 2 (Shared DTOs)
        └─► Phase 3 (US1 — Resume) ────────► Phase 6 (Polish)
        └─► Phase 4 (US2 — Visual Cues) ───► Phase 6 (Polish)
        └─► Phase 5 (US3 — Statistics) ────► Phase 6 (Polish)
```

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Requires Phase 1 complete (Prisma client must be regenerated before shared types compile)
- **Phases 3, 4, 5**: All require Phase 2; can proceed in parallel if staffed
- **Phase 6**: Requires Phases 3, 4, 5 all complete

### Within-Story Dependencies

| Task | Depends On |
|------|-----------|
| T004 | T003 (`GameOutcome` must exist) |
| T007 | T005, T006 (`EloSnapshotDTO`, `TopPlayerEntryDTO` must exist) |
| T008 | T003–T007 |
| T012 | T002 (Prisma client), T008 (DTOs compiled) |
| T013 | T012 (`serializeSnapshot` must exist) |
| T014 | T013 (`saveGameSnapshot` must exist) |
| T015 | T012 (`deserializeSnapshot` must exist) |
| T016 | T004 (`RecentGameDTO` must exist) |
| T017 | T015 (room restore), T013 (snapshot save) |
| T018 | T017 (endpoint must exist) |
| T019 | T018 (client call), T016 (outcome field in response) |
| T021 | T020 (tests written first) |
| T022 | T021 (`RecentGameRow` component) |
| T023 | T021 (`RecentGameRow` component), T019 (Resume handler) |
| T028 | T024 (tests written first), T002 (EloHistory in DB) |
| T029 | T028 (`computePlayerStats` must exist) |
| T030 | T029 (endpoint must exist) |
| T031 | T005 (`EloSnapshotDTO` type) |
| T032 | T031 (`EloGraph` component), T006/T007 (DTO types) |
| T033 | T030 (client call), T031, T032 (components) |
| T034, T035 | T019, T021, T032 (all i18n keys identified in implementation) |
| T036 | T019, T021, T031 (components must exist) |
| T037 | All previous tasks |

### Parallel Opportunities

**Phase 2** (same file — batch together in one commit):
```
T003 → T004 → T005 / T006 (parallel) → T007 → T008
```

**Phase 3** (after T008):
```
T009 (persistence tests)   ─► T012 → T013 → T014
                                              T015
T010 (resume endpoint test) ─────────────► T017 → T018 → T019
T011 (E2E test skeleton)    ───────────────────────────── T019
T016 (GET /api/matches)  ← independent from T012-T015, needs only T004
```

**Phase 5** (after T008 + T002):
```
T024 (stats unit tests)   ─► T028 → T029 → T030 → T033
T025 (component tests) [P] ─► T032 [P]  ─────────► T033
T026 (endpoint test)   [P] ─► T029  ──────────────► T033
T031 (EloGraph) [P]  ──────────────────────────────► T032 → T033
T027 (saveEloHistory)  ← can be done alongside T028
```

---

## Parallel Execution Example: Phase 3 (US1)

```bash
# Parallelizable at start of US1 (after DTOs ready):
Task T009: Write persistence.test.ts snapshot tests
Task T010: Write api-flow.integration.test.ts resume tests
Task T011: Write tests/e2e/resume-game.spec.ts skeleton

# Sequential (T012 unlocks T013, T013 unlocks T014 + T015):
T012 → T013 → T014 (BotifarraRoom snapshot on state change)
            ↘ T015 (BotifarraRoom restore on creation)

# T016 can run in parallel with T012-T015 (different file):
T016: Modify routes/matches.ts GET handler
```

---

## Implementation Strategy

### MVP: User Story 1 Only

1. Complete Phase 1 (migration) and Phase 2 (DTOs) — **~2–4 hours**
2. Complete Phase 3 (US1) in TDD order: T009 → T012 → T013 → T014/T015 → T016/T017 → T018 → T019 — **~4–6 hours**
3. **STOP and VALIDATE**: run unit, integration, and E2E tests; verify resume flow end-to-end
4. Deploy and demo: players can recover in-progress games

### Full Delivery (incremental)

1. MVP (above) → **US1 shipped**
2. Phase 4 (US2): T020 → T021 → T022/T023 → **Win/Loss cues shipped**
3. Phase 5 (US3): T024–T033 → **Stats/Graphs shipped**
4. Phase 6: T034–T037 → **Polish + i18n + accessibility hardened**

Each phase is independently deployable without breaking previous phases.

---

## Summary

| Phase | Tasks | Scope |
|-------|-------|-------|
| Phase 1: Setup | T001–T002 | Prisma schema + migration |
| Phase 2: Foundational | T003–T008 | Shared DTOs |
| Phase 3: US1 (P1 MVP) | T009–T019 | Resume in-progress game |
| Phase 4: US2 (P2) | T020–T023 | Win/loss visual cues |
| Phase 5: US3 (P2) | T024–T033 | Player statistics + ELO graphs |
| Phase 6: Polish | T034–T037 | i18n, accessibility, validation |
| **Total** | **37 tasks** | |

**Parallel opportunities**: 14 tasks marked [P]

**MVP scope**: Phases 1–3 (19 tasks) — delivers User Story 1 independently
