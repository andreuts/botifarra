# Feature Specification: Ranked Mode

Feature Branch: `004-ranked-mode`

Created: 2026-05-18

Status: Draft

Input: User description: "I now want to define a new spec being ranked mode. People will be able to search games of players near to their elos, where the players closer to their elo get more chances to enter the same game room. Currently, normal games already count the elo, not sure if they take elo into account while matchmaking. I want normal games not to play with elo and ranked games to do so. Winners receive elo points and losers lose elo points. Chess elo format seems enough to me. For both types of games: add surrender, where a player needs its partner to accept the surrender petition and if accepted they lose the game; add timeout to games, where games have 4h timeouts and after that automatically end and the couple with most points wins. Only ranked: player turns have a 15 sec base timeout plus 1 min per player that can be consumed during the whole round of 12 cards. After each round, the 1 min time budget resets per player. If the player does not play within the 15 sec plus remaining time from the 1 minute of the round, the couple loses the round and gives 36 points to the other couple. Players can see their own timer and the rest of players timers. Ranked games should be a switcher or similar when choosing game mode, solo or paired."

## User Scenarios & Testing (mandatory)

### User Story 1 - Choose Normal or Ranked Game Mode (Priority: P1)

A player can choose whether to play a normal game or a ranked game when selecting the game mode. This choice must be available for both solo queue and paired queue.

Why this priority: Ranked mode must be clearly separated from normal games so players understand whether Elo will be affected before joining a game.

Independent Test: Can be fully tested by opening the game mode selection screen, selecting solo or paired mode, toggling ranked on or off, and verifying the created or searched game has the selected ranking behavior.

Acceptance Scenarios:

1. Given a player is choosing a solo game, When the player enables ranked mode, Then the system searches for a ranked solo game.
2. Given a player is choosing a paired game, When the player enables ranked mode, Then the system searches for a ranked paired game.
3. Given a player is choosing a solo or paired game, When the player does not enable ranked mode, Then the system searches for a normal game.
4. Given a player joins a normal game, When the game finishes, Then no player's Elo is changed.
5. Given a player joins a ranked game, When the game finishes with a valid winner and loser, Then Elo changes are applied.

---

### User Story 2 - Match Ranked Players by Elo Proximity (Priority: P1)

A player searching for a ranked game is matched with players whose Elo ratings are close to their own rating. Players closer in Elo have a higher chance of being placed in the same game room.

Why this priority: Ranked mode depends on fair matchmaking. Elo-based matchmaking is the main difference between normal and ranked game search.

Independent Test: Can be fully tested by creating players with different Elo values, placing them into the ranked queue, and verifying that players with closer Elo values are prioritized over players with distant Elo values.

Acceptance Scenarios:

1. Given several players are searching for a ranked game, When compatible players with close Elo ratings are available, Then the system prioritizes those players for the same game room.
2. Given a player is searching for a ranked game, When no close-Elo players are available immediately, Then the system may gradually consider players with wider Elo differences.
3. Given a player is searching for a normal game, When other players are available, Then the system does not use Elo as a matchmaking criterion.
4. Given a ranked game room is formed, When players inspect the room before the game starts, Then the game is clearly identified as ranked.
5. Given a normal game room is formed, When players inspect the room before the game starts, Then the game is clearly identified as normal.

---

### User Story 3 - Update Elo After Ranked Games Only (Priority: P1)

When a ranked game ends, winners receive Elo points and losers lose Elo points using a chess-style Elo calculation. Normal games do not affect Elo.

Why this priority: Elo progression is the core reward and ranking mechanism for ranked mode.

Independent Test: Can be fully tested by completing a ranked game and a normal game with the same players, then confirming that only the ranked game changes Elo.

Acceptance Scenarios:

1. Given a ranked game ends with a winning couple and a losing couple, When the result is confirmed, Then each player in the winning couple gains Elo.
2. Given a ranked game ends with a winning couple and a losing couple, When the result is confirmed, Then each player in the losing couple loses Elo.
3. Given a normal game ends with a winning couple and a losing couple, When the result is confirmed, Then no player's Elo changes.
4. Given a ranked game ends by surrender, When the surrender is accepted, Then the surrendering couple loses and Elo is updated.
5. Given a ranked game ends by 4-hour timeout, When one couple has more points, Then that couple wins and Elo is updated.
6. Given a ranked game result has already been applied, When the same result is processed again, Then Elo must not be applied twice.

---

### User Story 4 - Surrender a Game With Partner Approval (Priority: P1)

A player can request to surrender during either a normal game or a ranked game. The surrender only succeeds if the requesting player's partner accepts the surrender petition. If accepted, the requesting couple loses the game.

Why this priority: Surrender affects game completion and ranked Elo, so it must be controlled and agreed by both players in the couple.

Independent Test: Can be fully tested by starting a normal game and a ranked game, having one player request surrender, and verifying the result when the partner accepts or rejects.

Acceptance Scenarios:

1. Given a game is in progress, When a player requests surrender, Then the player's partner receives a surrender petition.
2. Given a surrender petition is pending, When the partner accepts it, Then the petitioning couple immediately loses the game.
3. Given a surrender petition is pending, When the partner rejects it, Then the game continues.
4. Given a surrender petition is pending, When the partner does not respond, Then the game continues until another ending condition occurs.
5. Given a ranked game ends by accepted surrender, When the result is confirmed, Then Elo changes are applied as a ranked loss for the surrendering couple.
6. Given a normal game ends by accepted surrender, When the result is confirmed, Then the surrendering couple loses but no Elo changes are applied.

---

### User Story 5 - End Games Automatically After 4 Hours (Priority: P1)

Both normal and ranked games have a maximum duration of 4 hours. When the timeout is reached, the game ends automatically and the couple with the most points wins.

Why this priority: Games must not remain active indefinitely and ranked games need a deterministic ending condition.

Independent Test: Can be fully tested by simulating a game reaching 4 hours and verifying that the game ends with the current leading couple as winner.

Acceptance Scenarios:

1. Given a normal game has been active for 4 hours, When the timeout is reached, Then the game ends automatically.
2. Given a ranked game has been active for 4 hours, When the timeout is reached, Then the game ends automatically.
3. Given a game reaches the 4-hour timeout and one couple has more points, When the game ends, Then the couple with more points is declared winner.
4. Given a ranked game reaches the 4-hour timeout and one couple has more points, When the game result is confirmed, Then Elo changes are applied.
5. Given a normal game reaches the 4-hour timeout and one couple has more points, When the game result is confirmed, Then no Elo changes are applied.
6. Given a game reaches the 4-hour timeout with tied points, When the system tries to finish the game, Then the game is marked as unresolved and must follow the configured tie-resolution rule.

---

### User Story 6 - Enforce Ranked Turn Timers (Priority: P1)

In ranked games only, each player turn has a 15-second base timeout plus a personal 1-minute time budget that can be consumed during the current 12-card round. After each round, each player's 1-minute budget resets. If a player exceeds both the 15-second base time and their remaining round budget, that player's couple loses the round and the opposing couple receives 36 points.

Why this priority: Ranked games require anti-stalling rules and predictable turn pacing.

Independent Test: Can be fully tested by starting a ranked game, making a player exceed the turn timer, and verifying that the player's couple loses the round and the other couple receives 36 points.

Acceptance Scenarios:

1. Given a ranked game is in progress, When it becomes a player's turn, Then that player has 15 seconds of base turn time.
2. Given a ranked player exceeds the 15-second base turn time, When the player has remaining round time budget, Then the extra time is consumed from that player's 1-minute round budget.
3. Given a ranked player has no remaining round time budget, When the player exceeds the 15-second base turn time, Then that player's couple loses the round.
4. Given a ranked player times out for the round, When the round is awarded to the opposing couple, Then the opposing couple receives 36 points.
5. Given a ranked round of 12 cards ends, When the next round starts, Then each player's 1-minute round budget resets.
6. Given a normal game is in progress, When a player takes a turn, Then the ranked turn timer rules are not applied.

---

### User Story 7 - Show Turn Timers to Players in Ranked Games (Priority: P2)

During ranked games, every player can see their own timer and the timers of the other players.

Why this priority: Players need visibility into timing pressure, especially because timing out can lose the round.

Independent Test: Can be fully tested by starting a ranked game and verifying that all four player timers are visible and update during turns.

Acceptance Scenarios:

1. Given a ranked game is in progress, When a player views the game table, Then the player can see their own timer.
2. Given a ranked game is in progress, When a player views the game table, Then the player can see the other players' timers.
3. Given a player's turn is active, When the 15-second base time is being used, Then the timer display shows the active countdown.
4. Given a player's turn exceeds 15 seconds, When the player's round budget is being consumed, Then the timer display shows the remaining round budget.
5. Given a new ranked round starts, When timers are displayed, Then each player's round budget shows as reset.

## Edge Cases

- What happens when a ranked player waits in queue and no similar-Elo players are available?
- What is the maximum Elo difference allowed before ranked matchmaking refuses to create a game?
- How fast should the acceptable Elo range expand while a player waits?
- How is couple Elo calculated for paired ranked matchmaking if the two partners have different Elo values?
- How is couple Elo calculated when players join ranked mode through solo queue?
- What happens when a ranked game reaches the 4-hour timeout with tied points?
- What happens when a normal game reaches the 4-hour timeout with tied points?
- What happens if a player disconnects while a surrender petition is pending?
- What happens if a player's partner disconnects and cannot accept or reject a surrender petition?
- What happens if both couples request surrender at nearly the same time?
- What happens if a ranked turn timeout happens at the same moment that the 4-hour game timeout is reached?
- What happens if a ranked player times out during the final card of a 12-card round?
- What happens if a timer display differs between clients because of network delay?
- What happens if a ranked game result is corrected after Elo has already been applied?
- What happens if a ranked game is cancelled before enough cards or rounds have been played?
- What happens if a player closes the app or loses connection during their timed ranked turn?
- What happens if a surrender is accepted in a ranked game before any points have been scored?
- What happens if one couple is leading at the 4-hour timeout but the current round is incomplete?
- What happens if Elo calculations would reduce a player's Elo below the minimum allowed rating?

## Requirements (mandatory)

### Functional Requirements

#### Game Mode Selection

- FR-001: The system MUST allow players to choose between normal and ranked game modes.
- FR-002: The system MUST allow ranked mode to be selected when searching for a solo game.
- FR-003: The system MUST allow ranked mode to be selected when searching for a paired game.
- FR-004: The system MUST clearly show whether a game is normal or ranked before the game starts.
- FR-005: The system MUST clearly show whether an active game is normal or ranked during gameplay.
- FR-006: The system MUST preserve existing normal game access without requiring ranked participation.

#### Normal Game Behavior

- FR-007: The system MUST NOT use Elo as a matchmaking criterion for normal games.
- FR-008: The system MUST NOT update Elo after normal games.
- FR-009: The system MUST allow normal games to end by normal completion, accepted surrender, or 4-hour timeout.
- FR-010: The system MUST preserve normal game scoring without ranked-only turn timer penalties.

#### Ranked Matchmaking

- FR-011: The system MUST use Elo as a matchmaking criterion for ranked games.
- FR-012: The system MUST prioritize matching players with closer Elo ratings over players with more distant Elo ratings.
- FR-013: The system MUST allow ranked matchmaking to gradually consider wider Elo ranges when close-Elo players are not available.
- FR-014: The system MUST calculate a matchmaking Elo value for each player or couple entering the ranked queue.
- FR-015: The system MUST support ranked matchmaking for solo players.
- FR-016: The system MUST support ranked matchmaking for pre-made couples.
- FR-017: The system MUST ensure that every ranked game room has enough players to form two valid couples before the game starts.
- FR-018: The system MUST prevent a ranked game from starting if its ranked status or participants are ambiguous.
- FR-019: The system MUST exclude normal-game-only players from ranked matchmaking.

#### Elo Updates

- FR-020: The system MUST store an Elo rating for each player who participates in ranked games.
- FR-021: The system MUST update Elo only after ranked games.
- FR-022: The system MUST award Elo points to each player in the winning couple after a ranked game.
- FR-023: The system MUST subtract Elo points from each player in the losing couple after a ranked game.
- FR-024: The system MUST calculate Elo changes using a chess-style Elo formula.
- FR-025: The system MUST base Elo change on the expected result between the two couples.
- FR-026: The system MUST apply Elo changes once and only once per ranked game result.
- FR-027: The system MUST keep an Elo change record for each ranked game, including previous Elo, new Elo, result, and reason for game end.
- FR-028: The system MUST NOT apply Elo changes to games that are cancelled before a valid ranked result exists.
- FR-029: The system MUST support Elo changes for games ended by normal completion, accepted surrender, and 4-hour timeout.
- FR-030: The system MUST provide a minimum Elo floor if the product requires ratings not to fall below a configured value. `[NEEDS CLARIFICATION: minimum Elo floor is not specified]`
- FR-031: The system MUST use a configurable K-factor for Elo changes. `[NEEDS CLARIFICATION: exact K-factor is not specified; chess-style Elo commonly requires this configuration]`

#### Surrender

- FR-032: The system MUST allow a player to request surrender in both normal and ranked games.
- FR-033: The system MUST send the surrender petition to the requesting player's partner.
- FR-034: The system MUST keep the game active while a surrender petition is pending.
- FR-035: The system MUST end the game as a loss for the requesting couple if the partner accepts the surrender petition.
- FR-036: The system MUST continue the game if the partner rejects the surrender petition.
- FR-037: The system MUST allow only one active surrender petition per couple at a time.
- FR-038: The system MUST record surrender as the game end reason when a surrender petition is accepted.
- FR-039: The system MUST apply ranked Elo changes when a ranked game ends by accepted surrender.
- FR-040: The system MUST NOT apply Elo changes when a normal game ends by accepted surrender.

#### 4-Hour Game Timeout

- FR-041: The system MUST apply a 4-hour maximum duration to both normal and ranked games.
- FR-042: The system MUST automatically end a game when the game reaches 4 hours of active duration.
- FR-043: The system MUST declare the couple with the most points as winner when a game ends by 4-hour timeout.
- FR-044: The system MUST record timeout as the game end reason when a game ends after 4 hours.
- FR-045: The system MUST apply ranked Elo changes when a ranked game ends by 4-hour timeout with a valid winner.
- FR-046: The system MUST NOT apply Elo changes when a normal game ends by 4-hour timeout.
- FR-047: The system MUST block automatic winner declaration if the 4-hour timeout is reached and both couples have tied points. `[NEEDS CLARIFICATION: tie-resolution rule after 4-hour timeout is not specified]`

#### Ranked Turn Timers

- FR-048: The system MUST apply ranked turn timer rules only to ranked games.
- FR-049: The system MUST NOT apply ranked turn timer rules to normal games.
- FR-050: The system MUST give each ranked player 15 seconds of base time at the start of each turn.
- FR-051: The system MUST give each ranked player a 1-minute personal time budget at the start of each 12-card round.
- FR-052: The system MUST consume a player's personal round time budget only when that player exceeds the 15-second base time on their turn.
- FR-053: The system MUST preserve unused personal round time budget for that player until the current 12-card round ends.
- FR-054: The system MUST reset each player's personal 1-minute round time budget after each 12-card round.
- FR-055: The system MUST detect when a ranked player fails to act within the 15-second base time plus their remaining personal round budget.
- FR-056: The system MUST make the timed-out player's couple lose the current round when the player exceeds the allowed turn time.
- FR-057: The system MUST award 36 points to the opposing couple when a ranked round is lost by player timeout.
- FR-058: The system MUST record player timeout as the round end reason when a ranked round is lost by timer.
- FR-059: The system MUST continue the ranked game after a timeout-lost round unless another game-ending condition is reached.
- FR-060: The system MUST make timer state visible to all players in a ranked game.
- FR-061: The system MUST show each player their own timer in ranked games.
- FR-062: The system MUST show each player the other players' timers in ranked games.
- FR-063: The system MUST clearly distinguish base turn time from remaining personal round budget in ranked games.
- FR-064: The system MUST ensure timer decisions are based on authoritative game state rather than only client-side display.

#### Result Integrity

- FR-065: The system MUST record the final result of every normal and ranked game.
- FR-066: The system MUST record how each game ended: normal completion, accepted surrender, 4-hour timeout, cancellation, or unresolved timeout tie.
- FR-067: The system MUST prevent conflicting game end conditions from producing multiple results for the same game.
- FR-068: The system MUST prevent Elo updates until the ranked game has exactly one confirmed winning couple and one confirmed losing couple.
- FR-069: The system MUST preserve game history showing whether the game was normal or ranked.
- FR-070: The system MUST expose enough result information for players to understand why Elo changed or did not change.

## Key Entities

- Player: Represents a user who can play normal and ranked games. Key attributes include identity, current Elo, ranked eligibility, active queue state, and game participation state.

- Couple: Represents two players playing as partners in a game. In ranked games, the couple is the win/loss unit, while Elo is stored and updated per player.

- Game Mode Selection: Represents the player's choice of solo or paired queue and normal or ranked mode before searching for a game.

- Game Room: Represents a formed game with four players, two couples, game type, status, score, timers, start time, and end reason.

- Ranked Queue Entry: Represents a player or pre-made couple searching for a ranked game. Key attributes include matchmaking Elo, queue start time, accepted Elo range, and whether the entry is solo or paired.

- Elo Rating: Represents a player's ranked skill rating. Key attributes include current rating, previous rating, rating changes, number of ranked games, and last updated time.

- Elo Change Record: Represents the Elo update caused by one ranked game. Key attributes include game, player, previous Elo, new Elo, Elo delta, expected result, actual result, and game end reason.

- Surrender Petition: Represents a surrender request created by one player and awaiting partner approval. Key attributes include requesting player, partner, couple, game, status, created time, and response time.

- Game Timeout: Represents the 4-hour maximum game duration rule. Key attributes include game start time, timeout deadline, current score at timeout, and automatic result status.

- Ranked Turn Timer: Represents ranked-only timing state for a player's turn. Key attributes include active player, base turn time, consumed round budget, remaining round budget, and timeout status.

- Round: Represents a 12-card round within a game. Key attributes include cards played, current turn, player timers, round score, round end reason, and whether the round was lost by timeout.

- Game Result: Represents the final outcome of a game. Key attributes include winning couple, losing couple, final score, game type, end reason, ranked status, and Elo application status.

## Success Criteria (mandatory)

### Measurable Outcomes

- SC-001: Players can start searching for either normal or ranked games from both solo and paired game mode selection.
- SC-002: 100% of normal games finish without changing any player's Elo.
- SC-003: 100% of ranked games with a valid winner and loser apply exactly one Elo update per participating player.
- SC-004: Ranked matchmaking places closer-Elo players together more frequently than distant-Elo players under the same queue conditions.
- SC-005: Ranked matchmaking can form a valid game room for solo players and pre-made couples.
- SC-006: A surrender request cannot end a game unless the requesting player's partner accepts it.
- SC-007: When a surrender is accepted, the surrendering couple is marked as the losing couple in 100% of cases.
- SC-008: 100% of normal and ranked games automatically end at the 4-hour timeout when one couple has more points.
- SC-009: In ranked games, a player who exceeds the 15-second base time plus remaining personal round budget loses the round for their couple in 100% of timer-enforced cases.
- SC-010: In ranked games, the opposing couple receives 36 points in 100% of rounds lost by player timeout.
- SC-011: In ranked games, each player's 1-minute personal round budget resets after every 12-card round.
- SC-012: Ranked game players can see their own timer and the other players' timers during active gameplay.
- SC-013: Game history clearly identifies whether each completed game was normal or ranked and why the game ended.
- SC-014: Players can understand every Elo change from a ranked game history entry showing result, previous Elo, new Elo, and Elo delta.

## Assumptions

- "Elo" refers to a chess-style expected-score rating system applied per player.
- Elo is stored per player, not per couple.
- Couple matchmaking Elo is derived from the two players' Elo values. `[NEEDS CLARIFICATION: exact aggregation method is not specified; average Elo is the likely default]`
- Normal games may still display player Elo if the product already shows it, but normal games must not use Elo for matchmaking or Elo updates.
- Ranked mode is available as a selection or toggle alongside the existing solo or paired game choice.
- A "round" for the ranked timer budget means a 12-card butifarra round.
- The 1-minute ranked time budget is personal per player, not shared by the couple.
- The 15-second base turn timeout resets every turn.
- The 1-minute personal budget resets every 12-card round.
- Losing a round by ranked timeout does not automatically lose the entire game; it awards 36 points to the opposing couple and the game continues unless another end condition occurs.
- The 4-hour timeout applies to total game duration, not to a single round.
- When the 4-hour timeout occurs, the winner is determined using the current total game score.
- The exact behavior for tied games at the 4-hour timeout still needs product clarification.
- Existing butifarra scoring and normal game completion rules are reused unless explicitly overridden by ranked-mode rules.