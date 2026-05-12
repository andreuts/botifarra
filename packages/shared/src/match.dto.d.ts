import type { Card, CompletedTrick, Seat, TrumpDeclaration } from '@botifarra/core';
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
export interface PlayerGameStateDTO {
    matchId: string;
    roundNumber: number;
    dealerSeat: Seat;
    declarantSeat: Seat;
    trump: TrumpDeclaration | null;
    /** The requesting player's own hand */
    hand: Card[];
    /** Number of cards held by each seat (not the actual cards) */
    handSizes: Record<Seat, number>;
    currentTrick: Array<{
        seat: Seat;
        card: Card;
    }>;
    completedTricks: CompletedTrick[];
    currentLeader: Seat;
    scores: [number, number];
    currentPlayerSeat: Seat | null;
}
export interface MatchHistoryItemDTO {
    matchId: string;
    finishedAt: string;
    teams: [[string, string], [string, string]];
    scores: [number, number];
    winner: 0 | 1;
}
