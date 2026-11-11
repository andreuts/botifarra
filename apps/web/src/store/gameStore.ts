import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerGameStateDTO, ObserverGameStateDTO } from '@botifarra/shared';
import type { ChatMessage } from '../components/ChatPanel.js';

export interface GameResult {
  scores: [number, number];
  winner: 0 | 1;
}

export type ActiveGameMode = 'botifarra' | 'practice' | 'practice-duo';

export interface ActiveGame {
  roomId: string;
  matchId: string;
  mode: ActiveGameMode;
  canAbandon: boolean;
}

export interface TimerState {
  seat: 0 | 1 | 2 | 3;
  baseTurnMs: number;    // remaining phase-specific base timer; -1 when not this seat's turn
}

export interface TimerSnapshot {
  timers: TimerState[];
  /** Server monotonic time when these timer values were calculated. */
  serverTime: number | null;
  /** Incremented by the server whenever a new decision clock starts. */
  timerEpoch: number | null;
  /** Remaining trick-pause countdown at serverTime, when a pause is active. */
  trickPauseRemainingMs: number | null;
  /** Monotonic client time recorded when the snapshot was received. */
  receivedAt: number;
}

const TIMER_SEATS = [0, 1, 2, 3] as const;

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' && !(typeof value === 'string' && value.trim() !== '')) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Reject malformed timer packets before they can poison the client clock with NaN. */
export function normalizeTimerValues(value: unknown): TimerState[] | null {
  const rawTimers = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { timers?: unknown }).timers)
      ? (value as { timers: unknown[] }).timers
      : null;
  if (!rawTimers?.length) return null;

  const bySeat = new Map<TimerState['seat'], number>();
  for (const rawTimer of rawTimers) {
    if (!rawTimer || typeof rawTimer !== 'object') return null;
    const timer = rawTimer as Record<string, unknown>;
    const seatNumber = finiteNumber(timer['seat']);
    const baseTurnMs = finiteNumber(
      timer['baseTurnMs'] ?? timer['remainingMs'] ?? timer['remainingTimeMs'],
    );
    if (
      seatNumber === null ||
      !TIMER_SEATS.includes(seatNumber as TimerState['seat']) ||
      baseTurnMs === null
    ) {
      return null;
    }
    bySeat.set(seatNumber as TimerState['seat'], baseTurnMs < 0 ? -1 : baseTurnMs);
  }

  return TIMER_SEATS.map((seat) => ({
    seat,
    baseTurnMs: bySeat.get(seat) ?? -1,
  }));
}

export interface GameStore {
  gameState: PlayerGameStateDTO | null;
  observerState: ObserverGameStateDTO | null;
  chatMessages: ChatMessage[];
  roomId: string | null;
  connected: boolean;
  error: string | null;
  gameResult: GameResult | null;
  toasts: string[];
  timers: TimerState[] | null;
  timerSnapshot: TimerSnapshot | null;
  activeGame: ActiveGame | null;
  activeGameRoomId: string | null; // Persisted — for rejoin functionality
  setGameState: (state: PlayerGameStateDTO) => void;
  setObserverState: (state: ObserverGameStateDTO) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setConnected: (connected: boolean) => void;
  setRoomId: (roomId: string) => void;
  setError: (error: string | null) => void;
  setGameResult: (result: GameResult) => void;
  addToast: (msg: string) => void;
  dismissToast: () => void;
  setTimers: (
    timers: TimerState[],
    serverTime?: number,
    timerEpoch?: number,
    trickPauseRemainingMs?: number | null,
  ) => void;
  setActiveGameRoomId: (roomId: string | null) => void;
  setActiveGame: (activeGame: ActiveGame | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      gameState: null,
      observerState: null,
      chatMessages: [] as ChatMessage[],
      roomId: null,
      connected: false,
      error: null,
      gameResult: null,
      toasts: [],
      timers: null,
      timerSnapshot: null,
      activeGame: null,
      activeGameRoomId: null,
      setGameState: (gameState) => set({ gameState }),
      setObserverState: (observerState) => set({ observerState }),
      addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
      setConnected: (connected) => set({ connected }),
      setRoomId: (roomId) => set({ roomId }),
      setError: (error) => set({ error }),
      setGameResult: (gameResult) => set({ gameResult }),
      addToast: (msg) => set((s) => ({ toasts: [...s.toasts, msg] })),
      dismissToast: () => set((s) => ({ toasts: s.toasts.slice(1) })),
      setTimers: (timers, serverTime, timerEpoch, trickPauseRemainingMs) => {
        const normalizedTimers = normalizeTimerValues(timers);
        if (!normalizedTimers) return;
        set({
          timers: normalizedTimers,
          timerSnapshot: {
            timers: normalizedTimers,
            serverTime: finiteNumber(serverTime),
            timerEpoch: finiteNumber(timerEpoch),
            trickPauseRemainingMs: finiteNumber(trickPauseRemainingMs),
            receivedAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
          },
        });
      },
      setActiveGameRoomId: (activeGameRoomId) => set({ activeGameRoomId }),
      setActiveGame: (activeGame) => set({
        activeGame,
        activeGameRoomId: activeGame?.roomId ?? null,
      }),
      reset: () =>
        set({
          gameState: null,
          observerState: null,
          chatMessages: [],
          roomId: null,
          connected: false,
          error: null,
          gameResult: null,
          toasts: [],
          timers: null,
          timerSnapshot: null,
        }),
    }),
    {
      name: 'botifarra-game',
      partialize: (state) => ({
        activeGame: state.activeGame,
        activeGameRoomId: state.activeGameRoomId,
      }),
    },
  ),
);
