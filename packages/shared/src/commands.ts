import type { Card, TrumpDeclaration } from '@botifarra/core';

/**
 * Commands sent from the client to the server over the WebSocket connection.
 * The server validates every command before applying it.
 */

export interface DeclareTrumpCommand {
  type: 'declare_trump';
  declaration: TrumpDeclaration;
}

export interface PlayCardCommand {
  type: 'play_card';
  card: Card;
}

export interface JoinQueueCommand {
  type: 'join_queue';
  mode: 'single' | 'pair';
  ranked?: boolean;
  /** Required when mode is 'pair' */
  partnerId?: string;
  partnerUsername?: string;
}

export interface LeaveQueueCommand {
  type: 'leave_queue';
}

export interface JoinRoomCommand {
  type: 'join_room';
  matchId: string;
}

export interface LeaveRoomCommand {
  type: 'leave_room';
}

export interface PassDeclarationCommand {
  type: 'pass_declaration';
}

export interface CallContraCommand {
  type: 'call_contra';
}

export interface SendChatMessageCommand {
  type: 'chat_message';
  text: string;
}

export interface SurrenderRequestCommand {
  type: 'surrender_request';
}

export interface SurrenderRespondCommand {
  type: 'surrender_respond';
  accept: boolean;
}

/** Available emoji reaction keys */
export type ReactionEmoji = 'happy' | 'sad' | 'cry' | 'applause' | 'celebrate' | 'money' | 'cigar' | 'wine' | 'beer';

/** Available premade message keys */
export type PremadeMessageKey =
  | 'bona_sort'
  | 'ben_jugat'
  | 'quina_sort'
  | 'au_va'
  | 'botifarra'
  | 'fill_meu_tingues_bo'
  | 'joc_de_muts'
  | 'salut_i_manilles'
  | 'sortida_animal'
  | 'gg';

export interface SendReactionCommand {
  type: 'send_reaction';
  emoji: ReactionEmoji;
}

export interface SendPremadeCommand {
  type: 'send_premade';
  key: PremadeMessageKey;
}

export interface MutePlayerCommand {
  type: 'mute_player';
  seat: 0 | 1 | 2 | 3;
}

export interface UnmutePlayerCommand {
  type: 'unmute_player';
  seat: 0 | 1 | 2 | 3;
}

export type ClientCommand =
  | DeclareTrumpCommand
  | PlayCardCommand
  | JoinQueueCommand
  | LeaveQueueCommand
  | JoinRoomCommand
  | LeaveRoomCommand
  | PassDeclarationCommand
  | CallContraCommand
  | SendChatMessageCommand
  | SurrenderRequestCommand
  | SurrenderRespondCommand
  | SendReactionCommand
  | SendPremadeCommand
  | MutePlayerCommand
  | UnmutePlayerCommand;
