# Feature Specification: Resume Recent Games

**Feature Branch**: `[001-add-spec]`

**Created**: 2026-05-18

**Status**: Draft

**Input**: User description: "generate new spec letting the users come back to their recent games which are in_progress. 

The recent games should be improved: 
- let the inprogress recent games be re-accessed by the user in order to recover an ongoing games
- lost games are in red (the UI)
- won games are in green (the UI)
- in the "historial de partides" add a general statistics for the player, including total games played, total games won/lost, an elo graph, same with ranked games, top players played with, top players played against. Show only the last 30 games to avoid crashing the app."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resume In-Progress Game (Priority: P1)

As a player, when I have an in-progress game listed in Recent Games, I want to re-open that game so I can continue from the exact last state and finish the match.

**Why this priority**: Recovering ongoing matches preserves player time and prevents lost progress; it's critical for user experience.

**Independent Test**: From the Recent Games list, tap/click the in-progress entry. The game UI loads and shows the board, hands, scores, and turn exactly as when it was last saved. The player is able to make the next legal move.

**Acceptance Scenarios**:

1. **Given** a user has an in-progress game saved, **When** they select "Resume" from Recent Games, **Then** the game loads with all moves and state restored and the user can continue playing.
2. **Given** the previous session ended unexpectedly, **When** the user returns, **Then** the in-progress game is still available and marked so the user can resume.
3. **Given** it was the user's turn before leaving, **When** they resume, **Then** the same player turn is preserved and any turn-related metadata (timers, move limits) is shown.

---

### User Story 2 - Clear Win/Loss Visual Cues (Priority: P2)

As a player, I want finished games in Recent Games to clearly indicate whether I won or lost so I can quickly scan outcomes.

**Why this priority**: Quick recognition of outcomes improves UX and reduces cognitive load.

**Independent Test**: Show a list containing at least one won and one lost game and verify color and textual labels.

**Acceptance Scenarios**:

1. **Given** a finished game with outcome "won", **When** displayed in Recent Games, **Then** the entry is visually marked green and shows a textual status "Won" (not relying on color alone).
2. **Given** a finished game with outcome "lost", **When** displayed, **Then** the entry is visually marked red and shows a textual status "Lost".

---

### User Story 3 - Historial de Partides: Player Statistics (Priority: P2)

As a player viewing my game history, I want a compact overview of my recent performance and opponents so I can track progress and identify frequent opponents.

**Why this priority**: Statistics provide value and context; limiting displayed games prevents performance issues.

**Independent Test**: Open the history page with a dataset >30 games. Verify that only the most recent 30 game entries are displayed, aggregated stats are shown, and the ELO graphs render points for those games.

**Acceptance Scenarios**:

1. **Given** the player has more than 30 games, **When** opening "Historial de Partides", **Then** the UI displays only the 30 most recent games and summary statistics derived from the available dataset.
2. **Given** the player has ELO history, **When** viewing Historia, **Then** an overall ELO graph and a ranked-only ELO graph show the last 30 points (or fewer if fewer games exist).
3. **Given** the player has played with/against repeated opponents, **When** viewing Historia, **Then** lists for "Top players played with" and "Top players played against" are shown with player identifier, count, and win-rate.

---

### Edge Cases

- No in-progress games: Recent Games should show an empty state with guidance text.
- Fewer than 30 games: History pages and graphs should gracefully show available data with a placeholder for missing entries.
- Corrupted or incomplete saved state: The system should show a clear error and allow the user to remove or archive the corrupted entry.
- Network timeouts while loading a resume: The UI shows a retry path and does not lose the local Recent Games listing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Recent Games listing MUST include entries for "in-progress", "finished (won)", "finished (lost)", and "abandoned" states.
- **FR-002**: The system MUST allow a user to re-open any "in-progress" game entry and restore the game to the last saved state so play can continue.
- **FR-003**: Game state snapshots MUST capture sufficient data to restore a playable session (board position, player hands, scores, turn owner, and relevant timers/metadata).
- **FR-004**: Finished games in Recent Games MUST display outcome status using color-coded visuals: lost = red, won = green; and MUST also include a textual status label so information is not communicated by color alone.
- **FR-005**: "Historial de Partides" MUST show the following aggregated statistics for the player: total games played, total wins, total losses, win rate (percentage), and average ELO change for the displayed window.
- **FR-006**: The UI MUST include two ELO visualizations: an overall ELO graph (last 30 games) and a ranked-only ELO graph (last 30 ranked games) when data exists.
- **FR-007**: The UI MUST include two leader lists computed from recent data: "Top players played with" and "Top players played against". Each entry includes player identifier, number of shared games, and win-rate versus that player.
- **FR-008**: The UI and/or API MUST limit the detailed game list to the 30 most recent games to prevent large payloads and client-side slowdowns.
- **FR-009**: All visual status indicators MUST have non-color alternatives (text or icons) to ensure accessibility.
- **FR-010**: The system MUST include automated tests that verify: state restoration accuracy, color and label rendering for outcomes, stats computation correctness, and the 30-game limit enforcement.

## Key Entities

- **Game**: id, players[], status (in-progress/finished/abandoned), outcome (win/loss/draw), timestamp, is_ranked flag.
- **GameStateSnapshot**: game_id, snapshot_time, board_state, hands, turn_owner, timers, score_state, metadata.
- **Player**: id, display_name, current_elo, historical_elo[]
- **PlayerStatistics**: player_id, total_games, wins, losses, win_rate, average_elo_change, top_opponents[]
- **TopPlayerEntry**: opponent_id, games_played_together, win_rate_vs_opponent

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 95% of resumed games must restore the game state accurately (board, hands, scores, turn) during user acceptance testing.
- **SC-002**: Recent Games UI renders visual outcome indicators (green for wins, red for losses) and textual status labels for 100% of finished games in acceptance tests.
- **SC-003**: "Historial de Partides" loads and renders the summaries and graphs for a 30-game window within 2 seconds on a typical consumer connection (measured during QA).
- **SC-004**: ELO graphs display the correct sequence of ELO points for the last 30 games, and the ranked-only graph matches the subset of ranked games.
- **SC-005**: The UI never requests or renders more than 30 full game entries in a single page load; pagination or on-demand loading required for older history.

## Assumptions

- Persistent storage exists for game records and periodic snapshots of in-progress games.
- ELO calculation logic and historical ELO data are available from existing systems.
- The project will accept a UX decision to show only the most recent 30 games by default to reduce client load.
- Users have unique identifiers and authentication is already in place.
- Accessibility considerations (textual labels, icons) are required and will be implemented.

---

**Notes / Implementation hints (non-normative)**: Keep game snapshots minimal but sufficient to resume play. Consider snapshot frequency trade-offs (after every move vs periodic). These are design decisions for planning and do not belong in the specification's acceptance or test criteria.
