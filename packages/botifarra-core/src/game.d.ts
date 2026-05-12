import type { RoundScore, Seat, Team } from './types.js';
export type GamePhase = 'waiting' | 'in-progress' | 'finished';
export interface GameState {
    /** Target match-points to win the game. Common value: 12. */
    readonly targetScore: number;
    /** Accumulated match-points per team [team0, team1]. */
    readonly scores: [number, number];
    /** Current dealer seat. Rotates clockwise after every round. */
    readonly dealerSeat: Seat;
    /** Winning team once game is finished; null otherwise. */
    readonly winner: Team | null;
    /** Round number (0-based). */
    readonly roundNumber: number;
}
export declare function getGamePhase(game: GameState): GamePhase;
export interface CreateGameOptions {
    /** Match-points required to win. Defaults to 12. */
    targetScore?: number;
}
export declare function createGame({ targetScore }?: CreateGameOptions): GameState;
/**
 * Advances the dealer seat and marks the game as in-progress for the next round.
 * After the first call the round number increments; dealer rotates on subsequent calls.
 */
export declare function startNextRound(game: GameState): GameState;
/**
 * Applies the score from a completed round and determines if the game is over.
 * The team that first reaches `targetScore` wins.
 * If both teams reach it in the same round the team with more points wins;
 * if tied, play another round.
 */
export declare function applyRoundScore(game: GameState, score: RoundScore): GameState;
