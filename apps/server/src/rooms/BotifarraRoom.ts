import { Room, Client } from 'colyseus';
import { Schema, type, MapSchema } from '@colyseus/schema';

import type { ClientCommand } from '@botifarra/shared';
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
import { finalizeMatch, updateUserStats, updateRatings } from '../services/persistence.js';

// Module-level Prisma reference — set from index.ts after DB connects
let _prisma: PrismaClient | null = null;
export function setPrismaForRooms(p: PrismaClient) { _prisma = p; }

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
  /** If set, fill remaining seats (up to 4) with bot players */
  fillBots?: boolean;
  /** How many human players are expected (used with fillBots). Default 4. */
  humanPlayers?: number;
  /** Pre-assigned seats from matchmaking: userId → seat number */
  seatAssignments?: Record<string, number>;
}

export class BotifarraRoom extends Room<BotifarraRoomState, BotifarraRoomOptions> {
  override maxClients = 4;

  protected gameState!: RoomGameState;
  protected matchId: string = '';
  private targetScore: number = 101;
  protected fillBots: boolean = false;
  protected humanPlayersExpected: number = 4;
  protected botSeeds = new Set<string>();

  /** Pre-assigned seats from matchmaking (userId → seat). Empty for ad-hoc rooms. */
  private seatAssignments: Record<string, number> = {};

  // Reconnect tokens
  private reconnectTokens = new Map<string, ReturnType<typeof this.allowReconnection>>();

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  override onCreate(options: BotifarraRoomOptions) {
    this.matchId = options.matchId ?? this.roomId;
    this.targetScore = options.targetScore ?? 101;
    this.fillBots = options.fillBots ?? false;
    this.humanPlayersExpected = options.humanPlayers ?? 4;
    this.seatAssignments = options.seatAssignments ?? {};

    // Give clients 2 minutes to consume their seat reservation.
    // The default (15 s) is too short: polling (2 s) + navigation + React mount
    // can easily exceed it, causing "seat reservation expired" errors.
    this.setSeatReservationTime(120);

    // If filling with bots, restrict maxClients to human player count
    if (this.fillBots) {
      this.maxClients = this.humanPlayersExpected;
    }

    this.setState(new BotifarraRoomState());
    this.gameState = createRoomState(this.targetScore);

    this.onMessage('*', (client, type, message) => {
      this.handleCommand(client, type as string, message);
    });

    this.setSimulationInterval(() => this.tick(), 1000);
  }

  override onJoin(client: Client, options: BotifarraRoomOptions & { userId?: string; username?: string }) {
    const userId = options.userId ?? client.sessionId;
    const username = options.username ?? `Player-${client.sessionId.slice(0, 4)}`;

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
        const result = assignedSeat !== undefined
          ? assignSpecificSeat(this.gameState, client.sessionId, userId, username, assignedSeat as Seat)
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
              setTimeout(() => this.startNewRoundPublic(), 3000);
            }
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
        default:
          client.send('error', { code: 'UNKNOWN_COMMAND', message: `Unknown command: ${type}` });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      client.send('error', { code: 'COMMAND_ERROR', message });
    }
  }

  // ---------------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------------

  protected startNewRoundPublic() {
    this.gameState = startRound(this.gameState);
    this.syncSchemaPublic();

    // Send each human player only their own hand
    for (const [sessionId, playerSchema] of this.state.players) {
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (!client) continue; // bot — no real client
      const seat = playerSchema.seat as 0 | 1 | 2 | 3;
      this.sendGameStateTo(client, seat);
    }
  }

  /** Build map of seat → username from the Colyseus schema or room state */
  private getPlayerNames(): Record<0|1|2|3, string> {
    const names: Record<number, string> = { 0: '?', 1: '?', 2: '?', 3: '?' };
    for (const [, ps] of this.state.players) {
      names[ps.seat] = ps.username;
    }
    return names as Record<0|1|2|3, string>;
  }

  protected sendGameStateTo(client: Client, seat?: 0 | 1 | 2 | 3) {
    const round = this.gameState.round;
    if (!round) return;
    const playerSeat =
      seat ?? (this.state.players.get(client.sessionId)?.seat as 0 | 1 | 2 | 3 | undefined);
    if (playerSeat === undefined) return;
    client.send('game_state', {
      type: 'game_state',
      state: {
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
      },
    });
  }

  protected onGameFinished() {
    const { scores } = this.gameState.game;
    const winner: 0 | 1 = scores[0] >= scores[1] ? 0 : 1;
    this.broadcast('game_ended', { scores, winner });

    // Persist match result asynchronously
    if (_prisma) {
      const prisma = _prisma;
      const matchId = this.matchId;
      void (async () => {
        try {
          await finalizeMatch(prisma, matchId, scores[0], scores[1], winner);
          await updateUserStats(prisma, matchId, winner);
          await updateRatings(prisma, matchId, winner);
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
  }

  protected tick() {
    // Base tick — subclasses extend for bot logic
  }
}
