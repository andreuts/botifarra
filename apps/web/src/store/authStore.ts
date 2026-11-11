import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HandSortDirection } from '@botifarra/shared';

export interface AuthUser {
  userId: string;
  username: string;
  accessToken: string;
  handSortDirection?: HandSortDirection;
}

interface AuthState {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  setHandSortDirection: (direction: HandSortDirection) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => set({ user: null }),
      setHandSortDirection: (handSortDirection) =>
        set((state) => state.user ? { user: { ...state.user, handSortDirection } } : state),
    }),
    { name: 'botifarra-auth' },
  ),
);
