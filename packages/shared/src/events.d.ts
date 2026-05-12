import type { CompletedTrick, RoundScore, Seat, TrumpDeclaration } from '@botifarra/core';
import type { PlayerGameStateDTO } from './match.dto.js';
/**
 * Events emitted by the server to connected clients.
 * Clients must treat these as the single source of truth for game state.
 */
export interface GameStateEvent {
    type: 'game_state';
    state: PlayerGameStateDTO;
}
export interface TrumpDeclaredEvent {
    type: 'trump_declared';
    declaration: TrumpDeclaration;
    declarantSeat: Seat;
}
export interface CardPlayedEvent {
    type: 'card_played';
    seat: Seat;
    /** The card played — visible to all players once played */
    card: {
        suit: string;
        rank: number;
    };
}
export interface TrickCompletedEvent {
    type: 'trick_completed';
    trick: CompletedTrick;
    nextLeader: Seat;
}
export interface RoundEndedEvent {
    type: 'round_ended';
    score: RoundScore;
    totalScores: [number, number];
}
export interface GameEndedEvent {
    type: 'game_ended';
    winner: 0 | 1;
    finalScores: [number, number];
}
export interface ErrorEvent {
    type: 'error';
    code: string;
    message: string;
}
export interface PlayerConnectedEvent {
    type: 'player_connected';
    seat: Seat;
    username: string;
}
export interface PlayerDisconnectedEvent {
    type: 'player_disconnected';
    seat: Seat;
}
export type ServerEvent = GameStateEvent | TrumpDeclaredEvent | CardPlayedEvent | TrickCompletedEvent | RoundEndedEvent | GameEndedEvent | ErrorEvent | PlayerConnectedEvent | PlayerDisconnectedEvent;
