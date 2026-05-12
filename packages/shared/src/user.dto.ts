// ---------------------------------------------------------------------------
// User / Profile DTOs
// ---------------------------------------------------------------------------

export interface UserProfileDTO {
  userId: string;
  username: string;
  createdAt: string;
  stats: UserStatsDTO;
}

export interface UserStatsDTO {
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  individualRating: number;
}
