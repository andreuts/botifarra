import type { Card, Hands, Rank, Suit } from './types.js';
export declare const SUITS: Suit[];
export declare const RANKS: Rank[];
/** Creates a new, unshuffled 48-card deck. */
export declare function createDeck(): Card[];
/**
 * Returns a shuffled copy of the deck using Fisher-Yates.
 * Does NOT mutate the original array.
 */
export declare function shuffleDeck(deck: Card[]): Card[];
/**
 * Deals the 48-card deck one card at a time clockwise to 4 seats.
 * Each seat receives 12 cards.
 *
 * card[0] → seat 0, card[1] → seat 1, …, card[4] → seat 0, …
 */
export declare function dealHands(deck: Card[]): Hands;
/**
 * Point value of a card for scoring purposes.
 *
 * Manilla (9) = 9  |  As (1) = 11  |  Rei (12) = 4
 * Cavall (11) = 3  |  Sota (10) = 2  |  rest = 0
 *
 * Total across 48-card deck = 116 points.
 */
export declare function cardPointValue(card: Card): number;
/** Power of a card when it belongs to the trump suit. */
export declare function cardTrumpPower(card: Card): number;
/** Power of a card within its own (non-trump) suit. */
export declare function cardSuitPower(card: Card): number;
