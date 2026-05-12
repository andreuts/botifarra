import { describe, it, expect } from 'vitest';
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
} from './game-logic.js';
import { getRoundPhase, currentPlayerSeat, legalMoves } from '@botifarra/core';
import type { Seat } from '@botifarra/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function filledRoom() {
  let s = createRoomState(12);
  const sessions = ['s0', 's1', 's2', 's3'];
  for (let i = 0; i < 4; i++) {
    const r = assignSeat(s, sessions[i]!, `user${i}`, `Player${i}`);
    s = r.state;
  }
  return { state: s, sessions };
}

// ---------------------------------------------------------------------------
// Seat management
// ---------------------------------------------------------------------------

describe('createRoomState', () => {
  it('starts in lobby phase', () => {
    expect(createRoomState().phase).toBe('lobby');
  });
  it('has no seats assigned', () => {
    expect(createRoomState().seats.size).toBe(0);
  });
});

describe('assignSeat', () => {
  it('assigns seats 0-3 in order', () => {
    let s = createRoomState();
    const seats: Seat[] = [];
    for (let i = 0; i < 4; i++) {
      const r = assignSeat(s, `s${i}`, `u${i}`, `P${i}`);
      seats.push(r.seat);
      s = r.state;
    }
    expect(seats).toEqual([0, 1, 2, 3]);
  });

  it('throws when room is full', () => {
    const { state } = filledRoom();
    expect(() => assignSeat(state, 's4', 'u4', 'P4')).toThrow();
  });
});

describe('assignSpecificSeat', () => {
  it('assigns a player to the requested seat', () => {
    const s = createRoomState();
    const { state, seat } = assignSpecificSeat(s, 's1', 'u1', 'Alice', 2);
    expect(seat).toBe(2);
    expect(state.seats.get(2)?.userId).toBe('u1');
    expect(state.seats.get(2)?.username).toBe('Alice');
  });

  it('allows non-sequential seating', () => {
    let s = createRoomState();
    ({ state: s } = assignSpecificSeat(s, 's1', 'u1', 'Alice', 3));
    ({ state: s } = assignSpecificSeat(s, 's2', 'u2', 'Bob', 1));
    expect(s.seats.get(3)?.userId).toBe('u1');
    expect(s.seats.get(1)?.userId).toBe('u2');
    expect(s.seats.has(0)).toBe(false);
    expect(s.seats.has(2)).toBe(false);
  });

  it('throws if seat is already occupied', () => {
    let s = createRoomState();
    ({ state: s } = assignSpecificSeat(s, 's1', 'u1', 'Alice', 0));
    expect(() => assignSpecificSeat(s, 's2', 'u2', 'Bob', 0)).toThrow('Seat 0 is already occupied');
  });
});

describe('isRoomFull', () => {
  it('false when partially filled', () => {
    const s = createRoomState();
    const { state } = assignSeat(s, 's0', 'u0', 'P0');
    expect(isRoomFull(state)).toBe(false);
  });
  it('true when 4 seats assigned', () => {
    expect(isRoomFull(filledRoom().state)).toBe(true);
  });
});

describe('seatForSession', () => {
  it('returns correct seat for session', () => {
    let s = createRoomState();
    const { state } = assignSeat(s, 'sessionX', 'u0', 'P0');
    expect(seatForSession(state, 'sessionX')).toBe(0);
  });
  it('returns null for unknown session', () => {
    expect(seatForSession(createRoomState(), 'unknown')).toBeNull();
  });
});

describe('findSeatForUser', () => {
  it('returns correct seat for userId', () => {
    let s = createRoomState();
    const { state } = assignSeat(s, 'session1', 'alice-123', 'Alice');
    expect(findSeatForUser(state, 'alice-123')).toBe(0);
  });
  it('returns null for unknown userId', () => {
    expect(findSeatForUser(createRoomState(), 'unknown-user')).toBeNull();
  });
  it('finds user even with different sessionId', () => {
    let s = createRoomState();
    ({ state: s } = assignSeat(s, 'old-session', 'alice-123', 'Alice'));
    ({ state: s } = assignSeat(s, 'session2', 'bob-456', 'Bob'));
    expect(findSeatForUser(s, 'alice-123')).toBe(0);
    expect(findSeatForUser(s, 'bob-456')).toBe(1);
  });
});

describe('reassignSessionToSeat', () => {
  it('updates sessionId for existing seat', () => {
    let s = createRoomState();
    ({ state: s } = assignSeat(s, 'old-session', 'alice-123', 'Alice'));
    const s2 = reassignSessionToSeat(s, 0, 'new-session');
    expect(s2.seats.get(0)?.sessionId).toBe('new-session');
    expect(s2.seats.get(0)?.userId).toBe('alice-123'); // userId unchanged
    expect(s2.seats.get(0)?.username).toBe('Alice'); // username unchanged
    expect(s2.seats.get(0)?.connected).toBe(true); // reconnected
  });
  it('throws if seat is not occupied', () => {
    const s = createRoomState();
    expect(() => reassignSessionToSeat(s, 0, 'new-session')).toThrow('Seat 0 is not occupied');
  });
  it('allows reconnection during game', () => {
    const { state } = filledRoom();
    const s2 = startRound(state);
    const s3 = reassignSessionToSeat(s2, 2, 'reconnect-session');
    expect(s3.seats.get(2)?.sessionId).toBe('reconnect-session');
    expect(s3.round).not.toBeNull(); // game state preserved
  });
});

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------

describe('startRound', () => {
  it('transitions to playing phase', () => {
    const { state } = filledRoom();
    const s2 = startRound(state);
    expect(s2.phase).toBe('playing');
    expect(s2.round).not.toBeNull();
  });

  it('round starts in declaring phase', () => {
    const { state } = filledRoom();
    const s2 = startRound(state);
    expect(getRoundPhase(s2.round!)).toBe('declaring');
  });
});

// ---------------------------------------------------------------------------
// handleDeclareTrump
// ---------------------------------------------------------------------------

describe('handleDeclareTrump', () => {
  it('emits trump_declared event', () => {
    const { state, sessions } = filledRoom();
    let s = startRound(state);
    // Declarant is partner of dealer. Dealer = seat 0 (first round), declarant = seat 2
    const declarantSeat = s.round!.declarantSeat;
    const declarantSession = sessions[declarantSeat]!;
    const { events } = handleDeclareTrump(s, declarantSession, 'copes');
    expect(events.some((e) => e.type === 'trump_declared')).toBe(true);
  });

  it('throws when it is not the declarant\'s turn', () => {
    const { state, sessions } = filledRoom();
    let s = startRound(state);
    const declarantSeat = s.round!.declarantSeat;
    const wrongSeat = ((declarantSeat + 1) % 4) as Seat;
    expect(() => handleDeclareTrump(s, sessions[wrongSeat]!, 'oros')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// handlePlayCard — play a full round via the room command interface
// ---------------------------------------------------------------------------

describe('handlePlayCard', () => {
  it('allows playing a legal card', () => {
    const { state, sessions } = filledRoom();
    let s = startRound(state);
    const declarantSeat = s.round!.declarantSeat;
    const { state: s2 } = handleDeclareTrump(s, sessions[declarantSeat]!, 'oros');
    s = s2;

    const seat = currentPlayerSeat(s.round!)!;
    const legal = legalMoves({
      hand: s.round!.hands[seat],
      currentTrick: s.round!.currentTrick,
      trump: s.round!.trump!,
      playerSeat: seat,
    });
    const { events } = handlePlayCard(s, sessions[seat]!, legal[0]!);
    expect(events.some((e) => e.type === 'card_played')).toBe(true);
  });

  it('plays through a full round and emits round_ended', () => {
    const { state, sessions } = filledRoom();
    let s = startRound(state);
    const declarantSeat = s.round!.declarantSeat;
    const { state: afterDecl } = handleDeclareTrump(s, sessions[declarantSeat]!, 'oros');
    s = afterDecl;

    let roundEnded = false;
    for (let i = 0; i < 48; i++) {
      const seat = currentPlayerSeat(s.round!)!;
      const legal = legalMoves({
        hand: s.round!.hands[seat],
        currentTrick: s.round!.currentTrick,
        trump: s.round!.trump!,
        playerSeat: seat,
      });
      const r = handlePlayCard(s, sessions[seat]!, legal[0]!);
      s = r.state;
      if (r.roundEnded) roundEnded = true;
    }
    expect(roundEnded).toBe(true);
  });
});
