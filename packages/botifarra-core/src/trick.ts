import type { Card, CompletedTrick, Seat, TrickCard, TrumpDeclaration } from './types.js';
import { cardTrumpPower, cardSuitPower } from './deck.js';

/**
 * Resolves which seat wins a completed 4-card trick.
 *
 * Rules:
 * 1. The first card played defines the led suit.
 * 2. A trump card always beats a non-trump card.
 * 3. Among trump cards, highest trump power wins.
 * 4. Among non-trump cards of the led suit, highest suit power wins.
 * 5. Off-suit non-trump cards can never win.
 */
export function resolveTrick(
  cards: [TrickCard, TrickCard, TrickCard, TrickCard],
  trump: TrumpDeclaration,
): CompletedTrick {
  const isTrump = (c: Card): boolean => trump !== 'botifarra' && c.suit === trump;

  const ledSuit = cards[0].card.suit;
  let winner = cards[0];

  for (let i = 1; i < cards.length; i++) {
    const challenger = cards[i]!;
    if (cardBeats(challenger.card, winner.card, ledSuit, isTrump)) {
      winner = challenger;
    }
  }

  return {
    cards,
    leader: cards[0].seat,
    winner: winner.seat,
  };
}

function cardBeats(
  challenger: Card,
  current: Card,
  ledSuit: string,
  isTrump: (c: Card) => boolean,
): boolean {
  const cTrump = isTrump(challenger);
  const wTrump = isTrump(current);

  if (cTrump && !wTrump) return true;
  if (!cTrump && wTrump) return false;

  if (cTrump && wTrump) {
    return cardTrumpPower(challenger) > cardTrumpPower(current);
  }

  // Neither trump
  if (challenger.suit !== ledSuit) return false;
  if (current.suit !== ledSuit) return true;

  return cardSuitPower(challenger) > cardSuitPower(current);
}
