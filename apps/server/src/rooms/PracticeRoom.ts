import { BotifarraRoom, FINAL_TRICK_READ_AND_ANIMATION_MS, type BotifarraRoomOptions } from './BotifarraRoom.js';
import {
  heuristicBotMove,
  heuristicBotDeclareTrump,
  getRoundPhase,
  currentPlayerSeat,
} from '@botifarra/core';
import type { Seat } from '@botifarra/core';
import { handleDeclareTrump, handlePlayCard } from './game-logic.js';

const BOT_USERNAMES = ['Bot-Alpha', 'Bot-Beta', 'Bot-Gamma'];

// Delay between bot thinking and playing (ms) — feels natural, not instant
const BOT_DELAY_MIN = 450;
const BOT_DELAY_MAX = 950;

function botDelay() {
  return BOT_DELAY_MIN + Math.random() * (BOT_DELAY_MAX - BOT_DELAY_MIN);
}

// ---------------------------------------------------------------------------
// PracticeRoom supports solo practice and invited partner practice against bots.
// ---------------------------------------------------------------------------

export class PracticeRoom extends BotifarraRoom {
  override maxClients = 1; // single human; bots fill remaining seats
  private botPendingMove = false; // prevent double-scheduling

  override onCreate(options: BotifarraRoomOptions) {
    super.onCreate(options);

    // Solo practice starts with three bots already in place. Invited pair
    // practice waits for both humans, then BotifarraRoom fills the two seats left.
    const botsToPreload = this.fillBots ? 0 : 3;
    for (let i = 0; i < botsToPreload; i++) {
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
    if (this.trickPauseLeader !== null) return; // don't play during trick pause

    // Bots vote to pass when their team is deciding. A bot pass only counts as
    // one confirmation, so a human partner still gets to contra or confirm pass.
    if (this.contraDecidingTeam !== null) {
      const decidingTeam = this.contraDecidingTeam;
      const botEntry = [...this.botSeeds]
        .map((sessionId) => this.state.players.get(sessionId))
        .find(
          (player) =>
            player &&
            player.seat % 2 === decidingTeam &&
            !this.contraPassVotes.has(player.seat as Seat),
        );
      if (!botEntry) return;

      const seat = botEntry.seat as Seat;
      this.botPendingMove = true;
      setTimeout(() => {
        this.botPendingMove = false;
        if (this.contraDecidingTeam !== decidingTeam) return;
        if (this.contraPassVotes.has(seat)) return;
        try {
          this.registerContraPass(seat);
          this.broadcastGameState();
          this.broadcastTimerState();
          this.persistSnapshot();
        } catch {
          /* The decision may have changed while the bot was waiting. */
        }
      }, botDelay());
      return;
    }

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
        this.resetTurnTimer();
        this.gameState = state;
        this.syncSchemaPublic();
        for (const event of events) this.broadcastEvent(event);
        this.contraDecidingTeam = this.getContraDecidingTeamForRound(this.gameState.round);
        this.broadcastGameState();
        this.broadcastTimerState();
        this.persistSnapshot();
      } catch {
        /* ignore invalid move */
      }
    } else if (phase === 'playing') {
      const card = heuristicBotMove(round, seat);
      try {
        const { state, events, roundEnded, trickCompleted } = handlePlayCard(this.gameState, sessionId, card);
        this.resetTurnTimer();
        this.gameState = state;
        this.syncSchemaPublic();
        const deferGameEnd = roundEnded && this.gameState.phase === 'finished';
        for (const event of events) {
          if (deferGameEnd && event.type === 'game_ended') continue;
          this.broadcastEvent(event);
        }
        if (!roundEnded && trickCompleted) {
          const lastTrick = this.gameState.round!.completedTricks.at(-1)!;
          this.startTrickPause(lastTrick.winner as Seat);
        }
        this.broadcastGameState();
        this.broadcastTimerState();
        if (roundEnded) {
          if (this.gameState.phase === 'finished') {
            setTimeout(() => this.onGameFinished(), FINAL_TRICK_READ_AND_ANIMATION_MS);
          } else {
            setTimeout(() => this.startNewRoundPublic(), 15_000);
          }
        }
      } catch {
        /* ignore invalid move */
      }
    }
  }
}
