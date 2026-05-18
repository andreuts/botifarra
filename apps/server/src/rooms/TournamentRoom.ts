import { BotifarraRoom, type BotifarraRoomOptions } from './BotifarraRoom.js';

/**
 * TournamentRoom — extends BotifarraRoom with time and round limits
 * for non-final tournament matches.
 *
 * Non-final: max 30 minutes, max 8 rounds. If tied, 2 extra tiebreak rounds.
 * Final: no limits — plays like a normal full botifarra game.
 */

export interface TournamentRoomOptions extends BotifarraRoomOptions {
  /** If true, this is the tournament final — no time/round limits */
  isFinal?: boolean;
  /** Tournament match ID for result callback */
  tournamentMatchId?: string;
}

export class TournamentRoom extends BotifarraRoom {
  private isFinal = false;
  private tournamentMatchId: string | null = null;
  private matchStartTime: number = 0;
  private maxRounds = 8;
  private tiebreakRounds = 2;
  private maxDurationMs = 30 * 60 * 1000; // 30 minutes
  private roundsCompleted = 0;
  private inTiebreak = false;
  private tiebreakRoundsPlayed = 0;

  override onCreate(options: TournamentRoomOptions) {
    super.onCreate(options);
    this.isFinal = options.isFinal ?? false;
    this.tournamentMatchId = options.tournamentMatchId ?? null;
    this.matchStartTime = Date.now();
  }

  /**
   * Override the round-end logic to enforce tournament limits.
   */
  protected override onGameFinished() {
    // For final matches or if we haven't hit limits, use default behavior
    if (this.isFinal) {
      super.onGameFinished();
      return;
    }

    // Non-final: the game naturally ended (target score reached)
    super.onGameFinished();
  }

  /**
   * After each round completes, check if we've hit tournament limits.
   */
  protected override startNewRoundPublic() {
    this.roundsCompleted++;

    if (this.isFinal) {
      // Final — no limits
      super.startNewRoundPublic();
      return;
    }

    // Check round limit
    const roundLimit = this.inTiebreak
      ? this.maxRounds + this.tiebreakRounds
      : this.maxRounds;

    if (this.roundsCompleted >= roundLimit) {
      this.endByTournamentLimit();
      return;
    }

    // Check time limit (only in non-tiebreak phase)
    if (!this.inTiebreak && Date.now() - this.matchStartTime >= this.maxDurationMs) {
      this.endByTournamentLimit();
      return;
    }

    super.startNewRoundPublic();
  }

  private endByTournamentLimit() {
    const scores = this.gameState.game.scores;

    if (scores[0] === scores[1] && !this.inTiebreak) {
      // Tie — enter tiebreak
      this.inTiebreak = true;
      this.tiebreakRoundsPlayed = 0;
      this.broadcast('tournament_tiebreak', {
        message: 'Scores tied — playing 2 tiebreak rounds',
        scores,
      });
      super.startNewRoundPublic();
      return;
    }

    // Match is over (either a winner or unresolved after tiebreak)
    const winner: 0 | 1 | null =
      scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : null;

    this.broadcast('tournament_match_ended', {
      scores,
      winner,
      reason: this.inTiebreak ? 'tiebreak_complete' : 'limit_reached',
      tournamentMatchId: this.tournamentMatchId,
    });

    setTimeout(() => this.disconnect(), 5000);
  }

  protected override tick() {
    super.tick();

    // For non-final matches, check time limit during play
    if (
      !this.isFinal &&
      !this.inTiebreak &&
      this.gameState.phase === 'playing' &&
      Date.now() - this.matchStartTime >= this.maxDurationMs
    ) {
      // Don't interrupt mid-round. The limit will be enforced at the end of the current round.
    }
  }
}
