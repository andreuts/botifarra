import { useEffect, useRef, useCallback, useState } from 'react';
import { Client, type Room } from 'colyseus.js';
import { useTranslation } from 'react-i18next';
import { normalizeTimerValues, useGameStore, type TimerState } from '../store/gameStore.js';
import { CARD_TURN_MS, CONTRA_TIMEOUT_MS, DECLARATION_TURN_MS } from '../utils/timerUtils.js';
import type {
  ObserverGameStateDTO,
  PlayerGameStateDTO,
  ReactionEvent,
  ReactionMood,
} from '@botifarra/shared';
import type { Seat, TrumpDeclaration } from '@botifarra/core';
import type { SeatReservationData } from './useMatchmakingQueue.js';
import type { ChatMessage } from '../components/ChatPanel.js';
import { playReactionSound } from '../utils/reactionSounds.js';

const hostname = window.location.hostname;
const isLoopbackHost =
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  hostname === '[::1]';
const loopbackAddress = hostname.includes(':') ? '[::1]' : hostname;

const COLYSEUS_URL =
  import.meta.env['VITE_COLYSEUS_URL'] ??
  (isLoopbackHost
    ? `ws://${loopbackAddress}:3000`
    : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`);

export interface RoomLobbyPlayer {
  username: string;
  seat: number;
  connected: boolean;
}

export interface ActiveGameReaction extends ReactionEvent {
  id: number;
}

const TIMER_SEATS = [0, 1, 2, 3] as const;

function timerClockKey(state: PlayerGameStateDTO): string {
  return [
    state.roundNumber,
    state.trump ?? 'none',
    state.contraLevel,
    state.contraDecidingTeam ?? 'none',
    state.declarantSeat,
    state.dealerPassed,
    state.currentLeader,
    state.currentPlayerSeat ?? 'none',
    state.currentTrick.length,
    state.trickPauseLeader ?? 'none',
  ].join(':');
}

/** Local display fallback for servers that send an invalid timer snapshot. */
function fallbackTimerValues(state: PlayerGameStateDTO): TimerState[] {
  let activeSeats: number[] = [];
  let duration = CARD_TURN_MS;

  if (state.trickPauseLeader != null) {
    activeSeats = [];
  } else if (state.contraDecidingTeam === 0 || state.contraDecidingTeam === 1) {
    activeSeats = state.contraDecidingTeam === 0 ? [0, 2] : [1, 3];
    duration = CONTRA_TIMEOUT_MS;
  } else if (state.trump === null) {
    activeSeats = [state.declarantSeat];
    duration = DECLARATION_TURN_MS;
  } else if (state.currentPlayerSeat !== null) {
    activeSeats = [state.currentPlayerSeat];
  }

  return TIMER_SEATS.map((seat) => ({
    seat,
    baseTurnMs: activeSeats.includes(seat) ? duration : -1,
  }));
}

/**
 * Prevents duplicate consumption of a one-time reservation, including React
 * Strict Mode's repeated effect setup. Failed attempts are removed so they can
 * be retried while the reservation remains valid.
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
  const timerStreamActive = useRef(false);
  const timerClockKeyRef = useRef<string | null>(null);
  const intentionalLeaveRef = useRef(false);
  const [commandErrorVersion, setCommandErrorVersion] = useState(0);
  const [roomPlayers, setRoomPlayers] = useState<RoomLobbyPlayer[]>([]);
  const [activeReactions, setActiveReactions] = useState<Partial<Record<ReactionEvent['fromSeat'], ActiveGameReaction>>>({});
  const reactionTimeoutsRef = useRef(new Map<number, number>());
  const reactionSequenceRef = useRef(0);
  const { t } = useTranslation();
  const { setGameState, setObserverState, addChatMessage, setConnected, setRoomId, setError, reset, setGameResult, setTimers } =
    useGameStore();

  const connect = useCallback(
    async (token: string, userId: string, username: string) => {
      if (roomRef.current) return;
      intentionalLeaveRef.current = false;
      timerStreamActive.current = false;
      timerClockKeyRef.current = null;
      // Guard: consumeSeatReservation is a one-time token. If this sessionId has already
      // been attempted (including Strict Mode's double-invocation), skip to avoid
      // "seat reservation expired" on the server.
      if (seatReservation) {
        if (attemptedReservations.has(seatReservation.sessionId)) return;
        attemptedReservations.add(seatReservation.sessionId);
      }

      setRoomPlayers([]);
      for (const timeout of reactionTimeoutsRef.current.values()) window.clearTimeout(timeout);
      reactionTimeoutsRef.current.clear();
      setActiveReactions({});
      try {
        const client = new Client(COLYSEUS_URL);
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

        // The user may leave the waiting screen before the join handshake finishes.
        // In that case, release the newly-created room connection instead of keeping
        // them in the lobby after they've navigated away.
        if (intentionalLeaveRef.current) {
          void room.leave();
          return;
        }

        roomRef.current = room;
        setRoomId(room.id);
        setConnected(true);

        const syncRoomPlayers = (state: unknown) => {
          const playerMap = (state as {
            players?: { values: () => Iterable<RoomLobbyPlayer> };
          } | null)?.players;
          if (!playerMap) {
            setRoomPlayers([]);
            return;
          }
          setRoomPlayers(
            Array.from(playerMap.values())
              .map(({ username: playerName, seat, connected: playerConnected }) => ({
                username: playerName,
                seat,
                connected: playerConnected,
              }))
              .sort((a, b) => a.seat - b.seat),
          );
        };

        syncRoomPlayers(room.state);
        room.onStateChange(syncRoomPlayers);

        const updatePlayerConnectivity = (seatNumber: number, connected: boolean, username?: string) => {
          if (!TIMER_SEATS.includes(seatNumber as (typeof TIMER_SEATS)[number])) return;
          const seat = seatNumber as Seat;
          const fallbackName =
            useGameStore.getState().gameState?.playerNames[seat] ??
            t('trick.seatFallback', { seat });
          setRoomPlayers((current) => {
            const existing = current.find((player) => player.seat === seat);
            return [
              ...current.filter((player) => player.seat !== seat),
              { username: username ?? existing?.username ?? fallbackName, seat, connected },
            ].sort((a, b) => a.seat - b.seat);
          });
        };

        room.onMessage('game_state', (msg: { state: PlayerGameStateDTO }) => {
          setGameState(msg.state);
          const nextClockKey = timerClockKey(msg.state);
          const previousClockKey = timerClockKeyRef.current;
          const initialTimers = normalizeTimerValues(msg.state.timers);
          if (initialTimers) {
            timerClockKeyRef.current = nextClockKey;
          }
          // Seed the initial snapshot and refresh it when the decision changes.
          // Ignore same-decision snapshots so a late game_state cannot rewind a
          // countdown already advanced by timer_update.
          if (initialTimers && (!timerStreamActive.current || previousClockKey !== nextClockKey)) {
            setTimers(
              initialTimers,
              msg.state.timerServerTime,
              msg.state.timerEpoch,
              msg.state.trickPauseRemainingMs,
            );
          } else if (previousClockKey !== nextClockKey) {
            timerClockKeyRef.current = nextClockKey;
            setTimers(
              fallbackTimerValues(msg.state),
              undefined,
              msg.state.timerEpoch,
              msg.state.trickPauseRemainingMs,
            );
          }
        });

        // The game_state message carries the authoritative played-card table state.
        // Register this supplemental event because Colyseus warns on unhandled messages.
        room.onMessage('card_played', () => undefined);

        room.onMessage('timer_update', (msg: {
          timers: { seat: 0|1|2|3; baseTurnMs: number }[];
          serverTime?: number;
          timerEpoch?: number;
          trickPauseRemainingMs?: number | null;
        }) => {
          const normalizedTimers = normalizeTimerValues(msg.timers);
          if (!normalizedTimers) return;
          timerStreamActive.current = true;
          const currentGameState = useGameStore.getState().gameState;
          if (currentGameState) timerClockKeyRef.current = timerClockKey(currentGameState);
          setTimers(normalizedTimers, msg.serverTime, msg.timerEpoch, msg.trickPauseRemainingMs);
        });

        room.onMessage('observer_game_state', (msg: { state: ObserverGameStateDTO }) => {
          setObserverState(msg.state);
        });

        room.onMessage('chat_message', (msg: ChatMessage) => {
          addChatMessage(msg);
        });

        room.onMessage('trump_declared', () => undefined);
        room.onMessage('contra_called', () => undefined);
        room.onMessage('trick_completed', () => undefined);
        room.onMessage('round_ended', () => undefined);
        room.onMessage('game_ended', (msg: { scores: [number, number]; winner: 0 | 1 }) => {
          setGameResult({ scores: msg.scores, winner: msg.winner });
        });

        room.onMessage('player_connected', (msg: { seat?: number; username?: string }) => {
          if (msg.seat !== undefined) updatePlayerConnectivity(msg.seat, true, msg.username);
        });

        room.onMessage('player_disconnected', (msg: { seat: number }) => {
          updatePlayerConnectivity(msg.seat, false);
        });
        room.onMessage('reaction', (msg: ReactionEvent) => {
          const seat = msg.fromSeat;
          if (!Number.isInteger(seat) || seat < 0 || seat > 3) return;
          const reaction: ActiveGameReaction = { ...msg, id: ++reactionSequenceRef.current };
          setActiveReactions((previous) => ({ ...previous, [seat]: reaction }));

          const previousTimeout = reactionTimeoutsRef.current.get(seat);
          if (previousTimeout !== undefined) window.clearTimeout(previousTimeout);
          const timeout = window.setTimeout(() => {
            setActiveReactions((previous) => {
              if (previous[seat]?.id !== reaction.id) return previous;
              const next = { ...previous };
              delete next[seat];
              return next;
            });
            reactionTimeoutsRef.current.delete(seat);
          }, 2_300);
          reactionTimeoutsRef.current.set(seat, timeout);
          playReactionSound(msg.reaction);
        });

        room.onMessage('premade_message', (msg: { fromUsername: string; fromSeat: number; key: string }) => {
          addChatMessage({
            fromUsername: msg.fromUsername,
            fromSeat: msg.fromSeat,
            text: t('premade.' + msg.key),
            timestamp: Date.now(),
          });
        });
        room.onMessage('error', (msg: { code: string; message: string }) => {
          if (msg.code === 'REACTION_RATE_LIMITED') return;
          if (msg.code === 'INVALID_REACTION') {
            console.warn('[room] invalid reaction rejected by server');
            return;
          }
          if (msg.code === 'COMMAND_ERROR') {
            // Let pending card submissions recover when the server rejects a move.
            setCommandErrorVersion((version) => version + 1);
            console.warn('[room] command error:', msg.message);
            return;
          }
          setError(msg.message);
        });

        room.onMessage('lobby_timeout', () => {
          setError(t('toast.lobbyTimeout'));
          roomRef.current = null;
        });

        room.onLeave(() => {
          if (roomRef.current !== room) return;
          setConnected(false);
          setRoomPlayers([]);
          roomRef.current = null;
          if (!intentionalLeaveRef.current && !useGameStore.getState().gameResult) {
            setError(t('game.connectionLost'));
          }
        });

        room.onError((code, message) => {
          setError(t('toast.roomError', { code, message }));
        });
      } catch (err) {
        if (intentionalLeaveRef.current) return;
        // A failed connection attempt must not permanently consume this
        // module-level guard; the user may retry while the reservation is valid.
        if (seatReservation) attemptedReservations.delete(seatReservation.sessionId);
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

      reset,
      t,
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

  const sendPassContra = useCallback(() => {
    roomRef.current?.send('pass_contra', {});
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

  const sendReaction = useCallback((reaction: ReactionMood) => {
    roomRef.current?.send('send_reaction', { reaction });
  }, []);

  const sendPremade = useCallback((key: string) => {
    roomRef.current?.send('send_premade', { key });
  }, []);

  const leaveRoom = useCallback(() => {
    intentionalLeaveRef.current = true;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) void room.leave();
    setRoomPlayers([]);
    for (const timeout of reactionTimeoutsRef.current.values()) window.clearTimeout(timeout);
    reactionTimeoutsRef.current.clear();
    setActiveReactions({});
  }, []);

  const mutePlayer = useCallback((seat: number) => {
    roomRef.current?.send('mute_player', { seat });
  }, []);

  const unmutePlayer = useCallback((seat: number) => {
    roomRef.current?.send('unmute_player', { seat });
  }, []);

  useEffect(() => {
    return () => {
      intentionalLeaveRef.current = true;
      roomRef.current?.leave();
      for (const timeout of reactionTimeoutsRef.current.values()) window.clearTimeout(timeout);
      reactionTimeoutsRef.current.clear();
      reset();
    };
  }, [reset]);

  return {
    connect,
    sendDeclareTrump,
    sendPlayCard,
    sendPassDeclaration,
    sendPassContra,
    sendCallContra,
    sendChatMessage,
    sendSurrenderRequest,
    sendSurrenderRespond,
    sendReaction,
    sendPremade,
    leaveRoom,
    mutePlayer,
    unmutePlayer,
    commandErrorVersion,
    roomPlayers,
    activeReactions,
  };
}
