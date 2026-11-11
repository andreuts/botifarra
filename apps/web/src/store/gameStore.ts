import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerGameStateDTO, ObserverGameStateDTO } from '@botifarra/shared';
import type { ChatMessage } from '../components/ChatPanel.js';

export interface GameResult {
  scores: [number, number];
  winner: 0 | 1;
}

export interface TimerState {
  seat: 0 | 1 | 2 | 3;
  baseTurnMs: number;    // remaining phase-specific base timer; -1 when not this seat's turn
  roundBudgetMs: number; // remaining 60s per-player round budget (zero during contra)
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
      setTimers: (timers, serverTime, timerEpoch, trickPauseRemainingMs) =>
        set({
          timers,
          timerSnapshot: {
            timers,
            serverTime: serverTime ?? null,
            timerEpoch: timerEpoch ?? null,
            trickPauseRemainingMs: trickPauseRemainingMs ?? null,
            receivedAt: typeof performance !== 'undefined' ? performance.now() : Date.now(),
          },
        }),
      setActiveGameRoomId: (activeGameRoomId) => set({ activeGameRoomId }),
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
      partialize: (state) => ({ activeGameRoomId: state.activeGameRoomId }),
    },
  ),
);
