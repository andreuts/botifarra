import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../store/authStore.js';

export type QueueState = 'idle' | 'queued' | 'matched';
export type QueueMode = 'single' | 'pair';

/** Seat reservation returned by the server when a match is found */
export interface SeatReservationData {
  sessionId: string;
  room: {
    roomId: string;
    name: string;
    processId: string;
  };
}

const POLL_INTERVAL = 2000; // 2 s

/**
 * Manages joining, polling, and leaving the matchmaking queue.
 * Supports 'single' (solo) and 'pair' (with a teammate) queue modes.
 * When a match is found, navigates to the game page with the seat reservation
 * so the client can use consumeSeatReservation() — bypassing room.locked checks.
 */
export function useMatchmakingQueue() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [state, setState] = useState<QueueState>('idle');
  const [queueSize, setQueueSize] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<QueueMode>('single');
  const [ranked, setRanked] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueVersionRef = useRef(0);
  const activeQueueVersionRef = useRef<number | null>(null);

  const token = user?.accessToken ?? '';

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    const queueVersion = activeQueueVersionRef.current;
    if (queueVersion === null) return;

    try {
      const res = await fetch('/api/matches/queue/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (activeQueueVersionRef.current !== queueVersion) return;
      if (!res.ok) {
        stopPolling();
        return;
      }
      const body = (await res.json()) as {
        inQueue: boolean;
        mode?: QueueMode;
        ranked?: boolean;
        queueSize: number;
        reservation?: SeatReservationData;
      };
      setQueueSize(body.queueSize);
      if (body.mode) setMode(body.mode);
      if (body.reservation) {
        activeQueueVersionRef.current = null;
        stopPolling();
        setState('matched');
        // Pass seat reservation via route state so GamePage can use consumeSeatReservation,
        // which bypasses the room.locked check that would block joinById.
        navigate(`/match/${body.reservation.room.roomId}`, {
          state: { reservation: body.reservation },
        });
      }
    } catch {
      // network hiccup — keep polling
    }
  }, [token, navigate, stopPolling]);

  const joinQueue = useCallback(
    async (queueMode: QueueMode = 'single', partner?: { userId: string; username: string }, isRanked = false) => {
      if (state !== 'idle' || activeQueueVersionRef.current !== null) return;
      const queueVersion = ++queueVersionRef.current;
      activeQueueVersionRef.current = queueVersion;
      setError(null);
      setMode(queueMode);
      setRanked(isRanked);
      try {
        const bodyData: Record<string, unknown> = { mode: queueMode, ranked: isRanked };
        if (queueMode === 'pair' && partner) {
          bodyData.partnerId = partner.userId;
          bodyData.partnerUsername = partner.username;
        }

        const res = await fetch('/api/matches/queue/join', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyData),
        });
        const responseBody = (await res.json().catch(() => ({}))) as {
          error?: string;
          queueSize?: number;
        };
        if (activeQueueVersionRef.current !== queueVersion) {
          // If the user left while the join request was still in flight, make
          // sure a late successful response cannot leave them queued server-side.
          if (res.ok) {
            await fetch('/api/matches/queue/leave', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => {});
          }
          return;
        }
        if (!res.ok) {
          activeQueueVersionRef.current = null;
          setError(responseBody.error ?? 'Failed to join queue');
          return;
        }
        setQueueSize(responseBody.queueSize ?? 0);
        setState('queued');
        pollRef.current = setInterval(poll, POLL_INTERVAL);
      } catch {
        if (activeQueueVersionRef.current !== queueVersion) return;
        activeQueueVersionRef.current = null;
        setError('Network error joining queue');
      }
    },
    [state, token, poll],
  );

  const leaveQueue = useCallback(async () => {
    ++queueVersionRef.current;
    activeQueueVersionRef.current = null;
    stopPolling();
    setState('idle');
    if (!token) return;
    await fetch('/api/matches/queue/leave', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [token, stopPolling]);

  /**
   * Enter the 'queued' polling state without sending a POST to the server.
   * Used when the server already queued the user (e.g. pair invite was accepted
   * via the pair-invite REST endpoint).
   */
  const startPollingOnly = useCallback(
    (queueMode: QueueMode = 'pair', reservation?: SeatReservationData) => {
      if (state !== 'idle' || activeQueueVersionRef.current !== null) return;
      const queueVersion = ++queueVersionRef.current;
      activeQueueVersionRef.current = reservation ? null : queueVersion;
      setState(reservation ? 'matched' : 'queued');
      setMode(queueMode);
      if (reservation) {
        stopPolling();
        navigate(`/match/${reservation.room.roomId}`, {
          state: { reservation },
        });
        return;
      }
      // Poll once immediately, then on interval
      void poll();
      if (!pollRef.current) {
        pollRef.current = setInterval(poll, POLL_INTERVAL);
      }
    },
    [state, poll, navigate, stopPolling],
  );

  // On mount: check if already queued server-side (handles pair invite accepted
  // while on another page, or navigating back after pair accept).
  useEffect(() => {
    if (!token) return;
    const queueVersion = queueVersionRef.current;
    void (async () => {
      try {
        const res = await fetch('/api/matches/queue/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          inQueue: boolean;
          mode?: QueueMode;
          ranked?: boolean;
          queueSize: number;
          reservation?: SeatReservationData;
        };
        if (queueVersionRef.current !== queueVersion) return;
        setQueueSize(body.queueSize);
        if (body.reservation) {
          activeQueueVersionRef.current = null;
          setState('matched');
          navigate(`/match/${body.reservation.room.roomId}`, {
            state: { reservation: body.reservation },
          });
        } else if (body.inQueue) {
          activeQueueVersionRef.current = queueVersion;
          setState('queued');
          setMode(body.mode ?? 'pair');
          setRanked(body.ranked ?? false);
          if (!pollRef.current) {
            pollRef.current = setInterval(poll, POLL_INTERVAL);
          }
        }
      } catch {
        // ignore — network errors on mount check are non-fatal
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional one-time mount check

  // Clean up on unmount
  useEffect(
    () => () => {
      ++queueVersionRef.current;
      activeQueueVersionRef.current = null;
      stopPolling();
    },
    [stopPolling],
  );

  return { state, queueSize, error, mode, ranked, joinQueue, leaveQueue, startPollingOnly };
}
