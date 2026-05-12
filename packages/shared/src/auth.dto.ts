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

export interface MeResponse {
  userId: string;
  username: string;
  createdAt: string;
}
