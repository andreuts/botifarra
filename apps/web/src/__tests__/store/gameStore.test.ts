import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../../store/gameStore.js';

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.getState().reset();
  });

  it('starts with default state', () => {
    const s = useGameStore.getState();
    expect(s.gameState).toBeNull();
    expect(s.connected).toBe(false);
    expect(s.error).toBeNull();
    expect(s.toasts).toHaveLength(0);
  });

  it('setConnected updates connected flag', () => {
    useGameStore.getState().setConnected(true);
    expect(useGameStore.getState().connected).toBe(true);
  });

  it('setError stores error message', () => {
    useGameStore.getState().setError('Connection failed');
    expect(useGameStore.getState().error).toBe('Connection failed');
  });

  it('setError(null) clears error', () => {
    useGameStore.getState().setError('oops');
    useGameStore.getState().setError(null);
    expect(useGameStore.getState().error).toBeNull();
  });

  it('addToast appends messages', () => {
    useGameStore.getState().addToast('first');
    useGameStore.getState().addToast('second');
    expect(useGameStore.getState().toasts).toEqual(['first', 'second']);
  });

  it('dismissToast removes oldest toast', () => {
    useGameStore.getState().addToast('first');
    useGameStore.getState().addToast('second');
    useGameStore.getState().dismissToast();
    expect(useGameStore.getState().toasts).toEqual(['second']);
  });

  it('setRoomId stores the room id', () => {
    useGameStore.getState().setRoomId('abc123');
    expect(useGameStore.getState().roomId).toBe('abc123');
  });

  it('setGameResult stores result', () => {
    useGameStore.getState().setGameResult({ scores: [101, 50], winner: 0 });
    expect(useGameStore.getState().gameResult?.winner).toBe(0);
  });

  it('reset clears runtime state but not activeGameRoomId', () => {
    useGameStore.getState().setActiveGameRoomId('room-99');
    useGameStore.getState().setConnected(true);
    useGameStore.getState().addToast('hi');
    useGameStore.getState().reset();
    const s = useGameStore.getState();
    expect(s.connected).toBe(false);
    expect(s.toasts).toHaveLength(0);
    // activeGameRoomId is persisted state — reset does NOT clear it
    expect(s.activeGameRoomId).toBe('room-99');
  });
});
