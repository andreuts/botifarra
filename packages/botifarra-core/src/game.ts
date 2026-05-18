import type { RoundScore, Seat, Team } from './types.js';

// ---------------------------------------------------------------------------
// Game types
// ---------------------------------------------------------------------------

export type GamePhase = 'waiting' | 'in-progress' | 'finished';

export interface GameState {
  /** Target match-points to win the game. Common value: 12. */
  readonly targetScore: number;
  /** Accumulated match-points per team [team0, team1]. */
  readonly scores: [number, number];
  /** Current dealer seat. Rotates clockwise after every round. */
  readonly dealerSeat: Seat;
  /** Winning team once game is finished; null otherwise. */
  readonly winner: Team | null;
  /** Round number (0-based). */
  readonly roundNumber: number;
}

// ---------------------------------------------------------------------------
// Phase helper
// ---------------------------------------------------------------------------

export function getGamePhase(game: GameState): GamePhase {
  if (game.winner !== null) return 'finished';
  if (game.roundNumber === 0) return 'waiting';
  return 'in-progress';
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateGameOptions {
  /** Match-points required to win. Defaults to 12. */
  targetScore?: number;
}

export function createGame({ targetScore = 101 }: CreateGameOptions = {}): GameState {
  return {
    targetScore,
    scores: [0, 0],
    dealerSeat: 0,
    winner: null,
    roundNumber: 0,
  };
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/**
 * Advances the dealer seat and marks the game as in-progress for the next round.
 * After the first call the round number increments; dealer rotates on subsequent calls.
 */
export function startNextRound(game: GameState): GameState {
  if (game.winner !== null) {
    throw new Error('Game is already finished');
  }
  const nextDealer = ((game.dealerSeat + 1) % 4) as Seat;

  return {
    ...game,
    dealerSeat: nextDealer,
    roundNumber: game.roundNumber + 1,
  };
}

/**
 * Applies the score from a completed round and determines if the game is over.
 * The team that first reaches `targetScore` wins.
 * If both teams reach it in the same round the team with more points wins;
 * if tied, play another round.
 */
export function applyRoundScore(game: GameState, score: RoundScore): GameState {
  if (game.winner !== null) {
    throw new Error('Cannot apply score — game is already finished');
  }

  const newScores: [number, number] = [
    game.scores[0] + score.matchPoints[0],
    game.scores[1] + score.matchPoints[1],
  ];

  let winner: Team | null = null;
  const t0Wins = newScores[0] >= game.targetScore;
  const t1Wins = newScores[1] >= game.targetScore;

  if (t0Wins && t1Wins) {
    // Both reach target in the same round — highest score wins; tie → no winner yet
    if (newScores[0] > newScores[1]) winner = 0;
    else if (newScores[1] > newScores[0]) winner = 1;
  } else if (t0Wins) {
    winner = 0;
  } else if (t1Wins) {
    winner = 1;
  }

  return { ...game, scores: newScores, winner };
}
