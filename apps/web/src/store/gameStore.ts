import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlayerGameStateDTO } from '@botifarra/shared';

export interface GameResult {
  scores: [number, number];
  winner: 0 | 1;
}

export interface GameStore {
  gameState: PlayerGameStateDTO | null;
  roomId: string | null;
  connected: boolean;
  error: string | null;
  gameResult: GameResult | null;
  toasts: string[];
  activeGameRoomId: string | null; // Persisted — for rejoin functionality
  setGameState: (state: PlayerGameStateDTO) => void;
  setConnected: (connected: boolean) => void;
  setRoomId: (roomId: string) => void;
  setError: (error: string | null) => void;
  setGameResult: (result: GameResult) => void;
  addToast: (msg: string) => void;
  dismissToast: () => void;
  setActiveGameRoomId: (roomId: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>()(persist(
  (set) => ({
    gameState: null,
    roomId: null,
    connected: false,
    error: null,
    gameResult: null,
    toasts: [],
    activeGameRoomId: null,
    setGameState: (gameState) => set({ gameState }),
    setConnected: (connected) => set({ connected }),
    setRoomId: (roomId) => set({ roomId }),
    setError: (error) => set({ error }),
    setGameResult: (gameResult) => set({ gameResult }),
    addToast: (msg) => set((s) => ({ toasts: [...s.toasts, msg] })),
    dismissToast: () => set((s) => ({ toasts: s.toasts.slice(1) })),
    setActiveGameRoomId: (activeGameRoomId) => set({ activeGameRoomId }),
    reset: () => set({ gameState: null, roomId: null, connected: false, error: null, gameResult: null, toasts: [] }),
  }),
  {
    name: 'botifarra-game',
    partialize: (state) => ({ activeGameRoomId: state.activeGameRoomId }),
  },
));
