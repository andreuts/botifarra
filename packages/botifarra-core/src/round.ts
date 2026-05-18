import type {
  Card,
  CompletedTrick,
  ContraLevel,
  Hands,
  RoundState,
  Seat,
  TrickCard,
  TrumpDeclaration,
} from './types.js';
import { partnerSeat, seatTeam } from './types.js';
import { legalMoves } from './legal-moves.js';
import { resolveTrick } from './trick.js';

// ---------------------------------------------------------------------------
// Phase helpers
// ---------------------------------------------------------------------------

export type RoundPhase = 'declaring' | 'playing' | 'scoring';

export function getRoundPhase(round: RoundState): RoundPhase {
  if (round.trump === null) return 'declaring';
  if (round.completedTricks.length === 12) return 'scoring';
  return 'playing';
}

/**
 * Returns the seat of the player who should act next.
 * - During declaring phase: null (no card play yet).
 * - During playing: leader then counter-clockwise (−1 mod 4 per card played).
 *
 * Play order is counter-clockwise per the official Botifarra rules.
 * After the leader plays, the next seat is (leader − 1) mod 4, and so on.
 */
export function currentPlayerSeat(round: RoundState): Seat | null {
  if (getRoundPhase(round) !== 'playing') return null;
  // Counter-clockwise: subtract trick length from leader
  return ((((round.currentLeader - round.currentTrick.length) % 4) + 4) % 4) as Seat;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateRoundOptions {
  dealerSeat: Seat;
  hands: Hands;
}

/**
 * Creates a fresh round in the 'declaring' phase.
 *
 * Rules:
 * - The dealer declares trump first (may pass to partner).
 * - The first trick leader is the player to the RIGHT of the dealer,
 *   i.e. one step counter-clockwise: (dealerSeat + 3) % 4.
 * - Play proceeds counter-clockwise from the leader.
 */
export function createRound({ dealerSeat, hands }: CreateRoundOptions): RoundState {
  return {
    dealerSeat,
    declarantSeat: dealerSeat, // dealer declares first
    dealerPassed: false,
    contraLevel: 0,
    trump: null,
    hands: cloneHands(hands),
    completedTricks: [],
    currentLeader: ((dealerSeat + 3) % 4) as Seat, // right of dealer
    currentTrick: [],
  };
}

// ---------------------------------------------------------------------------
// Declaration phase
// ---------------------------------------------------------------------------

/**
 * The dealer passes the declaration obligation to their partner.
 * Only allowed when:
 *   - Round is in declaring phase.
 *   - Dealer has NOT already passed (dealerPassed === false).
 *   - The dealer is still the declarant.
 */
export function passDeclaration(round: RoundState): RoundState {
  if (round.trump !== null) {
    throw new Error('Cannot pass — trump already declared');
  }
  if (round.dealerPassed) {
    throw new Error('Cannot pass — dealer already passed');
  }
  if (round.declarantSeat !== round.dealerSeat) {
    throw new Error("Cannot pass — not the dealer's turn to declare");
  }
  return {
    ...round,
    declarantSeat: partnerSeat(round.dealerSeat),
    dealerPassed: true,
  };
}

/**
 * Records the trump declaration and advances the round to the playing phase.
 *
 * Rules:
 * - The current declarant (dealer or their partner after a pass) must declare.
 */
export function declareTrump(round: RoundState, declaration: TrumpDeclaration): RoundState {
  if (round.trump !== null) {
    throw new Error(`Trump already declared: ${round.trump}`);
  }

  return { ...round, trump: declaration };
}

// ---------------------------------------------------------------------------
// Contra / Recontro / Sant Vicenç
// ---------------------------------------------------------------------------

/**
 * Escalates the contra level.
 *
 * Rules:
 * - Can only be called once trump is declared and before the first card is played.
 * - Teams alternate: contra by non-declarant, recontro by declarant, sant vicenç by non-declarant.
 * - Sant Vicenç is only available when trump is NOT botifarra.
 * - `callerSeat` must be on the appropriate team for the current escalation.
 */
export function callContra(round: RoundState, callerSeat: Seat): RoundState {
  if (round.trump === null) {
    throw new Error('Cannot contra before trump is declared');
  }
  if (round.currentTrick.length > 0 || round.completedTricks.length > 0) {
    throw new Error('Cannot contra after play has started');
  }

  const nextLevel = (round.contraLevel + 1) as ContraLevel;
  if (nextLevel > 3) {
    throw new Error('Maximum contra level already reached');
  }

  // Sant Vicenç (level 3) is only available when trump is NOT botifarra
  if (nextLevel === 3 && round.trump === 'botifarra') {
    throw new Error('Sant Vicenç is not available when trump is botifarra');
  }

  // The team that must call is determined by the level:
  //   Level 1 (contra): non-declarant team
  //   Level 2 (recontro): declarant team
  //   Level 3 (sant vicenç): non-declarant team
  const declarantTeam = seatTeam(round.declarantSeat);
  const callerTeam = seatTeam(callerSeat);
  const mustBeDeclarantTeam = nextLevel === 2; // recontro is by declarant team
  const teamOk = mustBeDeclarantTeam ? callerTeam === declarantTeam : callerTeam !== declarantTeam;

  if (!teamOk) {
    throw new Error(`Wrong team for contra level ${nextLevel}`);
  }

  return { ...round, contraLevel: nextLevel };
}

// ---------------------------------------------------------------------------
// playCard
// ---------------------------------------------------------------------------

/**
 * Plays `card` for `seat` and returns the updated round state.
 *
 * Validates:
 * - Round is in playing phase.
 * - It is `seat`'s turn.
 * - `card` is in `seat`'s hand.
 * - `card` is among the legal moves for this position.
 */
export function playCard(round: RoundState, seat: Seat, card: Card): RoundState {
  if (getRoundPhase(round) !== 'playing') {
    throw new Error('Cannot play a card — round is not in playing phase');
  }

  const expected = currentPlayerSeat(round);
  if (expected !== seat) {
    throw new Error(`It is seat ${expected}'s turn, not seat ${seat}`);
  }

  const hand = round.hands[seat];
  const cardIndex = hand.findIndex((c) => c.suit === card.suit && c.rank === card.rank);
  if (cardIndex === -1) {
    throw new Error(`Card ${card.suit}-${card.rank} not found in seat ${seat}'s hand`);
  }

  // Legal move validation
  const legal = legalMoves({
    hand,
    currentTrick: round.currentTrick,
    trump: round.trump!,
    playerSeat: seat,
  });
  const isLegal = legal.some((c) => c.suit === card.suit && c.rank === card.rank);
  if (!isLegal) {
    throw new Error(`Card ${card.suit}-${card.rank} is not a legal move`);
  }

  // Remove card from hand
  const newHand = [...hand];
  newHand.splice(cardIndex, 1);

  const newTrickCard: TrickCard = { seat, card };
  const newTrick = [...round.currentTrick, newTrickCard];

  // Build new hands
  const newHands: Hands = { ...round.hands, [seat]: newHand };

  // If trick is complete (4 cards played), resolve it
  if (newTrick.length === 4) {
    const completed = resolveTrick(
      newTrick as [TrickCard, TrickCard, TrickCard, TrickCard],
      round.trump!,
    );
    const newCompleted: CompletedTrick[] = [...round.completedTricks, completed];

    return {
      ...round,
      hands: newHands,
      completedTricks: newCompleted,
      currentLeader: completed.winner,
      currentTrick: [],
    };
  }

  return {
    ...round,
    hands: newHands,
    currentTrick: newTrick,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function cloneHands(hands: Hands): Hands {
  return {
    0: [...hands[0]],
    1: [...hands[1]],
    2: [...hands[2]],
    3: [...hands[3]],
  };
}
