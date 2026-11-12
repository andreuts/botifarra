import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactionMood } from '@botifarra/shared';
import { reactionAssetClass, reactionAssetPath } from '../utils/reactionAssets.js';

const REACTION_MOODS: readonly ReactionMood[] = [
  'angry',
  'cheers',
  'laugh',
  'love',
  'happy',
  'pokerface',
];

const REACTION_COOLDOWN_MS = 2_000;
const REACTION_RATE_WINDOW_MS = 10_000;
const REACTION_RATE_MAX = 5;

interface ReactionPickerProps {
  onReaction: (reaction: ReactionMood) => void;
}

export function ReactionPicker({ onReaction }: ReactionPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const controlRef = useRef<HTMLDivElement>(null);
  const sentAtRef = useRef<number[]>([]);
  const cooldownRemaining = Math.max(0, cooldownUntil - now);
  const cooldownSeconds = Math.ceil(cooldownRemaining / 1_000);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      const timestamp = Date.now();
      setNow(timestamp);
      if (timestamp >= cooldownUntil) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
    };
  }, [open]);

  function chooseReaction(reaction: ReactionMood) {
    const timestamp = Date.now();
    const recent = sentAtRef.current.filter((sentAt) => timestamp - sentAt < REACTION_RATE_WINDOW_MS);
    const lastSentAt = recent.at(-1);
    const intervalWait = lastSentAt === undefined
      ? 0
      : Math.max(0, REACTION_COOLDOWN_MS - (timestamp - lastSentAt));
    const oldestSentAt = recent[0];
    const windowWait = recent.length >= REACTION_RATE_MAX && oldestSentAt !== undefined
      ? Math.max(0, oldestSentAt + REACTION_RATE_WINDOW_MS - timestamp)
      : 0;
    const waitMs = Math.max(intervalWait, windowWait);

    if (waitMs > 0) {
      setCooldownUntil(timestamp + waitMs);
      setNow(timestamp);
      return;
    }

    onReaction(reaction);
    recent.push(timestamp);
    sentAtRef.current = recent;
    const nextWindowWait = recent.length >= REACTION_RATE_MAX
      ? Math.max(0, (recent[0] ?? timestamp) + REACTION_RATE_WINDOW_MS - timestamp)
      : 0;
    setCooldownUntil(timestamp + Math.max(REACTION_COOLDOWN_MS, nextWindowWait));
    setNow(timestamp);
    setOpen(false);
  }

  return (
    <div ref={controlRef} className="reaction-picker-control">
      <button
        type="button"
        className="reaction-picker-trigger"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        disabled={cooldownRemaining > 0}
        aria-label={cooldownSeconds > 0
          ? t('reactions.cooldown', { seconds: cooldownSeconds })
          : t('reactions.open')}
        aria-expanded={open}
        title={cooldownSeconds > 0
          ? t('reactions.cooldown', { seconds: cooldownSeconds })
          : t('reactions.open')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M19.2 11.4a7.2 7.2 0 0 1-7.2 7.2 7 7 0 0 1-3.2-.8L4 19l1.2-4.4a7.1 7.1 0 1 1 14-3.2Z" />
          <path d="M12 7.8v5.4M9.3 10.5h5.4" />
        </svg>
        {cooldownSeconds > 0 && (
          <span className="reaction-picker-cooldown" aria-hidden="true">{cooldownSeconds}</span>
        )}
      </button>

      {open && (
        <div className="reaction-picker-panel" role="group" aria-label={t('reactions.open')}>
          {REACTION_MOODS.map((reaction) => (
            <button
              key={reaction}
              type="button"
              className="reaction-picker-option"
              onClick={() => chooseReaction(reaction)}
              disabled={cooldownRemaining > 0}
              title={t(`reactions.${reaction}`)}
            >
              <img
                className={reactionAssetClass(reaction)}
                src={reactionAssetPath(reaction)}
                alt=""
                draggable={false}
              />
              <span>{t(`reactions.${reaction}`)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
