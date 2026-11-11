import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotifarraRoom } from './BotifarraRoom.js';
import { assignSeat, createRoomState, startRound } from './game-logic.js';

describe('BotifarraRoom contra decisions', () => {
  afterEach(() => vi.useRealTimers());

  it('rejects card play while either team still owes a contra decision', () => {
    const room = Object.create(BotifarraRoom.prototype) as any;
    const client = { send: vi.fn() };
    room.contraDecidingTeam = 0;

    room.handleCommand(client, 'play_card', {
      card: { suit: 'oros', rank: 1 },
    });

    expect(client.send).toHaveBeenCalledWith('error', {
      code: 'COMMAND_ERROR',
      message: 'The contra decision must be resolved before playing a card',
    });
  });

  it('runs the shared timer for the deciding team, not the next card leader', () => {
    const room = Object.create(BotifarraRoom.prototype) as any;
    room.gameState = {
      round: {
        trump: 'oros',
        currentTrick: [],
        completedTricks: [],
        currentLeader: 3,
      },
    };
    room.contraDecidingTeam = 0;
    room.trickPauseLeader = null;
    room.turnStartedAt = performance.now() - 1000;
    room.broadcast = vi.fn();

    room.broadcastTimerState();

    const timers = room.broadcast.mock.calls[0][1].timers as Array<{
      seat: number;
      baseTurnMs: number;
    }>;
    expect(timers.filter((timer) => timer.baseTurnMs >= 0).map((timer) => timer.seat)).toEqual([0, 2]);
    expect(timers.find((timer) => timer.seat === 3)?.baseTurnMs).toBe(-1);
  });

  it('requires both deciding players to pass and starts a fresh decision clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const room = Object.create(BotifarraRoom.prototype) as any;
    room.gameState = {
      phase: 'playing',
      round: {
        trump: 'oros',
        currentTrick: [],
        completedTricks: [],
        currentLeader: 3,
      },
    };
    room.contraDecidingTeam = 0;
    room.contraPassVotes = new Set();
    room.trickPauseLeader = null;
    room.turnStartedAt = performance.now() - 35_000;
    room.timerEpoch = 0;
    room.seatForClient = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(2);
    room.broadcastGameState = vi.fn();
    room.broadcastTimerState = vi.fn();
    room.persistSnapshot = vi.fn();

    room.handleCommand({ send: vi.fn() }, 'pass_contra', {});

    expect(room.contraDecidingTeam).toBe(0);
    expect([...room.contraPassVotes]).toEqual([0]);

    room.handleCommand({ send: vi.fn() }, 'pass_contra', {});

    expect(room.contraDecidingTeam).toBeNull();
    expect(room.timerEpoch).toBe(1);
  });

  it('starts a fresh clock after trump is declared', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    let state = createRoomState();
    const sessions: string[] = [];
    for (let seat = 0; seat < 4; seat++) {
      const sessionId = `session-${seat}`;
      sessions.push(sessionId);
      state = assignSeat(state, sessionId, `user-${seat}`, `Player ${seat}`).state;
    }
    state = startRound(state);
    const declarantSeat = state.round!.declarantSeat;
    const sessionId = sessions[declarantSeat]!;
    const room = Object.create(BotifarraRoom.prototype) as any;
    room.gameState = state;
    room.state = { players: new Map([[sessionId, { seat: declarantSeat }]]) };
    room.contraDecidingTeam = null;
    room.trickPauseLeader = null;
    room.turnStartedAt = performance.now();
    room.timerEpoch = 0;
    room.syncSchemaPublic = vi.fn();
    room.broadcastEvent = vi.fn();
    room.broadcastGameState = vi.fn();
    room.broadcastTimerState = vi.fn();
    room.persistSnapshot = vi.fn();

    room.handleCommand({ sessionId, send: vi.fn() }, 'declare_trump', {
      declaration: 'oros',
    });

    expect(room.timerEpoch).toBe(1);
    expect(room.contraDecidingTeam).toBe(declarantSeat % 2 === 0 ? 1 : 0);
  });

  it('applies a timeout penalty only once before the next round starts', () => {
    vi.useFakeTimers();
    const room = Object.create(BotifarraRoom.prototype) as any;
    room.gameState = { phase: 'playing', game: { scores: [0, 0] } };
    room.targetScore = 101;
    room.broadcast = vi.fn();
    room.syncSchemaPublic = vi.fn();
    room.startNewRoundPublic = vi.fn();

    room.handleRankedTimeout(0);
    room.handleRankedTimeout(0);

    expect(room.gameState.game.scores).toEqual([0, 36]);
    vi.advanceTimersByTime(2000);
    expect(room.startNewRoundPublic).toHaveBeenCalledTimes(1);
  });

  it('ends the game once on a timeout that reaches the target score', () => {
    vi.useFakeTimers();
    const room = Object.create(BotifarraRoom.prototype) as any;
    room.gameState = {
      phase: 'playing',
      game: { scores: [0, 80] },
      seats: new Map(),
    };
    room.targetScore = 101;
    room.broadcast = vi.fn();
    room.disconnect = vi.fn();
    room.syncSchemaPublic = vi.fn();
    room.startNewRoundPublic = vi.fn();

    // Simulate an older round transition still pending when the timeout decides the game.
    room.scheduleRoundTransition(15_000);
    room.handleRankedTimeout(0);
    room.handleRankedTimeout(0);

    expect(room.gameState.game.scores).toEqual([0, 116]);
    expect(room.gameState.phase).toBe('finished');
    expect(room.broadcast).toHaveBeenCalledTimes(2); // round_timeout and game_ended
    vi.advanceTimersByTime(15_000);
    expect(room.startNewRoundPublic).not.toHaveBeenCalled();
  });

  it('cancels a scheduled round start when the game ends', () => {
    vi.useFakeTimers();
    const room = Object.create(BotifarraRoom.prototype) as any;
    room.gameState = {
      phase: 'playing',
      game: { scores: [101, 40] },
      seats: new Map(),
    };
    room.broadcast = vi.fn();
    room.disconnect = vi.fn();
    room.startNewRoundPublic = vi.fn();
    room.roundTimeoutHandled = false;
    room.gameFinished = false;
    room.pendingRoundTransition = null;

    room.scheduleRoundTransition(2000);
    room.gameState.phase = 'finished';
    room.onGameFinished();
    vi.advanceTimersByTime(2000);

    expect(room.pendingRoundTransition).toBeNull();
    expect(room.startNewRoundPublic).not.toHaveBeenCalled();
  });

  it('rejects invalid trump declarations at the room command boundary', () => {
    const room = Object.create(BotifarraRoom.prototype) as any;
    const client = { send: vi.fn() };

    room.handleCommand(client, 'declare_trump', { declaration: 'invalid-suit' });

    expect(client.send).toHaveBeenCalledWith('error', {
      code: 'COMMAND_ERROR',
      message: 'Invalid trump declaration',
    });
  });

  it('filters private game-state events from broadcasts', () => {
    const room = Object.create(BotifarraRoom.prototype) as any;
    room.broadcast = vi.fn();

    room.broadcastEvent({ type: 'game_state', state: { hand: [{ suit: 'oros', rank: 1 }] } });
    expect(room.broadcast).not.toHaveBeenCalled();

    room.broadcastEvent({ type: 'trump_declared', declaration: 'oros' });
    expect(room.broadcast).toHaveBeenCalledWith('trump_declared', {
      type: 'trump_declared',
      declaration: 'oros',
    });
  });
});
