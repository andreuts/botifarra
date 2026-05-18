import type { CompletedTrick, ContraLevel, RoundScore, Team, TrumpDeclaration } from './types.js';
import { cardPointValue } from './deck.js';
import { seatTeam } from './types.js';

/**
 * Computes the score for a completed round (12 tricks).
 *
 * Scoring rules (official Botifarra):
 *   - Each trick won = 1 point.
 *   - Card points: Manilla(9)=5, As(1)=4, Rei(12)=3, Cavall(11)=2, Sota(10)=1, rest=0.
 *   - Total per round: 60 card pts + 12 trick pts = 72.
 *   - Winning team: the one with more than 36 points.
 *   - Match-points scored = (teamTotal − 36) × multiplier.
 *   - If tied at 36–36: neither team scores.
 *
 * Multiplier:
 *   - Base: 1 for a normal trump suit, 2 for botifarra.
 *   - Contra escalation: ×2^contraLevel on top of base.
 *     contraLevel 0=none, 1=contra(×2), 2=recontro(×4), 3=sant vicenç(×8).
 *   - Combined: base × 2^contraLevel.
 *
 * @throws if `tricks` does not contain exactly 12 entries.
 */
export function scoreRound(
  tricks: CompletedTrick[],
  trump: TrumpDeclaration,
  contraLevel: ContraLevel = 0,
): RoundScore {
  if (tricks.length !== 12) {
    throw new Error(`scoreRound expects exactly 12 completed tricks, got ${tricks.length}`);
  }

  // Count total points per team (card values + 1 per trick won)
  const teamPoints: [number, number] = [0, 0];
  const tricksPerTeam: [number, number] = [0, 0];

  for (const completedTrick of tricks) {
    const winnerTeam: Team = seatTeam(completedTrick.winner);
    tricksPerTeam[winnerTeam]++;
    teamPoints[winnerTeam]++; // 1 point for winning the trick
    for (const { card } of completedTrick.cards) {
      teamPoints[winnerTeam] += cardPointValue(card);
    }
  }

  // Sanity check: total must be 72
  // (60 card pts + 12 trick pts)

  // Capot: one team won all 12 tricks
  const capot = tricksPerTeam[0] === 12 || tricksPerTeam[1] === 12;

  // Multiplier: base × 2^contraLevel
  const isNullTrump = trump === 'botifarra';
  const baseMultiplier = isNullTrump ? 2 : 1;
  const multiplier = baseMultiplier * Math.pow(2, contraLevel);

  // Match points: winning team scores (their_total − 36) × multiplier
  const matchPoints: [number, number] = [0, 0];
  if (teamPoints[0] > 36) {
    matchPoints[0] = (teamPoints[0] - 36) * multiplier;
  } else if (teamPoints[1] > 36) {
    matchPoints[1] = (teamPoints[1] - 36) * multiplier;
  }
  // 36–36 tie: neither scores

  return { teamPoints, capot, matchPoints, multiplier };
}
