import type { CompletedTrick, RoundScore, TrumpDeclaration } from './types.js';
/**
 * Computes the score for a completed round (12 tricks).
 *
 * Card points per rank:
 *   As=11, Manilla(9)=9, Rei=4, Cavall=3, Sota=2, rest=0 → total 116 per deck.
 *
 * Match-point rules (simplified standard):
 *   - The declarant's team needs > 58 card points to win the round.
 *   - Capot (winning all 12 tricks): yields an extra match point.
 *   - Exact match-point scale may be extended; base award is 1 per winning round.
 *
 * @throws if `tricks` does not contain exactly 12 entries.
 */
export declare function scoreRound(tricks: CompletedTrick[], trump: TrumpDeclaration): RoundScore;
