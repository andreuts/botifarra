# API Contract: Resume Recent Games

**Date**: 2026-05-18 | **Plan**: [../plan.md](../plan.md)

All endpoints require `Authorization: Bearer <token>` unless stated otherwise.
All request/response bodies are `application/json`.
Error responses follow the existing pattern: `{ "error": "<message>" }`.

---

## Modified: `GET /api/matches`

Returns the **30 most recent games** for the **authenticated user** (not all matches globally).

**Before**: returned up to 20 global matches as `MatchDTO[]`.

**After**: returns up to 30 user-specific matches as `RecentGameDTO[]`.

### Request

```
GET /api/matches
Authorization: Bearer <token>
```

### Response `200 OK`

```typescript
RecentGameDTO[]   // ordered by createdAt DESC, max 30 items
```

```json
[
  {
    "matchId": "cm123",
    "mode": "ranked",
    "ranked": true,
    "status": "in-progress",
    "players": [...],
    "scores": [6, 4],
    "targetScore": 12,
    "createdAt": "2026-05-18T10:00:00Z",
    "outcome": "in-progress",
    "myTeam": 0,
    "finishedAt": null
  },
  {
    "matchId": "cm120",
    "mode": "public",
    "ranked": false,
    "status": "finished",
    "players": [...],
    "scores": [12, 7],
    "targetScore": 12,
    "createdAt": "2026-05-17T20:00:00Z",
    "outcome": "won",
    "myTeam": 0,
    "finishedAt": "2026-05-17T20:45:00Z"
  }
]
```

### Outcome computation (server-side)

```
myTeam = matchPlayer.seat % 2   (for the requesting userId)
if match.status === 'IN_PROGRESS'  → outcome = 'in-progress'
if match.status === 'ABANDONED'    → outcome = 'abandoned'
if match.status === 'FINISHED':
  if match.winner === myTeam      → outcome = 'won'
  else if match.winner !== null   → outcome = 'lost'
  else                            → outcome = 'draw'
```

---

## New: `POST /api/matches/:matchId/resume`

Resumes an in-progress match. Returns the Colyseus room ID to join.

### Request

```
POST /api/matches/:matchId/resume
Authorization: Bearer <token>
```

### Response `200 OK`

```json
{ "roomId": "<colyseus-room-id>" }
```

### Response `403 Forbidden`

If the authenticated user is not a player in this match.

```json
{ "error": "Not a participant" }
```

### Response `409 Conflict`

If the match is not in `IN_PROGRESS` status.

```json
{ "error": "Match is not in progress" }
```

### Response `422 Unprocessable Entity`

If `lastSnapshot` is null or corrupted and the room cannot be restored.

```json
{ "error": "Cannot restore match state: snapshot missing or corrupted" }
```

### Server behaviour

1. Verify the requesting user is in `MatchPlayer` for this `matchId`.
2. Verify `match.status === 'IN_PROGRESS'`.
3. Check if a live Colyseus room with `roomId` matching the `matchId` room already exists (via `matchmaker.query`).
   - If yes → return that `roomId`.
4. If no live room: load `match.lastSnapshot`, call `deserializeSnapshot()`, create a new Colyseus `BotifarraRoom` with the deserialized state injected as `initialState`.
5. Return new `roomId`.

---

## New: `GET /api/users/me/stats`

Returns aggregated statistics for the authenticated user.

### Request

```
GET /api/users/me/stats
Authorization: Bearer <token>
```

### Response `200 OK`

```typescript
PlayerStatsDTO
```

```json
{
  "totalGames": 47,
  "wins": 28,
  "losses": 19,
  "winRate": 0.596,
  "currentElo": 1132.5,
  "averageEloChange": 4.2,
  "eloHistory": [
    { "matchId": "cm123", "eloAfter": 1132.5, "eloChange": 12.3, "isRanked": true, "createdAt": "2026-05-18T10:45:00Z" }
  ],
  "rankedEloHistory": [...],
  "topPlayedWith": [
    { "userId": "u1", "username": "perejoan", "gamesPlayed": 12, "winRateVsOpponent": 0.75 }
  ],
  "topPlayedAgainst": [
    { "userId": "u2", "username": "marieta", "gamesPlayed": 8, "winRateVsOpponent": 0.625 }
  ]
}
```

### Computation rules

- `totalGames`, `wins`, `losses` come from `UserStats` (existing aggregate).
- `winRate` = `wins / totalGames` (0 if no games).
- `eloHistory` = last 30 `EloHistory` rows for this user, ordered by `createdAt` ASC (for graphing left→right).
- `rankedEloHistory` = filtered subset where `isRanked = true`, last 30.
- `averageEloChange` = mean of `eloChange` across `eloHistory`.
- `topPlayedWith` = top 5 teammates (same team, different seat) by shared game count, from last 30 finished matches.
- `topPlayedAgainst` = top 5 opponents by shared game count, from last 30 finished matches.
- Win-rate vs. opponent: `wins_against / games_together` where "win" means the requester's team won that game.

---

## Unchanged endpoints

| Endpoint | Status |
|----------|--------|
| `GET /api/matches/:matchId` | Unchanged — still returns single `MatchDTO` |
| `GET /api/users/me` | Unchanged — returns `MeResponse` |
| `GET /api/users/:userId` | Unchanged — returns `UserProfileDTO` with `UserStatsDTO` |
| All other routes | Unchanged |
