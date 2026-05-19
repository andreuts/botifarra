# Data Model: UI Improvements — Header, Lobby Cards & Language

**Feature**: `003-ui-improvements`
**Phase**: 1 — Design

---

## Overview

This feature has no database schema changes and no new shared DTOs. All changes are confined to the React/Vite frontend (`apps/web`). The "data model" here describes the component and store interfaces that are introduced or modified.

---

## 1. LobbyCard Component Interface

**File**: `apps/web/src/components/LobbyCard.tsx` *(new)*

```typescript
interface LobbyCardProps {
  title: string;
  description: string;
  disabled?: boolean;        // visually suppress card when another mode is active
  children: React.ReactNode; // action button(s), inputs, status indicators
}
```

**Constraints**:
- `disabled` dims the card (opacity ~0.5) but does not remove it from the DOM.
- `children` is opaque; the card does not manage interactive state — that stays in `HomePage`.

---

## 2. AppShell Nav User Section

**File**: `apps/web/src/components/AppShell.tsx` *(modified)*

No new props or state. The existing `user` from `useAuthStore()` and `logout` action are already available. The modification adds a `.app-nav-user` div to the nav's flex row.

```typescript
// Existing: const { user } = useAuthStore()
// New:      const { user, logout } = useAuthStore()
// New JSX:
<div className="app-nav-user">
  <span className="app-nav-username">{user.username}</span>
  <button className="btn-outline app-nav-signout" onClick={logout}>
    {t('auth.signOut')}
  </button>
</div>
```

**Translation key used**: `auth.signOut` (already exists in all locale files).

---

## 3. Settings Store — Language Validation

**File**: `apps/web/src/store/settingsStore.ts` *(modified)*

The `persist` middleware is extended with `onRehydrateStorage` to sanitise a stale `"es"` value:

```typescript
const SUPPORTED_LANGUAGES = ['ca', 'en'] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Inside persist options:
onRehydrateStorage: () => (state) => {
  if (state && !SUPPORTED_LANGUAGES.includes(state.language as SupportedLanguage)) {
    state.language = 'ca';
    i18n.changeLanguage('ca');
  }
},
```

**Valid language values after this change**: `'ca'` | `'en'` (the `'es'` value is silently normalised to `'ca'`).

---

## 4. i18n Resource Map

**File**: `apps/web/src/i18n/index.ts` *(modified)*

| Before | After |
|--------|-------|
| `import es from './locales/es.json'` | `import en from './locales/en.json'` |
| `resources: { ca: ..., es: ... }` | `resources: { ca: ..., en: ... }` |
| `lng: 'ca'` | `lng: 'ca'` (unchanged) |
| `fallbackLng: 'ca'` | `fallbackLng: 'ca'` (unchanged) |

---

## 5. English Locale File Structure

**File**: `apps/web/src/i18n/locales/en.json` *(new)*

Mirrors `ca.json` exactly in key structure. Top-level namespaces:

| Namespace | Key count (approx.) | Notes |
|-----------|---------------------|-------|
| `app` | 1 | `title` |
| `auth` | 11 | sign-in, sign-out, register flows |
| `nav` | 6 | navigation labels |
| `home` | 22 | lobby, queue, room actions |
| `game` | 14 | in-game status messages |
| `declare` | 9 | trump declaration panel |
| `hand` | 4 | hand component labels |
| `trick` | 7 | trick area labels |
| `scoreboard` | 2 | |
| `card` | ranks + suits short | 16+ rank/suit entries |
| `suits` | 4 | Oros, Copes, Espases, Bastos |
| `game_terms` | 4 | botifarra, contra, etc. |
| `toast` | 7 | toast notification messages |
| `history` | 20+ | match history page |
| `rankings` | 9 | rankings page |
| `admin` | 20+ | admin panel |
| `settings` | 6 | settings panel labels |
| `friends` | 10+ | friends page |
| `news` | 8+ | news pages |
| `tournaments` | 10+ | tournament pages |
| `errors` | varies | error messages |

**Validation rule**: Every key in `ca.json` must have a corresponding key in `en.json`. Missing keys fall back to Catalan via `fallbackLng: 'ca'`, but the file must be complete per FR-006.

---

## 6. Home Page Structural Changes

**File**: `apps/web/src/pages/HomePage.tsx` *(modified)*

| Element removed | Reason |
|-----------------|--------|
| `<header>` block containing `<h1>{t('app.title')}</h1>` | Title already in nav brand link (FR-002) |
| `<span>{user?.username}</span>` inside that header | Moves to AppShell nav (FR-001) |
| `<button onClick={logout}>{t('auth.signOut')}</button>` inside that header | Moves to AppShell nav (FR-001) |

| Element refactored | Change |
|--------------------|--------|
| Play section flat button row | Wrapped in `LobbyCard` components (FR-003) |
| Private room toggle `showRoomPanel` | Panel content moves inside Private Room `LobbyCard` |
| Ranked checkbox | Rendered inside Solo Quick Match card |

---

## 7. State Transitions: Queue → Card Visual State

The `queueState` value from `useMatchmakingQueue()` drives the `disabled` prop on sibling `LobbyCard` components:

| `queueState` | Solo card | Pair card | Private Room card |
|---|---|---|---|
| `'idle'` | enabled | enabled | enabled |
| `'queued'` (mode=`single`) | **active** (shows cancel) | disabled | disabled |
| `'queued'` (mode=`pair`) | disabled | **active** (shows cancel) | disabled |
| `'found'` | disabled | disabled | disabled |
