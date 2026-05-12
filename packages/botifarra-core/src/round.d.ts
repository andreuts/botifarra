import type { Card, Hands, RoundState, Seat, TrumpDeclaration } from './types.js';
export type RoundPhase = 'declaring' | 'playing' | 'scoring';
export declare function getRoundPhase(round: RoundState): RoundPhase;
/**
 * Returns the seat of the player who should act next.
 * - `null` during the declaring phase.
 * - During playing: leader + number of cards already in current trick (mod 4).
 */
export declare function currentPlayerSeat(round: RoundState): Seat | null;
export interface CreateRoundOptions {
    dealerSeat: Seat;
    hands: Hands;
}
/**
 * Creates a fresh round in the 'declaring' phase.
 * The declarant is the partner of the dealer.
 * The first trick leader is the seat left of the dealer.
 */
export declare function createRound({ dealerSeat, hands }: CreateRoundOptions): RoundState;
/**
 * Records the trump declaration and advances the round to the playing phase.
 *
 * Rules:
 * - Trump can only be declared once (if trump is null).
 */
export declare function declareTrump(round: RoundState, declaration: TrumpDeclaration): RoundState;
/**
 * Plays `card` for `seat` and returns the updated round state.
 *
 * Validates:
 * - Round is in playing phase.
 * - It is `seat`'s turn.
 * - `card` is in `seat`'s hand.
 * - `card` is among the legal moves for this position.
 */
export declare function playCard(round: RoundState, seat: Seat, card: Card): RoundState;
