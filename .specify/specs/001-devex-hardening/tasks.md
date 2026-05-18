# Tasks: Developer Experience & Production Hardening

**Input**: Design documents from `.specify/specs/001-devex-hardening/`

**Prerequisites**: plan.md (required), spec.md (required)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1=CI, US2=Lint, US3=i18n, US4=Frontend tests, US5=E2E)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create config files that other phases depend on

- [x] T001 [P] [US2] Install ESLint 9 + typescript-eslint + Prettier as root devDependencies: `pnpm add -Dw eslint @eslint/js @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-config-prettier eslint-plugin-react-hooks eslint-plugin-react-refresh globals`
- [x] T002 [P] [US2] Create root `eslint.config.js` (flat config) with TypeScript strict rules, React hooks plugin for web, node plugin for server, no-any warning, ignoring dist/node_modules/.specify
- [x] T003 [P] [US2] Create root `.prettierrc` (2 spaces, single quotes, semicolons, trailing commas) and `.prettierignore` (dist, node_modules, pnpm-lock, prisma/migrations)
- [x] T004 [US2] Add `lint` script to each package.json (`apps/server`, `apps/web`, `packages/botifarra-core`, `packages/shared`) calling `eslint src/`
- [x] T005 [US2] Add `format` and `format:check` scripts to root package.json
- [x] T006 [US2] Run `pnpm lint` and `pnpm format` — fix all auto-fixable issues in existing code until both pass clean

**Checkpoint**: `pnpm lint` and `pnpm format:check` exit 0. All existing code is clean.

---

## Phase 2: CI/CD Pipeline (US1 — Priority: P1)

**Purpose**: Automated quality gates on every PR

**Depends on**: Phase 1 (lint must work before CI can run it)

- [x] T007 [US1] Create `.github/workflows/ci.yml`: trigger on PR to main + push to main, ubuntu-latest, Node 20, pnpm install, `pnpm lint`, `pnpm build`, `pnpm test`
- [ ] T008 [US1] Configure branch protection rule guidance in CONTRIBUTING.md: require CI checks to pass before merge
- [ ] T009 [US1] Test CI by pushing the branch and verifying the workflow runs green

**Checkpoint**: PR shows green CI checks for lint + build + test.

---

## Phase 3: Internationalization Foundation (US3 — Priority: P2)

**Purpose**: Externalize all user-facing strings, Catalan default

- [x] T010 [US3] Install i18n deps in apps/web: `pnpm --filter @botifarra/web add i18next react-i18next i18next-browser-languagedetector`
- [x] T011 [US3] Create `apps/web/src/i18n/index.ts` — initialize i18next with `ca` as default and fallback language, browser language detection, JSON backend
- [x] T012 [US3] Create `apps/web/src/i18n/locales/ca.json` — extract ALL user-facing strings from existing components (game terms, UI labels, buttons, toasts, error messages, page titles) into Catalan translation keys
- [x] T013 [P] [US3] Create `apps/web/src/i18n/locales/es.json` — Spanish translation stub (copy keys, translate values)
- [x] T014 [US3] Import i18n init in `apps/web/src/main.tsx` (before App renders)
- [x] T015 [US3] Replace hardcoded strings with `t()` calls in all game components: `HandComponent.tsx`, `DeclareTrumpPanel.tsx`, `Scoreboard.tsx`, `TrickArea.tsx`, `CardComponent.tsx`
- [x] T016 [US3] Replace hardcoded strings with `t()` calls in all page components: `GamePage.tsx`, `HomePage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx`, `MatchHistoryPage.tsx`, `RankingsPage.tsx`, `AdminPage.tsx`, `MonitoringPage.tsx`
- [x] T017 [US3] Replace hardcoded strings in toast messages and game-over overlay (inside `useGameRoom.ts` hook and `gameStore.ts`)
- [x] T018 [US3] Verify the app renders correctly in Catalan — manual smoke test

**Checkpoint**: All UI text comes from `ca.json`. Switching locale to `es` shows Spanish text.

---

## Phase 4: Frontend Test Infrastructure (US4 — Priority: P2)

**Purpose**: Component and hook testing for the web app

- [x] T019 [US4] Install test deps in apps/web: `pnpm --filter @botifarra/web add -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`
- [x] T020 [US4] Add Vitest config to `apps/web/vite.config.ts` or create `apps/web/vitest.config.ts` with jsdom environment and setup file
- [x] T021 [US4] Create `apps/web/src/__tests__/setup.ts` — import `@testing-library/jest-dom/vitest`, mock i18next
- [x] T022 [US4] Add `test` script to `apps/web/package.json`: `vitest run`
- [x] T023 [P] [US4] Write tests for `HandComponent` in `apps/web/src/__tests__/components/HandComponent.test.tsx` — renders cards, highlights legal moves, fires play callback
- [x] T024 [P] [US4] Write tests for `Scoreboard` in `apps/web/src/__tests__/components/Scoreboard.test.tsx` — renders scores, player names, trump indicator
- [x] T025 [P] [US4] Write tests for `DeclareTrumpPanel` in `apps/web/src/__tests__/components/DeclareTrumpPanel.test.tsx` — renders suit buttons, fires declaration callback, shows pass/contra
- [x] T026 [US4] Write tests for `gameStore` in `apps/web/src/__tests__/store/gameStore.test.ts` — state updates, toast management, connection status
- [x] T027 [US4] Verify `pnpm --filter @botifarra/web test` passes all new tests, then verify `pnpm test` (root) includes web tests

**Checkpoint**: `pnpm test` includes web package, ≥10 frontend tests pass.

---

## Phase 5: E2E Test Setup (US5 — Priority: P3)

**Purpose**: Full-stack smoke test with Playwright

- [x] T028 [US5] Install Playwright: `pnpm add -Dw @playwright/test` and run `npx playwright install --with-deps chromium`
- [x] T029 [US5] Create `playwright.config.ts` at monorepo root — base URL `http://localhost:5173`, web server command `pnpm dev`, chromium only, 30s timeout
- [x] T030 [US5] Create `tests/e2e/smoke.spec.ts` — test: navigate to `/register`, create account, verify redirect to home page
- [x] T031 [US5] Add `test:e2e` script to root package.json: `playwright test`
- [ ] T032 [US5] Run and verify the E2E test passes locally with `pnpm test:e2e`

**Checkpoint**: `pnpm test:e2e` executes 1 Playwright test successfully.

---

## Phase 6: Polish & Documentation

**Purpose**: Update docs, ensure consistency

- [x] T033 [P] Update `CONTRIBUTING.md` — add lint/format commands, frontend test commands, E2E test commands, i18n contribution guide (how to add a new language)
- [x] T034 [P] Update `README.md` — add i18n section, CI badge, updated commands table
- [x] T035 Verify all root scripts work: `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm format:check`, `pnpm test:e2e`
- [x] T036 Final cleanup: remove any TODO comments added during this feature, ensure no `any` types introduced

**Checkpoint**: All documentation is current. All scripts work from root. CI passes green.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Lint setup)**: No dependencies — start immediately
- **Phase 2 (CI)**: Depends on Phase 1 (CI needs lint to exist)
- **Phase 3 (i18n)**: Independent — can run parallel with Phase 2
- **Phase 4 (Frontend tests)**: Partially depends on Phase 3 (tests need i18n mock)
- **Phase 5 (E2E)**: Depends on Phase 4 (test infra should be established)
- **Phase 6 (Docs)**: Depends on all prior phases

### Parallel Opportunities

```
Phase 1 (Lint) ──────► Phase 2 (CI) ──────────────────► Phase 6 (Docs)
                  └──► Phase 3 (i18n) ──► Phase 4 (FE tests) ──► Phase 5 (E2E) ──┘
```

- T001, T002, T003 can all run in parallel (different files)
- T012 and T013 (translation files) can run in parallel
- T023, T024, T025 (component tests) can run in parallel
- T033, T034 (doc updates) can run in parallel

### Implementation Strategy (Solo Developer)

Execute sequentially in priority order:
1. Phase 1 → Phase 2 → verify CI → commit
2. Phase 3 → verify i18n → commit
3. Phase 4 → verify frontend tests → commit
4. Phase 5 → verify E2E → commit
5. Phase 6 → final PR

Each phase produces a shippable increment.
