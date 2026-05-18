import { useEffect, useRef, useCallback } from 'react';
import { Client, type Room } from 'colyseus.js';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/gameStore.js';
import type { PlayerGameStateDTO, ObserverGameStateDTO } from '@botifarra/shared';
import type { TrumpDeclaration } from '@botifarra/core';
import type { SeatReservationData } from './useMatchmakingQueue.js';
import type { ChatMessage } from '../components/ChatPanel.js';

const COLYSEUS_URL =
  import.meta.env['VITE_COLYSEUS_URL'] ??
  (window.location.hostname === 'localhost'
    ? 'ws://localhost:3000'
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`);

export const EMOJI_DISPLAY: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  cry: '😭',
  applause: '👏',
  celebrate: '🎉',
  money: '💰',
  cigar: '🚬',
  wine: '🍷',
  beer: '🍺',
};

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
  /** Join as observer (spectator) — no seat assigned */
  observe?: boolean,
) {
  const roomRef = useRef<Room | null>(null);
  const { t } = useTranslation();
  const { setGameState, setObserverState, addChatMessage, setConnected, setRoomId, setError, reset, setGameResult, addToast } =
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
          room = await client.joinById(roomId, { userId, username, token, observe });
        } else {
          room = await client.joinOrCreate(roomType, { userId, username, token, observe });
        }

        roomRef.current = room;
        setRoomId(room.id);
        setConnected(true);

        room.onMessage('game_state', (msg: { state: PlayerGameStateDTO }) => {
          setGameState(msg.state);
        });

        room.onMessage('observer_game_state', (msg: { state: ObserverGameStateDTO }) => {
          setObserverState(msg.state);
        });

        room.onMessage('chat_message', (msg: ChatMessage) => {
          addChatMessage(msg);
        });

        room.onMessage('trump_declared', (msg: { declaration: string; declarantSeat: number }) => {
          const suitLabel: Record<string, string> = {
            botifarra: t('game_terms.botifarra'),
            oros: t('suits.O'),
            copes: t('suits.C'),
            espases: t('suits.E'),
            bastos: t('suits.B'),
          };
          addToast(t('toast.trumpDeclared', { suit: suitLabel[msg.declaration] ?? msg.declaration }));
        });

        room.onMessage('contra_called', (msg: { level: number; callerSeat: number }) => {
          const contraLabels: Record<number, string> = {
            1: t('game_terms.contra'),
            2: t('game_terms.recontro'),
            3: t('game_terms.santVicenc'),
          };
          const gs = useGameStore.getState().gameState;
          const name =
            gs?.playerNames?.[msg.callerSeat as 0 | 1 | 2 | 3] ??
            t('trick.seatFallback', { seat: msg.callerSeat });
          addToast(`${name}: ${contraLabels[msg.level] ?? t('game_terms.contra')}`);
        });

        room.onMessage('trick_completed', (msg: { trick: { winner: number } }) => {
          const gs = useGameStore.getState().gameState;
          const name =
            gs?.playerNames?.[msg.trick.winner as 0 | 1 | 2 | 3] ??
            t('trick.seatFallback', { seat: msg.trick.winner });
          addToast(t('toast.trickWon', { name }));
        });

        room.onMessage('round_ended', (msg: { totalScores: [number, number] }) => {
          addToast(t('toast.roundOver', { score0: msg.totalScores[0], score1: msg.totalScores[1] }));
        });

        room.onMessage('game_ended', (msg: { scores: [number, number]; winner: 0 | 1 }) => {
          setGameResult({ scores: msg.scores, winner: msg.winner });
        });

        room.onMessage('player_connected', (msg: { seat: number; username: string }) => {
          addToast(t('toast.playerJoined', { username: msg.username, seat: msg.seat }));
        });

        room.onMessage('player_disconnected', (msg: { seat: number }) => {
          const gs = useGameStore.getState().gameState;
          const name =
            gs?.playerNames?.[msg.seat as 0 | 1 | 2 | 3] ??
            t('trick.seatFallback', { seat: msg.seat });
          addToast(t('toast.playerLeft', { name }));
        });

        room.onMessage('reaction', (msg: { fromUsername: string; fromSeat: number; emoji: string }) => {
          addToast(`${msg.fromUsername}: ${EMOJI_DISPLAY[msg.emoji] ?? msg.emoji}`);
        });

        room.onMessage('premade_message', (msg: { fromUsername: string; fromSeat: number; key: string }) => {
          addToast(`${msg.fromUsername}: ${t(`premade.${msg.key}`)}`);
        });

        room.onMessage('error', (msg: { code: string; message: string }) => {
          setError(msg.message);
        });

        room.onLeave(() => {
          setConnected(false);
          roomRef.current = null;
        });

        room.onError((code, message) => {
          setError(t('toast.roomError', { code, message }));
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('toast.connectionFailed');
        setError(msg);
      }
    },
    [
      roomId,
      roomType,
      seatReservation,
      observe,
      setConnected,
      setError,
      setGameState,
      setObserverState,
      addChatMessage,
      setRoomId,
      setGameResult,
      addToast,
      reset,
    ],
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

  const sendChatMessage = useCallback((text: string) => {
    roomRef.current?.send('chat_message', { text });
  }, []);

  const sendSurrenderRequest = useCallback(() => {
    roomRef.current?.send('surrender_request', {});
  }, []);

  const sendSurrenderRespond = useCallback((accept: boolean) => {
    roomRef.current?.send('surrender_respond', { accept });
  }, []);

  const sendReaction = useCallback((emoji: string) => {
    roomRef.current?.send('send_reaction', { emoji });
  }, []);

  const sendPremade = useCallback((key: string) => {
    roomRef.current?.send('send_premade', { key });
  }, []);

  const mutePlayer = useCallback((seat: number) => {
    roomRef.current?.send('mute_player', { seat });
  }, []);

  const unmutePlayer = useCallback((seat: number) => {
    roomRef.current?.send('unmute_player', { seat });
  }, []);

  useEffect(() => {
    return () => {
      roomRef.current?.leave();
      reset();
    };
  }, [reset]);

  return { connect, sendDeclareTrump, sendPlayCard, sendPassDeclaration, sendCallContra, sendChatMessage, sendSurrenderRequest, sendSurrenderRespond, sendReaction, sendPremade, mutePlayer, unmutePlayer };
}
