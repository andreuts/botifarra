/**
 * Tournament pairing algorithms.
 *
 * - Eliminatory: standard single-elimination bracket
 * - Swiss: pair by similar standings, avoid rematches
 */

interface CoupleStanding {
  coupleId: string;
  points: number;
}

interface PreviousMatchup {
  couple0Id: string;
  couple1Id: string;
}

export interface Pairing {
  couple0Id: string;
  couple1Id: string | null; // null = bye
}

// ---------------------------------------------------------------------------
// Eliminatory bracket
// ---------------------------------------------------------------------------

/**
 * Generate first-round pairings for an eliminatory tournament.
 * Seeded by registration order. Handles odd count with a bye.
 */
export function generateEliminatoryFirstRound(coupleIds: string[]): Pairing[] {
  const pairings: Pairing[] = [];
  for (let i = 0; i < coupleIds.length; i += 2) {
    if (i + 1 < coupleIds.length) {
      pairings.push({ couple0Id: coupleIds[i]!, couple1Id: coupleIds[i + 1]! });
    } else {
      // Bye for the last couple
      pairings.push({ couple0Id: coupleIds[i]!, couple1Id: null });
    }
  }
  return pairings;
}

/**
 * Generate next round of eliminatory from winners of the previous round.
 */
export function generateEliminatoryNextRound(winnerIds: string[]): Pairing[] {
  return generateEliminatoryFirstRound(winnerIds);
}

// ---------------------------------------------------------------------------
// Swiss pairing
// ---------------------------------------------------------------------------

/**
 * Swiss-style pairing: sort by points descending, pair adjacent, avoid rematches.
 * If odd number, the lowest-ranked couple gets a bye.
 */
export function generateSwissPairings(
  standings: CoupleStanding[],
  previousMatchups: PreviousMatchup[],
): Pairing[] {
  // Sort by points descending
  const sorted = [...standings].sort((a, b) => b.points - a.points);

  const pairings: Pairing[] = [];
  const paired = new Set<string>();

  // Build a set of previous matchup pairs for lookup
  const matchupSet = new Set<string>();
  for (const m of previousMatchups) {
    matchupSet.add(matchupKey(m.couple0Id, m.couple1Id));
  }

  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i]!;
    if (paired.has(c.coupleId)) continue;

    // Find best opponent: closest in ranking, not already played
    let bestOpponent: string | null = null;
    for (let j = i + 1; j < sorted.length; j++) {
      const candidate = sorted[j]!;
      if (paired.has(candidate.coupleId)) continue;
      if (!matchupSet.has(matchupKey(c.coupleId, candidate.coupleId))) {
        bestOpponent = candidate.coupleId;
        break;
      }
    }

    // If no non-repeated opponent found, accept a rematch
    if (!bestOpponent) {
      for (let j = i + 1; j < sorted.length; j++) {
        const candidate = sorted[j]!;
        if (paired.has(candidate.coupleId)) continue;
        bestOpponent = candidate.coupleId;
        break;
      }
    }

    if (bestOpponent) {
      pairings.push({ couple0Id: c.coupleId, couple1Id: bestOpponent });
      paired.add(c.coupleId);
      paired.add(bestOpponent);
    } else {
      // Odd couple — gets a bye
      pairings.push({ couple0Id: c.coupleId, couple1Id: null });
      paired.add(c.coupleId);
    }
  }

  return pairings;
}

function matchupKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}
