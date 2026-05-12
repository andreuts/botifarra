import type { Card, Seat, TrickCard, TrumpDeclaration } from './types.js';
import { cardTrumpPower, cardSuitPower } from './deck.js';
import { seatTeam } from './types.js';

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
 * Rules (official Botifarra, rule 12):
 *
 * 1. Leading (empty trick) → any card.
 * 2. Must follow the led suit if possible.
 *    a. If partner is currently winning: just follow suit (no must-kill obligation).
 *    b. If opponent is currently winning with a led-suit card: must beat it if possible.
 *    c. If opponent is winning with a trump: follow suit (can’t beat a trump with a non-trump).
 * 3. Led suit IS trump: must follow trump and overtrump if possible (unless partner winning).
 * 4. Void in led suit:
 *    a. Trump available: must trump. Must overtrump if possible (unless partner winning).
 *    b. No trump (or botifarra): play any card.
 * 5. Botifarra (no trump): follow suit if possible; else any card.
 */
export function legalMoves({
  hand,
  currentTrick,
  trump,
  playerSeat = 0,
}: LegalMovesInput): Card[] {
  // Leading: no cards have been played yet
  if (currentTrick.length === 0) return [...hand];

  const ledSuit = currentTrick[0]!.card.suit;
  const trumpStr = trump !== 'botifarra' ? trump as string : '';
  const isTrumpLed = trumpStr !== '' && ledSuit === trumpStr;

  // Cards in hand that match the led suit
  const sameSuit = hand.filter((c) => c.suit === ledSuit);

  // Determine who is currently winning the trick
  const currentWinner = trickWinner(currentTrick, trumpStr);
  const partnerWinning = currentWinner !== null && seatTeam(currentWinner) === seatTeam(playerSeat);
  const opponentWinning = currentWinner !== null && !partnerWinning;

  if (sameSuit.length > 0) {
    // Must follow led suit.
    if (isTrumpLed) {
      // Led suit is trump — overtrump if possible (unless partner winning)
      return overtrumpOrAll(sameSuit, currentTrick, trumpStr, playerSeat);
    }

    if (opponentWinning) {
      // Rule 12b: opponent winning — must beat their card within the led suit if possible.
      // Note: if opponent is winning with a trump, you can’t beat it with a non-trump card.
      const winnerCard = currentTrick.find((tc) => tc.seat === currentWinner)!.card;
      const winnerIsTrump = trumpStr !== '' && winnerCard.suit === trumpStr;

      if (!winnerIsTrump && winnerCard.suit === ledSuit) {
        // Opponent winning with a led-suit card — must play higher if available
        const winnerPower = cardSuitPower(winnerCard);
        const beating = sameSuit.filter((c) => cardSuitPower(c) > winnerPower);
        return beating.length > 0 ? beating : sameSuit;
      }
    }

    // Partner winning or first card — just follow suit, no overbeat obligation
    return sameSuit;
  }

  // Void in led suit
  if (trump === 'botifarra') {
    // No trump concept — play anything
    return [...hand];
  }

  // Suit trump available?
  const trumpCards = hand.filter((c) => c.suit === trump);
  if (trumpCards.length === 0) {
    // No trump either — play anything
    return [...hand];
  }

  // Must play trump. If partner is winning we are exempt from overtrump obligation.
  return overtrumpOrAll(trumpCards, currentTrick, trump, playerSeat);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Given a set of candidate trump cards, return only those that beat the
 * current highest trump on the table — UNLESS the player's partner is
 * already winning the trick (in which case return all candidates).
 */
function overtrumpOrAll(
  candidates: Card[],
  currentTrick: TrickCard[],
  trump: string,
  playerSeat: Seat,
): Card[] {
  const currentWinner = trickWinner(currentTrick, trump);

  // If partner is winning, no obligation to overtrump
  if (currentWinner !== null && seatTeam(currentWinner) === seatTeam(playerSeat)) {
    return candidates;
  }

  const highestTrumpPower = maxTrumpPowerInTrick(currentTrick, trump);
  const overtrumps = candidates.filter((c) => cardTrumpPower(c) > highestTrumpPower);

  return overtrumps.length > 0 ? overtrumps : candidates;
}

/** Returns the seat currently winning the trick, or null if trick is empty. */
function trickWinner(trick: TrickCard[], trump: string): Seat | null {
  if (trick.length === 0) return null;

  const ledSuit = trick[0]!.card.suit;
  let winner = trick[0]!;

  for (let i = 1; i < trick.length; i++) {
    const challenger = trick[i]!;
    if (beats(challenger.card, winner.card, ledSuit, trump)) {
      winner = challenger;
    }
  }
  return winner.seat;
}

/** Returns true if `challenger` beats `current` given led suit and trump. */
function beats(challenger: Card, current: Card, ledSuit: string, trump: string): boolean {
  const challengerIsTrump = trump !== 'botifarra' && challenger.suit === trump;
  const currentIsTrump = trump !== 'botifarra' && current.suit === trump;

  if (challengerIsTrump && !currentIsTrump) return true;
  if (!challengerIsTrump && currentIsTrump) return false;

  // Both trump or both non-trump
  if (challengerIsTrump && currentIsTrump) {
    return cardTrumpPower(challenger) > cardTrumpPower(current);
  }

  // Neither is trump — challenger must follow led suit to win
  if (challenger.suit !== ledSuit) return false;
  if (current.suit !== ledSuit) return true;

  return cardSuitPower(challenger) > cardSuitPower(current);
}

/** Highest trump power already played in the trick (0 if none). */
function maxTrumpPowerInTrick(trick: TrickCard[], trump: string): number {
  let max = 0;
  for (const { card } of trick) {
    if (card.suit === trump) {
      const p = cardTrumpPower(card);
      if (p > max) max = p;
    }
  }
  return max;
}
