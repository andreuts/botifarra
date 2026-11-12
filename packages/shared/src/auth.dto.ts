import type { GameAvatarId } from './avatars.js';

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

// ---------------------------------------------------------------------------
// Auth DTOs
// ---------------------------------------------------------------------------

export interface RegisterRequest {
  username: string;
  password: string;
  townId: string;
}

export interface RegisterResponse {
  userId: string;
  username: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  userId: string;
  username: string;
}

export type HandSortDirection = 'left-to-right' | 'right-to-left';

export interface UpdateUserPreferencesRequest {
  handSortDirection: HandSortDirection;
}

export interface UpdateUserPreferencesResponse {
  handSortDirection: HandSortDirection;
}

export interface UpdateUserAvatarRequest {
  avatarId: GameAvatarId | null;
}

export interface UpdateUserAvatarResponse {
  avatarId: GameAvatarId | null;
}

export interface MeResponse {
  userId: string;
  username: string;
  createdAt: string;
  handSortDirection: HandSortDirection;
  avatarId: GameAvatarId | null;
  townId: string | null;
  townLabel: string | null;
}

export interface UpdateUserTownRequest {
  townId: string;
}

export interface UpdateUserTownResponse {
  townId: string;
  townLabel: string;
}
