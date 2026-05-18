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
import { getRoundPhase, currentPlayerSeat } from '@botifarra/core';
import type { Seat } from '@botifarra/core';
import type { PrismaClient } from '@prisma/client';
import type { SerializableRoomSnapshot } from '../services/persistence.js';
import { finalizeMatch, updateUserStats, updateRatings, saveGameSnapshot, clearGameSnapshot, deserializeSnapshot } from '../services/persistence.js';
import { setUserActiveGame, clearUserActiveGame } from '../routes/friends.js';

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
  /** If set, fill remaining seats (up to 4) with bot players */
  fillBots?: boolean;
  /** How many human players are expected (used with fillBots). Default 4. */
  humanPlayers?: number;
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
  private gameStartedAt: number = 0;
  private endReason: string | null = null;

  // -- Ranked turn timers --
  private static readonly BASE_TURN_MS = 15_000; // 15 seconds
  private static readonly ROUND_BUDGET_MS = 60_000; // 1 minute per player per round
  private static readonly TIMEOUT_PENALTY_POINTS = 36;
  private turnStartedAt: number = 0;
  private roundBudgets: Record<Seat, number> = { 0: 60_000, 1: 60_000, 2: 60_000, 3: 60_000 };
  private lastTimerBroadcast: number = 0;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  override onCreate(options: BotifarraRoomOptions) {
    this.matchId = options.matchId ?? this.roomId;
    this.targetScore = options.targetScore ?? 101;
    this.fillBots = options.fillBots ?? false;
    this.humanPlayersExpected = options.humanPlayers ?? 4;
    this.seatAssignments = options.seatAssignments ?? {};
    this.ranked = options.ranked ?? false;
    this.gameStartedAt = Date.now();

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
        const result =
          assignedSeat !== undefined
            ? assignSpecificSeat(
                this.gameState,
                client.sessionId,
                userId,
                username,
                assignedSeat as Seat,
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
      if (existingSeat !== null && this.gameState.round) {
        this.sendGameStateTo(client, seat);
      }

      // Auto-start when room is full
      if (isRoomFull(this.gameState)) {
        this.startNewRoundPublic();
      } else if (this.fillBots && this.gameState.seats.size >= this.humanPlayersExpected) {
        // Fill remaining seats with bots then start
        const botsNeeded = 4 - this.gameState.seats.size;
        for (let i = 0; i < botsNeeded; i++) {
          const fakeSid = `bot-fill-${i}-${this.roomId}`;
          this.botSeeds.add(fakeSid);
          this.injectBotSeat(fakeSid, `Bot-${i + 1}`);
        }
        this.startNewRoundPublic();
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
          const { declaration } = payload as { declaration: string };
          const { state, events } = handleDeclareTrump(
            this.gameState,
            client.sessionId,
            declaration as any,
          );
          this.gameState = state;
          this.syncSchemaPublic();
          for (const event of events) {
            this.broadcastEvent(event, client);
          }
          // Send each player their personalized game state
          this.broadcastGameState();
          break;
        }
        case 'play_card': {
          const { card } = payload as { card: { suit: string; rank: number } };
          this.resetTurnTimer();
          const { state, events, roundEnded } = handlePlayCard(
            this.gameState,
            client.sessionId,
            card,
          );
          this.gameState = state;
          this.syncSchemaPublic();
          for (const event of events) {
            this.broadcastEvent(event, client);
          }
          // Send each player their personalized game state
          this.broadcastGameState();
          if (roundEnded) {
            if (this.gameState.phase === 'finished') {
              this.onGameFinished();
            } else {
              // Save snapshot after each round while still in-progress
              this.persistSnapshot();
              setTimeout(() => this.startNewRoundPublic(), 3000);
            }
          } else {
            // Save snapshot after each card play (throttled to avoid excessive writes)
            this.persistSnapshot();
          }
          break;
        }
        case 'pass_declaration': {
          const { state, events } = handlePassDeclaration(this.gameState, client.sessionId);
          this.gameState = state;
          this.syncSchemaPublic();
          for (const event of events) this.broadcastEvent(event, client);
          this.broadcastGameState();
          break;
        }
        case 'call_contra': {
          const { state, events } = handleCallContra(this.gameState, client.sessionId);
          this.gameState = state;
          this.syncSchemaPublic();
          for (const event of events) this.broadcastEvent(event, client);
          this.broadcastGameState();
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
    void saveGameSnapshot(prisma, matchId, state).catch((err) => {
      console.error('[BotifarraRoom] Snapshot save error:', err);
    });
  }

  // ---------------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------------

  protected startNewRoundPublic() {
    this.gameState = startRound(this.gameState);
    this.syncSchemaPublic();

    // Reset ranked turn timers for the new round
    if (this.ranked) {
      this.roundBudgets = { 0: BotifarraRoom.ROUND_BUDGET_MS, 1: BotifarraRoom.ROUND_BUDGET_MS, 2: BotifarraRoom.ROUND_BUDGET_MS, 3: BotifarraRoom.ROUND_BUDGET_MS };
      this.turnStartedAt = Date.now();
    }

    // Send each human player only their own hand
    for (const [sessionId, playerSchema] of this.state.players) {
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (!client) continue; // bot — no real client
      const seat = playerSchema.seat as 0 | 1 | 2 | 3;
      this.sendGameStateTo(client, seat);
    }
  }

  /** Build map of seat → username from the Colyseus schema or room state */
  private getPlayerNames(): Record<0 | 1 | 2 | 3, string> {
    const names: Record<number, string> = { 0: '?', 1: '?', 2: '?', 3: '?' };
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
      currentPlayerSeat: currentPlayerSeat(round),
      dealerPassed: round.dealerPassed,
      contraLevel: round.contraLevel,
      ranked: this.ranked,
    };

    if (this.surrenderPending) {
      statePayload['surrenderPending'] = {
        requestingSeat: this.surrenderPending.requestingSeat,
        partnerSeat: this.surrenderPending.partnerSeat,
      };
    }

    if (this.ranked) {
      const now = Date.now();
      const activeSeat = currentPlayerSeat(round);
      const elapsed = now - this.turnStartedAt;
      statePayload['timers'] = ([0, 1, 2, 3] as Seat[]).map((s) => {
        if (s === activeSeat) {
          const baseRemaining = Math.max(0, BotifarraRoom.BASE_TURN_MS - elapsed);
          const budgetConsumed = Math.max(0, elapsed - BotifarraRoom.BASE_TURN_MS);
          return { seat: s, baseTurnMs: baseRemaining, roundBudgetMs: Math.max(0, this.roundBudgets[s] - budgetConsumed) };
        }
        return { seat: s, baseTurnMs: -1, roundBudgetMs: this.roundBudgets[s] };
      });
    }

    client.send('game_state', { type: 'game_state', state: statePayload });
  }

  protected onGameFinished() {
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

  private broadcastEvent(event: { type: string }, sender: Client) {
    // All events except card_played go to everyone
    // card_played is already public (no hidden info in the event itself)
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
    // The timed-out player's team loses the round, other team gets 36 points
    const timedOutTeam: 0 | 1 = timedOutSeat % 2 === 0 ? 0 : 1;
    const scoringTeam: 0 | 1 = timedOutTeam === 0 ? 1 : 0;

    this.gameState.game.scores[scoringTeam] += BotifarraRoom.TIMEOUT_PENALTY_POINTS;

    this.broadcast('round_timeout', {
      timedOutSeat,
      penaltyPoints: BotifarraRoom.TIMEOUT_PENALTY_POINTS,
      scoringTeam,
    });

    // Consume the player's remaining budget
    this.roundBudgets[timedOutSeat] = 0;

    // Check if game should end
    if (this.gameState.game.scores[scoringTeam] >= this.targetScore) {
      this.gameState.phase = 'finished';
      this.syncSchemaPublic();
      this.onGameFinished();
    } else {
      // Start a new round
      this.syncSchemaPublic();
      setTimeout(() => this.startNewRoundPublic(), 2000);
    }
  }

  private broadcastTimerState() {
    if (!this.ranked || !this.gameState.round) return;
    const now = Date.now();
    const activeSeat = currentPlayerSeat(this.gameState.round);
    const elapsed = now - this.turnStartedAt;

    const timers = ([0, 1, 2, 3] as Seat[]).map((seat) => {
      if (seat === activeSeat) {
        const baseRemaining = Math.max(0, BotifarraRoom.BASE_TURN_MS - elapsed);
        const budgetConsumed = Math.max(0, elapsed - BotifarraRoom.BASE_TURN_MS);
        return {
          seat,
          baseTurnMs: baseRemaining,
          roundBudgetMs: Math.max(0, this.roundBudgets[seat] - budgetConsumed),
        };
      }
      return { seat, baseTurnMs: -1, roundBudgetMs: this.roundBudgets[seat] };
    });

    this.broadcast('timer_update', { timers });
  }

  /** Reset turn start when a play is made (called after each card play) */
  private resetTurnTimer() {
    if (!this.ranked) return;
    const now = Date.now();
    const elapsed = now - this.turnStartedAt;
    // If the player used some of their budget, deduct it
    if (elapsed > BotifarraRoom.BASE_TURN_MS) {
      const prevSeat = this.state.currentPlayerSeat as Seat;
      if (prevSeat >= 0 && prevSeat <= 3) {
        const overTime = elapsed - BotifarraRoom.BASE_TURN_MS;
        this.roundBudgets[prevSeat] = Math.max(0, this.roundBudgets[prevSeat] - overTime);
      }
    }
    this.turnStartedAt = now;
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
    if (this.gameState.phase !== 'playing') return;

    const now = Date.now();

    // -- 4-hour timeout (all games) --
    if (now - this.gameStartedAt >= BotifarraRoom.GAME_TIMEOUT_MS) {
      this.handleGameTimeout();
      return;
    }

    // -- Ranked turn timer enforcement --
    if (this.ranked && this.turnStartedAt > 0) {
      const elapsed = now - this.turnStartedAt;
      const currentSeat = currentPlayerSeat(this.gameState.round!);
      if (currentSeat === null) return;

      const baseExceeded = elapsed > BotifarraRoom.BASE_TURN_MS;
      if (baseExceeded) {
        const overTime = elapsed - BotifarraRoom.BASE_TURN_MS;
        const remaining = this.roundBudgets[currentSeat] - overTime;
        if (remaining <= 0) {
          // Player timed out — their team loses the round with 36pt penalty
          this.handleRankedTimeout(currentSeat);
          return;
        }
      }

      // Broadcast timer state every second
      if (now - this.lastTimerBroadcast >= 1000) {
        this.broadcastTimerState();
        this.lastTimerBroadcast = now;
      }
    }
  }
}
