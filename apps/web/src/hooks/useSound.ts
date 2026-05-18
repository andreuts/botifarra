import { useCallback, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore.js';

export type SoundEvent =
  | 'card-deal'
  | 'card-play'
  | 'trick-win'
  | 'round-win'
  | 'round-lose'
  | 'trump-declare';

const SOUND_FILES: Record<SoundEvent, string> = {
  'card-deal': '/sounds/card-deal.mp3',
  'card-play': '/sounds/card-play.mp3',
  'trick-win': '/sounds/trick-win.mp3',
  'round-win': '/sounds/round-win.mp3',
  'round-lose': '/sounds/round-lose.mp3',
  'trump-declare': '/sounds/trump-declare.mp3',
};

// Simple audio pool to allow overlapping sounds
const audioPool: HTMLAudioElement[] = [];
const POOL_SIZE = 6;

function getAudioElement(): HTMLAudioElement {
  const idle = audioPool.find((a) => a.paused || a.ended);
  if (idle) return idle;
  if (audioPool.length < POOL_SIZE) {
    const el = new Audio();
    audioPool.push(el);
    return el;
  }
  // Reuse oldest
  return audioPool[0]!;
}

export function useSound() {
  const unlocked = useRef(false);

  const play = useCallback((event: SoundEvent) => {
    const { soundEnabled, soundVolume } = useSettingsStore.getState();
    if (!soundEnabled) return;

    const src = SOUND_FILES[event];
    if (!src) return;

    const audio = getAudioElement();
    audio.src = src;
    audio.volume = soundVolume;
    audio.play().catch(() => {
      // Browser may block autoplay before user gesture — silently ignore
    });
  }, []);

  // Call this on first user interaction to unlock audio on mobile
  const unlock = useCallback(() => {
    if (unlocked.current) return;
    unlocked.current = true;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    ctx.resume().then(() => ctx.close()).catch(() => {});
  }, []);

  return { play, unlock };
}
