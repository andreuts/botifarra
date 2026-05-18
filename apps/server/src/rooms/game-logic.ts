import type { RoundState, Seat, TrumpDeclaration } from '@botifarra/core';
import {
  createDeck,
  shuffleDeck,
  dealHands,
  createRound,
  declareTrump,
  passDeclaration,
  callContra,
  playCard,
  currentPlayerSeat,
  getRoundPhase,
  legalMoves,
  scoreRound,
  createGame,
  startNextRound,
  applyRoundScore,
} from '@botifarra/core';
import type { ClientCommand, ServerEvent } from '@botifarra/shared';

// ---------------------------------------------------------------------------
// Seat assignment state
// ---------------------------------------------------------------------------

interface SeatInfo {
  userId: string;
  username: string;
  sessionId: string; // Colyseus client sessionId
  connected: boolean;
}

// ---------------------------------------------------------------------------
// In-memory game room state
// ---------------------------------------------------------------------------

export interface RoomGameState {
  seats: Map<Seat, SeatInfo>;
  game: ReturnType<typeof createGame>;
  round: RoundState | null;
  phase: 'lobby' | 'playing' | 'finished';
}

export function createRoomState(targetScore = 101): RoomGameState {
  return {
    seats: new Map(),
    game: createGame({ targetScore }),
    round: null,
    phase: 'lobby',
  };
}

// ---------------------------------------------------------------------------
// Seat management
// ---------------------------------------------------------------------------

export function assignSeat(
  state: RoomGameState,
  sessionId: string,
  userId: string,
  username: string,
): { state: RoomGameState; seat: Seat } {
  // Find the next free seat (0-3)
  for (const s of [0, 1, 2, 3] as Seat[]) {
    if (!state.seats.has(s)) {
      const next: RoomGameState = {
        ...state,
        seats: new Map(state.seats).set(s, { userId, username, sessionId, connected: true }),
      };
      return { state: next, seat: s };
    }
  }
  throw new Error('Room is full');
}

/**
 * Assign a player to a specific seat (used when matchmaking pre-determines seating).
 * Throws if the seat is already occupied.
 */
export function assignSpecificSeat(
  state: RoomGameState,
  sessionId: string,
  userId: string,
  username: string,
  seat: Seat,
): { state: RoomGameState; seat: Seat } {
  if (state.seats.has(seat)) {
    throw new Error(`Seat ${seat} is already occupied`);
  }
  const next: RoomGameState = {
    ...state,
    seats: new Map(state.seats).set(seat, { userId, username, sessionId, connected: true }),
  };
  return { state: next, seat };
}

export function isRoomFull(state: RoomGameState): boolean {
  return state.seats.size === 4;
}

export function seatForSession(state: RoomGameState, sessionId: string): Seat | null {
  for (const [seat, info] of state.seats) {
    if (info.sessionId === sessionId) return seat;
  }
  return null;
}

/**
 * Find the seat for a given userId (for reconnection).
 * Returns null if the user doesn't have a seat in this room.
 */
export function findSeatForUser(state: RoomGameState, userId: string): Seat | null {
  for (const [seat, info] of state.seats) {
    if (info.userId === userId) return seat;
  }
  return null;
}

/**
 * Reassign a new sessionId to an existing seat (for reconnection).
 * This allows a player to rejoin with a new session after disconnecting.
 */
export function reassignSessionToSeat(
  state: RoomGameState,
  seat: Seat,
  newSessionId: string,
): RoomGameState {
  const seatInfo = state.seats.get(seat);
  if (!seatInfo) {
    throw new Error(`Seat ${seat} is not occupied`);
  }
  const updatedInfo = { ...seatInfo, sessionId: newSessionId, connected: true };
  const newSeats = new Map(state.seats);
  newSeats.set(seat, updatedInfo);
  return { ...state, seats: newSeats };
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

export function startRound(state: RoomGameState): RoomGameState {
  const game = startNextRound(state.game);
  const hands = dealHands(shuffleDeck(createDeck()));
  const round = createRound({ dealerSeat: game.dealerSeat, hands });
  return { ...state, game, round, phase: 'playing' };
}

// ---------------------------------------------------------------------------
// Command handlers — return updated state and events to broadcast
// ---------------------------------------------------------------------------

export function handleDeclareTrump(
  state: RoomGameState,
  sessionId: string,
  declaration: TrumpDeclaration,
): { state: RoomGameState; events: ServerEvent[] } {
  const seat = seatForSession(state, sessionId);
  if (seat === null) throw new Error('Session not in room');

  const round = state.round;
  if (!round) throw new Error('No active round');
  if (getRoundPhase(round) !== 'declaring') throw new Error('Not in declaring phase');
  if (seat !== round.declarantSeat) throw new Error('Not your turn to declare');

  const newRound = declareTrump(round, declaration);
  const seatInfo = state.seats.get(seat)!;

  const events: ServerEvent[] = [
    { type: 'trump_declared', declaration, declarantSeat: seat },
    { type: 'game_state', state: buildPlayerState(state, newRound, seat) },
  ];

  return { state: { ...state, round: newRound }, events };
}

export function handlePassDeclaration(
  state: RoomGameState,
  sessionId: string,
): { state: RoomGameState; events: ServerEvent[] } {
  const seat = seatForSession(state, sessionId);
  if (seat === null) throw new Error('Session not in room');
  const round = state.round;
  if (!round) throw new Error('No active round');
  const newRound = passDeclaration(round);
  const events: ServerEvent[] = [
    { type: 'game_state', state: buildPlayerState(state, newRound, seat) },
  ];
  return { state: { ...state, round: newRound }, events };
}

export function handleCallContra(
  state: RoomGameState,
  sessionId: string,
): { state: RoomGameState; events: ServerEvent[] } {
  const seat = seatForSession(state, sessionId);
  if (seat === null) throw new Error('Session not in room');
  const round = state.round;
  if (!round) throw new Error('No active round');
  const newRound = callContra(round, seat);
  const events: ServerEvent[] = [
    { type: 'contra_called', level: newRound.contraLevel, callerSeat: seat },
    { type: 'game_state', state: buildPlayerState(state, newRound, seat) },
  ];
  return { state: { ...state, round: newRound }, events };
}

export function handlePlayCard(
  state: RoomGameState,
  sessionId: string,
  card: { suit: string; rank: number },
): { state: RoomGameState; events: ServerEvent[]; roundEnded: boolean } {
  const seat = seatForSession(state, sessionId);
  if (seat === null) throw new Error('Session not in room');

  const round = state.round;
  if (!round) throw new Error('No active round');
  if (getRoundPhase(round) !== 'playing') throw new Error('Not in playing phase');

  const typedCard = card as Parameters<typeof playCard>[2];
  const newRound = playCard(round, seat, typedCard);

  const events: ServerEvent[] = [{ type: 'card_played', seat, card }];

  let newState = { ...state, round: newRound };
  let roundEnded = false;

  // If a trick was just completed
  if (newRound.completedTricks.length > round.completedTricks.length) {
    const completed = newRound.completedTricks.at(-1)!;
    events.push({
      type: 'trick_completed',
      trick: completed,
      nextLeader: completed.winner,
    });
  }

  // If round is finished
  if (getRoundPhase(newRound) === 'scoring') {
    const score = scoreRound(newRound.completedTricks, newRound.trump!, newRound.contraLevel);
    const newGame = applyRoundScore(newState.game, score);
    events.push({ type: 'round_ended', score, totalScores: newGame.scores });

    if (newGame.winner !== null) {
      events.push({ type: 'game_ended', winner: newGame.winner, finalScores: newGame.scores });
      newState = { ...newState, game: newGame, phase: 'finished' };
    } else {
      newState = { ...newState, game: newGame };
    }
    roundEnded = true;
  }

  return { state: newState, events, roundEnded };
}

// ---------------------------------------------------------------------------
// Build the player-facing state (hides other players' cards)
// ---------------------------------------------------------------------------

function buildPlayerState(
  roomState: RoomGameState,
  round: RoundState,
  forSeat: Seat,
): import('@botifarra/shared').PlayerGameStateDTO {
  const handSizes: Record<Seat, number> = {
    0: round.hands[0].length,
    1: round.hands[1].length,
    2: round.hands[2].length,
    3: round.hands[3].length,
  };

  const playerNames: Record<Seat, string> = { 0: '?', 1: '?', 2: '?', 3: '?' };
  for (const [seat, info] of roomState.seats) {
    playerNames[seat] = info.username;
  }

  return {
    matchId: '', // filled in by the Colyseus room
    roundNumber: roomState.game.roundNumber,
    dealerSeat: round.dealerSeat,
    declarantSeat: round.declarantSeat,
    trump: round.trump,
    hand: round.hands[forSeat],
    mySeat: forSeat,
    playerNames,
    handSizes,
    currentTrick: round.currentTrick,
    completedTricks: round.completedTricks,
    currentLeader: round.currentLeader,
    scores: roomState.game.scores,
    currentPlayerSeat: currentPlayerSeat(round),
    dealerPassed: round.dealerPassed,
    contraLevel: round.contraLevel,
  };
}
