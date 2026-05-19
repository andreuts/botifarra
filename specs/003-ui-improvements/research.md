# Research: UI Improvements — Header, Lobby Cards & Language

**Feature**: `003-ui-improvements`
**Phase**: 0 — Research

---

## Decision 1: User Identity Placement in AppShell

**Decision**: Extend the existing `app-nav-inner` flex row in `AppShell.tsx` with a new `.app-nav-user` section containing `<span>{username}</span>` and a sign-out `<button>`.

**Rationale**:
- `AppShell` already imports `useAuthStore` and knows `user`; no new state dependencies are needed.
- The nav already has a left brand link, a centre links group, and a right gear icon — adding a user section between the links and the gear is the minimal structural change.
- No new layout component is needed; a single flex child suffices.

**Alternatives considered**:
- *Separate `UserBadge` component*: adds abstraction for a single-use element; rejected by Simplicity First.
- *Context menu / dropdown*: over-engineered for one action; rejected.

---

## Decision 2: Duplicate `<h1>` Removal Strategy

**Decision**: Remove the entire `<header>` block from `HomePage.tsx` (lines ~82–97 in current source). This block contains the `<h1>` with `app.title` and the username + sign-out button. Both concerns move to `AppShell`.

**Rationale**:
- The header block's only two children are the elements being relocated (title → nav brand already exists; user identity → nav user section). After removal, nothing meaningful is lost.
- Leaving an empty `<header>` wrapper would be dead markup.

**Alternatives considered**:
- *Empty the header but keep the wrapper*: unnecessary wrapper element; rejected.

---

## Decision 3: LobbyCard Component Design

**Decision**: Create a new `LobbyCard` component (`apps/web/src/components/LobbyCard.tsx`) with props: `title: string`, `description: string`, `children: React.ReactNode`. Cards use a `.lobby-card` CSS class with the project's existing `--color-surface`, `--radius`, and custom property system. The existing lobby section in `HomePage.tsx` is refactored to render three `LobbyCard` instances: Solo Quick Match, Pair Quick Match, Private Room.

**Rationale**:
- A reusable card shell keeps the card's structural markup in one place while the home page retains all interactive logic (queue state, room creation).
- Three distinct cards align with the three game-mode actions in the spec.
- The ranked checkbox moves inside the Solo / Pair cards (the spec assumption: "incorporated into the relevant card(s)").
- The private room inputs (create/join) move inside the Private Room card, collapsing the `showRoomPanel` toggle.

**Alternatives considered**:
- *Inline card markup in HomePage*: works but duplicates structure three times; a tiny shared shell is justified.
- *Full card library (e.g. Mantine)*: violates constitution (no new paid/heavy dependencies); rejected.

---

## Decision 4: English Locale File

**Decision**: Create `apps/web/src/i18n/locales/en.json` as a full translation of `ca.json` with identical key structure. Keys must cover all namespaces: `app`, `auth`, `nav`, `home`, `game`, `declare`, `hand`, `trick`, `scoreboard`, `card`, `suits`, `game_terms`, `toast`, `history`, `rankings`, `admin`, `settings`, `friends`, `news`, `tournaments`, `errors`.

**Rationale**:
- A complete locale file prevents missing-key fallback warnings during normal use.
- The spec requires full coverage of all keys present in Catalan.

**Alternatives considered**:
- *Partial English file with Catalan fallback*: acceptable for speed but violates FR-006 ("complete English translation file"); rejected.

---

## Decision 5: Spanish Removal & Stale Language Guard

**Decision**:
1. In `apps/web/src/i18n/index.ts`: replace the `es` resource import with `en`; update `resources` object key from `es` to `en`.
2. In `apps/web/src/components/SettingsPanel.tsx`: change the `<option value="es">Español</option>` to `<option value="en">English</option>`.
3. In `apps/web/src/store/settingsStore.ts`: in the `create()` initialiser, read the persisted state from `botifarra-settings` localStorage key; if `language === 'es'`, reset to `'ca'` before Zustand hydration completes. This is done via Zustand's `onRehydrateStorage` option inside the `persist` middleware.

**Rationale**:
- The guard must run before any component renders with the stale language; `onRehydrateStorage` fires synchronously after localStorage is read, satisfying FR-007.
- Removing the `es` resource from `i18n` init means even if the guard is bypassed by a race, `i18next` falls back to `ca` automatically.

**Alternatives considered**:
- *useEffect guard in App.tsx*: runs after first render, potentially shows Spanish briefly; rejected.
- *Clearing localStorage entirely on startup*: too destructive (erases sound settings); rejected.

---

## Decision 6: No New API Contracts

**Decision**: This feature touches only frontend UI files. No new REST endpoints, WebSocket commands, or shared DTO types are introduced. No `contracts/` documents are needed.

**Rationale**: The spec's FR-001 through FR-008 are all client-side concerns. The `logout` action already exists in `authStore`; no server changes are required.
