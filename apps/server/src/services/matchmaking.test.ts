import { describe, it, expect, vi } from 'vitest';
import { MatchmakingQueue, type OnMatchCreated, type SeatReservationData } from './matchmaking.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockReservation(userId: string): SeatReservationData {
  return {
    sessionId: `session-${userId}`,
    room: { roomId: 'room-abc', name: 'botifarra', processId: 'p1' },
  };
}

function makeQueue(
  onCreate: OnMatchCreated = vi.fn(async (players) => {
    const map = new Map<string, SeatReservationData>();
    for (const p of players) map.set(p.userId, makeMockReservation(p.userId));
    return map;
  }),
) {
  return { queue: new MatchmakingQueue(onCreate), onCreate };
}

// ---------------------------------------------------------------------------
// enqueueSingle
// ---------------------------------------------------------------------------

describe('MatchmakingQueue.enqueueSingle', () => {
  it('adds a player to the queue', () => {
    const { queue } = makeQueue();
    queue.enqueueSingle('u1', 'Alice');
    expect(queue.size).toBe(1);
    expect(queue.singleCount).toBe(1);
  });

  it('throws if player already queued', () => {
    const { queue } = makeQueue();
    queue.enqueueSingle('u1', 'Alice');
    expect(() => queue.enqueueSingle('u1', 'Alice')).toThrow('Already in queue');
  });

  it('triggers match when 4 singles are queued', async () => {
    const { queue, onCreate } = makeQueue();
    queue.enqueueSingle('u1', 'Alice');
    queue.enqueueSingle('u2', 'Bob');
    queue.enqueueSingle('u3', 'Carol');
    queue.enqueueSingle('u4', 'Dave');
    // Queue should be empty after match
    expect(queue.size).toBe(0);
    expect(onCreate).toHaveBeenCalledOnce();
    const calledPlayers = (onCreate as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(calledPlayers).toHaveLength(4);
  });

  it('leaves remaining players waiting if fewer than 4', () => {
    const { queue } = makeQueue();
    queue.enqueueSingle('u1', 'Alice');
    queue.enqueueSingle('u2', 'Bob');
    queue.enqueueSingle('u3', 'Carol');
    expect(queue.size).toBe(3); // 1 short of 4
  });
});

// ---------------------------------------------------------------------------
// enqueuePair
// ---------------------------------------------------------------------------

describe('MatchmakingQueue.enqueuePair', () => {
  it('adds a pair to the queue', () => {
    const { queue } = makeQueue();
    queue.enqueuePair({ userId: 'u1', username: 'Alice' }, { userId: 'u2', username: 'Bob' });
    expect(queue.size).toBe(2);
    expect(queue.pairCount).toBe(1);
  });

  it('throws if either player is already queued', () => {
    const { queue } = makeQueue();
    queue.enqueueSingle('u1', 'Alice');
    expect(() =>
      queue.enqueuePair({ userId: 'u1', username: 'Alice' }, { userId: 'u2', username: 'Bob' }),
    ).toThrow('is already in queue');
  });

  it('triggers match when 2 pairs are queued', () => {
    const { queue, onCreate } = makeQueue();
    queue.enqueuePair({ userId: 'u1', username: 'Alice' }, { userId: 'u2', username: 'Bob' });
    queue.enqueuePair({ userId: 'u3', username: 'Carol' }, { userId: 'u4', username: 'Dave' });
    expect(queue.size).toBe(0);
    expect(onCreate).toHaveBeenCalledOnce();
    const players = (onCreate as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    // Pair 1 → team 0 (seats 0, 2), Pair 2 → team 1 (seats 1, 3)
    expect(players).toEqual([
      expect.objectContaining({ userId: 'u1', seat: 0 }),
      expect.objectContaining({ userId: 'u3', seat: 1 }),
      expect.objectContaining({ userId: 'u2', seat: 2 }),
      expect.objectContaining({ userId: 'u4', seat: 3 }),
    ]);
  });

  it('triggers match when 1 pair + 2 singles are queued', () => {
    const { queue, onCreate } = makeQueue();
    queue.enqueuePair({ userId: 'u1', username: 'Alice' }, { userId: 'u2', username: 'Bob' });
    queue.enqueueSingle('u3', 'Carol');
    queue.enqueueSingle('u4', 'Dave');
    expect(queue.size).toBe(0);
    expect(onCreate).toHaveBeenCalledOnce();
    const players = (onCreate as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    // Pair → team 0 (seats 0, 2), Singles → team 1 (seats 1, 3)
    expect(players).toEqual([
      expect.objectContaining({ userId: 'u1', seat: 0 }),
      expect.objectContaining({ userId: 'u3', seat: 1 }),
      expect.objectContaining({ userId: 'u2', seat: 2 }),
      expect.objectContaining({ userId: 'u4', seat: 3 }),
    ]);
  });
});

// ---------------------------------------------------------------------------
// dequeue
// ---------------------------------------------------------------------------

describe('MatchmakingQueue.dequeue', () => {
  it('removes a single from the queue', () => {
    const { queue } = makeQueue();
    queue.enqueueSingle('u1', 'Alice');
    expect(queue.dequeue('u1')).toBe(true);
    expect(queue.size).toBe(0);
  });

  it('removes a pair when either member dequeues', () => {
    const { queue } = makeQueue();
    queue.enqueuePair({ userId: 'u1', username: 'Alice' }, { userId: 'u2', username: 'Bob' });
    expect(queue.dequeue('u2')).toBe(true);
    expect(queue.size).toBe(0);
    expect(queue.isQueued('u1')).toBe(false);
  });

  it('returns false if player was not queued', () => {
    const { queue } = makeQueue();
    expect(queue.dequeue('unknown')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isQueued
// ---------------------------------------------------------------------------

describe('MatchmakingQueue.isQueued', () => {
  it('true while in queue, false after dequeue', () => {
    const { queue } = makeQueue();
    queue.enqueueSingle('u1', 'Alice');
    expect(queue.isQueued('u1')).toBe(true);
    queue.dequeue('u1');
    expect(queue.isQueued('u1')).toBe(false);
  });

  it('detects pair members', () => {
    const { queue } = makeQueue();
    queue.enqueuePair({ userId: 'u1', username: 'Alice' }, { userId: 'u2', username: 'Bob' });
    expect(queue.isQueued('u1')).toBe(true);
    expect(queue.isQueued('u2')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// popResolvedReservation
// ---------------------------------------------------------------------------

describe('MatchmakingQueue.popResolvedReservation', () => {
  it('returns reservation after match and clears it', async () => {
    const { queue } = makeQueue();
    queue.enqueueSingle('u1', 'Alice');
    queue.enqueueSingle('u2', 'Bob');
    queue.enqueueSingle('u3', 'Carol');
    queue.enqueueSingle('u4', 'Dave');
    // Wait for async match creation
    await new Promise((r) => setTimeout(r, 50));
    const res = queue.popResolvedReservation('u1');
    expect(res).toBeDefined();
    expect(res!.sessionId).toBe('session-u1');
    expect(res!.room.roomId).toBe('room-abc');
    // Consuming again returns undefined
    expect(queue.popResolvedReservation('u1')).toBeUndefined();
  });

  it('returns undefined for a user not yet matched', () => {
    const { queue } = makeQueue();
    queue.enqueueSingle('u1', 'Alice');
    expect(queue.popResolvedReservation('u1')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// setOnMatchCreated
// ---------------------------------------------------------------------------

describe('MatchmakingQueue.setOnMatchCreated', () => {
  it('swaps the callback for future matches', async () => {
    const original = vi.fn(async (players: any[]) => {
      const map = new Map<string, SeatReservationData>();
      for (const p of players) map.set(p.userId, makeMockReservation(p.userId));
      return map;
    });
    const replacement = vi.fn(async (players: any[]) => {
      const map = new Map<string, SeatReservationData>();
      for (const p of players) map.set(p.userId, makeMockReservation(p.userId));
      return map;
    });
    const queue = new MatchmakingQueue(original);
    queue.setOnMatchCreated(replacement);
    queue.enqueueSingle('u1', 'Alice');
    queue.enqueueSingle('u2', 'Bob');
    queue.enqueueSingle('u3', 'Carol');
    queue.enqueueSingle('u4', 'Dave');
    expect(original).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledOnce();
  });
});
