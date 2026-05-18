# Feature Specification: Developer Experience & Production Hardening

**Feature Branch**: `001-devex-hardening`

**Created**: 2026-05-13

**Status**: Draft

**Input**: Constitution principles IV (TDD), VI (Observability), VII (i18n), IX (Zero-Cost), plus project audit of missing infrastructure

## User Scenarios & Testing *(mandatory)*

### User Story 1 - CI/CD Pipeline (Priority: P1)

A developer pushes code or opens a PR and GitHub Actions automatically runs all tests, builds all packages, and checks linting. The PR cannot merge unless all checks pass.

**Why this priority**: Without CI, the TDD principle (Constitution IV) has no enforcement. Code can ship broken. This is the single most impactful infrastructure addition.

**Independent Test**: Push a commit to a branch, verify the Actions workflow runs tests/build/lint and reports status on the PR.

**Acceptance Scenarios**:

1. **Given** a developer opens a PR, **When** CI runs, **Then** all unit/integration tests pass via `pnpm test`
2. **Given** a developer opens a PR, **When** CI runs, **Then** `pnpm build` succeeds with zero TypeScript errors
3. **Given** a developer opens a PR, **When** CI runs, **Then** `pnpm lint` passes with zero warnings/errors
4. **Given** a test fails, **When** CI reports, **Then** the PR is blocked from merging

---

### User Story 2 - Linting & Formatting Configuration (Priority: P1)

A developer writes code and gets immediate feedback from ESLint and Prettier (or Biome) on code style, potential bugs, and formatting issues, both locally and in CI.

**Why this priority**: `pnpm lint` exists in root package.json but no linter config exists. Without it, code style diverges and Constitution code style rules are unenforced. Co-priority with CI since CI needs lint to run.

**Independent Test**: Run `pnpm lint` locally — it exits 0 on clean code, exits non-zero and reports specific errors on bad code.

**Acceptance Scenarios**:

1. **Given** a codebase with existing code, **When** `pnpm lint` runs, **Then** it completes without errors on the current code
2. **Given** a file with `any` types, **When** linted, **Then** ESLint reports a warning (unless justified)
3. **Given** inconsistent formatting, **When** `pnpm format` runs, **Then** all files are formatted consistently
4. **Given** CI runs, **When** lint check executes, **Then** unformatted or lint-failing code blocks the PR

---

### User Story 3 - Internationalization Foundation (Priority: P2)

The game UI displays all user-facing text in Catalan by default, loaded from a translation file. A developer can add a new language by creating a new translation file without touching component code.

**Why this priority**: Constitution VII (Catalan Identity) mandates Catalan-first UI with i18n readiness. Currently strings are hardcoded across components — the longer this is deferred, the harder the migration.

**Independent Test**: Change the language setting and verify all game UI labels switch to the new language. Add a new translation file and see it picked up.

**Acceptance Scenarios**:

1. **Given** the app loads, **When** the default locale is Catalan, **Then** all game labels, card names, and UI text appear in Catalan
2. **Given** a translation file for Spanish exists, **When** the locale is set to Spanish, **Then** all labels switch to Spanish
3. **Given** a developer adds a new key to the Catalan file, **When** they forget to add it to Spanish, **Then** the app falls back to the Catalan default
4. **Given** a component renders text, **When** inspected, **Then** no hardcoded user-facing strings exist — all come from the i18n system

---

### User Story 4 - Frontend Test Infrastructure (Priority: P2)

A developer can write and run unit tests for React components and hooks using Vitest + Testing Library. A basic suite of tests exists for the core game components.

**Why this priority**: Zero frontend tests exist. Constitution IV (TDD) applies to all layers. The game UI logic (legal move highlighting, trump declaration, trick display) is complex enough to need tests.

**Independent Test**: Run `pnpm --filter @botifarra/web test` and see meaningful test output for game components.

**Acceptance Scenarios**:

1. **Given** a developer runs `pnpm --filter @botifarra/web test`, **When** tests execute, **Then** Vitest reports results for component tests
2. **Given** `HandComponent` receives a hand with legal moves, **When** rendered, **Then** test verifies legal cards are interactive and illegal ones are dimmed
3. **Given** `useGameRoom` hook connects, **When** a `game_state` message arrives, **Then** test verifies the store updates correctly

---

### User Story 5 - E2E Test Setup (Priority: P3)

A developer can run Playwright end-to-end tests that simulate a complete user journey: register, log in, start a practice game, play a few turns.

**Why this priority**: E2E tests are the final validation layer. Constitution IV mandates them but they're the slowest to write and run, so they're lower priority than unit/integration.

**Independent Test**: Run `pnpm test:e2e` and see Playwright execute a browser test that interacts with the running app.

**Acceptance Scenarios**:

1. **Given** the app and server are running, **When** Playwright executes, **Then** it registers a user, logs in, and reaches the home page
2. **Given** a logged-in user, **When** they start a practice game, **Then** Playwright verifies the game board renders with 12 cards

---

### Edge Cases

- What happens when linting discovers issues in existing code? → Auto-fixable issues are fixed in the PR; non-fixable issues are tracked and resolved before merge.
- What happens when i18n keys are missing for a locale? → Fallback to Catalan (default locale).
- What happens when CI runs on a PR that only changes docs? → CI still runs (fast, no harm) but could be optimized with path filters later.
- What happens when Playwright tests are flaky? → Retry logic (2 retries) and clear test isolation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Project MUST have a GitHub Actions CI workflow that runs on every PR to `main`
- **FR-002**: CI MUST execute `pnpm test`, `pnpm build`, and `pnpm lint` and block merge on failure
- **FR-003**: Project MUST have ESLint configured for all packages with TypeScript strict rules
- **FR-004**: Project MUST have a consistent code formatter (Prettier or Biome)
- **FR-005**: All user-facing strings MUST be externalized via an i18n system (e.g., `react-i18next`)
- **FR-006**: Default locale MUST be Catalan (`ca`) with all game terms in Catalan
- **FR-007**: Frontend MUST have Vitest + Testing Library configured for component testing
- **FR-008**: Project MUST have Playwright installed and configured with at least one smoke test
- **FR-009**: `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:e2e` MUST all be runnable from the monorepo root
- **FR-010**: All existing code MUST pass lint and build after configuration is applied

### Key Entities

- **Translation file**: JSON/TS keyed object mapping i18n keys to localized strings, one per locale
- **CI Workflow**: GitHub Actions YAML defining the test/build/lint pipeline
- **Lint Config**: ESLint + Prettier configuration files at monorepo root with package overrides

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every PR to `main` triggers CI and gets a pass/fail status check within 5 minutes
- **SC-002**: `pnpm lint` runs across all packages and exits 0 on the current codebase
- **SC-003**: All game UI text comes from translation files — zero hardcoded user-facing strings in components
- **SC-004**: At least 10 meaningful frontend component/hook tests exist and pass
- **SC-005**: At least 1 Playwright E2E test runs successfully against the full stack

## Assumptions

- GitHub Actions is free for public repositories (Constitution IX satisfied)
- ESLint 9 flat config will be used (modern, no `.eslintrc` legacy)
- `react-i18next` + `i18next` will be used for i18n (lightweight, well-maintained, free)
- Playwright is free and open-source
- Existing inline styles in components will NOT be refactored in this feature (separate future spec)
- Redis setup remains out of scope (unused currently, separate future spec)
