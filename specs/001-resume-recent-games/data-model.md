# Data Model: Resume Recent Games

**Date**: 2026-05-18 | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

---

## Database Changes (Prisma)

### Modified: `Match`

Add a nullable JSON column to store the latest serialized `RoomGameState`. Also add `ABANDONED` to the `MatchStatus` enum.

```prisma
enum MatchStatus {
  WAITING
  IN_PROGRESS
  FINISHED
  ABANDONED      // NEW — game was abandoned before completion
}

model Match {
  // ... existing fields ...
  lastSnapshot  Json?     // NEW — serialized RoomGameState; null when finished or not started
}
```

**Migration**: `<timestamp>_resume_recent_games`

---

### New: `EloHistory`

Records each player's ELO value after a match completes, enabling the ELO time-series graph.

```prisma
model EloHistory {
  id         String   @id @default(cuid())
  userId     String
  matchId    String
  eloAfter   Float
  eloChange  Float    // positive = gained, negative = lost
  isRanked   Boolean  @default(false)
  createdAt  DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  match Match @relation(fields: [matchId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@map("elo_history")
}
```

Add the back-relation on `User` and `Match` models:
```prisma
model User {
  // ... existing ...
  eloHistory EloHistory[]
}

model Match {
  // ... existing ...
  eloHistory EloHistory[]
}
```

---

## Shared DTO Changes (`packages/shared/src/match.dto.ts`)

### New: `GameOutcome`

```typescript
export type GameOutcome = 'won' | 'lost' | 'draw' | 'in-progress' | 'abandoned';
```

### New: `RecentGameDTO`

Extends `MatchDTO` with user-relative outcome data and resume capability.

```typescript
export interface RecentGameDTO extends MatchDTO {
  /** Outcome relative to the requesting player. */
  outcome: GameOutcome;
  /** The requesting player's team (0 = seats 0,2 | 1 = seats 1,3). Null if match not started. */
  myTeam: 0 | 1 | null;
  /** ISO timestamp when the match ended. Null if in-progress or abandoned. */
  finishedAt: string | null;
}
```

### New: `EloSnapshotDTO`

```typescript
export interface EloSnapshotDTO {
  matchId: string;
  eloAfter: number;
  eloChange: number;
  isRanked: boolean;
  /** ISO timestamp */
  createdAt: string;
}
```

### New: `TopPlayerEntryDTO`

```typescript
export interface TopPlayerEntryDTO {
  userId: string;
  username: string;
  gamesPlayed: number;
  winRateVsOpponent: number; // 0.0 – 1.0
}
```

### New: `PlayerStatsDTO`

```typescript
export interface PlayerStatsDTO {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;          // 0.0 – 1.0
  currentElo: number;
  averageEloChange: number; // over the displayed window
  eloHistory: EloSnapshotDTO[];       // overall, last 30
  rankedEloHistory: EloSnapshotDTO[]; // ranked-only, last 30
  topPlayedWith: TopPlayerEntryDTO[];
  topPlayedAgainst: TopPlayerEntryDTO[];
}
```

---

## Server Snapshot Serialization (`apps/server/src/services/persistence.ts`)

The `RoomGameState` uses a `Map` which is not directly JSON-serializable. A serializable intermediary is defined server-side only (not exported to shared):

```typescript
// Internal to apps/server — NOT exported to packages/shared
export interface SerializableRoomSnapshot {
  seats: Array<[number, { userId: string; username: string; sessionId: string; connected: boolean }]>;
  game: unknown;   // ReturnType<typeof createGame> — plain object, JSON-safe
  round: unknown;  // RoundState | null — plain object, JSON-safe
  phase: 'lobby' | 'playing' | 'finished';
}
```

`serializeSnapshot(state: RoomGameState): SerializableRoomSnapshot` converts the `Map` to an array.
`deserializeSnapshot(raw: SerializableRoomSnapshot): RoomGameState` rebuilds the `Map`.

---

## Entity Relationship Summary

```
User ──< MatchPlayer >── Match
User ──< EloHistory  >── Match
Match ── lastSnapshot (Json column, inline)
```

---

## Validation Rules

| Rule | Where enforced |
|------|---------------|
| `lastSnapshot` must be valid `SerializableRoomSnapshot` shape | `deserializeSnapshot()` throws on invalid input; match is shown as unresumable |
| `outcome` for `IN_PROGRESS` match: always `'in-progress'`, never `'won'`/`'lost'` | Server-side DTO mapper in `matches.ts` |
| `eloHistory` and `rankedEloHistory` contain at most 30 entries each | Prisma query `take: 30 ORDER BY createdAt DESC` |
| `topPlayedWith` / `topPlayedAgainst`: max 5 entries each (UI cap) | `computeTopOpponents()` in `stats.ts` |
| `ABANDONED` status: set when match is finalized with `endReason = 'surrender'` or connection timeout | `finalizeMatch()` extended with `ABANDONED` case |

---

## State Transitions

```
Match.status:  WAITING → IN_PROGRESS → FINISHED
                                     ↘ ABANDONED
```

- `lastSnapshot` is written after every card play and round end (while `IN_PROGRESS`)
- `lastSnapshot` is cleared (set to `null`) when status moves to `FINISHED` or `ABANDONED`
- `EloHistory` row is created per player when status moves to `FINISHED` (ranked matches only; `isRanked = Match.ranked`)
