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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const token = user?.accessToken ?? '';

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/matches/queue/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        stopPolling();
        return;
      }
      const body = (await res.json()) as {
        inQueue: boolean;
        queueSize: number;
        reservation?: SeatReservationData;
      };
      setQueueSize(body.queueSize);
      if (body.reservation) {
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
    async (queueMode: QueueMode = 'single', partner?: { userId: string; username: string }, ranked = false) => {
      if (state !== 'idle') return;
      setError(null);
      setMode(queueMode);
      try {
        const bodyData: Record<string, unknown> = { mode: queueMode, ranked };
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
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? 'Failed to join queue');
          return;
        }
        setState('queued');
        pollRef.current = setInterval(poll, POLL_INTERVAL);
      } catch {
        setError('Network error joining queue');
      }
    },
    [state, token, poll],
  );

  const leaveQueue = useCallback(async () => {
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
    (queueMode: QueueMode = 'pair') => {
      if (state !== 'idle') return;
      setState('queued');
      setMode(queueMode);
      // Poll once immediately, then on interval
      void poll();
      if (!pollRef.current) {
        pollRef.current = setInterval(poll, POLL_INTERVAL);
      }
    },
    [state, poll],
  );

  // On mount: check if already queued server-side (handles pair invite accepted
  // while on another page, or navigating back after pair accept).
  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const res = await fetch('/api/matches/queue/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          inQueue: boolean;
          queueSize: number;
          reservation?: SeatReservationData;
        };
        setQueueSize(body.queueSize);
        if (body.reservation) {
          setState('matched');
          navigate(`/match/${body.reservation.room.roomId}`, {
            state: { reservation: body.reservation },
          });
        } else if (body.inQueue) {
          setState('queued');
          setMode('pair');
          if (!pollRef.current) {
            pollRef.current = setInterval(poll, POLL_INTERVAL);
          }
        }
      } catch {
        // ignore — network errors on mount check are non-fatal
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentional one-time mount check

  // Clean up on unmount
  useEffect(
    () => () => {
      stopPolling();
    },
    [stopPolling],
  );

  return { state, queueSize, error, mode, joinQueue, leaveQueue, startPollingOnly };
}
