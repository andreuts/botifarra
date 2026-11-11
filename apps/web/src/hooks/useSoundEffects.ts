import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore.js';
import { useSound, type SoundEvent } from './useSound.js';
import { remainingTurnTimeMs } from '../utils/timerUtils.js';

interface GameSoundSnapshot {
  roundNumber: number;
  trump: string | null;
  dealerPassed: boolean;
  declarantSeat: number;
  contraLevel: number;
  currentTrickLength: number;
  completedTrickCount: number;
  currentPlayerSeat: number | null;
  mySeat: number;
  trickPauseLeader: number | null;
}

interface TimerSoundSnapshot {
  key: string;
  seconds: number;
  expired: boolean;
}

const CONTRA_SOUNDS: Record<number, SoundEvent> = {
  1: 'contra',
  2: 'recontra',
  3: 'sant-vicenc',
};

/** Mount once on the game page to turn shared game-state changes into SFX. */
export function useSoundEffects() {
  const { play, unlock } = useSound();
  const gameState = useGameStore((state) => state.gameState);
  const gameResult = useGameStore((state) => state.gameResult);
  const timers = useGameStore((state) => state.timers);

  const previousState = useRef<GameSoundSnapshot | null>(null);
  const previousGameResult = useRef(gameResult);
  const timerSound = useRef<TimerSoundSnapshot | null>(null);

  // Browsers require a real user gesture before Web Audio can play.
  useEffect(() => {
    const onFirstGesture = () => {
      unlock();
      document.removeEventListener('pointerdown', onFirstGesture, true);
      document.removeEventListener('keydown', onFirstGesture, true);
    };
    document.addEventListener('pointerdown', onFirstGesture, true);
    document.addEventListener('keydown', onFirstGesture, true);
    return () => {
      document.removeEventListener('pointerdown', onFirstGesture, true);
      document.removeEventListener('keydown', onFirstGesture, true);
    };
  }, [unlock]);

  // Event sounds come from synchronized state, so the same cue plays for each player.
  useEffect(() => {
    if (!gameState) {
      previousState.current = null;
      return;
    }

    const current: GameSoundSnapshot = {
      roundNumber: gameState.roundNumber,
      trump: gameState.trump,
      dealerPassed: gameState.dealerPassed,
      declarantSeat: gameState.declarantSeat,
      contraLevel: gameState.contraLevel,
      currentTrickLength: gameState.currentTrick.length,
      completedTrickCount: gameState.completedTricks.length,
      currentPlayerSeat: gameState.currentPlayerSeat,
      mySeat: gameState.mySeat,
      trickPauseLeader: gameState.trickPauseLeader ?? null,
    };
    const previous = previousState.current;

    if (!previous) {
      previousState.current = current;
      // The first state is the initial deal only when a fresh match starts at round one.
      if (current.roundNumber === 1 && current.trump === null && gameState.hand.length > 0) {
        play('card-deal');
      }
      return;
    }

    const newRound =
      current.roundNumber !== previous.roundNumber ||
      (previous.trump !== null && current.trump === null);

    if (newRound) {
      play('card-deal');
    } else {
      if (!previous.dealerPassed && current.dealerPassed && current.trump === null) {
        play('delegate');
      }

      if (previous.trump === null && current.trump !== null) {
        play(current.trump === 'botifarra' ? 'botifarra' : 'trump-declare');
      }

      if (current.contraLevel > previous.contraLevel) {
        const contraSound = CONTRA_SOUNDS[current.contraLevel];
        if (contraSound) play(contraSound);
      }

      // Count total cards played so the fourth card still sounds when the trick resets.
      const previousCardsPlayed = previous.completedTrickCount * 4 + previous.currentTrickLength;
      const currentCardsPlayed = current.completedTrickCount * 4 + current.currentTrickLength;
      if (currentCardsPlayed > previousCardsPlayed) play('card-play');

      if (current.completedTrickCount > previous.completedTrickCount) play('trick-win');
    }

    const playerJustGotTheTurn =
      current.currentPlayerSeat === current.mySeat &&
      (previous.currentPlayerSeat !== current.mySeat ||
        (previous.trickPauseLeader !== null && current.trickPauseLeader === null));
    if (playerJustGotTheTurn) play('turn-start');

    previousState.current = current;
  }, [gameState, play]);

  // Give only the local player a soft tick in the final seconds of their clock.
  useEffect(() => {
    if (!gameState || !timers) return;

    const myTimer = timers.find((timer) => timer.seat === gameState.mySeat);
    if (!myTimer || myTimer.baseTurnMs < 0) return;

    const remainingMs = remainingTurnTimeMs(myTimer);
    const phaseKey =
      gameState.currentPlayerSeat === null
        ? `decision-${gameState.declarantSeat}-${gameState.contraLevel}-${gameState.dealerPassed}`
        : `seat-${gameState.currentPlayerSeat}`;
    const key = `${gameState.matchId}-${gameState.roundNumber}-${phaseKey}-${gameState.trickPauseLeader ?? 'active'}`;

    if (remainingMs <= 0) {
      if (timerSound.current?.key !== key || !timerSound.current.expired) {
        play('timer-expired');
      }
      timerSound.current = { key, seconds: 0, expired: true };
      return;
    }

    const seconds = Math.ceil(remainingMs / 1000);
    const previous = timerSound.current;
    if (
      seconds <= 5 &&
      (previous?.key !== key || previous.seconds !== seconds)
    ) {
      play('timer-tick', { urgent: seconds <= 3 });
    }
    timerSound.current = { key, seconds, expired: false };
  }, [gameState, timers, play]);

  // Match result sounds are based on the local seat's team.
  useEffect(() => {
    if (gameResult && !previousGameResult.current) {
      const myTeam = (useGameStore.getState().gameState?.mySeat ?? 0) % 2;
      play(gameResult.winner === myTeam ? 'round-win' : 'round-lose');
    }
    previousGameResult.current = gameResult;
  }, [gameResult, play]);
}
