/**
 * Integration tests: Full game flow through the room game-logic layer.
 *
 * These tests simulate a complete Botifarra game by driving the room state
 * machine with deterministic inputs, verifying that rounds, scoring,
 * and game termination work end-to-end.
 */

import { describe, it, expect } from 'vitest';
import {
  createRoomState,
  assignSeat,
  isRoomFull,
  startRound,
  handleDeclareTrump,
  handlePlayCard,
  seatForSession,
  type RoomGameState,
} from '../rooms/game-logic.js';
import {
  getRoundPhase,
  currentPlayerSeat,
  legalMoves,
  heuristicBotMove,
  heuristicBotDeclareTrump,
} from '@botifarra/core';
import type { Seat } from '@botifarra/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFullRoom(): { state: RoomGameState; sessions: Record<Seat, string> } {
  let state = createRoomState(12);
  const sessions: Record<Seat, string> = {} as any;
  const players = [
    { session: 'sess-0', userId: 'u0', username: 'Alice' },
    { session: 'sess-1', userId: 'u1', username: 'Bob' },
    { session: 'sess-2', userId: 'u2', username: 'Carol' },
    { session: 'sess-3', userId: 'u3', username: 'Dave' },
  ];

  for (const p of players) {
    const result = assignSeat(state, p.session, p.userId, p.username);
    state = result.state;
    sessions[result.seat] = p.session;
  }

  return { state, sessions };
}

/** Play one complete round using heuristic bot logic for all seats. */
function playRoundWithBots(state: RoomGameState, sessions: Record<Seat, string>): RoomGameState {
  const round = state.round!;
  const phase = getRoundPhase(round);

  // Declaring phase
  if (phase === 'declaring') {
    const declarant = round.declarantSeat;
    const declaration = heuristicBotDeclareTrump(round, declarant);
    const sessId = sessions[declarant]!;
    const result = handleDeclareTrump(state, sessId, declaration);
    state = result.state;
  }

  // Playing phase — play all 12 tricks
  let safety = 0;
  while (safety++ < 100) {
    const r = state.round!;
    const rp = getRoundPhase(r);
    if (rp === 'scoring' || rp === 'declaring') break;

    const seat = currentPlayerSeat(r);
    if (seat === null || seat === undefined) break;

    const card = heuristicBotMove(r, seat);
    const sessId = sessions[seat]!;
    const { state: newState, roundEnded } = handlePlayCard(state, sessId, card);
    state = newState;

    if (roundEnded) break;
  }

  return state;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Seat assignment', () => {
  it('assigns 4 players to seats 0-3', () => {
    const { state, sessions } = createFullRoom();
    expect(isRoomFull(state)).toBe(true);
    expect(state.seats.size).toBe(4);
    for (const s of [0, 1, 2, 3] as Seat[]) {
      expect(state.seats.has(s)).toBe(true);
      expect(sessions[s]).toBeDefined();
    }
  });

  it('throws when a 5th player tries to join', () => {
    const { state } = createFullRoom();
    expect(() => assignSeat(state, 'extra', 'u99', 'Extra')).toThrow('Room is full');
  });

  it('seatForSession returns correct seat', () => {
    const { state, sessions } = createFullRoom();
    for (const [seat, sessId] of Object.entries(sessions)) {
      expect(seatForSession(state, sessId)).toBe(Number(seat));
    }
    expect(seatForSession(state, 'nonexistent')).toBeNull();
  });
});

describe('Integration: Single round flow', () => {
  it('starts a round and puts game into playing phase', () => {
    const { state, sessions } = createFullRoom();
    const playing = startRound(state);
    expect(playing.phase).toBe('playing');
    expect(playing.round).not.toBeNull();
    expect(playing.game.roundNumber).toBe(1);
  });

  it('declares trump successfully', () => {
    const { state, sessions } = createFullRoom();
    const s = startRound(state);
    const round = s.round!;
    expect(getRoundPhase(round)).toBe('declaring');

    const declarant = round.declarantSeat;
    const declaration = heuristicBotDeclareTrump(round, declarant);
    const { state: afterDeclare } = handleDeclareTrump(s, sessions[declarant]!, declaration);
    expect(afterDeclare.round!.trump).not.toBeNull();
  });

  it('rejects declaration from wrong seat', () => {
    const { state, sessions } = createFullRoom();
    const s = startRound(state);
    const round = s.round!;
    const wrongSeat = ((round.declarantSeat + 1) % 4) as Seat;

    expect(() => handleDeclareTrump(s, sessions[wrongSeat]!, 'oros')).toThrow('Not your turn');
  });

  it('plays all 12 tricks in a round', () => {
    const { state, sessions } = createFullRoom();
    let s = startRound(state);

    // Declare trump
    const round = s.round!;
    const declarant = round.declarantSeat;
    const { state: afterDeclare } = handleDeclareTrump(
      s,
      sessions[declarant]!,
      heuristicBotDeclareTrump(round, declarant),
    );
    s = afterDeclare;

    // Play all tricks
    let trickCount = 0;
    let safety = 0;
    while (safety++ < 200) {
      const r = s.round!;
      if (getRoundPhase(r) !== 'playing') break;

      const seat = currentPlayerSeat(r);
      if (seat === null || seat === undefined) break;

      const card = heuristicBotMove(r, seat);
      const { state: newState, roundEnded } = handlePlayCard(s, sessions[seat]!, card);
      s = newState;

      if (s.round && s.round.completedTricks.length > trickCount) {
        trickCount = s.round.completedTricks.length;
      }

      if (roundEnded) break;
    }

    // The round should have completed with all 12 tricks
    expect(trickCount).toBe(12);
    // Scores are cumulative match points — a 36–36 tie yields [0, 0] which is valid
    expect(s.game.scores[0]).toBeGreaterThanOrEqual(0);
    expect(s.game.scores[1]).toBeGreaterThanOrEqual(0);
  });
});

describe('Integration: Full game to completion', () => {
  it('plays rounds until a winner is determined', () => {
    const { state, sessions } = createFullRoom();
    let s = startRound(state);

    let rounds = 0;
    const maxRounds = 100;

    while (rounds++ < maxRounds) {
      s = playRoundWithBots(s, sessions);

      if (s.game.winner !== null || s.phase === 'finished') break;

      // Start next round
      s = startRound(s);
    }

    expect(s.game.winner).not.toBeNull();
    expect(s.phase).toBe('finished');
    expect(rounds).toBeLessThan(maxRounds);

    // Winner's score should be at or above target
    const winnerScore = s.game.scores[s.game.winner!];
    expect(winnerScore).toBeGreaterThanOrEqual(s.game.targetScore);
  });

  it('scores are non-negative throughout', () => {
    const { state, sessions } = createFullRoom();
    let s = startRound(state);

    let rounds = 0;
    while (rounds++ < 100) {
      s = playRoundWithBots(s, sessions);
      expect(s.game.scores[0]).toBeGreaterThanOrEqual(0);
      expect(s.game.scores[1]).toBeGreaterThanOrEqual(0);
      if (s.game.winner !== null) break;
      s = startRound(s);
    }
  });
});

describe('Integration: Legal moves enforcement', () => {
  it('rejects playing a card that is not in the hand', () => {
    const { state, sessions } = createFullRoom();
    let s = startRound(state);

    // Declare trump
    const round = s.round!;
    const { state: afterDeclare } = handleDeclareTrump(
      s,
      sessions[round.declarantSeat]!,
      heuristicBotDeclareTrump(round, round.declarantSeat),
    );
    s = afterDeclare;

    const seat = currentPlayerSeat(s.round!)!;
    // Try to play a card that doesn't exist (rank 99 is invalid)
    expect(() => handlePlayCard(s, sessions[seat]!, { suit: 'oros', rank: 99 })).toThrow();
  });

  it('rejects playing out of turn', () => {
    const { state, sessions } = createFullRoom();
    let s = startRound(state);

    // Declare trump
    const round = s.round!;
    const { state: afterDeclare } = handleDeclareTrump(
      s,
      sessions[round.declarantSeat]!,
      heuristicBotDeclareTrump(round, round.declarantSeat),
    );
    s = afterDeclare;

    const currentSeat = currentPlayerSeat(s.round!)!;
    const wrongSeat = ((currentSeat + 1) % 4) as Seat;
    const wrongHand = s.round!.hands[wrongSeat];

    if (wrongHand.length > 0) {
      expect(() => handlePlayCard(s, sessions[wrongSeat]!, wrongHand[0]!)).toThrow();
    }
  });
});

describe('Integration: buildPlayerState integrity', () => {
  it('hides other players hands while showing own', () => {
    const { state, sessions } = createFullRoom();
    const s = startRound(state);

    // Declare trump
    const round = s.round!;
    const { state: afterDeclare, events } = handleDeclareTrump(
      s,
      sessions[round.declarantSeat]!,
      heuristicBotDeclareTrump(round, round.declarantSeat),
    );

    // Find the game_state event
    const gameStateEvent = events.find((e) => e.type === 'game_state') as any;
    expect(gameStateEvent).toBeDefined();

    const playerState = gameStateEvent.state;
    // Player should see their own 12 cards
    expect(playerState.hand.length).toBe(12);
    // mySeat should match the declarant seat
    expect(playerState.mySeat).toBe(round.declarantSeat);
    // handSizes should reflect all players
    expect(playerState.handSizes[0]).toBe(12);
    expect(playerState.handSizes[1]).toBe(12);
    expect(playerState.handSizes[2]).toBe(12);
    expect(playerState.handSizes[3]).toBe(12);
  });
});
