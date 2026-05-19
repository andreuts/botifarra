import { useState, useEffect, useRef } from 'react';
import type { TimerState } from '../store/gameStore.js';

/**
 * Takes timer snapshots arriving ~1/s from the server and interpolates them
 * at 50 ms on the client for smooth bar/countdown animation.
 *
 * Active seat: baseTurnMs >= 0
 *   - While baseTurnMs > 0: the 15-second turn timer is counting down.
 *   - When baseTurnMs hits 0: the 1-minute round budget starts consuming.
 *
 * Inactive seats: baseTurnMs = -1  → only their static roundBudgetMs is shown.
 */
export function useInterpolatedTimers(serverTimers: TimerState[] | null): TimerState[] | null {
  const snapshotRef = useRef<{ timers: TimerState[]; at: number } | null>(null);
  const [local, setLocal] = useState<TimerState[] | null>(serverTimers);

  // When the server sends a new batch, store a timestamped snapshot
  useEffect(() => {
    if (!serverTimers) {
      snapshotRef.current = null;
      setLocal(null);
      return;
    }
    snapshotRef.current = { timers: serverTimers, at: Date.now() };
    setLocal(serverTimers);
  }, [serverTimers]);

  // Client-side interpolation at 50 ms — reads from the ref so the interval
  // never needs to be torn down when new snapshots arrive.
  useEffect(() => {
    const id = setInterval(() => {
      const snap = snapshotRef.current;
      if (!snap) return;

      const dt = Date.now() - snap.at;

      setLocal(
        snap.timers.map((t) => {
          if (t.baseTurnMs < 0) {
            // Inactive seat — budget doesn't change between server snapshots
            return t;
          }
          // Active seat: count down 15-s turn timer, then consume round budget
          const newBase = Math.max(0, t.baseTurnMs - dt);
          const budgetElapsed = Math.max(0, dt - t.baseTurnMs); // only after base expires
          const newBudget = Math.max(0, t.roundBudgetMs - budgetElapsed);
          return { ...t, baseTurnMs: newBase, roundBudgetMs: newBudget };
        }),
      );
    }, 50);

    return () => clearInterval(id);
  }, []); // runs once; reads snapshotRef which is always current

  return local;
}
