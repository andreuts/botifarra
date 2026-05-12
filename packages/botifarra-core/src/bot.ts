import type { Card, RoundState, Seat, TrumpDeclaration } from './types.js';
import { legalMoves } from './legal-moves.js';
import { getRoundPhase, currentPlayerSeat } from './round.js';

/**
 * Bot interface — all bots receive the same inputs and return the same output types.
 * This ensures bots can never bypass the server's legal-move validation.
 */

// ---------------------------------------------------------------------------
// Trump declaration
// ---------------------------------------------------------------------------

const DECLARABLE: TrumpDeclaration[] = ['oros', 'copes', 'espases', 'bastos', 'botifarra'];

/**
 * Picks a random initial trump declaration.
 * Called only when `round.trump` is null (declaring phase).
 */
export function randomBotDeclareTrump(_round: RoundState): TrumpDeclaration {
  return DECLARABLE[Math.floor(Math.random() * DECLARABLE.length)]!;
}

// ---------------------------------------------------------------------------
// Card play
// ---------------------------------------------------------------------------

/**
 * Returns a random legal card for `seat` to play.
 * Throws if the round is not in the playing phase or it is not `seat`'s turn.
 */
export function randomBotMove(round: RoundState, seat: Seat): Card {
  if (getRoundPhase(round) !== 'playing') {
    throw new Error('randomBotMove called outside of the playing phase');
  }

  const expected = currentPlayerSeat(round);
  if (expected !== seat) {
    throw new Error(`Not seat ${seat}'s turn (expected ${expected})`);
  }

  const legal = legalMoves({
    hand: round.hands[seat],
    currentTrick: round.currentTrick,
    trump: round.trump!,
    playerSeat: seat,
  });

  if (legal.length === 0) {
    throw new Error('No legal moves available — this should never happen');
  }

  return legal[Math.floor(Math.random() * legal.length)]!;
}
