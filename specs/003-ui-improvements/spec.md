# Feature Specification: UI Improvements — Header, Lobby Cards & Language

**Feature Branch**: `003-ui-improvements`

**Created**: 2026-05-19

**Status**: Draft

**Input**: User description: "Improve the UI so that: user info is in the header (name, tanca sessió button); the h1 'Botifarra Online' is deleted (since it is repeated); lobby buttons are better organised in cards; Spanish translation is disabled; English translation is enabled instead."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — User Info Visible in the Navigation Header (Priority: P1)

A logged-in user can see their username and a sign-out button at all times inside the top navigation bar, without needing to scroll or navigate to a separate section. The redundant "Botifarra Online" heading that previously appeared below the navigation bar on the home page is removed, so the page title appears only once — in the navigation brand link.

**Why this priority**: Consistent, always-visible user identity and sign-out access are a baseline usability expectation for any authenticated application. Removing the duplicate heading declutters the page.

**Independent Test**: Log in, land on the home page — the navigation bar must show the logged-in username and a "Tanca sessió" button; no `<h1>` reading "Botifarra Online" should appear anywhere inside the page content area below the nav.

**Acceptance Scenarios**:

1. **Given** a user is logged in and on any page with the navigation bar visible, **When** the page loads, **Then** the navigation bar displays the logged-in username and a sign-out button.
2. **Given** a user is on the home page, **When** the page renders, **Then** there is no `<h1>` element containing the application title inside the main content area.
3. **Given** a user clicks the sign-out button in the navigation bar, **When** the action completes, **Then** the user is signed out and redirected to the login page.
4. **Given** a user is on a screen where the navigation bar is hidden (the active game board), **When** they navigate back to the home page, **Then** the username and sign-out button are again visible in the navigation bar.
5. **Given** a user is on a narrow mobile screen, **When** the navigation bar renders, **Then** the username and sign-out button remain legible and do not overlap other navigation elements.

---

### User Story 2 — Lobby Action Buttons Organised as Cards (Priority: P1)

A user arriving at the home page lobby sees the available game actions (quick match solo, quick match with a partner, private room) displayed as distinct cards rather than a flat row of buttons. Each card has a title, a short description of the action, and a clear call-to-action button. The layout makes it immediately obvious what options exist and what each one does.

**Why this priority**: Card-based layouts improve scannability and communicate context per action, reducing user confusion about the difference between "quick match solo" and "quick match pair".

**Independent Test**: Load the home page logged in — the lobby section must render at least two distinct card components, each containing a label and an action button, with visible visual separation between cards.

**Acceptance Scenarios**:

1. **Given** the user is on the home page in an idle queue state, **When** the lobby section renders, **Then** each game mode (solo quick match, pair quick match, private room) is presented as a separate card with a title and description.
2. **Given** the user is on a mobile screen, **When** the lobby cards render, **Then** cards stack vertically and remain fully readable with no horizontal overflow.
3. **Given** the user is in the matchmaking queue, **When** the lobby renders, **Then** the card for the active mode shows the searching state (animated indicator + cancel option) while other cards are visually suppressed or disabled.
4. **Given** the private room card is shown, **When** the user expands or interacts with it, **Then** the create/join room inputs and actions are contained within or adjacent to that card, not scattered across the page.
5. **Given** a keyboard-only user tabs through the lobby, **When** focus moves between cards, **Then** each card's action button is reachable and operable by keyboard.

---

### User Story 3 — English Language Option Replaces Spanish (Priority: P2)

A user opening the settings panel sees "English" as a language option in place of "Spanish". Selecting English switches the entire UI to English labels, navigation items, button text, and error messages. The Catalan option remains unchanged. Spanish is no longer selectable.

**Why this priority**: The audience for this application includes Catalan speakers and international players; English is the relevant second language. Spanish is not the intended alternative.

**Independent Test**: Open the settings panel — the language selector must list "Català" and "English" only; selecting "English" must visibly change at least the navigation labels and home page button text to English immediately.

**Acceptance Scenarios**:

1. **Given** the user opens the settings panel, **When** they view the language selector, **Then** the available options are "Català" and "English"; "Español" is not present.
2. **Given** English is selected, **When** the UI re-renders, **Then** all visible labels, navigation links, button text, and error messages are displayed in English.
3. **Given** the user selects English and reloads the page, **When** the application initialises, **Then** English is still the active language.
4. **Given** the user was previously using Spanish (persisted setting), **When** the application loads after the update, **Then** the language falls back to Catalan (the default) rather than applying the now-unavailable Spanish option.

---

### Edge Cases

- What happens if a user has a persisted `language: "es"` setting in local storage when Spanish is removed? The application must fall back to the default language (Catalan) without crashing.
- What happens if the English locale file is missing a translation key? The application must display the Catalan fallback string rather than a blank or raw key.
- What happens on very narrow screens (320 px) with username and sign-out in the navigation bar? The layout must not overflow or hide the sign-out button.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application navigation header MUST display the logged-in user's username and a sign-out button when a user session is active.
- **FR-002**: The home page content area MUST NOT contain an `<h1>` element repeating the application title ("Botifarra Online"), as the title already appears in the navigation bar brand link.
- **FR-003**: The lobby section on the home page MUST present each game mode action (solo quick match, pair/friend quick match, private room) as a visually distinct card component containing at minimum a title, a short description, and an action button.
- **FR-004**: The lobby cards MUST remain usable on screens as narrow as 320 px by stacking vertically.
- **FR-005**: The settings panel language selector MUST offer "Català" (`ca`) and "English" (`en`) as the only selectable options.
- **FR-006**: A complete English translation file MUST be provided covering all translation keys present in the Catalan locale file.
- **FR-007**: If a persisted language preference of `"es"` (Spanish) is detected at application startup, the application MUST silently reset it to the default language (`"ca"`) without crashing or displaying untranslated keys.
- **FR-008**: Selecting English in the settings panel MUST immediately update all visible UI strings to English without requiring a page reload.

### Key Entities

- **Navigation Header**: The persistent top bar rendered by `AppShell`; extended to include user identity and sign-out action.
- **Lobby Card**: A new presentational component wrapping a game-mode action, containing a title, description, and primary action button.
- **Locale File (en)**: A new English translation resource equivalent in structure to the existing Catalan locale file.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A logged-in user can identify their username and sign out from any page with the navigation bar, without scrolling — verifiable by visual inspection on any screen width ≥ 320 px.
- **SC-002**: The home page contains zero `<h1>` elements repeating the application title after the change — verifiable by DOM inspection.
- **SC-003**: The lobby section renders at least three distinct card components, each with a readable title and action button, on both desktop and mobile viewports — verifiable by visual inspection and automated snapshot test.
- **SC-004**: The language selector in settings lists exactly two options (Catalan and English); selecting English changes visible UI strings immediately — verifiable by manual testing.
- **SC-005**: No runtime errors or blank text appear when the language is switched between Catalan and English — verifiable by browser console inspection during a language-switch action.
- **SC-006**: A user with a persisted `"es"` language setting experiences a clean fallback to Catalan on next load, with no visible error — verifiable by setting `language: "es"` in local storage and reloading.

---

## Assumptions

- The `AppShell` navigation bar is the single source of the top navigation; user identity and sign-out will be added there rather than creating a new layout component.
- The home page header element that currently contains the duplicate `<h1>` will be removed or repurposed; if the header contained other meaningful elements, those will be preserved.
- The English locale file will be a direct translation of the existing Catalan locale, with no new keys added.
- Lobby card descriptions will be short (one sentence) and written in the active locale; no card imagery or icons are required for this iteration.
- The ranked-match checkbox currently in the lobby will be incorporated into the relevant card(s) rather than removed.
- The existing settings persistence mechanism (local storage / settings store) does not need to be replaced — only extended with an `"en"` option and a guard against stale `"es"` values.
- Mobile breakpoint for card stacking is assumed to be ≤ 600 px wide, consistent with existing responsive breakpoints in the project.
