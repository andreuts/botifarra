import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface ContinueTrickButtonProps {
  /** Whether this player is the leader who can click to continue */
  isLeader: boolean;
  /** When the pause started (ms since epoch) */
  pauseStartedAt: number;
  /** Total pause duration (ms) */
  pauseDuration: number;
  /** Called when the leader clicks to continue */
  onContinue: () => void;
  /** Name of the player who leads */
  leaderName: string;
}

const SIZE = 72;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ContinueTrickButton({
  isLeader,
  pauseStartedAt,
  pauseDuration,
  onContinue,
  leaderName,
}: ContinueTrickButtonProps) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0); // 0 to 1
  const rafRef = useRef<number>(0);

  useEffect(() => {
    function tick() {
      const elapsed = Date.now() - pauseStartedAt;
      const p = Math.min(1, elapsed / pauseDuration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [pauseStartedAt, pauseDuration]);

  const remaining = Math.max(0, Math.ceil((pauseDuration - (Date.now() - pauseStartedAt)) / 1000));
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  if (isLeader) {
    return (
      <button
        onClick={onContinue}
        aria-label={t('trickPause.continue')}
        title={t('trickPause.continue')}
        style={{
          position: 'relative',
          width: SIZE,
          height: SIZE,
          borderRadius: '50%',
          background: 'rgba(201,168,76,0.12)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          transition: 'background 0.2s, transform 0.1s',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.93)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {/* SVG countdown ring */}
        <svg
          width={SIZE}
          height={SIZE}
          style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
        >
          {/* Background circle */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={STROKE}
          />
          {/* Progress arc — depletes over time */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth={STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
          />
        </svg>
        {/* Play icon + seconds */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, zIndex: 1 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-gold)">
            <polygon points="6,3 20,12 6,21" />
          </svg>
          <span
            style={{
              fontSize: '0.6rem',
              color: 'var(--color-gold)',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {remaining}s
          </span>
        </div>
      </button>
    );
  }

  // Non-leader: show waiting indicator with countdown
  return (
    <div
      style={{
        position: 'relative',
        width: SIZE,
        height: SIZE,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.1s linear', opacity: 0.5 }}
        />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, zIndex: 1, textAlign: 'center' }}>
        <span style={{ fontSize: '0.55rem', color: 'var(--color-muted)', maxWidth: 50, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {leaderName}
        </span>
        <span style={{ fontSize: '0.6rem', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {remaining}s
        </span>
      </div>
    </div>
  );
}
