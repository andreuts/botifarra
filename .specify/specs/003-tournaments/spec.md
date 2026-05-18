# Feature Specification: Tournaments

Feature Branch: `003-tournaments`

Created: 2026-05-18

Status: Draft

Input: User description: "I want to add a new spec feature to be developed. Feature must consist on tournaments: users can engage to tournaments with a couple or alone. Tournaments can be simple eliminatory rounds or swiss-style like. Tournaments must be time-limited to 30 minutes and 8 rounds, the couple that has the most points wins and in case of a tie they play two more rounds. The final must be an entire butifarra game (as usual, no round limit). There must be a classification board to visualize how the tournament develops and the position of each couple."

## User Scenarios & Testing (mandatory)

### User Story 0 - Create a Password-Protected Tournament (Priority: P1)

A user can optionally set a password when creating a tournament. When a password is set, only users who provide the correct password can register. Users without the password can still view the tournament in the list but cannot join.

Why this priority: Privacy and access control are needed before registration behaviour can be reliably tested.

Independent Test: Can be fully tested by creating a tournament without a password and verifying open access, then creating a tournament with a password and verifying that registration is rejected without the correct password and accepted with it.

Acceptance Scenarios:

1. Given a user creates a tournament without a password, When another user tries to register, Then no password is required.
2. Given a user creates a tournament with a password, When another user tries to register without providing the password, Then the system rejects the registration.
3. Given a user creates a tournament with a password, When another user provides the correct password when registering, Then the registration is accepted.
4. Given a tournament has a password, When the tournament list is displayed, Then the tournament is shown with a visible indicator that it is password-protected.
5. Given a tournament has a password, When the tournament detail is displayed, Then the tournament creator is shown alongside the password-required indicator.

---

### User Story 1 - Join a Tournament Alone or as a Couple (Priority: P1)

A user can register for an available tournament either with an existing couple or as an individual participant. Users who join alone are placed in a solo registration pool and must be assigned to a couple before the tournament starts.

Why this priority: Tournament participation is the entry point of the feature. Without registration, no tournament can be played.

Independent Test: Can be fully tested by opening a tournament registration, joining as a complete couple, joining as a solo user, and confirming that both registration modes appear correctly before the tournament starts.

Acceptance Scenarios:

1. Given an open tournament, When two users register together as a couple, Then the system accepts the couple as one tournament participant.
2. Given an open tournament, When a user registers alone, Then the system stores the user as waiting for couple assignment.
3. Given a solo user is paired with another solo user before tournament start, When the tournament starts, Then the newly formed couple is included in the tournament.
4. Given a user is already registered in a tournament, When the same user tries to register again in another couple for the same tournament, Then the system prevents duplicate participation.

---

### User Story 2 - Run Eliminatory and Swiss-Style Tournaments (Priority: P1)

A tournament organizer or authorized user can create a tournament using either a simple eliminatory format or a Swiss-style format. The tournament generates matchups according to the selected format and advances couples as results are submitted.

Why this priority: The core value of tournaments depends on supporting the requested competition formats.

Independent Test: Can be fully tested by creating one eliminatory tournament and one Swiss-style tournament, registering couples, starting each tournament, entering match results, and verifying that matchups and progression behave according to each selected format.

Acceptance Scenarios:

1. Given an eliminatory tournament with registered couples, When the tournament starts, Then couples are placed into eliminatory matchups.
2. Given an eliminatory match is completed, When the result is confirmed, Then the winning couple advances and the losing couple is marked as eliminated.
3. Given a Swiss-style tournament with registered couples, When a round starts, Then couples are paired based on their current tournament standing where possible.
4. Given a Swiss-style round is completed, When all results are confirmed, Then the classification board updates and the next Swiss-style round can be generated.
5. Given a tournament has enough progression to determine finalists, When the final starts, Then the final is played as a full butifarra game without the 30-minute or 8-round non-final limit.

---

### User Story 3 - Play Time-Limited Non-Final Tournament Matches (Priority: P1)

Couples play non-final tournament matches with a maximum duration of 30 minutes and a maximum of 8 butifarra rounds/hands. The couple with the highest points at the end wins. If both couples are tied, they play exactly two additional rounds/hands to resolve the tie.

Why this priority: The tournament format requires predictable match duration and a clear winner calculation before the final.

Independent Test: Can be fully tested by starting a non-final tournament match, ending it after 8 rounds or 30 minutes, entering scores, and verifying winner selection and tie-break handling.

Acceptance Scenarios:

1. Given a non-final tournament match is in progress, When 30 minutes have elapsed, Then the match becomes eligible to end even if fewer than 8 rounds/hands have been played.
2. Given a non-final tournament match is in progress, When 8 rounds/hands have been completed, Then the match becomes eligible to end even if fewer than 30 minutes have elapsed.
3. Given a non-final tournament match ends with one couple having more points, When the result is confirmed, Then that couple is declared the match winner.
4. Given a non-final tournament match ends in a tie, When the tie is detected, Then the match enters a two-round tie-break phase.
5. Given the two additional tie-break rounds are completed, When one couple has more points, Then that couple is declared the match winner.
6. Given the two additional tie-break rounds are completed and the score is still tied, When the result is submitted, Then the match is marked as unresolved and must be manually resolved before tournament progression continues.

---

### User Story 4 - Play the Final as a Complete Butifarra Game (Priority: P1)

The final match of a tournament is played as a complete butifarra game using the usual game rules, with no 30-minute limit and no 8-round limit.

Why this priority: The requested tournament structure explicitly treats the final differently from earlier matches.

Independent Test: Can be fully tested by progressing a tournament to the final, starting the final match, and verifying that no non-final time or round limits are applied.

Acceptance Scenarios:

1. Given a tournament has two finalist couples, When the final starts, Then the final is created as a full butifarra game.
2. Given the final is in progress, When 30 minutes elapse, Then the final continues normally.
3. Given the final has completed 8 rounds/hands, When the game has not yet ended under normal butifarra rules, Then the final continues normally.
4. Given the final ends under normal butifarra rules, When the result is confirmed, Then the winning couple is declared tournament champion.

---

### User Story 5 - View Classification Board During Tournament (Priority: P2)

Users can view a classification board showing how the tournament is developing and the current position of each couple.

Why this priority: The classification board gives participants visibility into tournament progress and standings.

Independent Test: Can be fully tested by starting a tournament, submitting results, and verifying that the board updates positions, scores, status, and progression after each result.

Acceptance Scenarios:

1. Given a tournament has started, When a user opens the classification board, Then the user sees all registered couples and their current positions.
2. Given a match result is confirmed, When the classification board is refreshed, Then the affected couples' points and positions are updated.
3. Given an eliminatory tournament is in progress, When a couple is eliminated, Then the board clearly shows that couple as eliminated.
4. Given a Swiss-style tournament is in progress, When a round is completed, Then the board reorders couples by tournament points.
5. Given the tournament has a champion, When the board is viewed, Then the champion is clearly identified at the top of the classification.

---

### Edge Cases

- What happens when an odd number of solo users register before the tournament starts?
- What happens when an odd number of couples participate in a Swiss-style tournament round?
- What happens when a user tries to participate in multiple couples in the same tournament?
- What happens when a couple withdraws before the tournament starts?
- What happens when a couple withdraws during an active tournament?
- What happens when a non-final match reaches both 30 minutes and 8 rounds/hands at nearly the same time?
- What happens when a tie remains after the two additional tie-break rounds?
- What happens when a final is interrupted before the full butifarra game is completed?
- What happens when a submitted match result is corrected after the classification board has already updated?
- What happens when not all match results in a round are submitted?

## Requirements (mandatory)

### Functional Requirements

- FR-001: The system MUST allow authorized users to create tournaments.
- FR-002: The system MUST support at least two tournament formats: simple eliminatory and Swiss-style.
- FR-003: The system MUST allow users to register for a tournament as a complete couple.
- FR-004: The system MUST allow users to register for a tournament alone.
- FR-005: The system MUST prevent the same user from being registered more than once in the same tournament.
- FR-006: The system MUST form tournament couples from solo registrations before the tournament starts.
- FR-007: The system MUST prevent a tournament from starting while any solo registration remains unpaired, unless the user is removed or converted into a valid couple.
- FR-008: The system MUST represent each couple as the tournament participant unit for scoring, pairing, elimination, and classification.
- FR-009: The system MUST allow a tournament to move through clear statuses: registration open, ready to start, in progress, completed, and cancelled.
- FR-010: The system MUST generate tournament matchups according to the selected tournament format.
- FR-011: For eliminatory tournaments, the system MUST advance winning couples and mark losing couples as eliminated after each confirmed match result.
- FR-012: For Swiss-style tournaments, the system MUST generate each new round based on current tournament standings where possible.
- FR-013: For Swiss-style tournaments with an odd number of active couples, the system MUST assign a bye according to a fair rule and clearly show the bye on the classification board.
- FR-014: The system MUST track tournament points for each couple.
- FR-015: The system MUST calculate match winners based on points scored by each couple.
- FR-016: The system MUST limit every non-final tournament match to a maximum of 30 minutes.
- FR-017: The system MUST limit every non-final tournament match to a maximum of 8 butifarra rounds/hands.
- FR-018: The system MUST allow a non-final match to end when either the 30-minute limit or the 8-round/hand limit is reached.
- FR-019: The system MUST declare the couple with the most points as the winner of a non-final match when the match limit is reached.
- FR-020: The system MUST detect tied non-final matches after the normal match limit.
- FR-021: The system MUST require exactly two additional butifarra rounds/hands when a non-final match is tied after the normal limit.
- FR-022: The system MUST determine the winner after the two additional tie-break rounds if one couple has more points.
- FR-023: The system MUST block tournament progression when a match remains tied after the two additional tie-break rounds until the match is manually resolved.
- FR-024: The system MUST treat the final match as a complete butifarra game.
- FR-025: The system MUST NOT apply the 30-minute limit to the final match.
- FR-026: The system MUST NOT apply the 8-round/hand limit to the final match.
- FR-027: The system MUST declare the winner of the final according to the usual full butifarra game rules.
- FR-028: The system MUST declare the winner of the final as the tournament champion.
- FR-029: The system MUST provide a classification board for every tournament.
- FR-030: The classification board MUST show each couple's current position.
- FR-031: The classification board MUST show each couple's current tournament points.
- FR-032: The classification board MUST show each couple's tournament status, such as active, eliminated, finalist, champion, withdrawn, or unresolved.
- FR-033: The classification board MUST update after each confirmed match result.
- FR-034: The classification board MUST distinguish between eliminatory progression and Swiss-style standings.
- FR-035: The system MUST preserve historical match results for the tournament after the tournament is completed.
- FR-036: The system MUST make the completed tournament result visible, including champion, final result, and final classification.
- FR-037: The system MUST display the username of the tournament creator on both the tournament list and tournament detail views.
- FR-038: The system MUST display the total number of individual users registered to a tournament (couples × 2 + unpaired solo registrations).
- FR-039: The system MUST allow a tournament creator to optionally set a password when creating a tournament.
- FR-040: When a tournament has a password, the system MUST reject registration attempts that do not include the correct password.
- FR-041: When a tournament has a password, the system MUST display a clear indicator (lock icon or label) in the tournament list and detail views.
- FR-042: The system MUST NOT expose the tournament password hash or any derivable secret in any API response.

### Key Entities

- Tournament: Represents a competition event. Key attributes include name, format, status, registration list, start time, completion time, active round, final match, champion, creator username, total registered users count, and optional password hash.
- Tournament Couple: Represents the participant unit in a tournament. It contains either two users who registered together or two solo users paired before tournament start.
- Solo Registration: Represents an individual user waiting to be paired into a tournament couple.
- Tournament Match: Represents a match between two couples. Key attributes include tournament, participating couples, match stage, whether it is final or non-final, start time, end time, round/hand count, score, status, and winner.
- Tournament Round: Represents a group of matches within the tournament flow. In eliminatory tournaments this represents bracket stages; in Swiss-style tournaments this represents Swiss pairings for a round.
- Match Result: Represents the confirmed outcome of a tournament match, including couple scores, winner, tie-break status, and confirmation state.
- Classification Board Entry: Represents one couple's displayed tournament standing, including position, points, matches played, wins, losses, status, and progression notes.
- Bye: Represents an automatic round advancement or awarded result for a couple when an odd number of couples prevents complete pairing.

## Success Criteria (mandatory)

### Measurable Outcomes

- SC-001: At least 95% of users can successfully register for an open tournament either as a couple or alone without administrator assistance.
- SC-002: A tournament can be created with either eliminatory or Swiss-style format and started once valid couples are available.
- SC-003: Non-final tournament matches consistently end when they reach either 30 minutes or 8 rounds/hands, unless they enter the two-round tie-break phase.
- SC-004: The system correctly identifies the match winner in 100% of non-tied non-final matches based on highest points.
- SC-005: The system detects tied non-final matches and triggers the two-round tie-break phase in 100% of tied cases.
- SC-006: The final match can continue beyond 30 minutes and beyond 8 rounds/hands without being automatically ended by tournament limits.
- SC-007: The classification board reflects confirmed match results and updated couple positions within one user refresh or automatic update cycle.
- SC-008: Users viewing the classification board can identify the current leader, eliminated couples, active couples, finalists, and champion.
- SC-009: Completed tournaments retain final standings and match history for later review.
- SC-010: Tournament progression is blocked whenever an unresolved match result would otherwise affect pairings, eliminations, finalists, or champion declaration.

## Assumptions

- A "round" in the 8-round limit refers to a butifarra round/hand within a non-final match, not to a tournament bracket round.
- The 30-minute and 8-round/hand limits apply to each non-final tournament match.
- Existing butifarra scoring rules already exist and will be reused for tournament matches.
- The final uses the existing full butifarra game rules without tournament-specific time or round limits.
- Users who register alone must be paired before the tournament starts.
- If a tie remains after the two additional tie-break rounds, manual resolution is acceptable for the first version of the feature.
- Swiss-style pairing should prioritize couples with similar current tournament standings and avoid repeated pairings where possible.
- The classification board is visible to tournament participants and any user who can access the tournament.