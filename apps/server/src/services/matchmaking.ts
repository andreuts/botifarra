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
  ranked: boolean;
  rating: number; // Elo rating for ranked, 0 for normal
  joinedAt: Date;
}

export interface PairEntry {
  type: 'pair';
  players: [{ userId: string; username: string }, { userId: string; username: string }];
  ranked: boolean;
  rating: number; // average Elo for ranked, 0 for normal
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
  ranked: boolean,
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
  enqueueSingle(userId: string, username: string, ranked = false, rating = 0): void {
    if (this.isQueued(userId)) throw new Error('Already in queue');
    this.singles.push({ type: 'single', userId, username, ranked, rating, joinedAt: new Date() });
    this.attemptMatch();
  }

  /**
   * Add a pair of players to the queue.
   * Throws if either player is already queued.
   */
  enqueuePair(
    player1: { userId: string; username: string },
    player2: { userId: string; username: string },
    ranked = false,
    rating = 0,
  ): void {
    if (this.isQueued(player1.userId)) throw new Error(`${player1.username} is already in queue`);
    if (this.isQueued(player2.userId)) throw new Error(`${player2.username} is already in queue`);
    this.pairs.push({ type: 'pair', players: [player1, player2], ranked, rating, joinedAt: new Date() });
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
    // Try ranked matches first, then normal
    this.attemptMatchForMode(true);
    this.attemptMatchForMode(false);
  }

  /** Maximum Elo difference allowed for ranked matchmaking */
  private static readonly MAX_ELO_DIFF = 300;

  /** Check if two entries are within acceptable Elo range */
  private isEloCompatible(a: { rating: number; joinedAt: Date }, b: { rating: number; joinedAt: Date }): boolean {
    // Widen the acceptable range based on wait time (50 pts per 30s waited)
    const now = Date.now();
    const waitA = (now - a.joinedAt.getTime()) / 30000; // 30s units
    const waitB = (now - b.joinedAt.getTime()) / 30000;
    const maxWait = Math.max(waitA, waitB);
    const allowedDiff = MatchmakingQueue.MAX_ELO_DIFF + maxWait * 50;
    return Math.abs(a.rating - b.rating) <= allowedDiff;
  }

  private attemptMatchForMode(ranked: boolean): void {
    const singles = this.singles.filter((e) => e.ranked === ranked);
    const pairs = this.pairs.filter((e) => e.ranked === ranked);

    // Priority 1: 2 pairs → match
    if (pairs.length >= 2) {
      if (ranked) {
        // Find best Elo-compatible pair
        for (let i = 0; i < pairs.length - 1; i++) {
          for (let j = i + 1; j < pairs.length; j++) {
            if (this.isEloCompatible(pairs[i]!, pairs[j]!)) {
              const pair1 = pairs[i]!;
              const pair2 = pairs[j]!;
              this.pairs.splice(this.pairs.indexOf(pair2), 1);
              this.pairs.splice(this.pairs.indexOf(pair1), 1);
              this.createMatch(this.arrangeTwoPairs(pair1, pair2), ranked);
              return;
            }
          }
        }
      } else {
        const [pair1, pair2] = [pairs[0]!, pairs[1]!];
        this.pairs.splice(this.pairs.indexOf(pair2), 1);
        this.pairs.splice(this.pairs.indexOf(pair1), 1);
        this.createMatch(this.arrangeTwoPairs(pair1, pair2), ranked);
        return;
      }
    }

    // Priority 2: 1 pair + 2 singles → match
    if (pairs.length >= 1 && singles.length >= 2) {
      if (ranked) {
        const pair = pairs[0]!;
        // Find 2 Elo-compatible singles
        const compatible = singles.filter((s) => this.isEloCompatible(pair, s));
        if (compatible.length >= 2) {
          const s1 = compatible[0]!;
          const s2 = compatible[1]!;
          this.pairs.splice(this.pairs.indexOf(pair), 1);
          this.singles.splice(this.singles.indexOf(s1), 1);
          this.singles.splice(this.singles.indexOf(s2), 1);
          this.createMatch(this.arrangePairAndSingles(pair, [s1, s2] as [SingleEntry, SingleEntry]), ranked);
          return;
        }
      } else {
        const pair = pairs[0]!;
        const solos = [singles[0]!, singles[1]!] as [SingleEntry, SingleEntry];
        this.pairs.splice(this.pairs.indexOf(pair), 1);
        this.singles.splice(this.singles.indexOf(solos[1]), 1);
        this.singles.splice(this.singles.indexOf(solos[0]), 1);
        this.createMatch(this.arrangePairAndSingles(pair, solos), ranked);
        return;
      }
    }

    // Priority 3: 4 singles → match
    if (singles.length >= 4) {
      if (ranked) {
        // Sort by rating and take the 4 closest
        const sorted = [...singles].sort((a, b) => a.rating - b.rating);
        // Find a window of 4 where max-min diff is within tolerance
        for (let i = 0; i <= sorted.length - 4; i++) {
          if (this.isEloCompatible(sorted[i]!, sorted[i + 3]!)) {
            const group = sorted.slice(i, i + 4) as [SingleEntry, SingleEntry, SingleEntry, SingleEntry];
            for (const s of group) {
              this.singles.splice(this.singles.indexOf(s), 1);
            }
            this.createMatch(this.arrangeFourSingles(group), ranked);
            return;
          }
        }
      } else {
        const solos = [singles[0]!, singles[1]!, singles[2]!, singles[3]!];
        for (const s of solos) {
          this.singles.splice(this.singles.indexOf(s), 1);
        }
        this.createMatch(
          this.arrangeFourSingles(solos as [SingleEntry, SingleEntry, SingleEntry, SingleEntry]),
          ranked,
        );
        return;
      }
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

  private createMatch(players: MatchPlayer[], ranked: boolean): void {
    const matchId = generateMatchId();

    void this.onMatchCreated(players, matchId, ranked)
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
              ranked: false,
              rating: 1500,
            });
          }
        }
      });
  }
}

function generateMatchId(): string {
  return `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
