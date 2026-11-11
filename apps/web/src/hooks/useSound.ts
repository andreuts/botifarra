import { useCallback } from 'react';
import { useSettingsStore } from '../store/settingsStore.js';

export type SoundEvent =
  | 'card-deal'
  | 'card-play'
  | 'trick-win'
  | 'round-win'
  | 'round-lose'
  | 'trump-declare'
  | 'botifarra'
  | 'delegate'
  | 'contra'
  | 'recontra'
  | 'sant-vicenc'
  | 'turn-start'
  | 'timer-tick'
  | 'timer-expired';

interface SoundOptions {
  urgent?: boolean;
}

interface Note {
  at: number;
  frequency: number;
  duration: number;
  gain: number;
  waveform?: OscillatorType;
  endFrequency?: number;
}

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let audioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioContext && audioContext.state !== 'closed') return audioContext;

  const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor =
    typeof AudioContext !== 'undefined' ? AudioContext : browserWindow.webkitAudioContext;
  if (!AudioContextConstructor) return null;

  try {
    const context = new AudioContextConstructor();
    const gain = context.createGain();
    gain.connect(context.destination);
    audioContext = context;
    masterGain = gain;
    noiseBuffer = null;
    return context;
  } catch {
    return null;
  }
}

function getMasterGain(context: AudioContext): GainNode {
  if (!masterGain || masterGain.context !== context) {
    masterGain = context.createGain();
    masterGain.connect(context.destination);
  }
  return masterGain;
}

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === context.sampleRate) return noiseBuffer;

  const length = Math.ceil(context.sampleRate * 0.12);
  noiseBuffer = context.createBuffer(1, length, context.sampleRate);
  const samples = noiseBuffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function scheduleTone(
  context: AudioContext,
  destination: AudioNode,
  startAt: number,
  note: Note,
): void {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  const endAt = startAt + note.duration;

  oscillator.type = note.waveform ?? 'sine';
  oscillator.frequency.setValueAtTime(note.frequency, startAt);
  if (note.endFrequency && note.endFrequency !== note.frequency) {
    oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency, endAt);
  }

  envelope.gain.setValueAtTime(0.0001, startAt);
  envelope.gain.exponentialRampToValueAtTime(
    Math.max(0.0002, note.gain),
    startAt + Math.min(0.012, note.duration / 3),
  );
  envelope.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.015);
}

function scheduleNoise(
  context: AudioContext,
  destination: AudioNode,
  startAt: number,
  duration: number,
  peakGain: number,
  highPassHz: number,
): void {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const envelope = context.createGain();

  source.buffer = getNoiseBuffer(context);
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(highPassHz, startAt);
  envelope.gain.setValueAtTime(0.0001, startAt);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, peakGain), startAt + 0.006);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(destination);
  source.start(startAt, 0, duration);
  source.stop(startAt + duration + 0.01);
}

function playNotes(context: AudioContext, destination: AudioNode, notes: Note[]): void {
  const startAt = context.currentTime + 0.008;
  for (const note of notes) {
    scheduleTone(context, destination, startAt + note.at, note);
  }
}

function playSound(
  context: AudioContext,
  destination: AudioNode,
  event: SoundEvent,
  urgent: boolean,
): void {
  const now = context.currentTime + 0.008;

  switch (event) {
    case 'card-play':
      // A short paper flick with a soft wooden tap.
      scheduleNoise(context, destination, now, 0.055, 0.09, 900);
      scheduleTone(context, destination, now, {
        at: 0,
        frequency: 190,
        endFrequency: 125,
        duration: 0.045,
        gain: 0.07,
        waveform: 'triangle',
      });
      break;
    case 'card-deal':
      // Three quiet card slides, spaced like cards landing on the table.
      for (const offset of [0, 0.075, 0.15]) {
        scheduleNoise(context, destination, now + offset, 0.045, 0.045, 1200);
      }
      break;
    case 'trick-win':
      playNotes(context, destination, [
        { at: 0, frequency: 523, duration: 0.1, gain: 0.07, waveform: 'triangle' },
        { at: 0.085, frequency: 659, duration: 0.11, gain: 0.075, waveform: 'triangle' },
        { at: 0.17, frequency: 784, duration: 0.17, gain: 0.08, waveform: 'triangle' },
      ]);
      break;
    case 'round-win':
      playNotes(context, destination, [
        { at: 0, frequency: 523, duration: 0.16, gain: 0.08, waveform: 'triangle' },
        { at: 0.11, frequency: 659, duration: 0.17, gain: 0.085, waveform: 'triangle' },
        { at: 0.22, frequency: 784, duration: 0.2, gain: 0.09, waveform: 'triangle' },
        { at: 0.34, frequency: 1047, duration: 0.3, gain: 0.085, waveform: 'sine' },
      ]);
      break;
    case 'round-lose':
      playNotes(context, destination, [
        { at: 0, frequency: 392, duration: 0.16, gain: 0.075, waveform: 'triangle' },
        { at: 0.13, frequency: 330, duration: 0.18, gain: 0.075, waveform: 'triangle' },
        { at: 0.27, frequency: 262, duration: 0.26, gain: 0.07, waveform: 'sine' },
      ]);
      break;
    case 'trump-declare':
      playNotes(context, destination, [
        { at: 0, frequency: 587, duration: 0.12, gain: 0.065, waveform: 'sine' },
        { at: 0.09, frequency: 784, duration: 0.2, gain: 0.075, waveform: 'sine' },
      ]);
      break;
    case 'botifarra':
      // A fuller, low-to-high call distinct from a suit declaration.
      playNotes(context, destination, [
        { at: 0, frequency: 262, duration: 0.13, gain: 0.065, waveform: 'triangle' },
        { at: 0.09, frequency: 392, duration: 0.16, gain: 0.08, waveform: 'sawtooth' },
        { at: 0.2, frequency: 523, duration: 0.23, gain: 0.085, waveform: 'triangle' },
      ]);
      break;
    case 'delegate':
      // A gentle handoff motif: two notes descending to the partner.
      playNotes(context, destination, [
        { at: 0, frequency: 784, duration: 0.11, gain: 0.055, waveform: 'sine' },
        { at: 0.1, frequency: 587, duration: 0.18, gain: 0.06, waveform: 'sine' },
      ]);
      break;
    case 'contra':
      playNotes(context, destination, [
        { at: 0, frequency: 392, duration: 0.12, gain: 0.075, waveform: 'triangle' },
        { at: 0.1, frequency: 587, duration: 0.17, gain: 0.085, waveform: 'triangle' },
      ]);
      break;
    case 'recontra':
      playNotes(context, destination, [
        { at: 0, frequency: 494, duration: 0.12, gain: 0.08, waveform: 'triangle' },
        { at: 0.095, frequency: 740, duration: 0.17, gain: 0.09, waveform: 'triangle' },
      ]);
      break;
    case 'sant-vicenc':
      playNotes(context, destination, [
        { at: 0, frequency: 523, duration: 0.11, gain: 0.08, waveform: 'triangle' },
        { at: 0.09, frequency: 784, duration: 0.13, gain: 0.09, waveform: 'triangle' },
        { at: 0.19, frequency: 1047, duration: 0.23, gain: 0.095, waveform: 'sine' },
      ]);
      break;
    case 'turn-start':
      playNotes(context, destination, [
        { at: 0, frequency: 587, duration: 0.07, gain: 0.045, waveform: 'sine' },
        { at: 0.075, frequency: 784, duration: 0.11, gain: 0.05, waveform: 'sine' },
      ]);
      break;
    case 'timer-tick':
      scheduleTone(context, destination, now, {
        at: 0,
        frequency: urgent ? 1047 : 784,
        duration: urgent ? 0.045 : 0.03,
        gain: urgent ? 0.075 : 0.045,
        waveform: 'sine',
      });
      break;
    case 'timer-expired':
      playNotes(context, destination, [
        { at: 0, frequency: 784, duration: 0.09, gain: 0.07, waveform: 'triangle' },
        { at: 0.12, frequency: 392, duration: 0.2, gain: 0.075, waveform: 'triangle' },
      ]);
      break;
  }
}

export function useSound() {
  const play = useCallback((event: SoundEvent, options: SoundOptions = {}) => {
    const { soundEnabled, soundVolume } = useSettingsStore.getState();
    if (!soundEnabled || soundVolume <= 0 || !audioUnlocked) return;

    const context = getAudioContext();
    if (!context || context.state !== 'running') return;

    const gain = getMasterGain(context);
    gain.gain.setTargetAtTime(soundVolume, context.currentTime, 0.02);
    playSound(context, gain, event, options.urgent ?? false);
  }, []);

  const unlock = useCallback(() => {
    const context = getAudioContext();
    if (!context) return;

    if (context.state === 'running') {
      audioUnlocked = true;
      return;
    }

    void context.resume().then(() => {
      audioUnlocked = context.state === 'running';
    }).catch(() => {
      audioUnlocked = false;
    });
  }, []);

  return { play, unlock };
}
