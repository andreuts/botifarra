import { useEffect, useRef, useState } from 'react';
import type { TimerSnapshot, TimerState } from '../store/gameStore.js';

interface InterpolationSnapshot {
  timers: TimerState[];
  trickPauseRemainingMs: number | null;
  /** Local monotonic time corresponding to serverTime. */
  at: number;
  serverTime: number | null;
  timerEpoch: number | null;
  receivedAt: number;
}

export interface InterpolatedTimerState {
  timers: TimerState[];
  trickPauseRemainingMs: number | null;
}

function monotonicNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function activeKey(timers: TimerState[]): string {
  return timers
    .filter((timer) => timer.baseTurnMs >= 0)
    .map((timer) => timer.seat)
    .sort()
    .join(',');
}

/** Predict timer values elapsed milliseconds after a server snapshot. */
function advance(timers: TimerState[], elapsedMs: number): TimerState[] {
  const elapsed = Math.max(0, elapsedMs);
  return timers.map((timer) => {
    if (timer.baseTurnMs < 0) return timer;

    const baseTurnMs = Math.max(0, timer.baseTurnMs - elapsed);
    const budgetElapsed = Math.max(0, elapsed - timer.baseTurnMs);
    const roundBudgetMs = Math.max(0, timer.roundBudgetMs - budgetElapsed);
    return { ...timer, baseTurnMs, roundBudgetMs };
  });
}

function interpolate(snapshot: InterpolationSnapshot, now: number): InterpolatedTimerState {
  const elapsed = Math.max(0, now - snapshot.at);
  return {
    timers: advance(snapshot.timers, elapsed),
    trickPauseRemainingMs: snapshot.trickPauseRemainingMs === null
      ? null
      : Math.max(0, snapshot.trickPauseRemainingMs - elapsed),
  };
}

/**
 * Ordinary server updates for the same clock can only reduce remaining time.
 * Clamp small synchronization jitter down so a countdown never jumps upward.
 */
function keepCountdownMonotonic(
  nextTimers: TimerState[],
  previousAtServerTime: TimerState[],
): TimerState[] {
  return nextTimers.map((next) => {
    const previous = previousAtServerTime.find((timer) => timer.seat === next.seat);
    if (!previous) return next;

    if (next.baseTurnMs >= 0 && previous.baseTurnMs >= 0) {
      return {
        ...next,
        baseTurnMs: Math.min(next.baseTurnMs, previous.baseTurnMs),
        roundBudgetMs: Math.min(next.roundBudgetMs, previous.roundBudgetMs),
      };
    }

    if (next.baseTurnMs < 0 && previous.baseTurnMs < 0) {
      return { ...next, roundBudgetMs: Math.min(next.roundBudgetMs, previous.roundBudgetMs) };
    }

    return next;
  });
}

export function useInterpolatedTimers(source: TimerSnapshot | null): InterpolatedTimerState | null {
  const snapshotRef = useRef<InterpolationSnapshot | null>(null);
  const serverToClientOffsetRef = useRef<number | null>(null);
  const [local, setLocal] = useState<InterpolatedTimerState | null>(() => source
    ? { timers: source.timers, trickPauseRemainingMs: source.trickPauseRemainingMs }
    : null);

  // Anchor each authoritative snapshot to the client's monotonic clock. The
  // lowest observed receive/server offset approximates the one-way latency
  // floor, so slow or jittery packets are aged before they reach the UI.
  useEffect(() => {
    if (!source) {
      snapshotRef.current = null;
      serverToClientOffsetRef.current = null;
      setLocal(null);
      return;
    }

    const previous = snapshotRef.current;
    if (
      previous &&
      previous.serverTime !== null &&
      source.serverTime !== null &&
      source.serverTime < previous.serverTime
    ) {
      return; // Ignore an out-of-order timer packet.
    }

    let at = source.receivedAt;
    if (source.serverTime !== null) {
      const observedOffset = source.receivedAt - source.serverTime;
      serverToClientOffsetRef.current = serverToClientOffsetRef.current === null
        ? observedOffset
        : Math.min(serverToClientOffsetRef.current, observedOffset);
      at = source.serverTime + serverToClientOffsetRef.current;
    }

    const serverElapsed = previous
      ? source.serverTime !== null && previous.serverTime !== null
        ? Math.max(0, source.serverTime - previous.serverTime)
        : Math.max(0, source.receivedAt - previous.receivedAt)
      : 0;
    const previousAtNewTime = previous ? advance(previous.timers, serverElapsed) : null;
    const clockRestarted =
      !previous ||
      activeKey(source.timers) !== activeKey(previous.timers) ||
      (source.timerEpoch !== null &&
        previous.timerEpoch !== null &&
        source.timerEpoch !== previous.timerEpoch);
    const timers = previous && previousAtNewTime && !clockRestarted
      ? keepCountdownMonotonic(source.timers, previousAtNewTime)
      : source.timers;
    const previousPauseAtNewTime = previous?.trickPauseRemainingMs === null || !previous
      ? null
      : Math.max(0, previous.trickPauseRemainingMs - serverElapsed);
    const trickPauseRemainingMs =
      !clockRestarted &&
      source.trickPauseRemainingMs !== null &&
      previousPauseAtNewTime !== null
        ? Math.min(source.trickPauseRemainingMs, previousPauseAtNewTime)
        : source.trickPauseRemainingMs;

    const nextSnapshot: InterpolationSnapshot = {
      timers,
      trickPauseRemainingMs,
      at,
      serverTime: source.serverTime,
      timerEpoch: source.timerEpoch,
      receivedAt: source.receivedAt,
    };
    snapshotRef.current = nextSnapshot;
    setLocal(interpolate(nextSnapshot, monotonicNow()));
  }, [source]);

  // Recalculate from the anchored snapshot instead of decrementing a local
  // counter. This avoids interval drift and works correctly after tab sleeps.
  useEffect(() => {
    const id = window.setInterval(() => {
      const snapshot = snapshotRef.current;
      if (!snapshot) return;
      setLocal(interpolate(snapshot, monotonicNow()));
    }, 50);

    return () => window.clearInterval(id);
  }, []);

  return local;
}
