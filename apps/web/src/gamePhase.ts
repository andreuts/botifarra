import type { PlayerGameStateDTO } from '@botifarra/shared';

type ContraPhaseState = Pick<
  PlayerGameStateDTO,
  'trump' | 'contraLevel' | 'currentTrick' | 'completedTricks' | 'declarantSeat'
> & Pick<PlayerGameStateDTO, 'contraDecidingTeam'>;

/** Returns the team that may call contra, or null once play has begun or escalation is over. */
export function getContraDecidingTeam(gameState: ContraPhaseState): 0 | 1 | null {
  // The server provides this explicitly so a team can pass on its contra
  // decision before the first card is played. Older snapshots omit the field;
  // retain the derived behavior for those payloads.
  if ('contraDecidingTeam' in gameState) return gameState.contraDecidingTeam ?? null;

  const { trump, currentTrick, completedTricks, declarantSeat } = gameState;
  const contraLevel = gameState.contraLevel ?? 0;
  const nextLevel = contraLevel + 1;

  if (
    trump === null ||
    currentTrick.length > 0 ||
    completedTricks.length > 0 ||
    contraLevel >= 3 ||
    (nextLevel === 3 && trump === 'botifarra')
  ) {
    return null;
  }

  const declarantTeam = (declarantSeat % 2) as 0 | 1;
  if (nextLevel === 2) return declarantTeam;
  return declarantTeam === 0 ? 1 : 0;
}
