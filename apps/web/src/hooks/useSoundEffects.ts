import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { useSound } from './useSound.js';

/**
 * Hook that listens to game state changes and triggers appropriate sound effects.
 * Should be mounted once at the game page level.
 */
export function useSoundEffects() {
  const { play, unlock } = useSound();
  const gameState = useGameStore((s) => s.gameState);
  const gameResult = useGameStore((s) => s.gameResult);

  // Track previous values to detect changes
  const prevTrickCount = useRef<number>(0);
  const prevTrump = useRef<string | null | undefined>(undefined);
  const prevCardCount = useRef<number>(0);
  const prevGameResult = useRef(gameResult);

  // Unlock audio on first interaction
  useEffect(() => {
    const handler = () => { unlock(); document.removeEventListener('click', handler); };
    document.addEventListener('click', handler, { once: true });
    return () => document.removeEventListener('click', handler);
  }, [unlock]);

  // Detect game events from state changes
  useEffect(() => {
    if (!gameState) return;

    const currentTrump = gameState.trump;
    const trickCards = gameState.currentTrick?.length ?? 0;
    const completedTrickCount = gameState.completedTricks?.length ?? 0;

    // Trump declaration (trump went from null to a value)
    if (currentTrump !== null && prevTrump.current === null) {
      play('trump-declare');
    }

    // Card played (trick cards increased)
    if (trickCards > prevCardCount.current && prevCardCount.current >= 0 && prevTrump.current !== undefined) {
      play('card-play');
    }

    // Trick completed (completed trick count increased)
    if (completedTrickCount > prevTrickCount.current && prevTrickCount.current > 0) {
      play('trick-win');
    }

    // Deal (trump reset to null from a value — new round)
    if (currentTrump === null && prevTrump.current !== null && prevTrump.current !== undefined) {
      play('card-deal');
    }

    prevTrump.current = currentTrump;
    prevCardCount.current = trickCards;
    prevTrickCount.current = completedTrickCount;
  }, [gameState, play]);

  // Game ended
  useEffect(() => {
    if (gameResult && !prevGameResult.current) {
      const mySeat = useGameStore.getState().gameState?.mySeat ?? 0;
      const myTeam = mySeat % 2;
      if (gameResult.winner === myTeam) {
        play('round-win');
      } else {
        play('round-lose');
      }
    }
    prevGameResult.current = gameResult;
  }, [gameResult, play]);
}
