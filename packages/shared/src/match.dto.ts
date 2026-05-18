import type { Card, CompletedTrick, RoundScore, Seat, TrumpDeclaration } from '@botifarra/core';

// ---------------------------------------------------------------------------
// Match / Lobby DTOs
// ---------------------------------------------------------------------------

export type MatchStatus = 'waiting' | 'in-progress' | 'finished' | 'abandoned';
export type MatchMode = 'public' | 'private' | 'practice' | 'ranked';

/** Outcome relative to the requesting player */
export type GameOutcome = 'won' | 'lost' | 'draw' | 'in-progress' | 'abandoned';

export interface MatchPlayerDTO {
  userId: string;
  username: string;
  seat: Seat;
  connected: boolean;
}

export interface MatchDTO {
  matchId: string;
  mode: MatchMode;
  ranked: boolean;
  status: MatchStatus;
  players: MatchPlayerDTO[];
  scores: [number, number];
  targetScore: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// In-game state visible to a player (hides opponents' hands)
// ---------------------------------------------------------------------------

export interface PlayerGameStateDTO {
  matchId: string;
  roundNumber: number;
  dealerSeat: Seat;
  declarantSeat: Seat;
  trump: TrumpDeclaration | null;
  /** The requesting player's own hand */
  hand: Card[];
  /** This player's seat (0-3) */
  mySeat: Seat;
  /** Player usernames indexed by seat */
  playerNames: Record<Seat, string>;
  /** Number of cards held by each seat (not the actual cards) */
  handSizes: Record<Seat, number>;
  currentTrick: Array<{ seat: Seat; card: Card }>;
  completedTricks: CompletedTrick[];
  currentLeader: Seat;
  scores: [number, number];
  currentPlayerSeat: Seat | null;
  dealerPassed: boolean;
  contraLevel: number;
  /** Whether this is a ranked game */
  ranked?: boolean;
  /** Turn timer state (ranked only) */
  timers?: {
    seat: Seat;
    baseTurnMs: number;
    roundBudgetMs: number;
  }[];
  /** Pending surrender request */
  surrenderPending?: { requestingSeat: Seat; partnerSeat: Seat } | null;
}

// ---------------------------------------------------------------------------
// Match history
// ---------------------------------------------------------------------------

export interface MatchHistoryItemDTO {
  matchId: string;
  finishedAt: string;
  teams: [[string, string], [string, string]]; // [[p0, p2], [p1, p3]] usernames
  scores: [number, number];
  winner: 0 | 1;
}

// ---------------------------------------------------------------------------
// Recent game (user-relative view, max 30 returned by server)
// ---------------------------------------------------------------------------

export interface RecentGameDTO extends MatchDTO {
  /** Outcome relative to the requesting player */
  outcome: GameOutcome;
  /** The requesting player's team (0 = seats 0,2 | 1 = seats 1,3). Null if match not started. */
  myTeam: 0 | 1 | null;
  /** ISO timestamp when the match ended. Null if in-progress or not yet finished. */
  finishedAt: string | null;
  /** Whether a snapshot exists on the server that allows this game to be resumed. */
  hasSnapshot: boolean;
}

// ---------------------------------------------------------------------------
// Player statistics DTOs
// ---------------------------------------------------------------------------

export interface EloSnapshotDTO {
  matchId: string;
  eloAfter: number;
  eloChange: number;
  isRanked: boolean;
  /** ISO timestamp */
  createdAt: string;
}

export interface TopPlayerEntryDTO {
  userId: string;
  username: string;
  gamesPlayed: number;
  winRateVsOpponent: number; // 0.0 – 1.0
}

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

// ---------------------------------------------------------------------------
// Observer state — public game info without any player's hand
// ---------------------------------------------------------------------------

export interface ObserverGameStateDTO {
  matchId: string;
  roundNumber: number;
  dealerSeat: Seat;
  declarantSeat: Seat;
  trump: TrumpDeclaration | null;
  /** Player usernames indexed by seat */
  playerNames: Record<Seat, string>;
  /** Number of cards held by each seat */
  handSizes: Record<Seat, number>;
  currentTrick: Array<{ seat: Seat; card: Card }>;
  completedTricks: CompletedTrick[];
  currentLeader: Seat;
  scores: [number, number];
  currentPlayerSeat: Seat | null;
  contraLevel: number;
}
