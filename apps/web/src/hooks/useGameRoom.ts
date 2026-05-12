import { useEffect, useRef, useCallback } from 'react';
import { Client, type Room } from 'colyseus.js';
import { useGameStore } from '../store/gameStore.js';
import type { PlayerGameStateDTO } from '@botifarra/shared';
import type { TrumpDeclaration } from '@botifarra/core';
import type { SeatReservationData } from './useMatchmakingQueue.js';

const COLYSEUS_URL =
  import.meta.env['VITE_COLYSEUS_URL'] ??
  (window.location.hostname === 'localhost'
    ? 'ws://localhost:3000'
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`);

/**
 * Tracks seat reservation sessionIds that have already been attempted.
 * consumeSeatReservation is a one-time token: the server marks the seat as consumed
 * on first attempt. React Strict Mode's double-mount would retry with the same token
 * and get "seat reservation expired." A module-level Set persists across React's
 * unmount/remount cycle.
 */
const attemptedReservations = new Set<string>();

export function useGameRoom(
  roomId?: string,
  roomType: 'botifarra' | 'practice' = 'botifarra',
  /** Seat reservation from matchmaking — uses consumeSeatReservation which bypasses room.locked */
  seatReservation?: SeatReservationData,
) {
  const roomRef = useRef<Room | null>(null);
  const { setGameState, setConnected, setRoomId, setError, reset, setGameResult, addToast } =
    useGameStore();

  const connect = useCallback(
    async (token: string, userId: string, username: string) => {
      if (roomRef.current) return;
      // Guard: consumeSeatReservation is a one-time token. If this sessionId has already
      // been attempted (including Strict Mode's double-invocation), skip to avoid
      // "seat reservation expired" on the server.
      if (seatReservation) {
        if (attemptedReservations.has(seatReservation.sessionId)) return;
        attemptedReservations.add(seatReservation.sessionId);
      }

      const client = new Client(COLYSEUS_URL);
      try {
        let room: Room;

        if (seatReservation) {
          // consumeSeatReservation connects directly via sessionId, bypassing
          // the room.locked check that would cause joinById to fail after all
          // seats are reserved atomically by the server at match creation time.
          room = await client.consumeSeatReservation(seatReservation);
        } else if (roomId) {
          room = await client.joinById(roomId, { userId, username, token });
        } else {
          room = await client.joinOrCreate(roomType, { userId, username, token });
        }

        roomRef.current = room;
        setRoomId(room.id);
        setConnected(true);

        room.onMessage('game_state', (msg: { state: PlayerGameStateDTO }) => {
          setGameState(msg.state);
        });

        room.onMessage('trump_declared', (msg: { declaration: string; declarantSeat: number }) => {
          const suitLabel: Record<string, string> = {
            botifarra: 'Botifarra!',
            oros: 'Oros', copes: 'Copes', espases: 'Espases', bastos: 'Bastos',
          };
          addToast(`Trump: ${suitLabel[msg.declaration] ?? msg.declaration}`);
        });

        room.onMessage('contra_called', (msg: { level: number; callerSeat: number }) => {
          const contraLabels: Record<number, string> = { 1: 'Contra!', 2: 'Recontro!', 3: 'Sant Vicenç!' };
          const gs = useGameStore.getState().gameState;
          const name = gs?.playerNames?.[msg.callerSeat as 0|1|2|3] ?? `Seat ${msg.callerSeat}`;
          addToast(`${name}: ${contraLabels[msg.level] ?? 'Contra!'}`);
        });

        room.onMessage('trick_completed', (msg: { trick: { winner: number } }) => {
          // Get the name from current game state if available
          const gs = useGameStore.getState().gameState;
          const name = gs?.playerNames?.[msg.trick.winner as 0|1|2|3] ?? `Seat ${msg.trick.winner}`;
          addToast(`${name} won the trick`);
        });

        room.onMessage('round_ended', (msg: { totalScores: [number, number] }) => {
          addToast(`Round over — ${msg.totalScores[0]} : ${msg.totalScores[1]}`);
        });

        room.onMessage('game_ended', (msg: { scores: [number, number]; winner: 0 | 1 }) => {
          setGameResult({ scores: msg.scores, winner: msg.winner });
        });

        room.onMessage('player_connected', (msg: { seat: number; username: string }) => {
          addToast(`${msg.username} joined (seat ${msg.seat})`);
        });

        room.onMessage('player_disconnected', (msg: { seat: number }) => {
          const gs = useGameStore.getState().gameState;
          const name = gs?.playerNames?.[msg.seat as 0|1|2|3] ?? `Seat ${msg.seat}`;
          addToast(`${name} disconnected`);
        });

        room.onMessage('error', (msg: { code: string; message: string }) => {
          setError(msg.message);
        });

        room.onLeave(() => {
          setConnected(false);
          roomRef.current = null;
        });

        room.onError((code, message) => {
          setError(`Room error ${code}: ${message}`);
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to connect to game';
        setError(msg);
      }
    },
    [roomId, roomType, seatReservation, setConnected, setError, setGameState, setRoomId, setGameResult, addToast, reset],
  );

  const sendDeclareTrump = useCallback((declaration: TrumpDeclaration) => {
    roomRef.current?.send('declare_trump', { declaration });
  }, []);

  const sendPlayCard = useCallback((card: { suit: string; rank: number }) => {
    roomRef.current?.send('play_card', { card });
  }, []);

  const sendPassDeclaration = useCallback(() => {
    roomRef.current?.send('pass_declaration', {});
  }, []);

  const sendCallContra = useCallback(() => {
    roomRef.current?.send('call_contra', {});
  }, []);

  useEffect(() => {
    return () => {
      roomRef.current?.leave();
      reset();
    };
  }, [reset]);

  return { connect, sendDeclareTrump, sendPlayCard, sendPassDeclaration, sendCallContra };
}
