/**
 * Level 2 Heuristic Bot
 *
 * Decision rules (in priority order):
 *
 * Declaration:
 *   1. Count trump-power-weighted score per suit.
 *   2. Declare the best suit (if ≥ 3 cards in that suit + high cards).
 *   3. Fall back to botifarra if hand is even across all suits.
 *
 * Leading a trick:
 *   1. Lead Manilla (9) of trump if held — draws opponent trumps.
 *   2. Lead Ace (1) of a non-trump suit to establish it.
 *   3. Lead highest card of longest off-suit if void in trump.
 *   4. Otherwise dump lowest point-value card.
 *
 * Following suit / trumping:
 *   1. If partner is winning: play highest card to maximise points won.
 *   2. If opponent is winning and we can overtrump: play minimum winning trump.
 *   3. If we must follow suit: play highest card of led suit to win, else dump lowest.
 *   4. If we must trump but can't overtrump: dump lowest trump.
 *   5. If completely free: dump lowest point-value card.
 */
import type { Card, RoundState, Seat, TrumpDeclaration } from './types.js';
/**
 * Picks the best trump declaration for `seat` using a weighted suit score.
 */
export declare function heuristicBotDeclareTrump(round: RoundState, seat: Seat): TrumpDeclaration;
export declare function heuristicBotMove(round: RoundState, seat: Seat): Card;
