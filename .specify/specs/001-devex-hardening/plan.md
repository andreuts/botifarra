# Implementation Plan: Developer Experience & Production Hardening

**Branch**: `001-devex-hardening` | **Date**: 2026-05-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `.specify/specs/001-devex-hardening/spec.md`

## Summary

Add the missing developer experience infrastructure: GitHub Actions CI/CD pipeline, ESLint + Prettier configuration, react-i18next internationalization with Catalan as the default language, Vitest + Testing Library for frontend component tests, and Playwright for E2E tests. This hardens the project for collaborative development and enforces the Constitution's TDD, observability, and i18n principles.

## Technical Context

**Language/Version**: TypeScript 5.8+ (strict mode), Node.js ≥ 20

**Primary Dependencies**:
- ESLint 9 (flat config) + `@typescript-eslint/eslint-plugin` + Prettier
- `i18next` + `react-i18next` (i18n runtime)
- `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` (frontend tests)
- `@playwright/test` (E2E)
- GitHub Actions (CI)

**Storage**: N/A (no schema changes)

**Testing**: Vitest (unit + integration + component), Playwright (E2E)

**Target Platform**: Node.js CI runner (ubuntu-latest), all browsers via Playwright

**Project Type**: Monorepo (pnpm workspaces) — apps/server, apps/web, packages/core, packages/shared

**Performance Goals**: CI completes in under 5 minutes

**Constraints**: Zero-cost (all tools free/open-source), no paid CI minutes

**Scale/Scope**: ~165 existing tests + 10 new frontend tests + 1 E2E smoke test

## Constitution Check

| Principle | Compliance |
|-----------|-----------|
| I. Simplicity First | ✅ Minimal config files, standard tooling |
| II. Shared Game Engine | ✅ No changes to botifarra-core |
| III. Server-Authoritative | ✅ No gameplay changes |
| IV. TDD (NON-NEGOTIABLE) | ✅ This feature ADDS test infrastructure |
| V. Monorepo Boundaries | ✅ Lint/test config respects package boundaries |
| VI. Observability | ✅ CI provides build/test visibility |
| VII. Catalan Identity & i18n | ✅ Implements i18n with Catalan default |
| VIII. Cross-Platform | ✅ No platform changes |
| IX. Zero-Cost | ✅ All tools are free and open-source |
| X. Loyal to Architecture | ✅ No architectural deviations |

## Project Structure

### Documentation (this feature)

```text
.specify/specs/001-devex-hardening/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Task breakdown
```

### Source Code Changes

```text
# New files
.github/workflows/ci.yml                    # GitHub Actions CI pipeline
eslint.config.js                             # ESLint 9 flat config (root)
.prettierrc                                  # Prettier config (root)
.prettierignore                              # Prettier ignores
apps/web/src/i18n/                           # i18n setup
├── index.ts                                 # i18next initialization
├── locales/
│   ├── ca.json                              # Catalan translations (default)
│   └── es.json                              # Spanish translations (stub)
apps/web/src/__tests__/                      # Frontend test files
├── setup.ts                                 # Vitest setup (jsdom, testing-library matchers)
├── components/                              # Component tests
│   ├── HandComponent.test.tsx
│   ├── Scoreboard.test.tsx
│   └── DeclareTrumpPanel.test.tsx
├── hooks/
│   └── useGameRoom.test.ts
playwright.config.ts                         # Playwright config (root)
tests/e2e/                                   # E2E tests
└── smoke.spec.ts                            # Register → login → practice game

# Modified files
apps/web/src/main.tsx                        # Import i18n init
apps/web/package.json                        # Add test/i18n deps
apps/web/vite.config.ts                      # Add test config if needed
apps/server/package.json                     # Add lint script
packages/botifarra-core/package.json         # Add lint script
packages/shared/package.json                 # Add lint script
package.json                                 # Add format, test:e2e scripts
apps/web/src/components/*.tsx                 # Replace hardcoded strings with t() calls
```

**Structure Decision**: All changes integrate into the existing monorepo structure. No new packages. Lint config lives at root (shared). i18n lives in apps/web (frontend-only concern). E2E tests live at monorepo root (full-stack concern).

### Key Technical Decisions

| Decision | Rationale | Alternative Rejected |
|----------|-----------|---------------------|
| ESLint 9 flat config | Modern, no legacy `.eslintrc` | ESLint 8 (deprecated path) |
| Prettier (separate) | Widely supported, editor integration | Biome (less React ecosystem support) |
| `react-i18next` | De-facto React i18n, lightweight, free | `react-intl` (heavier, less flexible) |
| JSON translation files | Simple, tooling-friendly, diffable | TypeScript files (overkill) |
| Vitest + Testing Library | Already used in backend, consistent | Jest (slower, ESM issues) |
| Playwright | Multi-browser, modern, free | Cypress (heavier, limited free tier) |

## Complexity Tracking

No constitution violations. All changes use standard, widely-adopted tools.
