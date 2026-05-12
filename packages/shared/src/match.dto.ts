import type { Card, CompletedTrick, RoundScore, Seat, TrumpDeclaration } from '@botifarra/core';

// ---------------------------------------------------------------------------
// Match / Lobby DTOs
// ---------------------------------------------------------------------------

export type MatchStatus = 'waiting' | 'in-progress' | 'finished';
export type MatchMode = 'public' | 'private' | 'practice';

export interface MatchPlayerDTO {
  userId: string;
  username: string;
  seat: Seat;
  connected: boolean;
}

export interface MatchDTO {
  matchId: string;
  mode: MatchMode;
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
