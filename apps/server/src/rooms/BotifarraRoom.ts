import { Room, Client } from 'colyseus';
import { Schema, type, MapSchema } from '@colyseus/schema';

import type { ClientCommand, ReactionEmoji, PremadeMessageKey } from '@botifarra/shared';
import type { ObserverGameStateDTO } from '@botifarra/shared';
import {
  createRoomState,
  assignSeat,
  assignSpecificSeat,
  isRoomFull,
  seatForSession,
  findSeatForUser,
  reassignSessionToSeat,
  startRound,
  handleDeclareTrump,
  handlePlayCard,
  handlePassDeclaration,
  handleCallContra,
} from './game-logic.js';
import type { RoomGameState } from './game-logic.js';
import { currentPlayerSeat, isTrumpDeclaration } from '@botifarra/core';
import type { Seat } from '@botifarra/core';
import type { PrismaClient } from '@prisma/client';
import type { SerializableRoomSnapshot } from '../services/persistence.js';
import { finalizeMatch, updateUserStats, updateRatings, saveGameSnapshot, clearGameSnapshot, deserializeSnapshot } from '../services/persistence.js';
import { setUserActiveGame, clearUserActiveGame } from '../routes/friends.js';
import { TRICK_PAUSE_DURATION_MS } from '@botifarra/shared';

/** Keep the final trick visible long enough to read and animate into its won-trick pile. */
export const FINAL_TRICK_READ_AND_ANIMATION_MS = TRICK_PAUSE_DURATION_MS;

// Module-level Prisma reference — set from index.ts after DB connects
let _prisma: PrismaClient | null = null;
export function setPrismaForRooms(p: PrismaClient) {
  _prisma = p;
}

// ---------------------------------------------------------------------------
// Colyseus schema — minimal serialisable state shared with all clients
// ---------------------------------------------------------------------------

export class PlayerSchema extends Schema {
  @type('string') userId: string = '';
  @type('string') username: string = '';
  @type('uint8') seat: number = 0;
  @type('boolean') connected: boolean = true;
}

export class BotifarraRoomState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type('string') phase: string = 'lobby';
  @type('int32') score0: number = 0;
  @type('int32') score1: number = 0;
  @type('uint8') roundNumber: number = 0;
  @type('string') trump: string = '';
  @type('int8') currentPlayerSeat: number = -1;
}

// ---------------------------------------------------------------------------
// BotifarraRoom
// ---------------------------------------------------------------------------

/** Options passed when creating/joining a room */
export interface BotifarraRoomOptions {
  matchId?: string;
  targetScore?: number;
  ranked?: boolean;
  /** Original match creation timestamp (ms). Used to preserve the 4-hour timeout across resumes. */
  matchCreatedAt?: number;
  /** If set, fill remaining seats (up to 4) with bot players */
  fillBots?: boolean;
  /** How many human players are expected (used with fillBots). Default 4. */
  humanPlayers?: number;
  /** Lobby deadline override for rooms waiting on invited players. */
  lobbyTimeoutMs?: number;
  /** Pre-assigned seats from matchmaking: userId → seat number */
  seatAssignments?: Record<string, number>;
  /** Serialized snapshot to restore (resume flow) */
  initialSnapshot?: SerializableRoomSnapshot;
}

export class BotifarraRoom extends Room<BotifarraRoomState, BotifarraRoomOptions> {
  override maxClients = 20; // 4 players + up to 16 observers

  protected gameState!: RoomGameState;
  protected matchId: string = '';
  private targetScore: number = 101;
  protected fillBots: boolean = false;
  protected humanPlayersExpected: number = 4;
  protected botSeeds = new Set<string>();
  protected ranked: boolean = false;

  /** Pre-assigned seats from matchmaking (userId → seat). Empty for ad-hoc rooms. */
  private seatAssignments: Record<string, number> = {};

  // Reconnect tokens
  private reconnectTokens = new Map<string, ReturnType<typeof this.allowReconnection>>();

  /** Observer clients (spectating friends) — sessionId → { client, username, userId } */
  private observers = new Map<string, { client: Client; username: string; userId: string }>();

  /** Chat rate-limiter: sessionId → timestamps of recent messages */
  private chatRateLimit = new Map<string, number[]>();

  private static readonly CHAT_MAX_LENGTH = 200;
  private static readonly CHAT_RATE_WINDOW_MS = 3000;
  private static readonly CHAT_RATE_MAX = 5;

  // -- Reaction rate limiting --
  private static readonly REACTION_RATE_WINDOW_MS = 60_000; // 1 minute
  private static readonly REACTION_RATE_MAX = 5; // 5 reactions per minute
  private reactionRateLimit = new Map<string, number[]>();

  private static readonly VALID_EMOJIS: Set<ReactionEmoji> = new Set([
    'happy', 'sad', 'cry', 'applause', 'celebrate', 'money', 'cigar', 'wine', 'beer',
  ]);
  private static readonly VALID_PREMADES: Set<PremadeMessageKey> = new Set([
    'bona_sort', 'ben_jugat', 'quina_sort', 'au_va', 'botifarra',
    'fill_meu_tingues_bo', 'joc_de_muts', 'salut_i_manilles', 'sortida_animal', 'gg',
  ]);

  /** Per-session muted seats (match-scoped) */
  private mutedSeats = new Map<string, Set<number>>();

  // -- Surrender state --
  private surrenderPending: { requestingSeat: Seat; partnerSeat: Seat; requestedAt: number } | null = null;

  // -- 4-hour timeout --
  private static readonly GAME_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
  // -- Lobby fill timeout: if not full after reservation time + buffer, close --
  private static readonly LOBBY_FILL_TIMEOUT_MS = 150_000; // 2.5 minutes (>120s reservation)
  private lobbyFillTimeoutMs = BotifarraRoom.LOBBY_FILL_TIMEOUT_MS;
  private gameStartedAt: number = 0;
  private endReason: string | null = null;
  private gameFinished = false;

  // -- Decision timers --
  private static readonly DECLARATION_TURN_MS = 30_000; // 30 seconds to choose trump
  private static readonly CARD_TURN_MS = 15_000; // 15 seconds to play a card
  private static readonly CONTRA_TIMEOUT_MS = 30_000; // 30 seconds per contra decision
  private static readonly TIMEOUT_PENALTY_POINTS = 36;
  private roundTimeoutHandled = false;
  private pendingRoundTransition: ReturnType<typeof setTimeout> | null = null;
  protected turnStartedAt: number = 0;
  private timerEpoch = 0;
  private lastTimerBroadcast: number = 0;
  /** Which team (0 or 1) currently has to decide contra/recontro/sant vicenç. Null outside contra phase. */
  protected contraDecidingTeam: 0 | 1 | null = null;
  /** Each deciding-team player must confirm a pass; a call still resolves immediately. */
  protected contraPassVotes = new Set<Seat>();

  // -- Fixed pause: let players review the completed trick before the next one --
  private static readonly TRICK_PAUSE_MS = TRICK_PAUSE_DURATION_MS;
  protected trickPauseLeader: Seat | null = null;
  private trickPauseStartedAt: number = 0;
  private trickPauseTimeout: ReturnType<typeof setTimeout> | null = null;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  override onCreate(options: BotifarraRoomOptions) {
    this.matchId = options.matchId ?? this.roomId;
    this.targetScore = options.targetScore ?? 101;
    this.fillBots = options.fillBots ?? false;
    this.humanPlayersExpected = options.humanPlayers ?? 4;
    this.lobbyFillTimeoutMs = options.lobbyTimeoutMs ?? BotifarraRoom.LOBBY_FILL_TIMEOUT_MS;
    this.seatAssignments = options.seatAssignments ?? {};
    this.ranked = options.ranked ?? false;
    // Use the original match creation time if provided (resume flow),
    // so the 4-hour timeout is measured from when the match was FIRST created,
    // not from when this room instance was spun up.
    this.gameStartedAt = options.matchCreatedAt ?? Date.now();

    // Give clients 2 minutes to consume their seat reservation.
    // The default (15 s) is too short: polling (2 s) + navigation + React mount
    // can easily exceed it, causing "seat reservation expired" errors.
    this.setSeatReservationTime(120);

    // If filling with bots, restrict maxClients to human player count
    if (this.fillBots) {
      this.maxClients = this.humanPlayersExpected;
    }

    this.setState(new BotifarraRoomState());

    // Restore from snapshot if provided (resume flow)
    if (options.initialSnapshot) {
      try {
        this.gameState = deserializeSnapshot(options.initialSnapshot);
        this.contraDecidingTeam =
          'contraDecidingTeam' in options.initialSnapshot
            ? options.initialSnapshot.contraDecidingTeam ?? null
            : this.getContraDecidingTeamForRound(this.gameState.round);
        this.contraPassVotes = new Set(
          this.contraDecidingTeam === null
            ? []
            : (options.initialSnapshot.contraPassVotes ?? []).filter(
                (seat) => seat % 2 === this.contraDecidingTeam,
              ),
        );
        // Restore Colyseus schema state from snapshot
        this.state.phase = this.gameState.phase;
        this.state.score0 = this.gameState.game.scores[0];
        this.state.score1 = this.gameState.game.scores[1];
        this.state.roundNumber = this.gameState.game.roundNumber;
        // Re-inject bot seats that were present in the snapshot
        for (const [seat, info] of this.gameState.seats) {
          if (info.userId.startsWith('bot-')) {
            this.botSeeds.add(info.sessionId);
            const player = new PlayerSchema();
            player.userId = info.userId;
            player.username = info.username;
            player.seat = seat;
            player.connected = true;
            this.state.players.set(info.sessionId, player);
          }
        }
      } catch (err) {
        console.error('[BotifarraRoom] Failed to restore snapshot, starting fresh:', err);
        this.gameState = createRoomState(this.targetScore);
      }
    } else {
      this.gameState = createRoomState(this.targetScore);
    }

    this.onMessage('*', (client, type, message) => {
      this.handleCommand(client, type as string, message);
    });

    this.setSimulationInterval(() => this.tick(), 1000);
  }

  override onJoin(
    client: Client,
    options: BotifarraRoomOptions & { userId?: string; username?: string; observe?: boolean },
  ) {
    const userId = options.userId ?? client.sessionId;
    const username = options.username ?? `Player-${client.sessionId.slice(0, 4)}`;

    // Observer mode — spectators don't take a seat
    if (options.observe) {
      this.observers.set(client.sessionId, { client, username, userId });
      this.broadcast('observer_joined', { username });
      // Send the current game state (observer view) if game is in progress
      if (this.gameState.round) {
        this.sendObserverStateTo(client);
      }
      return;
    }

    try {
      // Check if this user already has a seat (reconnection case)
      const existingSeat = findSeatForUser(this.gameState, userId);

      let seat: Seat;
      if (existingSeat !== null) {
        // User is reconnecting — get old sessionId before reassigning
        const oldSessionId = this.gameState.seats.get(existingSeat)?.sessionId;

        // Reassign their seat with the new sessionId
        this.gameState = reassignSessionToSeat(this.gameState, existingSeat, client.sessionId);
        seat = existingSeat;

        // Remove old schema entry if it exists
        if (oldSessionId && oldSessionId !== client.sessionId) {
          this.state.players.delete(oldSessionId);
        }
      } else {
        // New player — assign a seat
        const assignedSeat = this.seatAssignments[userId];
        const isPartnerPractice = this.fillBots && this.humanPlayersExpected === 2;
        const partnerPracticeSeat = assignedSeat ?? (isPartnerPractice ? 2 : undefined);
        const result =
          partnerPracticeSeat !== undefined
            ? assignSpecificSeat(
                this.gameState,
                client.sessionId,
                userId,
                username,
                partnerPracticeSeat as Seat,
              )
            : assignSeat(this.gameState, client.sessionId, userId, username);
        this.gameState = result.state;
        seat = result.seat;
      }

      // Update Colyseus schema
      const player = new PlayerSchema();
      player.userId = userId;
      player.username = username;
      player.seat = seat;
      player.connected = true;
      this.state.players.set(client.sessionId, player);

      // Broadcast join event
      this.broadcast('player_connected', { seat, username });

      // Track this user's active game for friends system
      setUserActiveGame(userId, this.roomId);

      // If player is rejoining an in-progress game, send them the current state
      // and refresh all other connected players (their names panel may show '?' until now)
      if (existingSeat !== null && this.gameState.round) {
        this.sendGameStateTo(client, seat);
        // Push a fresh game_state to every other already-connected player so
        // their playerNames row updates without waiting for the next card play.
        for (const [sid, ps] of this.state.players) {
          if (sid === client.sessionId) continue;
          const otherClient = this.clients.find((c) => c.sessionId === sid);
          if (otherClient) this.sendGameStateTo(otherClient, ps.seat as 0 | 1 | 2 | 3);
        }
      }

      // Auto-start only when filling seats for the FIRST time (lobby phase).
      // Reconnecting players (existingSeat !== null) must never trigger a new round —
      // the game is already in progress.
      if (this.gameState.phase === 'lobby') {
        if (isRoomFull(this.gameState)) {
          this.startNewRoundPublic();
        } else if (
          this.fillBots &&
          [...this.gameState.seats.values()].filter((seatInfo) => !this.botSeeds.has(seatInfo.sessionId)).length >=
            this.humanPlayersExpected
        ) {
          // Fill remaining seats with bots then start
          const botsNeeded = 4 - this.gameState.seats.size;
          for (let i = 0; i < botsNeeded; i++) {
            const fakeSid = `bot-fill-${i}-${this.roomId}`;
            this.botSeeds.add(fakeSid);
            this.injectBotSeat(fakeSid, `Bot-${i + 1}`);
          }
          this.startNewRoundPublic();
        }
      }
    } catch (err) {
      // Room full or other error — kick the client
      client.leave(4000);
    }
  }

  override async onLeave(client: Client, consented: boolean) {
    // Handle observer leaving
    const observer = this.observers.get(client.sessionId);
    if (observer) {
      this.observers.delete(client.sessionId);
      this.broadcast('observer_left', { username: observer.username });
      return;
    }

    const player = this.state.players.get(client.sessionId);
    if (player && consented && this.gameState.phase === 'lobby') {
      const seat = player.seat as Seat;
      const seatInfo = this.gameState.seats.get(seat);
      if (seatInfo?.sessionId === client.sessionId) {
        this.gameState.seats.delete(seat);
        if (!(this.fillBots && this.humanPlayersExpected === 2)) {
          delete this.seatAssignments[seatInfo.userId];
        }
        clearUserActiveGame(seatInfo.userId);
      }
      // A deliberate exit frees the waiting seat and removes the departed player
      // from the roster so another code-holder can take their place.
      this.state.players.delete(client.sessionId);
      return;
    }

    if (player) {
      player.connected = false;
      this.broadcast('player_disconnected', { seat: player.seat });
    }

    if (!consented && this.gameState.phase === 'playing') {
      const reconnection = this.allowReconnection(client, 60);
      this.reconnectTokens.set(client.sessionId, reconnection);
      try {
        await reconnection;
        if (player) player.connected = true;
        this.broadcast('player_connected', { seat: player?.seat, username: player?.username });
        this.sendGameStateTo(client);
      } catch {
        this.reconnectTokens.delete(client.sessionId);
      }
    }
  }

  override onDispose() {
    this.cancelPendingRoundTransition();
    this.clearTrickPause();
    // Clear active game tracking for all players
    for (const [, info] of this.gameState.seats) {
      clearUserActiveGame(info.userId);
    }
    this.gameState.seats.clear();
  }

  // ---------------------------------------------------------------------------
  // Inject a virtual (bot) seat without a real Client object
  // ---------------------------------------------------------------------------

  protected injectBotSeat(sessionId: string, username: string) {
    try {
      const { state, seat } = assignSeat(this.gameState, sessionId, sessionId, username);
      this.gameState = state;
      const player = new PlayerSchema();
      player.userId = sessionId;
      player.username = username;
      player.seat = seat;
      player.connected = true;
      this.state.players.set(sessionId, player);
    } catch {
      // ignore if room full
    }
  }

  // ---------------------------------------------------------------------------
  // Command routing
  // ---------------------------------------------------------------------------

  private handleCommand(client: Client, type: string, payload: unknown) {
    try {
      switch (type) {
        case 'declare_trump': {
          const declaration = (payload as { declaration?: unknown } | null)?.declaration;
          if (!isTrumpDeclaration(declaration)) {
            throw new Error('Invalid trump declaration');
          }
          const { state, events } = handleDeclareTrump(
            this.gameState,
            client.sessionId,
            declaration,
          );
          this.resetTurnTimer();
          this.gameState = state;
          this.syncSchemaPublic();
          for (const event of events) this.broadcastEvent(event);
          // Trump declared — contra phase begins. Non-declarant team decides first.
          this.contraDecidingTeam = this.getContraDecidingTeamForRound(this.gameState.round);
          this.contraPassVotes.clear();
          // Send each player their personalized game state
          this.broadcastGameState();
          this.broadcastTimerState();
          this.lastTimerBroadcast = performance.now();
          this.persistSnapshot();
          break;
        }
        case 'play_card': {
          if (this.contraDecidingTeam !== null) {
            client.send('error', {
              code: 'COMMAND_ERROR',
              message: 'The contra decision must be resolved before playing a card',
            });
            break;
          }
          if (this.trickPauseLeader !== null) {
            client.send('error', {
              code: 'COMMAND_ERROR',
              message: 'Cannot play a card while the trick is paused',
            });
            break;
          }
          const { card } = payload as { card: { suit: string; rank: number } };
          const { state, events, roundEnded, trickCompleted } = handlePlayCard(
            this.gameState,
            client.sessionId,
            card,
          );
          // Only consume time and end the contra window after a valid play.
          this.resetTurnTimer();
          this.gameState = state;
          this.syncSchemaPublic();
          const deferGameEnd = roundEnded && this.gameState.phase === 'finished';
          for (const event of events) {
            // The final-trick reveal is followed by onGameFinished(), which sends
            // the game_ended event after the client animation has completed.
            if (deferGameEnd && event.type === 'game_ended') continue;
            this.broadcastEvent(event);
          }
          if (!roundEnded && trickCompleted) {
            const lastTrick = this.gameState.round!.completedTricks.at(-1)!;
            this.startTrickPause(lastTrick.winner as Seat);
          }
          // Send the completed trick and pause state together, so clients never see
          // an empty table between the final card and the synchronized reveal.
          this.broadcastGameState();
          this.broadcastTimerState();
          this.lastTimerBroadcast = performance.now();
          if (roundEnded) {
            if (this.gameState.phase === 'finished') {
              setTimeout(() => this.onGameFinished(), FINAL_TRICK_READ_AND_ANIMATION_MS);
            } else {
              // Save snapshot after each round while still in-progress
              this.persistSnapshot();
              // Show the completed last trick for 5s, then start the new round after 15s total
              this.scheduleRoundTransition(15_000);
            }
          } else if (trickCompleted) {
            // Save the pause state so reconnecting clients can resume the reveal.
            this.persistSnapshot();
          } else {
            // Save snapshot after each card play (throttled to avoid excessive writes)
            this.persistSnapshot();
          }
          break;
        }
        case 'pass_declaration': {
          const passingSeat = this.gameState.round?.declarantSeat ?? null;
          const { state, events } = handlePassDeclaration(this.gameState, client.sessionId);
          if (passingSeat !== null) this.resetTurnTimer();
          this.gameState = state;
          this.syncSchemaPublic();
          for (const event of events) this.broadcastEvent(event);
          this.broadcastGameState();
          this.broadcastTimerState();
          this.lastTimerBroadcast = performance.now();
          break;
        }
        case 'pass_contra': {
          const seat = this.seatForClient(client);
          if (seat === null) throw new Error('Session not in room');
          this.registerContraPass(seat);
          this.broadcastGameState();
          this.broadcastTimerState();
          this.lastTimerBroadcast = performance.now();
          this.persistSnapshot();
          break;
        }
        case 'call_contra': {
          const callerSeat = this.seatForClient(client);
          if (callerSeat === null) throw new Error('Session not in room');
          if (
            this.contraDecidingTeam === null ||
            callerSeat % 2 !== this.contraDecidingTeam
          ) {
            throw new Error('Your team is not deciding contra');
          }
          const { state, events } = handleCallContra(this.gameState, client.sessionId);
          this.resetTurnTimer();
          this.gameState = state;
          this.syncSchemaPublic();
          for (const event of events) this.broadcastEvent(event);
          this.contraDecidingTeam = this.getContraDecidingTeamForRound(this.gameState.round);
          this.contraPassVotes.clear();
          this.broadcastGameState();
          // Immediately push a fresh timer broadcast so clients see the reset instantly
          this.broadcastTimerState();
          this.lastTimerBroadcast = performance.now();
          this.persistSnapshot();
          break;
        }
        case 'chat_message': {
          this.handleChatMessage(client, payload);
          break;
        }
        case 'send_reaction': {
          this.handleReaction(client, payload);
          break;
        }
        case 'send_premade': {
          this.handlePremade(client, payload);
          break;
        }
        case 'mute_player': {
          this.handleMute(client, payload);
          break;
        }
        case 'unmute_player': {
          this.handleUnmute(client, payload);
          break;
        }
        case 'surrender_request': {
          this.handleSurrenderRequest(client);
          break;
        }
        case 'surrender_respond': {
          const { accept } = payload as { accept: boolean };
          this.handleSurrenderResponse(client, accept);
          break;
        }
        default:
          client.send('error', { code: 'UNKNOWN_COMMAND', message: `Unknown command: ${type}` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.send('error', { code: 'COMMAND_ERROR', message });
    }
  }

  // ---------------------------------------------------------------------------
  // Snapshot persistence
  // ---------------------------------------------------------------------------

  /** Fire-and-forget snapshot save. Only persists while game is in-progress. */
  protected persistSnapshot() {
    if (!_prisma || this.gameState.phase !== 'playing') return;
    const prisma = _prisma;
    const matchId = this.matchId;
    const state = this.gameState;
    void saveGameSnapshot(
      prisma,
      matchId,
      state,
      this.contraDecidingTeam,
      [...this.contraPassVotes],
    ).catch((err) => {
      console.error('[BotifarraRoom] Snapshot save error:', err);
    });
  }

  // ---------------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------------

  protected startNewRoundPublic() {
    if (this.gameFinished || this.gameState.phase === 'finished') return;
    this.cancelPendingRoundTransition();
    this.roundTimeoutHandled = false;
    this.gameState = startRound(this.gameState);
    this.syncSchemaPublic();

    // Start the fixed clock for the first decision of the new round.
    this.startTurnTimerClock();
    this.lastTimerBroadcast = 0;
    this.contraDecidingTeam = null;
    this.contraPassVotes.clear();
    this.clearTrickPause();

    // Send each human player only their own hand
    for (const [sessionId, playerSchema] of this.state.players) {
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (!client) continue; // bot — no real client
      const seat = playerSchema.seat as 0 | 1 | 2 | 3;
      this.sendGameStateTo(client, seat);
    }
    // Immediately broadcast fresh timer state so client interpolator starts cleanly
    this.broadcastTimerState();
    this.lastTimerBroadcast = performance.now();
  }

  /** Build map of seat → username from the Colyseus schema or room state */
  private getPlayerNames(): Record<0 | 1 | 2 | 3, string> {
    // Start from the authoritative game state (always populated, even on resume before all rejoin)
    const names: Record<number, string> = { 0: '?', 1: '?', 2: '?', 3: '?' };
    for (const [seat, info] of this.gameState.seats) {
      names[seat] = info.username;
    }
    // Override with Colyseus schema in case username changed (shouldn't happen, but safe)
    for (const [, ps] of this.state.players) {
      names[ps.seat] = ps.username;
    }
    return names as Record<0 | 1 | 2 | 3, string>;
  }

  protected sendGameStateTo(client: Client, seat?: 0 | 1 | 2 | 3) {
    const round = this.gameState.round;
    if (!round) return;
    const playerSeat =
      seat ?? (this.state.players.get(client.sessionId)?.seat as 0 | 1 | 2 | 3 | undefined);
    if (playerSeat === undefined) return;

    const statePayload: Record<string, unknown> = {
      matchId: this.matchId,
      roundNumber: this.gameState.game.roundNumber,
      dealerSeat: round.dealerSeat,
      declarantSeat: round.declarantSeat,
      trump: round.trump,
      hand: round.hands[playerSeat],
      mySeat: playerSeat,
      playerNames: this.getPlayerNames(),
      handSizes: {
        0: round.hands[0].length,
        1: round.hands[1].length,
        2: round.hands[2].length,
        3: round.hands[3].length,
      },
      currentTrick: round.currentTrick,
      completedTricks: round.completedTricks,
      currentLeader: round.currentLeader,
      scores: this.gameState.game.scores,
      // During trick pause, suppress currentPlayerSeat so client knows nobody can play yet
      currentPlayerSeat: this.trickPauseLeader !== null ? null : currentPlayerSeat(round),
      dealerPassed: round.dealerPassed,
      contraLevel: round.contraLevel,
      contraDecidingTeam: this.contraDecidingTeam,
      contraPassVotes: [...this.contraPassVotes],
      ranked: this.ranked,
      trickPauseLeader: this.trickPauseLeader,
      trickPauseStartedAt: this.trickPauseStartedAt || null,
    };

    if (this.surrenderPending) {
      statePayload['surrenderPending'] = {
        requestingSeat: this.surrenderPending.requestingSeat,
        partnerSeat: this.surrenderPending.partnerSeat,
      };
    }

    // Always include timer state for all game types
    {
      const timerServerTime = performance.now();
      const elapsed = timerServerTime - this.turnStartedAt;
      const activeSeats = new Set(this.getActiveTimerSeats(round));
      const decisionBaseMs = this.getCurrentDecisionBaseMs();
      statePayload['timerServerTime'] = timerServerTime;
      statePayload['timerEpoch'] = this.timerEpoch;
      statePayload['trickPauseRemainingMs'] = this.trickPauseLeader === null
        ? null
        : Math.max(0, BotifarraRoom.TRICK_PAUSE_MS - (timerServerTime - this.trickPauseStartedAt));
      statePayload['timers'] = ([0, 1, 2, 3] as Seat[]).map((s) => {
        const isSeatActive = activeSeats.has(s);
        return {
          seat: s,
          baseTurnMs: isSeatActive && this.turnStartedAt > 0
            ? Math.max(0, decisionBaseMs - elapsed)
            : -1,
        };
      });
    }

    client.send('game_state', { type: 'game_state', state: statePayload });
  }

  protected onGameFinished() {
    if (this.gameFinished) return;
    this.gameFinished = true;
    this.roundTimeoutHandled = true;
    this.cancelPendingRoundTransition();
    this.clearTrickPause();

    const { scores } = this.gameState.game;
    const winner: 0 | 1 = scores[0] >= scores[1] ? 0 : 1;
    this.endReason = this.endReason ?? 'normal';
    this.broadcast('game_ended', { scores, winner });

    // Clear active game tracking for all players
    for (const [, info] of this.gameState.seats) {
      clearUserActiveGame(info.userId);
    }

    // Persist match result asynchronously
    if (_prisma) {
      const prisma = _prisma;
      const matchId = this.matchId;
      const ranked = this.ranked;
      const endReason = this.endReason;
      const abandoned = endReason === 'surrender';
      void (async () => {
        try {
          await finalizeMatch(prisma, matchId, scores[0], scores[1], winner, endReason, abandoned);
          await updateUserStats(prisma, matchId, winner);
          // Only update ratings for ranked games
          if (ranked) {
            await updateRatings(prisma, matchId, winner);
          }
        } catch (err) {
          console.error('[BotifarraRoom] Persistence error:', err);
        }
      })();
    }

    setTimeout(() => this.disconnect(), 5000);
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  protected syncSchemaPublic() {
    const { game, phase } = this.gameState;
    this.state.phase = phase;
    this.state.score0 = game.scores[0];
    this.state.score1 = game.scores[1];
    this.state.roundNumber = game.roundNumber;

    const round = this.gameState.round;
    if (round) {
      this.state.trump = round.trump ?? '';
      this.state.currentPlayerSeat = currentPlayerSeat(round) ?? -1;
    }
  }

  protected broadcastEvent(event: { type: string }) {
    // game_state events returned by the game-logic helpers contain the
    // acting player's private hand. Game state is sent separately, per seat,
    // by broadcastGameState() immediately after command handling.
    if (event.type === 'game_state') return;

    // Private snapshots were filtered above; the remaining events are public.
    this.broadcast(event.type, event);
  }

  /** Send each human client their personalized game state */
  protected broadcastGameState() {
    for (const [sessionId, playerSchema] of this.state.players) {
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (!client) continue; // bot — no real client
      const seat = playerSchema.seat as 0 | 1 | 2 | 3;
      this.sendGameStateTo(client, seat);
    }
    // Also send observer state to all spectators
    this.broadcastObserverState();
  }

  // ---------------------------------------------------------------------------
  // Observer support
  // ---------------------------------------------------------------------------

  /** Build observer state (no hand info) and send to a specific observer */
  protected sendObserverStateTo(client: Client) {
    const round = this.gameState.round;
    if (!round) return;
    const observerState: ObserverGameStateDTO = {
      matchId: this.matchId,
      roundNumber: this.gameState.game.roundNumber,
      dealerSeat: round.dealerSeat,
      declarantSeat: round.declarantSeat,
      trump: round.trump,
      playerNames: this.getPlayerNames(),
      handSizes: {
        0: round.hands[0].length,
        1: round.hands[1].length,
        2: round.hands[2].length,
        3: round.hands[3].length,
      },
      currentTrick: round.currentTrick,
      completedTricks: round.completedTricks,
      currentLeader: round.currentLeader,
      scores: this.gameState.game.scores,
      currentPlayerSeat: currentPlayerSeat(round),
      contraLevel: round.contraLevel,
      contraDecidingTeam: this.contraDecidingTeam,
      contraPassVotes: [...this.contraPassVotes],
    };
    client.send('observer_game_state', { type: 'observer_game_state', state: observerState });
  }

  /** Send observer state to all spectators */
  private broadcastObserverState() {
    for (const [, obs] of this.observers) {
      this.sendObserverStateTo(obs.client);
    }
  }

  // ---------------------------------------------------------------------------
  // Surrender
  // ---------------------------------------------------------------------------

  private handleSurrenderRequest(client: Client) {
    if (this.gameState.phase !== 'playing') {
      client.send('error', { code: 'NOT_PLAYING', message: 'Game is not in progress' });
      return;
    }
    if (this.surrenderPending) {
      client.send('error', { code: 'SURRENDER_PENDING', message: 'A surrender is already pending' });
      return;
    }
    const playerSchema = this.state.players.get(client.sessionId);
    if (!playerSchema) return;
    const seat = playerSchema.seat as Seat;
    // Partner is on the same team: seats 0,2 are team 0; seats 1,3 are team 1
    const partnerSeat = (seat + 2) % 4 as Seat;

    this.surrenderPending = { requestingSeat: seat, partnerSeat, requestedAt: Date.now() };
    this.broadcast('surrender_requested', { requestingSeat: seat, partnerSeat });
  }

  private handleSurrenderResponse(client: Client, accept: boolean) {
    if (!this.surrenderPending) {
      client.send('error', { code: 'NO_SURRENDER', message: 'No surrender pending' });
      return;
    }
    const playerSchema = this.state.players.get(client.sessionId);
    if (!playerSchema) return;
    const seat = playerSchema.seat as Seat;

    // Only the partner can respond
    if (seat !== this.surrenderPending.partnerSeat) {
      client.send('error', { code: 'NOT_PARTNER', message: 'Only the partner can respond' });
      return;
    }

    if (accept) {
      // Requesting team loses
      const losingTeam: 0 | 1 = this.surrenderPending.requestingSeat % 2 === 0 ? 0 : 1;
      this.broadcast('surrender_resolved', { accepted: true, losingSeat: losingTeam });
      this.endReason = 'surrender';
      // Force game end: set winning team score high
      if (losingTeam === 0) {
        this.gameState.game.scores[1] = Math.max(this.gameState.game.scores[1], this.targetScore);
      } else {
        this.gameState.game.scores[0] = Math.max(this.gameState.game.scores[0], this.targetScore);
      }
      this.gameState.phase = 'finished';
      this.syncSchemaPublic();
      this.onGameFinished();
    } else {
      this.broadcast('surrender_resolved', { accepted: false });
    }
    this.surrenderPending = null;
  }

  // ---------------------------------------------------------------------------
  // 4-hour game timeout
  // ---------------------------------------------------------------------------

  private handleGameTimeout() {
    const { scores } = this.gameState.game;
    const winner: 0 | 1 | null = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : null;
    this.endReason = 'timeout';

    this.broadcast('game_timeout', { winner, finalScores: scores });

    if (winner !== null) {
      this.gameState.phase = 'finished';
      this.syncSchemaPublic();
      this.onGameFinished();
    } else {
      // Tied at timeout — mark as unresolved
      if (_prisma) {
        const prisma = _prisma;
        const matchId = this.matchId;
        void prisma.match.update({
          where: { id: matchId },
          data: { status: 'FINISHED', endReason: 'timeout_tie', finishedAt: new Date(), score0: scores[0], score1: scores[1] },
        }).catch(() => {});
      }
      setTimeout(() => this.disconnect(), 5000);
    }
  }

  // ---------------------------------------------------------------------------
  // Ranked turn timer
  // ---------------------------------------------------------------------------

  private handleRankedTimeout(timedOutSeat: Seat) {
    if (
      this.roundTimeoutHandled ||
      this.gameFinished ||
      this.gameState.phase !== 'playing'
    ) {
      return;
    }
    this.roundTimeoutHandled = true;

    // The timed-out player's team loses the round, other team gets 36 points
    const timedOutTeam: 0 | 1 = timedOutSeat % 2 === 0 ? 0 : 1;
    const scoringTeam: 0 | 1 = timedOutTeam === 0 ? 1 : 0;

    this.gameState.game.scores[scoringTeam] += BotifarraRoom.TIMEOUT_PENALTY_POINTS;

    this.broadcast('round_timeout', {
      timedOutSeat,
      penaltyPoints: BotifarraRoom.TIMEOUT_PENALTY_POINTS,
      scoringTeam,
    });

    // Check if game should end
    if (this.gameState.game.scores[scoringTeam] >= this.targetScore) {
      this.gameState.phase = 'finished';
      this.syncSchemaPublic();
      this.onGameFinished();
    } else {
      // Start a new round
      this.syncSchemaPublic();
      this.scheduleRoundTransition(2000);
    }
  }

  private scheduleRoundTransition(delayMs: number) {
    this.cancelPendingRoundTransition();
    if (this.gameFinished || this.gameState.phase === 'finished') return;

    this.pendingRoundTransition = setTimeout(() => {
      this.pendingRoundTransition = null;
      if (this.gameFinished || this.gameState.phase === 'finished') return;
      this.startNewRoundPublic();
    }, delayMs);
  }

  private cancelPendingRoundTransition() {
    if (this.pendingRoundTransition !== null) {
      clearTimeout(this.pendingRoundTransition);
      this.pendingRoundTransition = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Trick pause — automatically resume after the fixed review interval
  // ---------------------------------------------------------------------------

  private seatForClient(client: Client): Seat | null {
    const p = this.state.players.get(client.sessionId);
    return p ? (p.seat as Seat) : null;
  }

  protected startTrickPause(leader: Seat) {
    this.trickPauseLeader = leader;
    this.trickPauseStartedAt = performance.now();
    // Automatically advance when the review interval ends.
    if (this.trickPauseTimeout) clearTimeout(this.trickPauseTimeout);
    this.trickPauseTimeout = setTimeout(() => {
      if (this.trickPauseLeader !== null) {
        this.clearTrickPause();
        this.startTurnTimerClock();
        this.broadcastGameState();
        this.broadcastTimerState();
        this.lastTimerBroadcast = performance.now();
      }
    }, BotifarraRoom.TRICK_PAUSE_MS);
  }

  protected clearTrickPause() {
    this.trickPauseLeader = null;
    this.trickPauseStartedAt = 0;
    if (this.trickPauseTimeout) {
      clearTimeout(this.trickPauseTimeout);
      this.trickPauseTimeout = null;
    }
  }

  protected broadcastTimerState() {
    if (!this.gameState.round) return;
    const now = performance.now();
    const elapsed = now - this.turnStartedAt;

    // During trick pause, no seat is active — all timers show idle/frozen state
    if (this.trickPauseLeader !== null) {
      const timers = ([0, 1, 2, 3] as Seat[]).map((seat) => ({
        seat,
        baseTurnMs: -1,
      }));
      const trickPauseRemainingMs = Math.max(0, BotifarraRoom.TRICK_PAUSE_MS - (now - this.trickPauseStartedAt));
      this.broadcast('timer_update', {
        timers,
        serverTime: now,
        timerEpoch: this.timerEpoch,
        trickPauseRemainingMs,
      });
      return;
    }

    // A pending contra decision takes precedence over the next card player's turn.
    const activeSeats = new Set(this.getActiveTimerSeats(this.gameState.round));
    const decisionBaseMs = this.getCurrentDecisionBaseMs();
    const timers = ([0, 1, 2, 3] as Seat[]).map((seat) => {
      const isSeatActive = activeSeats.has(seat);

      return {
        seat,
        baseTurnMs: isSeatActive ? Math.max(0, decisionBaseMs - elapsed) : -1,
      };
    });

    this.broadcast('timer_update', {
      timers,
      serverTime: now,
      timerEpoch: this.timerEpoch,
      trickPauseRemainingMs: null,
    });
  }

  /** Seats currently sharing the active decision clock. */
  protected getActiveTimerSeats(round = this.gameState.round): Seat[] {
    if (!round || this.trickPauseLeader !== null) return [];
    if (this.contraDecidingTeam !== null) {
      return this.contraDecidingTeam === 0 ? [0, 2] : [1, 3];
    }
    if (round.trump === null) return [round.declarantSeat];
    const currentSeat = currentPlayerSeat(round);
    return currentSeat === null ? [] : [currentSeat];
  }

  private getCurrentDecisionBaseMs(): number {
    if (this.contraDecidingTeam !== null) return BotifarraRoom.CONTRA_TIMEOUT_MS;
    if (this.gameState.round?.trump == null) return BotifarraRoom.DECLARATION_TURN_MS;
    return BotifarraRoom.CARD_TURN_MS;
  }

  /** Resolve a team's contra decision by passing and start the card-play clock. */
  protected resolveContraPass(seat: Seat) {
    if (this.contraDecidingTeam === null || seat % 2 !== this.contraDecidingTeam) {
      throw new Error('Your team is not deciding contra');
    }
    this.resetTurnTimer();
    this.contraDecidingTeam = null;
    this.contraPassVotes.clear();
  }

  /** Record one player's pass and resolve only after both teammates pass. */
  protected registerContraPass(seat: Seat) {
    if (this.contraDecidingTeam === null || seat % 2 !== this.contraDecidingTeam) {
      throw new Error('Your team is not deciding contra');
    }
    if (this.contraPassVotes.has(seat)) {
      throw new Error('You have already passed this contra decision');
    }

    this.contraPassVotes.add(seat);
    const teamSeats: Seat[] = this.contraDecidingTeam === 0 ? [0, 2] : [1, 3];
    if (teamSeats.every((teamSeat) => this.contraPassVotes.has(teamSeat))) {
      this.resolveContraPass(seat);
    }
  }

  protected getContraDecidingTeamForRound(
    round: RoomGameState['round'],
  ): 0 | 1 | null {
    if (
      !round ||
      round.trump === null ||
      round.currentTrick.length > 0 ||
      round.completedTricks.length > 0 ||
      round.contraLevel >= 3 ||
      (round.contraLevel + 1 === 3 && round.trump === 'botifarra')
    ) {
      return null;
    }
    const declarantTeam = (round.declarantSeat % 2) as 0 | 1;
    if (round.contraLevel + 1 === 2) return declarantTeam;
    return declarantTeam === 0 ? 1 : 0;
  }

  /** Start the next fixed decision clock. */
  protected resetTurnTimer() {
    this.startTurnTimerClock();
  }

  /** Start a new authoritative decision clock and identify its timer epoch. */
  protected startTurnTimerClock(now = performance.now()) {
    this.turnStartedAt = now;
    this.timerEpoch += 1;
  }

  // ---------------------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------------------

  private handleChatMessage(client: Client, payload: unknown) {
    const { text } = payload as { text?: string };
    if (!text || typeof text !== 'string') {
      client.send('error', { code: 'INVALID_CHAT', message: 'Chat message text is required' });
      return;
    }

    if (text.length > BotifarraRoom.CHAT_MAX_LENGTH) {
      client.send('error', {
        code: 'CHAT_TOO_LONG',
        message: `Chat message exceeds ${BotifarraRoom.CHAT_MAX_LENGTH} characters`,
      });
      return;
    }

    // Rate limiting
    const now = Date.now();
    const timestamps = this.chatRateLimit.get(client.sessionId) ?? [];
    const recent = timestamps.filter((t) => now - t < BotifarraRoom.CHAT_RATE_WINDOW_MS);
    if (recent.length >= BotifarraRoom.CHAT_RATE_MAX) {
      client.send('error', { code: 'CHAT_RATE_LIMITED', message: 'Too many messages, slow down' });
      return;
    }
    recent.push(now);
    this.chatRateLimit.set(client.sessionId, recent);

    // Determine sender info
    const playerSchema = this.state.players.get(client.sessionId);
    const observer = this.observers.get(client.sessionId);
    const fromUsername = playerSchema?.username ?? observer?.username ?? 'Unknown';
    const fromSeat = playerSchema ? (playerSchema.seat as 0 | 1 | 2 | 3) : null;

    const chatEvent = {
      type: 'chat_message' as const,
      fromUsername,
      fromSeat,
      text: text.trim(),
      timestamp: now,
    };

    // Send to all players
    this.broadcast('chat_message', chatEvent);
    // Send to all observers
    for (const [, obs] of this.observers) {
      obs.client.send('chat_message', chatEvent);
    }
  }

  // ---------------------------------------------------------------------------
  // Reactions & Premade Messages
  // ---------------------------------------------------------------------------

  private checkReactionRateLimit(client: Client): boolean {
    const now = Date.now();
    const timestamps = this.reactionRateLimit.get(client.sessionId) ?? [];
    const recent = timestamps.filter((t) => now - t < BotifarraRoom.REACTION_RATE_WINDOW_MS);
    if (recent.length >= BotifarraRoom.REACTION_RATE_MAX) {
      client.send('error', { code: 'REACTION_RATE_LIMITED', message: 'Too many reactions, slow down' });
      return false;
    }
    recent.push(now);
    this.reactionRateLimit.set(client.sessionId, recent);
    return true;
  }

  private handleReaction(client: Client, payload: unknown) {
    const { emoji } = payload as { emoji?: string };
    if (!emoji || !BotifarraRoom.VALID_EMOJIS.has(emoji as ReactionEmoji)) {
      client.send('error', { code: 'INVALID_REACTION', message: 'Invalid emoji key' });
      return;
    }
    const playerSchema = this.state.players.get(client.sessionId);
    if (!playerSchema) return; // observers can't react

    if (!this.checkReactionRateLimit(client)) return;

    const event = {
      type: 'reaction' as const,
      fromUsername: playerSchema.username,
      fromSeat: playerSchema.seat as 0 | 1 | 2 | 3,
      emoji,
      timestamp: Date.now(),
    };

    this.broadcastToNonMuted(event, playerSchema.seat as 0 | 1 | 2 | 3);
  }

  private handlePremade(client: Client, payload: unknown) {
    const { key } = payload as { key?: string };
    if (!key || !BotifarraRoom.VALID_PREMADES.has(key as PremadeMessageKey)) {
      client.send('error', { code: 'INVALID_PREMADE', message: 'Invalid premade message key' });
      return;
    }
    const playerSchema = this.state.players.get(client.sessionId);
    if (!playerSchema) return;

    if (!this.checkReactionRateLimit(client)) return;

    const event = {
      type: 'premade_message' as const,
      fromUsername: playerSchema.username,
      fromSeat: playerSchema.seat as 0 | 1 | 2 | 3,
      key,
      timestamp: Date.now(),
    };

    this.broadcastToNonMuted(event, playerSchema.seat as 0 | 1 | 2 | 3);
  }

  private broadcastToNonMuted(event: Record<string, unknown>, senderSeat: number) {
    // Send to players who haven't muted the sender
    for (const [sessionId] of this.state.players.entries()) {
      const muted = this.mutedSeats.get(sessionId);
      if (muted && muted.has(senderSeat)) continue;
      this.clients.find((c) => c.sessionId === sessionId)?.send(event.type as string, event);
    }
    // Send to observers
    for (const [, obs] of this.observers) {
      obs.client.send(event.type as string, event);
    }
  }

  private handleMute(client: Client, payload: unknown) {
    const { seat } = payload as { seat?: number };
    if (seat === undefined || seat < 0 || seat > 3) {
      client.send('error', { code: 'INVALID_SEAT', message: 'Invalid seat to mute' });
      return;
    }
    const muted = this.mutedSeats.get(client.sessionId) ?? new Set();
    muted.add(seat);
    this.mutedSeats.set(client.sessionId, muted);
  }

  private handleUnmute(client: Client, payload: unknown) {
    const { seat } = payload as { seat?: number };
    if (seat === undefined || seat < 0 || seat > 3) {
      client.send('error', { code: 'INVALID_SEAT', message: 'Invalid seat to unmute' });
      return;
    }
    const muted = this.mutedSeats.get(client.sessionId);
    if (muted) muted.delete(seat);
  }

  protected tick() {
    // Base tick — subclasses extend for bot logic
    const now = Date.now();
    const timerNow = performance.now();

    // -- Lobby timeout: close room if not all players connect in time --
    if (this.gameState.phase === 'lobby') {
      if (now - this.gameStartedAt >= this.lobbyFillTimeoutMs) {
        this.broadcast('lobby_timeout', {
          message: 'Not all players connected in time. Please re-queue.',
        });
        this.disconnect();
      }
      return;
    }

    if (this.gameState.phase !== 'playing') return;

    // -- 4-hour timeout (all games) --
    if (now - this.gameStartedAt >= BotifarraRoom.GAME_TIMEOUT_MS) {
      this.handleGameTimeout();
      return;
    }

    // -- Turn timer enforcement (all game types) --
    if (this.turnStartedAt > 0 && this.gameState.round) {
      // During trick pause, nobody's clock is running — skip enforcement and broadcast idle timers
      if (this.trickPauseLeader !== null) {
        if (timerNow - this.lastTimerBroadcast >= 1000) {
          this.broadcastTimerState();
          this.lastTimerBroadcast = timerNow;
        }
        return;
      }

      const elapsed = timerNow - this.turnStartedAt;
      const activeSeats = this.getActiveTimerSeats(this.gameState.round);
      if (activeSeats.length > 0) {
        if (this.contraDecidingTeam !== null) {
          if (elapsed >= BotifarraRoom.CONTRA_TIMEOUT_MS) {
            // A contra timeout resolves as a team pass, without the card-turn
            // timeout penalty. Passing early still requires both players.
            this.resolveContraPass(activeSeats[0]!);
            this.broadcastGameState();
            this.broadcastTimerState();
            this.lastTimerBroadcast = timerNow;
            this.persistSnapshot();
            return;
          }
        } else {
          if (elapsed >= this.getCurrentDecisionBaseMs()) {
            this.handleRankedTimeout(activeSeats[0]!);
            return;
          }
        }
      }

      // Broadcast timer state every second (declaration, contra, and card play).
      if (timerNow - this.lastTimerBroadcast >= 1000) {
        this.broadcastTimerState();
        this.lastTimerBroadcast = timerNow;
      }
    }
  }
}
