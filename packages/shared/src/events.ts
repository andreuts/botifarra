import type {
  CompletedTrick,
  ContraLevel,
  RoundScore,
  Seat,
  TrumpDeclaration,
} from '@botifarra/core';
import type { PlayerGameStateDTO } from './match.dto.js';

/**
 * Events emitted by the server to connected clients.
 * Clients must treat these as the single source of truth for game state.
 */

export interface GameStateEvent {
  type: 'game_state';
  state: PlayerGameStateDTO;
}

export interface TrumpDeclaredEvent {
  type: 'trump_declared';
  declaration: TrumpDeclaration;
  declarantSeat: Seat;
}

export interface CardPlayedEvent {
  type: 'card_played';
  seat: Seat;
  /** The card played — visible to all players once played */
  card: { suit: string; rank: number };
}

export interface TrickCompletedEvent {
  type: 'trick_completed';
  trick: CompletedTrick;
  nextLeader: Seat;
}

export interface RoundEndedEvent {
  type: 'round_ended';
  score: RoundScore;
  totalScores: [number, number];
}

export interface GameEndedEvent {
  type: 'game_ended';
  winner: 0 | 1;
  finalScores: [number, number];
}

export interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
}

export interface PlayerConnectedEvent {
  type: 'player_connected';
  seat: Seat;
  username: string;
}

export interface PlayerDisconnectedEvent {
  type: 'player_disconnected';
  seat: Seat;
}

export interface ContraCalledEvent {
  type: 'contra_called';
  level: ContraLevel;
  callerSeat: Seat;
}

export interface ChatMessageEvent {
  type: 'chat_message';
  fromUsername: string;
  fromSeat: Seat | null; // null for observers
  text: string;
  timestamp: number;
}

export interface ReactionEvent {
  type: 'reaction';
  fromUsername: string;
  fromSeat: Seat;
  emoji: string;
  timestamp: number;
}

export interface PremadeMessageEvent {
  type: 'premade_message';
  fromUsername: string;
  fromSeat: Seat;
  key: string;
  timestamp: number;
}

export interface SurrenderRequestedEvent {
  type: 'surrender_requested';
  requestingSeat: Seat;
  partnerSeat: Seat;
}

export interface SurrenderResolvedEvent {
  type: 'surrender_resolved';
  accepted: boolean;
  losingSeat?: Seat; // which team's seat lost (0 or 1)
}

export interface TimerUpdateEvent {
  type: 'timer_update';
  timers: {
    seat: Seat;
    baseTurnMs: number; // remaining base 15s countdown (-1 if not their turn)
    roundBudgetMs: number; // remaining 1-min round budget
  }[];
}

export interface RoundTimeoutEvent {
  type: 'round_timeout';
  timedOutSeat: Seat;
  penaltyPoints: number; // 36
  scoringTeam: 0 | 1;
}

export interface GameTimeoutEvent {
  type: 'game_timeout';
  winner: 0 | 1 | null; // null if tied
  finalScores: [number, number];
}

export interface ObserverJoinedEvent {
  type: 'observer_joined';
  username: string;
}

export interface ObserverLeftEvent {
  type: 'observer_left';
  username: string;
}

export type ServerEvent =
  | GameStateEvent
  | TrumpDeclaredEvent
  | CardPlayedEvent
  | TrickCompletedEvent
  | RoundEndedEvent
  | GameEndedEvent
  | ErrorEvent
  | PlayerConnectedEvent
  | PlayerDisconnectedEvent
  | ContraCalledEvent
  | ChatMessageEvent
  | ObserverJoinedEvent
  | ObserverLeftEvent;
