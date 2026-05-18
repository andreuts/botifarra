// ---------------------------------------------------------------------------
// Tournament DTOs
// ---------------------------------------------------------------------------

export type TournamentFormat = 'eliminatory' | 'swiss';

export type TournamentStatus =
  | 'registration_open'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type TournamentCoupleStatus =
  | 'active'
  | 'eliminated'
  | 'finalist'
  | 'champion'
  | 'withdrawn';

export type TournamentMatchStatus =
  | 'pending'
  | 'in_progress'
  | 'tiebreak'
  | 'finished'
  | 'unresolved';

// ---------------------------------------------------------------------------
// Request / Response DTOs
// ---------------------------------------------------------------------------

export interface CreateTournamentPayload {
  name: string;
  format: TournamentFormat;
  password?: string; // optional — if set, registration requires this password
}

export interface RegisterSoloPayload {
  password?: string;
}

export interface RegisterCouplePayload {
  partnerUserId: string;
  password?: string;
}

export interface SubmitMatchResultPayload {
  matchId: string;
  score0: number;
  score1: number;
  winnerId?: string; // for manual resolution of unresolved ties
}

// ---------------------------------------------------------------------------
// Response DTOs
// ---------------------------------------------------------------------------

export interface TournamentDTO {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  createdById: string;
  createdByUsername: string;
  activeRound: number;
  championId: string | null;
  coupleCount: number;
  registeredUsersCount: number;
  hasPassword: boolean;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TournamentCoupleDTO {
  id: string;
  user1Id: string;
  user1Username: string;
  user2Id: string;
  user2Username: string;
  status: TournamentCoupleStatus;
  points: number;
  matchesWon: number;
  matchesLost: number;
  position: number; // computed ranking position
}

export interface TournamentMatchDTO {
  id: string;
  roundNumber: number;
  couple0: { id: string; user1Username: string; user2Username: string };
  couple1: { id: string; user1Username: string; user2Username: string } | null; // null = bye
  isFinal: boolean;
  status: TournamentMatchStatus;
  score0: number;
  score1: number;
  roundsPlayed: number;
  winnerId: string | null;
  roomId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface TournamentRoundDTO {
  roundNumber: number;
  matches: TournamentMatchDTO[];
}

export interface TournamentDetailDTO {
  tournament: TournamentDTO;
  couples: TournamentCoupleDTO[];
  rounds: TournamentRoundDTO[];
}

export interface TournamentListDTO {
  tournaments: TournamentDTO[];
}
