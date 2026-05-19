# Tasks: UI Improvements — Header, Lobby Cards & Language

**Feature branch**: `003-ui-improvements`

**Input**: Design documents from `specs/003-ui-improvements/`

**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Scope**: All changes are confined to `apps/web`. No server code, database schema, shared DTOs, or game-engine packages are touched.

**Tests**: Included — TDD is NON-NEGOTIABLE per the project constitution (§IV). Unit tests are written first (failing), implementation second, E2E tests in the final polish phase.

**Organization**: Tasks grouped by user story to enable independent implementation and testing of each story.

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no in-story dependencies)
- **[Story]**: Which user story this task belongs to (`[US1]`, `[US2]`, `[US3]`)
- Exact file paths are included in every description

---

## Phase 1: Setup (Baseline Context)

**Purpose**: Establish the baseline knowledge required for safe modifications. No new files are created here.

- [X] T001 Read `apps/web/src/index.css` to catalogue all existing CSS custom properties (`--color-*`, `--radius`, etc.) and responsive breakpoints before adding new rules
- [X] T002 Read `apps/web/src/i18n/locales/ca.json` from top to bottom and note every top-level namespace and every key — this list is the required coverage contract for `en.json` (FR-006)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: There are no shared infrastructure changes that block all three stories simultaneously. Stories 1 and 2 are fully independent. Story 3 has internal sequencing (en.json → i18n/index.ts → settingsStore). The i18n `index.ts` update is listed here because it gates any Story 3 component rendering correctly in tests.

*No tasks in this phase — proceed directly to user story phases.*

**⚠️ Internal Story 3 sequence**: T012 (en.json) → T013 (i18n/index.ts) → T014 (settingsStore) must run in order within Phase 5.

---

## Phase 3: User Story 1 — User Info Visible in the Navigation Header (Priority: P1) 🎯 MVP

**Goal**: Logged-in username and sign-out button appear in the navigation bar on every page; the duplicate `<h1>` app title on the home page is removed.

**Independent Test**: Log in → the `<nav>` must contain the logged-in username text and a "Tanca sessió" button; `document.querySelector('h1')` inside the main content area must return `null` or contain no application title.

### Tests for User Story 1 (TDD — write failing tests FIRST)

- [X] T003 [US1] Create `apps/web/src/__tests__/components/AppShell.test.tsx` — render `<AppShell>` with mocked `useAuthStore` returning `{ user: { username: 'testuser' }, logout: vi.fn() }`; assert (a) the text `testuser` is visible inside the `<nav>`, (b) a button matching `auth.signOut` translation is present, (c) clicking that button calls `logout`

### Implementation for User Story 1

- [X] T004 [P] [US1] Modify `apps/web/src/components/AppShell.tsx` — destructure `logout` from `useAuthStore()` alongside the existing `user`; add `<div className="app-nav-user"><span className="app-nav-username">{user.username}</span><button className="btn-outline app-nav-signout" onClick={logout}>{t('auth.signOut')}</button></div>` as a flex child inside `.app-nav-inner`, after `.app-nav-links` and before the gear `<button>`
- [X] T005 [P] [US1] Add to `apps/web/src/index.css`: `.app-nav-user { display: flex; align-items: center; gap: 0.5rem; }` and a responsive rule at ≤ 600 px that sets `max-width: 8ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` on `.app-nav-username` to prevent layout overflow on narrow screens
- [X] T006 [US1] Remove the entire `<header>` block from `apps/web/src/pages/HomePage.tsx` — the block contains the `<h1>` with `t('app.title')`, the username `<span>`, and the sign-out `<button>`; also remove the now-unused `logout` destructure from `useAuthStore()` in that file

**Checkpoint**: Run `pnpm --filter @botifarra/web test` — T003 tests must pass. Manually verify: log in → username and sign-out visible in nav, no `<h1>` app title in page content.

---

## Phase 4: User Story 2 — Lobby Action Buttons Organised as Cards (Priority: P1)

**Goal**: The three game-mode actions on the home page (Solo Quick Match, Pair Quick Match, Private Room) are each presented as a `LobbyCard` component with a title, description, and action area; non-active cards are visually suppressed when a queue is active.

**Independent Test**: Load the home page logged in → the lobby section must contain exactly three elements with class `lobby-card`, each with an `<h3>` title and at least one action button; resize to 375 px → cards stack vertically without horizontal overflow.

### Tests for User Story 2 (TDD — write failing tests FIRST)

- [X] T007 [US2] Create `apps/web/src/__tests__/components/LobbyCard.test.tsx` — render `<LobbyCard title="Test" description="Desc"><button>Act</button></LobbyCard>`; assert (a) `<h3>` contains "Test", (b) `<p>` contains "Desc", (c) the child button renders inside `.lobby-card-actions`; then render again with `disabled={true}` and assert the wrapper element has the `lobby-card--disabled` class; render with `disabled={false}` and assert the class is absent

### Implementation for User Story 2

- [X] T008 [P] [US2] Create `apps/web/src/components/LobbyCard.tsx` — props interface `{ title: string; description: string; disabled?: boolean; children: React.ReactNode }`; render `<div className={['lobby-card', disabled && 'lobby-card--disabled'].filter(Boolean).join(' ')}><h3 className="lobby-card-title">{title}</h3><p className="lobby-card-desc">{description}</p><div className="lobby-card-actions">{children}</div></div>`
- [X] T009 [P] [US2] Add to `apps/web/src/index.css`: `.lobby-cards { display: flex; flex-wrap: wrap; gap: 1rem; }` and `.lobby-card { background: var(--color-surface); border-radius: var(--radius); padding: 1.25rem; flex: 1; min-width: 220px; }` and `.lobby-card--disabled { opacity: 0.5; pointer-events: none; }` and a responsive rule at ≤ 600 px for `flex-direction: column` on `.lobby-cards`
- [X] T010 [US2] Refactor the Play section of `apps/web/src/pages/HomePage.tsx` to use three `<LobbyCard>` instances wrapped in a `<div className="lobby-cards">`:
  - **Solo Quick Match card** — title: `t('home.quickMatchSolo')`, description: `t('home.quickMatchSoloDesc')` (new key — add to both `ca.json` and `en.json` with one-sentence descriptions), `disabled={queueState !== 'idle' && queueState.mode !== 'single'}` — contains the ranked checkbox and the queue/cancel/found state button
  - **Pair Quick Match card** — title: `t('home.quickMatchPair')`, description: `t('home.quickMatchPairDesc')` (new key), `disabled={queueState !== 'idle' && queueState.mode !== 'pair'}` — contains the pair mode action
  - **Private Room card** — title: `t('home.privateRoomSection')`, description: `t('home.privateRoomCreateHint')`, `disabled={false}` always — contains the create/join inputs inline (remove the `showRoomPanel` toggle state, always show the private room inputs inside the card)

**Checkpoint**: Run `pnpm --filter @botifarra/web test` — T007 tests must pass. Manually verify: home page shows three distinct cards; queue one mode and confirm sibling cards dim.

---

## Phase 5: User Story 3 — English Language Option Replaces Spanish (Priority: P2)

**Goal**: The settings panel language selector lists "Català" and "English" only; selecting English immediately switches all UI strings; users with a stale persisted `"es"` language fall back to Catalan silently on startup.

**Independent Test**: Open Settings → language selector must have exactly two `<option>` elements ("Català" and "English"); select English → `document.querySelectorAll('[data-i18n]')` text (or nav labels) must change immediately; set `localStorage['botifarra-settings']` to `{"state":{"language":"es"}}` and reload → app renders in Catalan with no console errors.

### Tests for User Story 3 (TDD — write failing tests FIRST)

- [X] T011 [US3] Add language guard test cases to `apps/web/src/__tests__/store/settingsStore.test.ts` — mock `localStorage` with `botifarra-settings` state set to `{ language: 'es' }`; trigger store rehydration; assert `useSettingsStore.getState().language === 'ca'`; add a second case with `{ language: 'en' }` and assert it remains `'en'` unchanged; add a third case with `{ language: 'ca' }` and assert it remains `'ca'`

### Implementation for User Story 3

> **⚠️ Sequence**: T012 must complete before T013; T013 must complete before T014. T015 is independent.

- [X] T012 [US3] Create `apps/web/src/i18n/locales/en.json` — a complete English translation covering every key in `ca.json` (established in T002); notable values: `auth.signOut` → `"Sign out"`, `home.quickMatchSolo` → `"Quick Match (Solo)"`, `home.quickMatchPair` → `"Quick Match (Pair)"`, `home.privateRoom` → `"Private Room"`, `home.privateRoomSection` → `"Private Room"`, `home.searching` → `"Searching ({{mode}})… ({{count}} in queue) — Cancel"`, `suits.O` → `"Coins"`, `suits.C` → `"Cups"`, `suits.E` → `"Swords"`, `suits.B` → `"Clubs"`; card rank labels remain numeric (1–12) except descriptive names (`"Jack"`, `"Knight"`, `"King"`); game terms translate to English equivalents (`"Botifarra"` stays as-is, `"Contra"` stays, `"Recontra"` → `"Recontra"`, `"Sant Vicenç"` stays)
- [X] T013 [US3] Update `apps/web/src/i18n/index.ts` — replace `import es from './locales/es.json'` with `import en from './locales/en.json'`; in the `resources` object replace `es: { translation: es }` with `en: { translation: en }`; leave `lng: 'ca'` and `fallbackLng: 'ca'` unchanged
- [X] T014 [US3] Update `apps/web/src/store/settingsStore.ts` — add `const SUPPORTED_LANGUAGES = ['ca', 'en'] as const` at module scope; add `onRehydrateStorage: () => (state) => { if (state && !SUPPORTED_LANGUAGES.includes(state.language as typeof SUPPORTED_LANGUAGES[number])) { state.language = 'ca'; i18n.changeLanguage('ca'); } }` inside the `persist` options object alongside the existing `name: 'botifarra-settings'` key
- [X] T015 [P] [US3] Update `apps/web/src/components/SettingsPanel.tsx` — change `<option value="es">Español</option>` to `<option value="en">English</option>` in the language selector; no other changes

**Checkpoint**: Run `pnpm --filter @botifarra/web test` — T011 tests must pass. Manually verify all four FR-005–FR-008 scenarios from `quickstart.md`.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: E2E test coverage for all three user stories; final smoke validation.

- [X] T016 Update `tests/e2e/smoke.spec.ts` — after the login step, add an assertion that `page.locator('nav .app-nav-username')` is visible; add an assertion that no `h1` containing the application title exists in the main content area (`page.locator('main h1:has-text("Botifarra")')` should have count 0)
- [X] T017 Create `tests/e2e/language.spec.ts` — four scenarios:
  1. Assert language selector contains exactly two options: "Català" and "English"; assert "Español" is not present
  2. Select English; assert a navigation label (e.g. `nav a[href="/history"]`) text changes to the English value immediately (without reload)
  3. Reload; assert English is still active (same nav label still in English)
  4. Use `page.evaluate(() => localStorage.setItem('botifarra-settings', JSON.stringify({ state: { language: 'es', soundEnabled: true, soundVolume: 0.7 }, version: 0 })))` then reload; assert UI renders in Catalan and no console errors appear

**Checkpoint**: `pnpm exec playwright test` must pass all smoke and language tests. Visual check: all three stories verifiable via `quickstart.md` FR-001–FR-008 manual steps.

---

## Dependencies

```
US1 (T003–T006)   ──────────────────────────────────────► independent
US2 (T007–T010)   ──────────────────────────────────────► independent
US3 (T011–T015)   T012 → T013 → T014 (sequence within US3; T015 parallel)
Polish (T016–T017) depends on US1, US2, US3 complete
```

US1 and US2 are fully independent and can be implemented in parallel by two contributors.
US3 can begin after T002 (ca.json inventory) is complete.

---

## Parallel Execution Map

| Stream A (US1) | Stream B (US2) | Stream C (US3) |
|----------------|----------------|----------------|
| T001, T002 (shared setup) | | |
| T003 (test) | T007 (test) | T011 (test) |
| T004 ‖ T005 | T008 ‖ T009 | T012 → T013 → T014 |
| T006 | T010 | T015 (‖ T014) |
| T016 (polish) | T016 (polish) | T017 (polish) |

---

## Implementation Strategy

**MVP scope**: Complete US1 (T001–T006) first — it delivers visible user identity and removes the duplicate heading, which is the highest-impact single change. US2 can follow immediately as it only touches `HomePage.tsx` and a new component. US3 is lower priority (P2) and involves more files, so it is a natural second wave.

**Delivery order**: US1 → US2 → US3 → Polish

---

## Task Summary

| Phase | Story | Task count |
|-------|-------|-----------|
| Phase 1: Setup | — | 2 |
| Phase 2: Foundational | — | 0 |
| Phase 3 | US1 (P1) | 4 |
| Phase 4 | US2 (P1) | 4 |
| Phase 5 | US3 (P2) | 5 |
| Phase 6: Polish | — | 2 |
| **Total** | | **17** |

Parallel opportunities identified: T004‖T005, T008‖T009, T015‖T014, US1 stream ‖ US2 stream.
