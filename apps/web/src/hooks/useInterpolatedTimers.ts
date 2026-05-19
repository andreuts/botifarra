import { useState, useEffect, useRef, useCallback } from 'react';
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
 *
 * To avoid 1-second jitter, the snapshot is only replaced when:
 *   - The set of active seats changes (turn rotated), OR
 *   - The client-interpolated value has drifted >2 s from the server's value.
 * Otherwise the client just keeps counting down from the existing snapshot.
 */

/** Fingerprint that identifies which seats are active */
function activeKey(timers: TimerState[]): string {
  return timers
    .filter((t) => t.baseTurnMs >= 0)
    .map((t) => t.seat)
    .sort()
    .join(',');
}

/** Check if the server values differ from what the client would predict by >2s */
function hasDrifted(
  snap: { timers: TimerState[]; at: number },
  server: TimerState[],
): boolean {
  const dt = Date.now() - snap.at;
  for (const st of server) {
    if (st.baseTurnMs < 0) continue;
    const local = snap.timers.find((t) => t.seat === st.seat);
    if (!local || local.baseTurnMs < 0) return true; // seat became active
    // What the client thinks baseTurnMs should be now
    const predictedBase = Math.max(0, local.baseTurnMs - dt);
    if (Math.abs(predictedBase - st.baseTurnMs) > 2000) return true;
  }
  return false;
}

export function useInterpolatedTimers(serverTimers: TimerState[] | null): TimerState[] | null {
  const snapshotRef = useRef<{ timers: TimerState[]; at: number } | null>(null);
  const prevKeyRef = useRef<string>('');

  // Seed with the first server value so the bar appears immediately on mount
  const [local, setLocal] = useState<TimerState[] | null>(() => {
    if (serverTimers) {
      snapshotRef.current = { timers: serverTimers, at: Date.now() };
      prevKeyRef.current = activeKey(serverTimers);
    }
    return serverTimers;
  });

  // When the server sends a new batch, decide whether to accept the new snapshot
  // or keep the existing one (to avoid 1-second jumps).
  useEffect(() => {
    if (!serverTimers) {
      snapshotRef.current = null;
      prevKeyRef.current = '';
      setLocal(null);
      return;
    }

    const newKey = activeKey(serverTimers);
    const snap = snapshotRef.current;

    // Accept new snapshot if:
    // 1. No existing snapshot (first load / reconnect)
    // 2. Active seats changed (turn moved to someone else)
    // 3. Values have drifted significantly (correction needed)
    if (!snap || newKey !== prevKeyRef.current || hasDrifted(snap, serverTimers)) {
      snapshotRef.current = { timers: serverTimers, at: Date.now() };
      prevKeyRef.current = newKey;
    }
    // Otherwise: keep existing snapshot, client continues smooth countdown
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
