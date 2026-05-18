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

import type { Card, RoundState, Seat, Suit, TrumpDeclaration } from './types.js';
import { cardPointValue, cardTrumpPower, cardSuitPower, SUITS } from './deck.js';
import { legalMoves } from './legal-moves.js';
import { getRoundPhase, currentPlayerSeat } from './round.js';
import { seatTeam } from './types.js';

// ---------------------------------------------------------------------------
// Trump declaration
// ---------------------------------------------------------------------------

/**
 * Picks the best trump declaration for `seat` using a weighted suit score.
 */
export function heuristicBotDeclareTrump(round: RoundState, seat: Seat): TrumpDeclaration {
  const hand = round.hands[seat];

  // Score each suit: sum of trump-power values for cards held in that suit
  const suitScores: Record<Suit, number> = {
    oros: 0,
    copes: 0,
    espases: 0,
    bastos: 0,
  };
  const suitCounts: Record<Suit, number> = {
    oros: 0,
    copes: 0,
    espases: 0,
    bastos: 0,
  };

  for (const card of hand) {
    suitScores[card.suit] += cardTrumpPower(card);
    suitCounts[card.suit]++;
  }

  // Find the best suit
  let bestSuit: Suit = 'oros';
  let bestScore = -1;
  for (const suit of SUITS) {
    if (suitScores[suit] > bestScore) {
      bestScore = suitScores[suit];
      bestSuit = suit;
    }
  }

  // If the best suit has very few cards or low power, consider botifarra
  if (suitCounts[bestSuit] <= 2 && bestScore < 15) {
    return 'botifarra';
  }

  return bestSuit;
}

// ---------------------------------------------------------------------------
// Card play
// ---------------------------------------------------------------------------

export function heuristicBotMove(round: RoundState, seat: Seat): Card {
  if (getRoundPhase(round) !== 'playing') {
    throw new Error('heuristicBotMove called outside playing phase');
  }
  if (currentPlayerSeat(round) !== seat) {
    throw new Error(`Not seat ${seat}'s turn`);
  }

  const hand = round.hands[seat];
  const trick = round.currentTrick;
  const trump = round.trump!;

  const legal = legalMoves({ hand, currentTrick: trick, trump, playerSeat: seat });

  // Leading the trick
  if (trick.length === 0) {
    return chooseLead(legal, trump);
  }

  // Following
  return chooseFollow(legal, trick, trump, seat);
}

// ---------------------------------------------------------------------------
// Lead strategy
// ---------------------------------------------------------------------------

function chooseLead(legal: Card[], trump: TrumpDeclaration): Card {
  const trumpSuit = isSuit(trump) ? trump : null;

  if (trumpSuit) {
    // 1. Lead Manilla of trump to draw trumps
    const manilla = legal.find((c) => c.suit === trumpSuit && c.rank === 9);
    if (manilla) return manilla;

    // 2. Lead Ace of a non-trump suit
    const offAce = legal.find((c) => c.rank === 1 && c.suit !== trumpSuit);
    if (offAce) return offAce;
  } else {
    // Botifarra: lead highest-power card
    const ace = legal.find((c) => c.rank === 1);
    if (ace) return ace;
  }

  // 3. Lead highest card of non-trump suit (establish suit)
  const nonTrump = legal.filter((c) => c.suit !== trumpSuit);
  if (nonTrump.length > 0) {
    return maxBy(nonTrump, cardSuitPower);
  }

  // 4. Dump lowest point card
  return minBy(legal, cardPointValue);
}

// ---------------------------------------------------------------------------
// Follow/trump strategy
// ---------------------------------------------------------------------------

function chooseFollow(
  legal: Card[],
  trick: RoundState['currentTrick'],
  trump: TrumpDeclaration,
  seat: Seat,
): Card {
  const trumpSuit = isSuit(trump) ? trump : null;
  const ledSuit = trick[0]!.card.suit;

  // Determine currently winning seat & team
  const winner = currentWinnerSeat(trick, trump);
  const partnerWinning = winner !== null && seatTeam(winner) === seatTeam(seat);

  // Partition legal moves
  const trumpCards = trumpSuit ? legal.filter((c) => c.suit === trumpSuit) : [];
  const ledSuitCards = legal.filter((c) => c.suit === ledSuit);
  const otherCards = legal.filter((c) => c.suit !== ledSuit && c.suit !== trumpSuit);

  // Partner is winning — contribute as many points as possible without risking the trick
  if (partnerWinning) {
    // Play the highest point card that won't win the trick away from partner in a harmful way
    // Simplification: play highest point card
    return maxBy(legal, cardPointValue);
  }

  // Opponent is winning the trick
  // If we have led-suit cards, we must follow — try to win
  if (ledSuitCards.length > 0) {
    const winning = ledSuitCards.filter((c) => beatsCurrentWinner(c, trick, trump));
    if (winning.length > 0) return minBy(winning, (c) => cardSuitPower(c)); // win cheaply
    return minBy(ledSuitCards, cardPointValue); // can't win, dump lowest point
  }

  // We must trump (or can play anything)
  if (trumpCards.length > 0) {
    const overtrumps = trumpCards.filter((c) => beatsCurrentWinner(c, trick, trump));
    if (overtrumps.length > 0) return minBy(overtrumps, cardTrumpPower); // minimum winning trump
    return minBy(trumpCards, cardPointValue); // can't overtrump, dump lowest trump
  }

  // Nothing forced — dump lowest point card
  return minBy(legal, cardPointValue);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isSuit(trump: TrumpDeclaration): trump is Suit {
  return trump !== 'botifarra';
}

function currentWinnerSeat(
  trick: RoundState['currentTrick'],
  trump: TrumpDeclaration,
): Seat | null {
  if (trick.length === 0) return null;
  const ledSuit = trick[0]!.card.suit;
  const trumpSuit = isSuit(trump) ? trump : null;

  let winner = trick[0]!;
  for (let i = 1; i < trick.length; i++) {
    if (cardBeats(trick[i]!.card, winner.card, ledSuit, trumpSuit)) {
      winner = trick[i]!;
    }
  }
  return winner.seat;
}

function beatsCurrentWinner(
  card: Card,
  trick: RoundState['currentTrick'],
  trump: TrumpDeclaration,
): boolean {
  if (trick.length === 0) return true;
  const ledSuit = trick[0]!.card.suit;
  const trumpSuit = isSuit(trump) ? trump : null;
  const winnerCard = (() => {
    let w = trick[0]!;
    for (let i = 1; i < trick.length; i++) {
      if (cardBeats(trick[i]!.card, w.card, ledSuit, trumpSuit)) w = trick[i]!;
    }
    return w.card;
  })();
  return cardBeats(card, winnerCard, ledSuit, trumpSuit);
}

function cardBeats(
  challenger: Card,
  current: Card,
  ledSuit: string,
  trumpSuit: string | null,
): boolean {
  const cTrump = trumpSuit !== null && challenger.suit === trumpSuit;
  const wTrump = trumpSuit !== null && current.suit === trumpSuit;
  if (cTrump && !wTrump) return true;
  if (!cTrump && wTrump) return false;
  if (cTrump && wTrump) return cardTrumpPower(challenger) > cardTrumpPower(current);
  if (challenger.suit !== ledSuit) return false;
  if (current.suit !== ledSuit) return true;
  return cardSuitPower(challenger) > cardSuitPower(current);
}

function maxBy<T>(arr: T[], fn: (x: T) => number): T {
  return arr.reduce((best, x) => (fn(x) > fn(best) ? x : best));
}

function minBy<T>(arr: T[], fn: (x: T) => number): T {
  return arr.reduce((best, x) => (fn(x) < fn(best) ? x : best));
}
