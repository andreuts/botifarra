import { BotifarraRoom, type BotifarraRoomOptions } from './BotifarraRoom.js';
import {
  heuristicBotMove,
  heuristicBotDeclareTrump,
  getRoundPhase,
  currentPlayerSeat,
} from '@botifarra/core';
import { handleDeclareTrump, handlePlayCard } from './game-logic.js';

const BOT_USERNAMES = ['Bot-Alpha', 'Bot-Beta', 'Bot-Gamma'];

// Delay between bot thinking and playing (ms) — feels natural, not instant
const BOT_DELAY_MIN = 450;
const BOT_DELAY_MAX = 950;

function botDelay() {
  return BOT_DELAY_MIN + Math.random() * (BOT_DELAY_MAX - BOT_DELAY_MIN);
}

// ---------------------------------------------------------------------------
// PracticeRoom — fills empty seats with heuristic bots so a single human
// player can play immediately without waiting for others.
// ---------------------------------------------------------------------------

export class PracticeRoom extends BotifarraRoom {
  override maxClients = 1; // single human; bots fill remaining seats
  private botPendingMove = false; // prevent double-scheduling

  override onCreate(options: BotifarraRoomOptions) {
    super.onCreate(options);

    for (let i = 0; i < 3; i++) {
      const fakeSid = `bot-${i}-${this.roomId}`;
      this.botSeeds.add(fakeSid);
      this.injectBotSeat(fakeSid, BOT_USERNAMES[i] ?? `Bot-${i}`);
    }
  }

  protected override tick() {
    super.tick();
    this.triggerBotIfNeeded();
  }

  private triggerBotIfNeeded() {
    if (this.botPendingMove) return;
    if (!this.gameState?.round) return;

    const round = this.gameState.round;
    const phase = getRoundPhase(round);

    // Determine which seat should act next
    let targetSeat: number | null = null;
    if (phase === 'declaring') {
      // Bot must declare (or pass) trump
      targetSeat = round.declarantSeat;
    } else if (phase === 'playing') {
      targetSeat = currentPlayerSeat(round);
    }

    if (targetSeat === null || targetSeat === undefined) return;

    // Is it a bot's turn?
    let botSessionId: string | undefined;
    for (const sid of this.botSeeds) {
      const p = this.state.players.get(sid);
      if (p && p.seat === targetSeat) {
        botSessionId = sid;
        break;
      }
    }
    if (!botSessionId) return;

    this.botPendingMove = true;
    const sid = botSessionId;
    setTimeout(() => {
      this.botPendingMove = false;
      this.executeBotMove(sid, phase as 'declaring' | 'playing');
    }, botDelay());
  }

  private executeBotMove(sessionId: string, phase: 'declaring' | 'playing') {
    if (!this.gameState?.round) return;
    const round = this.gameState.round;

    const playerSchema = this.state.players.get(sessionId);
    if (!playerSchema) return;
    const seat = playerSchema.seat as 0 | 1 | 2 | 3;

    // Verify it's still this bot's turn (state may have changed while waiting)
    if (phase === 'declaring') {
      if (round.declarantSeat !== seat) return;
    } else {
      const nowSeat = currentPlayerSeat(round);
      if (nowSeat !== seat) return;
    }

    if (phase === 'declaring') {
      const declaration = heuristicBotDeclareTrump(round, seat);
      try {
        const { state, events } = handleDeclareTrump(this.gameState, sessionId, declaration);
        this.gameState = state;
        this.syncSchemaPublic();
        for (const event of events) this.broadcast(event.type, event);
        this.broadcastGameState();
      } catch {
        /* ignore invalid move */
      }
    } else if (phase === 'playing') {
      const card = heuristicBotMove(round, seat);
      try {
        const { state, events, roundEnded } = handlePlayCard(this.gameState, sessionId, card);
        this.gameState = state;
        this.syncSchemaPublic();
        for (const event of events) this.broadcast(event.type, event);
        this.broadcastGameState();
        if (roundEnded) {
          if (this.gameState.phase === 'finished') {
            this.onGameFinished();
          } else {
            setTimeout(() => this.startNewRoundPublic(), 2500);
          }
        }
      } catch {
        /* ignore invalid move */
      }
    }
  }
}
