import { useEffect, useRef, useState } from 'react';
import { normalizeTimerValues, type TimerSnapshot, type TimerState } from '../store/gameStore.js';

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
    return { ...timer, baseTurnMs };
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
      };
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

    const sourceTimers = normalizeTimerValues(source.timers);
    if (!sourceTimers) return;
    const sourceServerTime = Number.isFinite(source.serverTime) ? source.serverTime : null;
    const sourceTimerEpoch = Number.isFinite(source.timerEpoch) ? source.timerEpoch : null;
    const sourceTrickPauseRemainingMs = Number.isFinite(source.trickPauseRemainingMs)
      ? source.trickPauseRemainingMs
      : null;
    const sourceReceivedAt = Number.isFinite(source.receivedAt) ? source.receivedAt : monotonicNow();

    const previous = snapshotRef.current;
    if (
      previous &&
      previous.serverTime !== null &&
      sourceServerTime !== null &&
      sourceServerTime < previous.serverTime
    ) {
      return; // Ignore an out-of-order timer packet.
    }

    let at = sourceReceivedAt;
    if (sourceServerTime !== null) {
      const observedOffset = sourceReceivedAt - sourceServerTime;
      if (Number.isFinite(observedOffset)) {
        serverToClientOffsetRef.current = serverToClientOffsetRef.current === null
          ? observedOffset
          : Math.min(serverToClientOffsetRef.current, observedOffset);
        at = sourceServerTime + serverToClientOffsetRef.current;
      }
    }

    const serverElapsed = previous
      ? sourceServerTime !== null && previous.serverTime !== null
        ? Math.max(0, sourceServerTime - previous.serverTime)
        : Math.max(0, sourceReceivedAt - previous.receivedAt)
      : 0;
    const previousAtNewTime = previous ? advance(previous.timers, serverElapsed) : null;
    const clockRestarted =
      !previous ||
      activeKey(sourceTimers) !== activeKey(previous.timers) ||
      (sourceTimerEpoch !== null &&
        previous.timerEpoch !== null &&
        sourceTimerEpoch !== previous.timerEpoch);
    const timers = previous && previousAtNewTime && !clockRestarted
      ? keepCountdownMonotonic(sourceTimers, previousAtNewTime)
      : sourceTimers;
    const previousPauseAtNewTime = previous?.trickPauseRemainingMs === null || !previous
      ? null
      : Math.max(0, previous.trickPauseRemainingMs - serverElapsed);
    const trickPauseRemainingMs =
      !clockRestarted &&
      sourceTrickPauseRemainingMs !== null &&
      previousPauseAtNewTime !== null
        ? Math.min(sourceTrickPauseRemainingMs, previousPauseAtNewTime)
        : sourceTrickPauseRemainingMs;

    const nextSnapshot: InterpolationSnapshot = {
      timers,
      trickPauseRemainingMs,
      at,
      serverTime: sourceServerTime,
      timerEpoch: sourceTimerEpoch,
      receivedAt: sourceReceivedAt,
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
