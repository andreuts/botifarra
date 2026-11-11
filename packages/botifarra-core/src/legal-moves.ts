import type { Card, Seat, TrickCard, TrumpDeclaration } from './types.js';
import { cardPointValue, cardTrumpPower, cardSuitPower } from './deck.js';
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
 * Rules (eastern / obligada variant):
 *
 * Follow suit first. If the partner is not winning, beat the current winner if
 * possible, including trumping or overtrumping when void in the led suit.
 * Otherwise, a non-winning play must be the lowest card of its suit. When the
 * partner is winning, a counting card may be played instead; the second player
 * who is void in the led suit has the same counting-card exception.
 */
export function legalMoves({ hand, currentTrick, trump, playerSeat = 0 }: LegalMovesInput): Card[] {
  // Leading: no cards have been played yet
  if (currentTrick.length === 0) return [...hand];

  const ledSuit = currentTrick[0]!.card.suit;
  const trumpStr = trump !== 'botifarra' ? (trump as string) : '';
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
      return obligadaMoves(
        overtrumpOrAll(sameSuit, currentTrick, trumpStr, playerSeat),
        hand,
        currentTrick,
        trumpStr,
        playerSeat,
      );
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
        if (beating.length > 0) return beating;
      }

      return obligadaMoves(sameSuit, hand, currentTrick, trumpStr, playerSeat);
    }

    // Partner winning: overtake only if desired; otherwise apply obligada.
    return obligadaMoves(sameSuit, hand, currentTrick, trumpStr, playerSeat);
  }

  // Void in led suit
  if (trump === 'botifarra') {
    // No trump concept, but obligada's discard restrictions still apply.
    return obligadaMoves([...hand], hand, currentTrick, trumpStr, playerSeat);
  }

  // There is no obligation to overtake a partner who is already winning.
  if (partnerWinning) return obligadaMoves([...hand], hand, currentTrick, trumpStr, playerSeat);

  // Suit trump available?
  const trumpCards = hand.filter((c) => c.suit === trump);
  if (trumpCards.length === 0) {
    // No trump available to beat the opponents; apply obligada to the discard.
    return obligadaMoves([...hand], hand, currentTrick, trumpStr, playerSeat);
  }

  // An opponent is winning: trump if it beats the current winner, and
  // overtrump if a trump is already winning.
  const highestTrumpPower = maxTrumpPowerInTrick(currentTrick, trump);
  const overtrumps = trumpCards.filter((c) => cardTrumpPower(c) > highestTrumpPower);
  return obligadaMoves(overtrumps.length > 0 ? overtrumps : [...hand], hand, currentTrick, trumpStr, playerSeat);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Applies obligada's lowest-card rules to candidate plays that do not win. */
function obligadaMoves(
  candidates: Card[],
  hand: Card[],
  currentTrick: TrickCard[],
  trump: string,
  playerSeat: Seat,
): Card[] {
  const winnerSeat = trickWinner(currentTrick, trump);
  if (winnerSeat === null) return candidates;

  const partnerWinning = seatTeam(winnerSeat) === seatTeam(playerSeat);
  const winnerCard = currentTrick.find((played) => played.seat === winnerSeat)!.card;
  const ledSuit = currentTrick[0]!.card.suit;
  const winningMoves = candidates.filter((card) => beats(card, winnerCard, ledSuit, trump));
  const nonWinningMoves = candidates.filter((card) => !beats(card, winnerCard, ledSuit, trump));
  const secondPlayerVoidInLedSuit =
    !partnerWinning && currentTrick.length === 1 && !hand.some((card) => card.suit === ledSuit);

  const allowedNonWinningMoves = nonWinningMoves.filter((card) => {
    if (partnerWinning && cardPointValue(card) > 0) return true;
    if (isLowestOfSuit(card, hand)) return true;
    return secondPlayerVoidInLedSuit && cardPointValue(card) > 0;
  });

  return [...winningMoves, ...allowedNonWinningMoves];
}

function isLowestOfSuit(card: Card, hand: Card[]): boolean {
  return hand
    .filter((held) => held.suit === card.suit)
    .every((held) => cardSuitPower(card) <= cardSuitPower(held));
}

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
