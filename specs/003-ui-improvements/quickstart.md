# Quickstart: UI Improvements — Header, Lobby Cards & Language

**Feature**: `003-ui-improvements`

---

## Prerequisites

- Node.js 20+, pnpm 9+
- Docker (for PostgreSQL via `docker-compose.yml`)
- Branch: `003-ui-improvements`

---

## Run the dev environment

```bash
# 1. Install dependencies (from repo root)
pnpm install

# 2. Start PostgreSQL
docker compose up -d

# 3. Start backend
pnpm --filter @botifarra/server dev

# 4. Start frontend (separate terminal)
pnpm --filter @botifarra/web dev
```

Frontend available at `http://localhost:5173`.

---

## Verify changes manually

### FR-001 / FR-002 — User info in nav, no duplicate h1

1. Log in with any account.
2. Inspect the navigation bar — username and "Tanca sessió" / "Sign Out" button must be visible.
3. Open browser DevTools → Elements; search for `<h1>` → no `<h1>` should contain "Botifarra Online" in the page content area.

### FR-003 / FR-004 — Lobby cards

1. On the home page, the lobby section must show three cards: Solo Quick Match, Pair Quick Match, Private Room.
2. Resize the browser to 375 px width — cards must stack vertically with no horizontal overflow.

### FR-005 / FR-006 / FR-007 / FR-008 — Language

1. Open Settings (⚙ gear) — the language selector must show "Català" and "English" only; no "Español".
2. Select "English" — all visible labels change immediately without page reload.
3. Reload — English persists.
4. Open DevTools → Application → Local Storage → `botifarra-settings` → set `"language":"es"` → reload — app renders in Catalan (guard fired).

---

## Run unit tests

```bash
# All web tests
pnpm --filter @botifarra/web test

# Watch mode
pnpm --filter @botifarra/web test -- --watch
```

---

## Run E2E tests

```bash
# Requires running backend + frontend (see above)
pnpm exec playwright test
```

Key E2E specs for this feature:
- `tests/e2e/smoke.spec.ts` — updated to assert nav user info visible after login
- *(new)* `tests/e2e/language.spec.ts` — language switch and stale-es guard
