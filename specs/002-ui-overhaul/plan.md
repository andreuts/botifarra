# Implementation Plan: UI Overhaul — Catalan Professional Experience

## Tech Stack (from constitution)
- Frontend: React 19 + Vite + TypeScript
- State: Zustand (persisted) + TanStack Query
- Styling: CSS custom properties (no runtime lib)
- i18n: i18next + react-i18next
- Audio: Web Audio API / HTMLAudioElement (no new deps)
- Build: Vite with vite-plugin-pwa

## Architecture Decisions

### Card Images
- **Location**: `apps/web/public/cards/` (static assets, not bundled)
- **Naming**: `{suit}_{rank}.png` (e.g., `oros_01.png`, `bastos_12.png`)
- **Back**: `back.png`
- **Loading**: Native `<img>` with lazy loading, CSS object-fit
- **Fallback**: Current SVG pip rendering as fallback if image fails

### Sound System
- **Location**: `apps/web/public/sounds/` (static, loaded on demand)
- **Files**: `card-deal.mp3`, `card-play.mp3`, `trick-win.mp3`, `round-win.mp3`, `round-lose.mp3`, `trump-declare.mp3`
- **Implementation**: Custom `useSound` hook using HTMLAudioElement pool
- **Settings**: Stored in a new `settingsStore` (Zustand, persisted to localStorage)

### Settings Store
- New Zustand store: `apps/web/src/store/settingsStore.ts`
- Fields: `soundEnabled: boolean`, `soundVolume: number (0-1)`, `language: string`
- Persisted under key `botifarra-settings`

### Settings Panel
- `apps/web/src/components/SettingsPanel.tsx` — modal overlay triggered by gear icon
- Gear icon rendered in a new `AppShell` layout wrapper component
- Contains: sound toggle, volume slider, language select, About link

### About Page
- `apps/web/src/pages/AboutPage.tsx` — accessible from settings panel
- Shows: app name, version (from `__APP_VERSION__` define), copyright, card attribution, licenses

### Visual Theme (Option C — Blend)
- Keep felt-green table surface
- Warm up gold accent to richer ochre
- Add subtle red accent (not Senyera-bright, more terracotta/wine)
- Refine wood rail border
- Add subtle ornamental corner decorations via CSS pseudo-elements
- Typography: keep Inter but add Georgia/serif for card labels and headings

### UX Improvements
- Add `AppShell` component wrapping all auth'd pages (persistent nav bar + settings gear)
- Streamline home page: single primary CTA, secondary options below
- Game-end screen: direct rematch + return-to-lobby buttons
- First-time tooltip on game board (one-shot, localStorage flag)

## File Structure Changes

```
apps/web/
├── public/
│   ├── cards/         (48 face PNGs + 1 back)
│   └── sounds/        (6 MP3 files)
├── src/
│   ├── components/
│   │   ├── AppShell.tsx        (NEW — layout wrapper with nav + settings gear)
│   │   ├── SettingsPanel.tsx   (NEW — settings modal)
│   │   └── CardComponent.tsx   (MODIFIED — use card images)
│   ├── hooks/
│   │   └── useSound.ts        (NEW — sound playback hook)
│   ├── pages/
│   │   ├── AboutPage.tsx       (NEW)
│   │   ├── HomePage.tsx        (MODIFIED — UX streamlining)
│   │   └── GamePage.tsx        (MODIFIED — sound triggers, game-end UX)
│   ├── store/
│   │   └── settingsStore.ts    (NEW — sound + language prefs)
│   ├── i18n/locales/
│   │   ├── ca.json             (MODIFIED — new keys for settings, about)
│   │   └── es.json             (MODIFIED — matching new keys)
│   ├── App.tsx                 (MODIFIED — wrap routes in AppShell, add About route)
│   └── index.css               (MODIFIED — theme refinement)
└── vite.config.ts              (MODIFIED — define __APP_VERSION__)
```
