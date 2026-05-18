# Quickstart: Resume Recent Games Feature

**Date**: 2026-05-18 | **Plan**: [plan.md](plan.md)

This guide covers how to set up your local environment and run the code for this feature.

## Prerequisites

- Node.js 20 LTS
- pnpm 9+
- Docker Desktop (for PostgreSQL)
- The repository cloned and dependencies installed (`pnpm install` from repo root)

---

## 1. Apply the database migration

After checking out the `001-add-spec` branch:

```bash
# Start the local PostgreSQL container (if not running)
docker compose up -d postgres

# Generate and apply the migration
cd apps/server
pnpm prisma migrate dev --name resume_recent_games
pnpm prisma generate
```

This creates the `elo_history` table, adds `Match.lastSnapshot`, and adds `ABANDONED` to the `MatchStatus` enum.

---

## 2. Run the development servers

From the repository root:

```bash
pnpm dev
```

Both `apps/server` (Fastify + Colyseus on port 3001) and `apps/web` (Vite on port 5173) start concurrently.

---

## 3. Run tests for this feature

```bash
# Unit + integration tests (all packages)
pnpm test

# Watch mode for the server package only
cd apps/server
pnpm test --watch

# Watch mode for the web package only
cd apps/web
pnpm test --watch

# E2E tests (requires dev server to be running)
pnpm exec playwright test tests/e2e/resume-game.spec.ts
```

---

## 4. Key files to work in

| File | Purpose |
|------|---------|
| [apps/server/prisma/schema.prisma](../../apps/server/prisma/schema.prisma) | DB schema — add `EloHistory`, modify `Match` |
| [apps/server/src/services/persistence.ts](../../apps/server/src/services/persistence.ts) | Add `saveGameSnapshot()`, `saveEloHistory()` |
| [apps/server/src/services/stats.ts](../../apps/server/src/services/stats.ts) | NEW — `computePlayerStats()`, `computeTopOpponents()` |
| [apps/server/src/routes/matches.ts](../../apps/server/src/routes/matches.ts) | User-specific list + resume endpoint |
| [apps/server/src/routes/users.ts](../../apps/server/src/routes/users.ts) | Add `GET /api/users/me/stats` |
| [apps/server/src/rooms/BotifarraRoom.ts](../../apps/server/src/rooms/BotifarraRoom.ts) | Trigger snapshot saves; restore from snapshot |
| [packages/shared/src/match.dto.ts](../../packages/shared/src/match.dto.ts) | Add `RecentGameDTO`, `PlayerStatsDTO`, etc. |
| [apps/web/src/pages/MatchHistoryPage.tsx](../../apps/web/src/pages/MatchHistoryPage.tsx) | Stats panel, ELO graphs, color-coded rows |
| [apps/web/src/pages/HomePage.tsx](../../apps/web/src/pages/HomePage.tsx) | Resume button for in-progress games |
| [apps/web/src/components/EloGraph.tsx](../../apps/web/src/components/EloGraph.tsx) | NEW — SVG ELO line chart |
| [apps/web/src/components/RecentGameRow.tsx](../../apps/web/src/components/RecentGameRow.tsx) | NEW — single color-coded game row |
| [apps/web/src/i18n/locales/ca.json](../../apps/web/src/i18n/locales/ca.json) | Add Catalan i18n keys |
| [apps/web/src/i18n/locales/es.json](../../apps/web/src/i18n/locales/es.json) | Mirror keys in Spanish |

---

## 5. TDD workflow (per constitution §IV)

For each new function:

1. Write a failing test in the corresponding `.test.ts` file
2. Implement the minimum code to pass
3. Refactor if needed

Example order for backend:
1. `persistence.test.ts` → `saveGameSnapshot()` / `deserializeSnapshot()`
2. `stats.test.ts` (new) → `computePlayerStats()` / `computeTopOpponents()`
3. `routes/api.test.ts` (extend) → `GET /api/matches` user-specific, `POST /api/matches/:matchId/resume`, `GET /api/users/me/stats`

Example order for frontend:
1. `RecentGameRow.test.tsx` → color + label rendering for each outcome
2. `PlayerStatsSummary.test.tsx` → stats display
3. Playwright E2E → full resume flow

---

## 6. New i18n keys to add

Add the following keys to `ca.json` and `es.json`:

```json
{
  "history": {
    "outcome": {
      "won": "Victòria",
      "lost": "Derrota",
      "draw": "Empat",
      "in-progress": "En curs",
      "abandoned": "Abandonada"
    },
    "resume": "Reprèn",
    "resumeAriaLabel": "Reprèn la partida en curs",
    "stats": {
      "heading": "Les teves estadístiques",
      "totalGames": "Partides jugades",
      "wins": "Victòries",
      "losses": "Derrotes",
      "winRate": "% victòries",
      "currentElo": "ELO actual",
      "eloGraph": "Evolució ELO (totes les partides)",
      "rankedEloGraph": "Evolució ELO (classificatòries)",
      "topPlayedWith": "Companys freqüents",
      "topPlayedAgainst": "Rivals freqüents",
      "gamesPlayed": "{{count}} partides",
      "winRateVs": "{{rate}}% victòries"
    },
    "eloTableCaption": "Historial ELO dels últims {{count}} jocs",
    "eloTableColGame": "Partida",
    "eloTableColElo": "ELO",
    "eloTableColChange": "Canvi"
  }
}
```
