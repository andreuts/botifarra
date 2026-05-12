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
    mode: 'public' | 'practice';
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
export type ClientCommand = DeclareTrumpCommand | PlayCardCommand | JoinQueueCommand | LeaveQueueCommand | JoinRoomCommand | LeaveRoomCommand;
