# Tasks: UI Overhaul — Catalan Professional Experience

## Phase 1: Setup & Assets

- [X] T1: Extract card images from zip, place in `apps/web/public/cards/` with correct naming
- [X] T2: Create `apps/web/public/sounds/` directory with placeholder sound files
- [X] T3: Add `__APP_VERSION__` define to vite.config.ts
- [X] T4: Create settings store (`apps/web/src/store/settingsStore.ts`)

## Phase 2: Core Infrastructure

- [X] T5: Create `useSound` hook (`apps/web/src/hooks/useSound.ts`)
- [X] T6: Create `AppShell` layout component with nav bar and settings gear icon
- [X] T7: Create `SettingsPanel` component (sound toggle, volume, language)
- [X] T8: Add new i18n keys to ca.json and es.json (settings, about, nav updates)

## Phase 3: Visual Theme

- [X] T9: Update CSS custom properties for Catalan blend theme
- [X] T10: Update CardComponent to use card images with SVG fallback

## Phase 4: Pages & UX

- [X] T11: Create `AboutPage` component (integrated into AppShell as modal)
- [X] T12: Update `App.tsx` — wrap routes in AppShell
- [X] T13: Streamline HomePage UX (remove duplicate nav, clear CTA hierarchy)
- [X] T14: Improve GamePage game-end screen (rematch + lobby buttons)
- [X] T15: Wire sound events into GamePage via useSoundEffects hook

## Phase 5: Polish & Validation

- [X] T16: Ensure keyboard accessibility for settings panel and about page
- [X] T17: Verify card images render correctly at all sizes
- [X] T18: Run existing tests to confirm no regressions (38/38 pass)
