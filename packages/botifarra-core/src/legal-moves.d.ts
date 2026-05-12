import type { Card, Seat, TrickCard, TrumpDeclaration } from './types.js';
export interface LegalMovesInput {
    hand: Card[];
    currentTrick: TrickCard[];
    trump: TrumpDeclaration;
    /** Seat of the player whose legal moves are being computed. Defaults to 0. */
    playerSeat?: Seat;
}
/**
 * Returns the subset of `hand` that is legal to play given the current trick state.
 *
 * Rules (in priority order):
 *
 * 1. Leading (empty trick) → any card.
 * 2. Must follow the led suit if possible.
 * 3. If void in led suit and a trump suit is declared:
 *    a. Must trump if possible.
 *    b. If already playing trump (led suit IS trump), must overtrump if possible
 *       UNLESS partner is currently winning the trick.
 * 4. If using trump and partner is NOT winning, must overtrump if possible;
 *    otherwise any trump card is legal.
 * 5. If void in both led suit and trump → any card.
 * 6. In 'botifarra' (no-trump): follow suit if possible; else any card.
 */
export declare function legalMoves({ hand, currentTrick, trump, playerSeat, }: LegalMovesInput): Card[];
