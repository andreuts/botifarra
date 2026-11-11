import type { TimerState } from '../store/gameStore.js';

export const DECLARATION_TURN_MS = 30_000;
export const CARD_TURN_MS = 15_000;
export const CONTRA_TIMEOUT_MS = 30_000;

/** Remaining time on the fixed decision clock. */
export function remainingTurnTimeMs(timer: Pick<TimerState, 'baseTurnMs'>): number {
  if (timer.baseTurnMs < 0) return 0;
  return Math.max(0, timer.baseTurnMs);
}
