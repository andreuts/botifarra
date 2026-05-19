# Implementation Plan: UI Improvements — Header, Lobby Cards & Language

**Branch**: `003-ui-improvements` | **Date**: 2026-05-19 | **Spec**: [specs/003-ui-improvements/spec.md](spec.md)

**Input**: Feature specification from `specs/003-ui-improvements/spec.md`

---

## Summary

Move the logged-in user's identity (username + sign-out button) into the `AppShell` navigation header, remove the duplicate `<h1>` app title from the home page, redesign the lobby action buttons as cards (`LobbyCard` component), and replace the Spanish locale with a full English locale — removing the `"es"` option from the language selector and adding a stale-value guard to the settings store.

All changes are confined to `apps/web`. No server code, database schema, shared DTOs, or game-engine logic is touched.

---

## Technical Context

**Language/Version**: TypeScript 5 (strict mode), React 18, Vite 5

**Primary Dependencies**: React, react-router, react-i18next / i18next, Zustand (with `persist` middleware), TanStack Query, CSS custom properties

**Storage**: No DB changes. Language preference persisted in `localStorage` via the Zustand `persist` middleware key `botifarra-settings`.

**Testing**: Vitest + React Testing Library (unit/component), Playwright (E2E)

**Target Platform**: Modern browsers; responsive mobile-first PWA (minimum 320 px width)

**Project Type**: Web application — React SPA frontend in monorepo

**Performance Goals**: No regressions; UI language switch must complete synchronously (i18next `changeLanguage` is already synchronous for in-memory resources)

**Constraints**: No new npm dependencies beyond what already exists. No changes to `packages/botifarra-core` or `packages/shared`. All user-facing strings must go through `t()`.

**Scale/Scope**: 4 modified files, 1 new component, 1 new locale file, ~3 new/updated test files

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| **I. Simplicity First** | PASS | One new component (`LobbyCard`), no new abstraction layers. Changes are direct and minimal. |
| **II. Shared Game Engine (NON-NEGOTIABLE)** | PASS | No changes to `packages/botifarra-core`. |
| **III. Server-Authoritative (NON-NEGOTIABLE)** | PASS | No server changes. Sign-out calls existing `authStore.logout()`. |
| **IV. TDD (NON-NEGOTIABLE)** | PASS | New `LobbyCard` component and `AppShell` nav user section must have unit tests. Language guard must have a store test. E2E smoke test updated. |
| **V. Monorepo Boundaries** | PASS | All changes in `apps/web`. No new cross-package dependencies. |
| **VII. Catalan Identity & i18n** | PASS | Catalan remains the default (`lng: 'ca'`, `fallbackLng: 'ca'`). English is added as a second option. Spanish removed as specified. |
| **VIII. Cross-Platform & Accessibility** | PASS | Cards must stack at 320 px (FR-004). Nav user section must be keyboard-accessible and not overlap other elements. |
| **X. Loyal to the Architecture** | PASS | Stack unchanged: React + Vite + Zustand + i18next. No new libraries. |

*Post-design re-check*: All gates remain PASS. The `onRehydrateStorage` usage is standard Zustand `persist` middleware API — no constitutional deviation.

---

## Project Structure

### Documentation (this feature)

```
specs/003-ui-improvements/
├── plan.md          <- this file
├── research.md      <- Phase 0: decisions on nav placement, card design, locale strategy
├── data-model.md    <- Phase 1: component interfaces and structural changes
├── quickstart.md    <- Phase 1: how to run and verify
└── tasks.md         <- Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```
apps/web/
├── src/
│   ├── components/
│   │   ├── AppShell.tsx              MODIFY  add .app-nav-user section (username + sign-out)
│   │   ├── LobbyCard.tsx             NEW     presentational card shell for lobby actions
│   │   └── SettingsPanel.tsx         MODIFY  change language option es to en
│   ├── pages/
│   │   └── HomePage.tsx              MODIFY  remove duplicate header, refactor lobby to LobbyCard
│   ├── i18n/
│   │   ├── index.ts                  MODIFY  replace es resource with en
│   │   └── locales/
│   │       ├── ca.json               NO CHANGE
│   │       ├── es.json               NO CHANGE (kept on disk; removed from i18n bundle)
│   │       └── en.json               NEW     full English translation
│   ├── store/
│   │   └── settingsStore.ts          MODIFY  onRehydrateStorage guard for stale 'es' value
│   └── index.css                     MODIFY  add .lobby-card, .app-nav-user CSS rules
└── src/__tests__/
    ├── components/
    │   ├── AppShell.test.tsx          NEW     nav user section visibility tests
    │   └── LobbyCard.test.tsx         NEW     card render and disabled state tests
    └── store/
        └── settingsStore.test.ts      MODIFY  add language guard test cases

tests/
└── e2e/
    ├── smoke.spec.ts                  MODIFY  assert nav username visible post-login
    └── language.spec.ts               NEW     language switch + stale-es fallback E2E
```

---

## Implementation Steps

### Step 1 — AppShell: add user identity to nav header

**Files**: `apps/web/src/components/AppShell.tsx`, `apps/web/src/index.css`

1. Destructure `logout` from `useAuthStore()` (file already imports `user` from the same store).
2. Add `<div className="app-nav-user">` as a flex child inside `.app-nav-inner`, positioned after `.app-nav-links` and before the gear button.
3. Inside it: `<span className="app-nav-username">{user.username}</span>` and `<button className="btn-outline app-nav-signout" onClick={logout}>{t('auth.signOut')}</button>`.
4. In `index.css`: `.app-nav-user { display:flex; align-items:center; gap:0.5rem; }`. On narrow screens (<=600 px): `max-width:8ch; overflow:hidden; text-overflow:ellipsis` on the username span.
5. Write `AppShell.test.tsx`: render with mocked `useAuthStore` returning a user; assert username text and sign-out button are present inside the `<nav>` element.

### Step 2 — HomePage: remove duplicate header

**File**: `apps/web/src/pages/HomePage.tsx`

1. Delete the `<header>` block (the flex container holding the `<h1>` with `app.title`, the username span, and the sign-out button).
2. The `logout` destructure from `useAuthStore` can be removed from this file since sign-out now lives in `AppShell`.
3. Update E2E `smoke.spec.ts`: assert no `h1` containing the application title exists in the main content area after login.

### Step 3 — LobbyCard component and HomePage lobby refactor

**Files**: `apps/web/src/components/LobbyCard.tsx` (new), `apps/web/src/pages/HomePage.tsx`, `apps/web/src/index.css`

1. Create `LobbyCard.tsx` — props: `{ title: string; description: string; disabled?: boolean; children: React.ReactNode }`. Renders a `<div className={lobby-card class list}>` with an `<h3>` title, `<p>` description, and `<div className="lobby-card-actions">` wrapping children.
2. In `HomePage.tsx`, replace the flat Play section with three `LobbyCard` instances:
   - **Solo Quick Match** (`t('home.quickMatchSolo')`, description from `t()`) — contains the ranked checkbox and queue button / cancel / found state.
   - **Pair Quick Match** (`t('home.quickMatchPair')`) — navigate-to-friends button.
   - **Private Room** (`t('home.privateRoom')`) — contains the create/join inputs (the `showRoomPanel` toggle state is removed; private room content is always visible inside its card).
3. Apply `disabled` prop to the two non-active cards when `queueState !== 'idle'`.
4. In `index.css`: `.lobby-cards { display:flex; flex-wrap:wrap; gap:1rem; }` and `.lobby-card { background:var(--color-surface); border-radius:var(--radius); padding:1.25rem; flex:1; min-width:220px; }`. At <=600 px: flex-direction column.
5. Write `LobbyCard.test.tsx`: assert title, description, and children render; assert disabled class applied when `disabled={true}`; assert class absent when `disabled={false}`.

### Step 4 — English locale file

**File**: `apps/web/src/i18n/locales/en.json` (new)

1. Create `en.json` as a complete English translation covering every key in `ca.json` (see data-model.md §5 for namespace inventory).
2. Notable translations: `auth.signOut` → `"Sign out"`, `home.quickMatchSolo` → `"Quick Match (Solo)"`, `home.quickMatchPair` → `"Quick Match (Pair)"`, `home.privateRoom` → `"Private Room"`, `home.searching` → `"Searching ({{mode}})… ({{count}} in queue) — Cancel"`.
3. Suit names: translate to English equivalents (Coins, Cups, Swords, Clubs) for an international audience, consistent with Constitution §VII (cultural authenticity does not require English speakers to read Catalan suit names).

### Step 5 — i18n init: replace es with en

**File**: `apps/web/src/i18n/index.ts`

1. Replace `import es from './locales/es.json'` with `import en from './locales/en.json'`.
2. In the `resources` object, replace `es: { translation: es }` with `en: { translation: en }`.
3. `fallbackLng: 'ca'` and `lng: 'ca'` remain unchanged.

### Step 6 — Settings store: stale language guard

**File**: `apps/web/src/store/settingsStore.ts`

1. Define `const SUPPORTED_LANGUAGES = ['ca', 'en'] as const` at module scope.
2. Add `onRehydrateStorage` to the `persist` options:
   - If the rehydrated state has `language` that is not in `SUPPORTED_LANGUAGES`, reset it to `'ca'` and call `i18n.changeLanguage('ca')`.
3. Add test cases to `settingsStore.test.ts`:
   - Persisted `"es"` → after rehydration `language === 'ca'`.
   - Persisted `"en"` → after rehydration `language === 'en'` (unchanged).

### Step 7 — SettingsPanel: replace language option

**File**: `apps/web/src/components/SettingsPanel.tsx`

1. Change `<option value="es">Español</option>` to `<option value="en">English</option>`.
2. No other changes.

### Step 8 — Tests: E2E

**Files**: `tests/e2e/smoke.spec.ts` (modify), `tests/e2e/language.spec.ts` (new)

1. In `smoke.spec.ts`: after login, assert `page.locator('nav .app-nav-username')` is visible.
2. In `language.spec.ts`:
   - Assert language selector shows "Català" and "English" options; "Español" absent.
   - Select English; assert a nav label changes to English immediately.
   - Reload; assert English persists.
   - Set `localStorage['botifarra-settings']` to `{"language":"es",...}` via `page.evaluate`; reload; assert UI renders in Catalan.

---

## Complexity Tracking

No constitutional violations. No complexity justification needed.
