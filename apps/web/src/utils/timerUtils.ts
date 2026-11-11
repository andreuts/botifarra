import type { TimerState } from '../store/gameStore.js';

export const DECLARATION_TURN_MS = 30_000;
export const CARD_TURN_MS = 10_000;
export const CONTRA_TIMEOUT_MS = 15_000;
export const ROUND_BUDGET_MS = 60_000;
export const MAX_DECLARATION_TIME_MS = DECLARATION_TURN_MS + ROUND_BUDGET_MS;
export const MAX_CARD_TIME_MS = CARD_TURN_MS + ROUND_BUDGET_MS;

/** The active clock is the base turn allowance plus the player's remaining overtime budget. */
export function remainingTurnTimeMs(timer: Pick<TimerState, 'baseTurnMs' | 'roundBudgetMs'>): number {
  if (timer.baseTurnMs < 0) return 0;
  return Math.max(0, timer.baseTurnMs) + Math.max(0, timer.roundBudgetMs);
}
