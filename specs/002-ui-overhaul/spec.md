# Feature Specification: UI Overhaul — Catalan Professional Experience

**Feature Branch**: `002-ui-overhaul`

**Created**: 2026-05-18

**Status**: Draft

**Input**: User description: "Rework the UI so it looks like a more professional application with a Catalan look and feel, uses the attached Spanish deck images, is still lightweight, UI does not break and is accessible, UX workflows are improved, application uses sounds, a user configuration wheel menu for sound settings, and an About page with copyright, version, etc."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Authentic Spanish Deck Cards with Catalan Aesthetic (Priority: P1)

A player opens Botifarra and sees a visually polished interface. Card faces display the pcio-style Spanish deck artwork — hand and bat (oros, copes, espases, bastos) — making each card immediately recognizable. The overall aesthetic feels distinctly Catalan: warm red and gold tones drawn from the Senyera, a card table surface that evokes a traditional Catalan game room, and ornamental touches that reference Catalan cultural heritage. The layout is clean and uncluttered; nothing feels cheap or generic.

**Why this priority**: The visual foundation underpins all other stories. Without authentic cards and a coherent aesthetic, every other UI improvement is incomplete.

**Independent Test**: Can be fully tested by launching the app, logging in, and entering a game — the card images must render correctly and the visual identity must be consistent across the game board, lobby, and login screen.

**Acceptance Scenarios**:

1. **Given** the player opens any page of the application, **When** the page loads, **Then** the visual design uses the Catalan colour palette (warm reds, gold, ochre/terracotta earth tones) consistently throughout navigation, buttons, and panels.
2. **Given** the player is in an active game, **When** cards are dealt, **Then** each card face displays the correct pcio-style Spanish deck artwork at a legible size on both mobile (portrait) and desktop.
3. **Given** the player is on a mobile device (320 px wide), **When** viewing their hand, **Then** all card images are visible, identifiable, and no text or UI element is cut off or overlaps another.
4. **Given** a screen reader user navigates the game board, **When** focus moves to a card, **Then** the card's name and suit are announced correctly in Catalan (e.g., "As d'Oros").
5. **Given** the player has a slow connection, **When** cards are loading, **Then** a lightweight placeholder is shown — no blank white boxes or broken image icons appear.

---

### User Story 2 — Sound Feedback During Gameplay (Priority: P2)

A player hears audio cues that match game events: a crisp card-slap sound when any player plays a card, a short celebratory flourish when a trick is won, a fanfare when the round ends with their team winning, and a deflated tone when they lose. Sounds are short, culturally fitting (traditional/folk-inspired rather than electronic beeps), and never distracting. On first visit, sounds are enabled by default.

**Why this priority**: Sound feedback significantly increases the sense of presence and polish; it is a standard expectation for card games.

**Independent Test**: Can be fully tested by entering a game against bots and playing through a full round — each of the defined sound events must trigger once per appropriate game moment.

**Acceptance Scenarios**:

1. **Given** sound is enabled, **When** any player (human or bot) plays a card, **Then** a card-play sound effect plays within a perceptible instant of the card being placed.
2. **Given** sound is enabled, **When** the player's team wins a trick, **Then** a distinct "trick won" sound plays; when the opponent team wins, the sound is different or absent.
3. **Given** sound is enabled, **When** a game round concludes, **Then** a win fanfare or loss tone plays according to the player's team result.
4. **Given** sound is enabled, **When** cards are dealt at the start of a round, **Then** a shuffling/dealing sound plays once.
5. **Given** sound is enabled, **When** a trump suit is declared, **Then** a distinct declaration sound plays.
6. **Given** the player is on a mobile browser that requires a user gesture to unlock audio, **When** they first interact with the app (tap/click anything), **Then** audio is unlocked and all subsequent game sounds play normally — no error or silent failure occurs.

---

### User Story 3 — Settings Configuration Panel (Priority: P2)

A gear icon is always visible in the corner of every screen. Tapping it opens a settings panel where the player can toggle game sounds on or off, adjust the sound volume, and switch the display language between Catalan and Spanish. Settings are saved immediately and persist when the player closes and reopens the app. The panel closes without losing game state.

**Why this priority**: Settings are needed to support players in different environments (e.g., playing silently in public) and enables the sound feature to be user-controlled from day one.

**Independent Test**: Can be fully tested without a live game — open the settings panel from the home screen, change sound and language settings, reload the page, and verify all settings are still applied.

**Acceptance Scenarios**:

1. **Given** the player is on any screen (lobby, game board, history, etc.), **When** they look at the corner of the screen, **Then** the settings gear icon is visible and accessible via keyboard Tab navigation.
2. **Given** the settings panel is open, **When** the player toggles sounds off, **Then** all game sound effects immediately stop playing and do not play for subsequent game events in the same session.
3. **Given** the player adjusts the volume slider to a specific level and closes the panel, **When** they reopen the app in a new browser session, **Then** the volume is at the same level they set.
4. **Given** the settings panel is open during an active game, **When** the player closes the panel (via Escape key or close button), **Then** the game resumes from the exact state it was in with no missed events.
5. **Given** a keyboard-only user opens the settings panel, **When** navigating through settings, **Then** all controls (toggle, slider, language select) are reachable and operable by keyboard alone.

---

### User Story 4 — About Screen (Priority: P3)

A player can open an About screen accessible from the settings panel. It shows the application name, current version number, copyright statement, a brief description of what Botifarra is, credits for card artwork (pcio-style deck attribution), and a link to open-source license information. It is a single, clean, read-only screen.

**Why this priority**: Required for legal compliance (license attribution for card artwork) and provides basic trust/transparency signals.

**Independent Test**: Can be fully tested by opening the settings panel and navigating to About — all required fields must be present and readable.

**Acceptance Scenarios**:

1. **Given** the player opens the About screen, **When** it loads, **Then** it displays the app name, version number, copyright year and holder, and a short game description.
2. **Given** the About screen is open, **When** the player reads the credits, **Then** the pcio-style Spanish deck artwork attribution is clearly visible.
3. **Given** the About screen is open, **When** the player interacts with the open-source licenses link, **Then** they are shown or directed to the relevant license texts.
4. **Given** a screen reader user opens the About screen, **When** they read through its content, **Then** all text is properly announced in logical reading order.

---

### User Story 5 — Streamlined UX Workflows (Priority: P3)

A player experiences cleaner navigation throughout the app: fewer unnecessary confirmation dialogs, clearer call-to-action hierarchy on the home screen, a persistent navigation bar with quick access to history and rankings, and a more polished game-end screen that offers immediate rematch or return-to-lobby options. Onboarding for first-time users includes a brief tooltip about how to play.

**Why this priority**: UX polish makes the app feel professional and reduces friction; however it sits below the core visual and sound work.

**Independent Test**: Can be fully tested end-to-end: land on home screen, start a match, play to completion, accept rematch — measure the number of taps required compared to the current flow.

**Acceptance Scenarios**:

1. **Given** the player is on the home screen, **When** they look at the primary action area, **Then** there is a clear single primary call-to-action to start a game (not three equally weighted options).
2. **Given** a game ends, **When** the result screen is shown, **Then** the player can start a rematch or return to the lobby in one tap, without navigating through the home screen manually.
3. **Given** the player is anywhere in the app, **When** they want to access match history, **Then** it is reachable in at most two taps from any screen.
4. **Given** a first-time user enters the game board, **When** it is their turn to play, **Then** a subtle tooltip or visual cue highlights the actionable cards in their hand.

---

### Edge Cases

- What happens when card images fail to load (network error, missing file)?
- How does the layout adapt when a player has 10+ cards in hand on a narrow mobile screen?
- What happens to active sounds when the browser tab loses focus or the device is locked?
- How are settings handled for users who have no localStorage access (private browsing, browser restrictions)?
- What happens when the version number is not yet available at app startup?
- How does the settings panel behave during the trump declaration phase (time-sensitive)?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game board MUST display card faces using the pcio-style Spanish deck artwork for all 48 cards (oros, copes, espases, bastos — 1 through 12 each).
- **FR-002**: Card backs MUST display a single unified back image consistent with the deck style.
- **FR-003**: The application MUST apply a Catalan visual identity using a **blended approach**: keep the card-table metaphor (felt green surface), enrich with warm gold and subtle red accents, add understated Catalan ornamental touches without overt patriotic references. Heritage soul, modern execution — the result should feel like a quality card game app with Catalan cultural warmth, not a flag display. No prominent Senyera usage; identity comes through colour warmth, typography, and game terminology rather than explicit national symbols.

- **FR-004**: All interactive UI elements MUST meet WCAG 2.1 AA colour contrast requirements (≥ 4.5:1 for normal text, ≥ 3:1 for large text and UI components).
- **FR-005**: Every card MUST have an accessible text alternative that announces its rank and suit in Catalan when focused by keyboard or screen reader.
- **FR-006**: Sound effects MUST play for the following game events: card dealt, card played by any player, trick won by own team, round/game won, round/game lost, trump declaration.
- **FR-007**: All sound effects MUST be controllable via a persistent user preference: enabled/disabled toggle and volume level (0–100%).
- **FR-008**: Sound preferences MUST persist across browser sessions without requiring a user account.
- **FR-009**: A settings control MUST be accessible from every screen in the application, openable and closable without navigating away.
- **FR-010**: The settings panel MUST contain at minimum: sound toggle, volume control, and language selector (Catalan / Spanish).
- **FR-011**: An About screen MUST be accessible from the settings panel and MUST display: application name, version, copyright, Catalan game description, card artwork attribution, and open-source license references.
- **FR-012**: The home screen MUST present a clear visual hierarchy with one dominant primary action (start a game) and secondary actions visually subordinate.
- **FR-013**: A game-end screen MUST offer direct actions: rematch (same opponents/mode) and return to lobby, without requiring additional navigation.
- **FR-014**: The entire application MUST be fully keyboard-navigable: every interactive element reachable via Tab, activatable via Enter/Space, and modals dismissible via Escape.
- **FR-015**: The application MUST remain lightweight: all newly added assets (card images, sounds) MUST NOT cause initial page load time to exceed 3 seconds on a standard broadband connection.

### Key Entities

- **CardImage**: Visual representation of a playing card; identified by suit (oros, copes, espases, bastos) and rank (1–12); has a face image and a shared back image.
- **SoundEvent**: A named game event that triggers an audio cue; has an event type, associated audio file, and a user-controllable enabled state.
- **UserPreferences**: Persistent per-device settings including sound enabled, volume level, and selected language; stored client-side and does not require authentication.
- **AppMetadata**: Read-only information about the build: version string, copyright year, attribution texts, and license references.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 48 card face images and 1 card back image render correctly in-game on screens from 320 px to 1920 px wide, with zero broken-image placeholders.
- **SC-002**: Sound effects play within 150 ms of the triggering game event on a modern mobile device — imperceptible lag to the player.
- **SC-003**: Settings changes (sound toggle, volume, language) take effect immediately, with zero page reload required.
- **SC-004**: User preferences persist correctly across a full browser close and reopen cycle in 100% of tests.
- **SC-005**: Automated accessibility audit reports zero WCAG 2.1 AA violations across all pages (lobby, game board, settings, about).
- **SC-006**: A player can reach match history from the game-end screen in ≤ 2 taps/clicks.
- **SC-007**: A player can start a rematch from the game-end screen in ≤ 1 tap/click.
- **SC-008**: Total asset size added by card images and sound files does not cause initial Largest Contentful Paint to exceed 3 seconds on a 10 Mbps connection.
- **SC-009**: Keyboard-only navigation reaches every interactive element on every page with no focus traps outside of modal dialogs.

---

## Assumptions

1. **Card Image Format**: The attached pcio-style Spanish deck images will be provided as individual PNG files per card, named by suit and rank (e.g., `oros_01.png`). If a different format is supplied, naming conventions will be adapted accordingly.
2. **Sound File Location**: Sound effects will be stored in `apps/web/public/sounds/` so they are served as static assets, loaded on demand, and not bundled into the JavaScript payload. Recommended sound events and suggested filenames:
   - `card-deal.mp3` — card shuffle / deal
   - `card-play.mp3` — single card placed on table
   - `trick-win.mp3` — own team wins a trick
   - `round-win.mp3` — own team wins the round/game
   - `round-lose.mp3` — own team loses the round/game
   - `trump-declare.mp3` — trump suit is declared
3. **Card Image Location**: Card face and back images will be stored in `apps/web/public/cards/` served as static assets, lazy-loaded as needed.
4. **Version Number**: The application version will be sourced from `package.json` at build time and embedded as a build-time constant.
5. **Settings Storage**: User preferences are stored in the browser's localStorage under a namespaced key. No server synchronisation is assumed; preferences are device-local.
6. **Sound Library**: No new audio library dependency is required; the Web Audio API (built into all modern browsers) or the native HTML `<audio>` element is sufficient.
7. **Existing CSS Architecture**: The redesign will extend the existing CSS custom-property system rather than replace it wholesale, updating colour variables and adding new ones to minimise regression risk.
8. **Card Back**: A single card back design is used for all card backs; the pcio-style deck is assumed to include a back image.
9. **First-Time User Tooltip**: Implemented as a simple one-time overlay dismissable on any tap/click; no complex onboarding flow is required.
10. **Language Support**: Only Catalan and Spanish are in scope for this feature; additional languages remain a future concern.
