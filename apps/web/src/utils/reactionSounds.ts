import type { ReactionMood } from '@botifarra/shared';

type ReactionSoundProfile = {
  notes: number[];
  waveform: OscillatorType;
  stepSeconds: number;
  noteSeconds: number;
  volume: number;
};

const SOUND_PROFILES: Record<ReactionMood, ReactionSoundProfile> = {
  angry: { notes: [180, 145], waveform: 'square', stepSeconds: 0.09, noteSeconds: 0.12, volume: 0.045 },
  cheers: { notes: [1046, 1318, 1568], waveform: 'sine', stepSeconds: 0.07, noteSeconds: 0.22, volume: 0.035 },
  laugh: { notes: [620, 820, 690, 920], waveform: 'triangle', stepSeconds: 0.075, noteSeconds: 0.09, volume: 0.055 },
  love: { notes: [523, 659, 784], waveform: 'sine', stepSeconds: 0.11, noteSeconds: 0.18, volume: 0.045 },
  happy: { notes: [587, 740, 880], waveform: 'triangle', stepSeconds: 0.08, noteSeconds: 0.13, volume: 0.05 },
  pokerface: { notes: [440, 440], waveform: 'sine', stepSeconds: 0.12, noteSeconds: 0.1, volume: 0.035 },
};

let reactionAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  try {
    reactionAudioContext ??= new window.AudioContext();
    return reactionAudioContext;
  } catch {
    return null;
  }
}

/** Call after a user's first touch/click so later incoming reactions can sound. */
export function unlockReactionSounds() {
  const context = getAudioContext();
  if (context?.state === 'suspended') void context.resume().catch(() => undefined);
}

function playToneSequence(context: AudioContext, profile: ReactionSoundProfile) {
  const startAt = context.currentTime + 0.015;
  profile.notes.forEach((frequency, index) => {
    const start = startAt + index * profile.stepSeconds;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = profile.waveform;
    oscillator.frequency.setValueAtTime(frequency, start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(profile.volume, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + profile.noteSeconds);
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + profile.noteSeconds + 0.02);
  });
}

export function playReactionSound(reaction: ReactionMood) {
  const context = getAudioContext();
  if (!context) return;
  const play = () => {
    playToneSequence(context, SOUND_PROFILES[reaction]);
  };

  if (context.state === 'suspended') {
    void context.resume().then(play).catch(() => undefined);
  } else {
    play();
  }
}
