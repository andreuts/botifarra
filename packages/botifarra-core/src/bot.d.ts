import type { Card, RoundState, Seat, TrumpDeclaration } from './types.js';
/**
 * Picks a random initial trump declaration.
 * Called only when `round.trump` is null (declaring phase).
 */
export declare function randomBotDeclareTrump(_round: RoundState): TrumpDeclaration;
/**
 * Returns a random legal card for `seat` to play.
 * Throws if the round is not in the playing phase or it is not `seat`'s turn.
 */
export declare function randomBotMove(round: RoundState, seat: Seat): Card;
