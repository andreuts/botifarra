/**
 * In-memory matchmaking queue.
 *
 * Supports two queue modes:
 *   1. **single** — a solo player looking for a match
 *   2. **pair**   — two players who want to be on the same team
 *
 * Matching rules (4-player Botifarra):
 *   - 2 pairs → match (each pair forms a team)
 *   - 1 pair + 2 singles → match (pair = team, singles = team)
 *   - 4 singles → match (random seating)
 *
 * When a match is formed, `onMatchCreated` is called with the arranged
 * player list and match ID.  The callback must return the Colyseus roomId.
 * Clients then join the room via `joinById` which creates a fresh seat
 * reservation internally (eliminating "seat reservation expired" errors).
 */

import type { Seat } from '@botifarra/core';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type QueueMode = 'single' | 'pair';

export interface SingleEntry {
  type: 'single';
  userId: string;
  username: string;
  joinedAt: Date;
}

export interface PairEntry {
  type: 'pair';
  players: [
    { userId: string; username: string },
    { userId: string; username: string },
  ];
  joinedAt: Date;
}

export type QueueEntry = SingleEntry | PairEntry;

/** Resolved player arrangement ready for room creation */
export interface MatchPlayer {
  userId: string;
  username: string;
  seat: Seat;
}

/**
 * Per-player seat reservation returned by the server.
 * Clients pass this directly to `consumeSeatReservation()` which bypasses
 * the `room.locked` check (unlike `joinById`).
 */
export interface SeatReservationData {
  sessionId: string;
  room: {
    roomId: string;
    name: string;
    processId: string;
  };
}

/**
 * Callback invoked when a match is formed.
 * Must create the Colyseus room, reserve a seat for each player, and return
 * the map of userId → SeatReservationData.
 */
export type OnMatchCreated = (
  players: MatchPlayer[],
  matchId: string,
) => Promise<Map<string, SeatReservationData>>;

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export class MatchmakingQueue {
  private singles: SingleEntry[] = [];
  private pairs: PairEntry[] = [];
  private onMatchCreated: OnMatchCreated;

  /** Holds userId → SeatReservationData for polled retrieval after match */
  private resolvedReservations = new Map<string, SeatReservationData>();

  constructor(onMatchCreated: OnMatchCreated) {
    this.onMatchCreated = onMatchCreated;
  }

  /** Hot-swap the callback (used from index.ts once gameServer is ready) */
  setOnMatchCreated(cb: OnMatchCreated) {
    this.onMatchCreated = cb;
  }

  // -------------------------------------------------------------------------
  // Resolved room ID (poll-based retrieval)
  // -------------------------------------------------------------------------

  /** Returns the SeatReservationData if this user was recently matched, then clears it */
  popResolvedReservation(userId: string): SeatReservationData | undefined {
    const data = this.resolvedReservations.get(userId);
    if (data) this.resolvedReservations.delete(userId);
    return data;
  }

  // -------------------------------------------------------------------------
  // Enqueue
  // -------------------------------------------------------------------------

  /**
   * Add a solo player to the queue.
   * Throws if the player is already queued.
   */
  enqueueSingle(userId: string, username: string): void {
    if (this.isQueued(userId)) throw new Error('Already in queue');
    this.singles.push({ type: 'single', userId, username, joinedAt: new Date() });
    this.attemptMatch();
  }

  /**
   * Add a pair of players to the queue.
   * Throws if either player is already queued.
   */
  enqueuePair(
    player1: { userId: string; username: string },
    player2: { userId: string; username: string },
  ): void {
    if (this.isQueued(player1.userId)) throw new Error(`${player1.username} is already in queue`);
    if (this.isQueued(player2.userId)) throw new Error(`${player2.username} is already in queue`);
    this.pairs.push({ type: 'pair', players: [player1, player2], joinedAt: new Date() });
    this.attemptMatch();
  }

  // -------------------------------------------------------------------------
  // Dequeue
  // -------------------------------------------------------------------------

  dequeue(userId: string): boolean {
    // Check singles
    const sIdx = this.singles.findIndex((e) => e.userId === userId);
    if (sIdx !== -1) {
      this.singles.splice(sIdx, 1);
      return true;
    }
    // Check pairs — remove the whole pair if either member leaves
    const pIdx = this.pairs.findIndex(
      (e) => e.players[0].userId === userId || e.players[1].userId === userId,
    );
    if (pIdx !== -1) {
      this.pairs.splice(pIdx, 1);
      return true;
    }
    return false;
  }

  isQueued(userId: string): boolean {
    return (
      this.singles.some((e) => e.userId === userId) ||
      this.pairs.some((e) => e.players.some((p) => p.userId === userId))
    );
  }

  get size(): number {
    return this.singles.length + this.pairs.length * 2;
  }

  get singleCount(): number {
    return this.singles.length;
  }

  get pairCount(): number {
    return this.pairs.length;
  }

  // -------------------------------------------------------------------------
  // Internal — matching logic
  // -------------------------------------------------------------------------

  private attemptMatch(): void {
    // Priority 1: 2 pairs → match
    if (this.pairs.length >= 2) {
      const [pair1, pair2] = this.pairs.splice(0, 2);
      this.createMatch(
        this.arrangeTwoPairs(pair1!, pair2!),
      );
      return;
    }

    // Priority 2: 1 pair + 2 singles → match
    if (this.pairs.length >= 1 && this.singles.length >= 2) {
      const [pair] = this.pairs.splice(0, 1);
      const solos = this.singles.splice(0, 2);
      this.createMatch(
        this.arrangePairAndSingles(pair!, solos as [SingleEntry, SingleEntry]),
      );
      return;
    }

    // Priority 3: 4 singles → match
    if (this.singles.length >= 4) {
      const solos = this.singles.splice(0, 4);
      this.createMatch(
        this.arrangeFourSingles(solos as [SingleEntry, SingleEntry, SingleEntry, SingleEntry]),
      );
      return;
    }
  }

  // ---- Seat arrangement helpers -------------------------------------------

  /**
   * Two pairs: pair1 → team 0 (seats 0, 2), pair2 → team 1 (seats 1, 3)
   */
  private arrangeTwoPairs(pair1: PairEntry, pair2: PairEntry): MatchPlayer[] {
    return [
      { userId: pair1.players[0].userId, username: pair1.players[0].username, seat: 0 },
      { userId: pair2.players[0].userId, username: pair2.players[0].username, seat: 1 },
      { userId: pair1.players[1].userId, username: pair1.players[1].username, seat: 2 },
      { userId: pair2.players[1].userId, username: pair2.players[1].username, seat: 3 },
    ];
  }

  /**
   * One pair + 2 singles: pair → team 0 (seats 0, 2), singles → team 1 (seats 1, 3)
   */
  private arrangePairAndSingles(
    pair: PairEntry,
    singles: [SingleEntry, SingleEntry],
  ): MatchPlayer[] {
    return [
      { userId: pair.players[0].userId, username: pair.players[0].username, seat: 0 },
      { userId: singles[0].userId, username: singles[0].username, seat: 1 },
      { userId: pair.players[1].userId, username: pair.players[1].username, seat: 2 },
      { userId: singles[1].userId, username: singles[1].username, seat: 3 },
    ];
  }

  /**
   * Four singles: random seat assignment
   */
  private arrangeFourSingles(
    entries: [SingleEntry, SingleEntry, SingleEntry, SingleEntry],
  ): MatchPlayer[] {
    // Shuffle
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    return shuffled.map((e, i) => ({
      userId: e.userId,
      username: e.username,
      seat: i as Seat,
    }));
  }

  // ---- Match creation -----------------------------------------------------

  private createMatch(players: MatchPlayer[]): void {
    const matchId = generateMatchId();

    void this.onMatchCreated(players, matchId)
      .then((reservations) => {
        for (const p of players) {
          const r = reservations.get(p.userId);
          if (r) this.resolvedReservations.set(p.userId, r);
        }
      })
      .catch((err: unknown) => {
        console.error('[MatchmakingQueue] Failed to create match:', err);
        // Re-queue the players so they can try again
        for (const p of players) {
          if (!this.isQueued(p.userId)) {
            this.singles.push({
              type: 'single',
              userId: p.userId,
              username: p.username,
              joinedAt: new Date(),
            });
          }
        }
      });
  }
}

function generateMatchId(): string {
  return `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
