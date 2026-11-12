export declare const USERNAME_MIN_LENGTH = 3;
export declare const USERNAME_MAX_LENGTH = 20;
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
