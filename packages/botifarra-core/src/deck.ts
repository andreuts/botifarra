import type { Card, Hands, Rank, Seat, Suit } from './types.js';

export const SUITS: Suit[] = ['oros', 'copes', 'espases', 'bastos'];
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Creates a new, unshuffled 48-card deck. */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Returns a shuffled copy of the deck using Fisher-Yates.
 * Does NOT mutate the original array.
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const copy = [...deck];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Deals the 48-card deck one card at a time clockwise to 4 seats.
 * Each seat receives 12 cards.
 *
 * card[0] → seat 0, card[1] → seat 1, …, card[4] → seat 0, …
 */
export function dealHands(deck: Card[]): Hands {
  const hands: Hands = { 0: [], 1: [], 2: [], 3: [] };
  for (let i = 0; i < deck.length; i++) {
    const seat = (i % 4) as Seat;
    // deck[i] is always defined because i < deck.length
    hands[seat].push(deck[i]!);
  }
  return hands;
}

// ---------------------------------------------------------------------------
// Card values
// ---------------------------------------------------------------------------

/**
 * Point value of a card for scoring purposes.
 *
 * Per the official Botifarra rules:
 *   Manilla (9) = 5  |  As (1) = 4  |  Rei (12) = 3
 *   Cavall (11) = 2  |  Sota (10) = 1  |  rest = 0
 *
 * Total card points per suit: 5+4+3+2+1 = 15
 * Total card points in deck : 15 × 4 suits = 60
 * Plus 1 point per trick won = 12 extra → grand total 72 per round.
 */
export function cardPointValue(card: Card): number {
  switch (card.rank) {
    case 9:  return 5; // Manilla
    case 1:  return 4; // As
    case 12: return 3; // Rei
    case 11: return 2; // Cavall
    case 10: return 1; // Sota
    default: return 0;
  }
}

/**
 * Internal rank-to-power mapping used for both trump and non-trump ordering.
 *
 * Trump power order (desc):
 *   9 (Manilla) > 1 (As) > 12 (Rei) > 11 (Cavall) > 10 (Sota) > 8 > 7 > 6 > 5 > 4 > 3 > 2
 */
const RANK_POWER: Record<Rank, number> = {
  9:  12, // Manilla — highest
  1:  11, // As
  12: 10, // Rei
  11: 9,  // Cavall
  10: 8,  // Sota
  8:  7,
  7:  6,
  6:  5,
  5:  4,
  4:  3,
  3:  2,
  2:  1,
};

/** Power of a card when it belongs to the trump suit. */
export function cardTrumpPower(card: Card): number {
  return RANK_POWER[card.rank];
}

/** Power of a card within its own (non-trump) suit. */
export function cardSuitPower(card: Card): number {
  return RANK_POWER[card.rank];
}
