import type { PlayerGameStateDTO } from '@botifarra/shared';

export const mockGameState: PlayerGameStateDTO = {
  matchId: 'test-match-1',
  roundNumber: 1,
  dealerSeat: 0,
  declarantSeat: 1,
  trump: 'oros',
  hand: [
    { suit: 'O', rank: 'A' },
    { suit: 'C', rank: '3' },
    { suit: 'E', rank: 'R' },
  ],
  mySeat: 0,
  playerNames: { 0: 'Alice', 1: 'Bob', 2: 'Carol', 3: 'Dave' },
  handSizes: { 0: 3, 1: 3, 2: 3, 3: 3 },
  currentTrick: [],
  completedTricks: [],
  currentLeader: 1,
  scores: [45, 60],
  currentPlayerSeat: 0,
  dealerPassed: false,
  contraLevel: 0,
};
