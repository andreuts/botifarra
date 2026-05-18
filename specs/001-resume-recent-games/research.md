# Research: Resume Recent Games

**Date**: 2026-05-18 | **Plan**: [plan.md](plan.md)

---

## 1. Game State Resumption Strategy

**Decision**: Store a JSON snapshot of the full `RoomGameState` in a new nullable `lastSnapshot` column on the existing `Match` model.

**Rationale**:
- `MatchEvent` (event log) already exists, but replaying the full event log to reconstruct `RoomGameState` would require running all `botifarra-core` functions in sequence — fragile and adds test burden.
- Adding a `lastSnapshot Json?` column to `Match` is a single-line schema change (no new table) and aligns with Principle I (Simplicity First).
- The snapshot is overwritten after each significant game action (card play, trump declaration, round end), so only the latest state is stored; this keeps storage minimal.
- `RoomGameState` contains `seats: Map<Seat, SeatInfo>`, `game`, `round`, and `phase`. The `Map` must be serialized as an array of `[key, value]` pairs in JSON; a `serializeSnapshot` / `deserializeSnapshot` pair in `persistence.ts` handles this.

**Alternatives considered**:
- **Full event replay**: rejected — requires importing and running all game-logic on resume; error-prone; must handle schema migrations of old events.
- **Dedicated `GameStateSnapshot` table**: rejected — adds schema complexity for no benefit; `Match` already has a 1:1 cardinality with active state.
- **Redis in-memory cache**: rejected — adds an infrastructure dependency (no Redis in current `docker-compose.yml`); violates Principle IX (Zero-Cost Infrastructure adds paid Redis if self-hosting is dropped).

---

## 2. ELO History Tracking

**Decision**: Add a new `EloHistory` Prisma model with fields `(id, userId, matchId, eloAfter, eloChange, isRanked, createdAt)`.

**Rationale**:
- `UserStats.individualRating` only stores the current ELO — no history exists in the database.
- The ELO graph in "Historial de Partides" requires an ordered time series of ELO values.
- A separate table is the cleanest approach: each ranked match generates one row per player; the table can be queried directly with `ORDER BY createdAt DESC LIMIT 30`.
- `isRanked` flag enables the two separate graphs (overall vs. ranked-only) required by FR-006.

**Alternatives considered**:
- **Store ELO as a JSON array on `UserStats`**: rejected — unbounded growth, harder to query, conflicts with Prisma's type-safe query model.
- **Recompute from `MatchPlayer` + `Match`**: rejected — requires knowing ELO at each historic point; loses precision since ELO is updated in place today.

---

## 3. User-Specific Match Endpoint

**Decision**: Modify `GET /api/matches` to filter by the authenticated user's `userId` and add a computed `outcome` field relative to that user.

**Rationale**:
- The current endpoint returns all matches regardless of who is requesting — not user-specific. This must be corrected for privacy and relevance (FR-001, FR-002).
- Outcome computation: `winner` on `Match` is `0 | 1` (winning team). The requesting player's team is `seat % 2` from `MatchPlayer`. `outcome = winner === myTeam ? 'won' : 'lost'`. For `IN_PROGRESS` matches, `outcome = 'in-progress'`.
- The 30-game limit is applied in the Prisma query (`take: 30`) — this prevents large payloads (FR-008).

**Alternatives considered**:
- **New `GET /api/users/me/matches` endpoint**: viable, but modifying the existing endpoint reduces client-side changes (the web client already calls `/api/matches`).

---

## 4. Resume Flow

**Decision**: Add `POST /api/matches/:matchId/resume` endpoint that returns a `roomId` the client can navigate to.

**Rationale**:
- The server must check if a live Colyseus room still exists for the `matchId` (using the Colyseus driver's room listing).
- If the room is alive, return its `roomId` directly.
- If not, create a new Colyseus room, deserialize `Match.lastSnapshot` into `RoomGameState`, and inject it as the initial game state. Return the new `roomId`.
- The client then navigates to `/match/:roomId?mode=botifarra` — the existing game flow handles connection from there.
- Bot players: if the original match had bot seats, they must be re-added during snapshot restoration (their `userId` prefix `bot-` identifies them).

**Alternatives considered**:
- **Reconnect using `activeGameRoomId` stored in `gameStore`**: this already handles the "session still active" case but fails if the server restarted. The server-side resume endpoint is necessary for cross-session persistence.

---

## 5. Player Statistics Computation

**Decision**: Add `GET /api/users/me/stats` that returns `PlayerStatsDTO` — computed at query time from the last 30 `EloHistory` rows and match aggregations.

**Rationale**:
- Stats (win rate, top opponents) are cheap to compute from a window of ≤30 games.
- No caching or pre-aggregation layer is needed at this scale (Principle I).
- Top opponents are computed with a GROUP BY on `matchPlayers` for the user's last 30 matches.
- Win-rate against each opponent is computed in the same query.

**Alternatives considered**:
- **Materialize stats in `UserStats`**: would require updating a stats row on every match end; more complex; not needed at current scale.
- **Separate analytics service**: explicitly rejected by Principle I.

---

## 6. ELO Graph Rendering

**Decision**: Implement `EloGraph` as a pure React + SVG component (no new chart library).

**Rationale**:
- Adding a charting library (recharts, chart.js, etc.) is a new dependency requiring constitutional amendment.
- An SVG line path with `polyline` or `path` is sufficient for a simple ELO trend line; data points are ≤30.
- Accessibility: provide a visually hidden `<table>` with the same data as an alternative to the SVG.

**Alternatives considered**:
- **Canvas-based rendering**: rejected — SVG is more accessible and debuggable.
- **recharts or chart.js**: rejected — new runtime dependency; violates Principle IX/X without amendment.
