// ---------------------------------------------------------------------------
// Auth DTOs
// ---------------------------------------------------------------------------

export interface RegisterRequest {
  username: string;
  password: string;
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

export interface MeResponse {
  userId: string;
  username: string;
  createdAt: string;
  handSortDirection: HandSortDirection;
}
