import { useTranslation } from 'react-i18next';
import type { RecentGameDTO } from '@botifarra/shared';

interface RecentGameRowProps {
  match: RecentGameDTO;
  onResume?: (matchId: string) => void;
}

const OUTCOME_COLORS: Record<RecentGameDTO['outcome'], string> = {
  won: 'var(--color-success, #27ae60)',
  lost: 'var(--color-danger, #e74c3c)',
  'in-progress': 'var(--color-surface)',
  abandoned: 'var(--color-surface)',
  draw: 'var(--color-surface)',
};

const OUTCOME_BORDER: Record<RecentGameDTO['outcome'], string> = {
  won: '2px solid var(--color-success, #27ae60)',
  lost: '2px solid var(--color-danger, #e74c3c)',
  'in-progress': '2px solid var(--color-accent, #3498db)',
  abandoned: '1px solid var(--color-border)',
  draw: '1px solid var(--color-border)',
};

export function RecentGameRow({ match, onResume }: RecentGameRowProps) {
  const { t } = useTranslation();

  const bgColor = OUTCOME_COLORS[match.outcome];
  const border = OUTCOME_BORDER[match.outcome];

  const isWon = match.outcome === 'won';
  const isLost = match.outcome === 'lost';
  const isInProgress = match.outcome === 'in-progress';

  return (
    <li
      style={{
        background: isWon
          ? 'rgba(39, 174, 96, 0.12)'
          : isLost
          ? 'rgba(231, 76, 60, 0.12)'
          : 'var(--color-surface)',
        border,
        borderRadius: 'var(--radius)',
        padding: '0.75rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.5rem',
      }}
      aria-label={t(`history.outcome.${match.outcome}` as any)}
    >
      {/* Left: outcome badge + mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <span
          style={{
            display: 'inline-block',
            minWidth: 80,
            padding: '0.2rem 0.5rem',
            borderRadius: 4,
            fontSize: '0.75rem',
            fontWeight: 700,
            textAlign: 'center',
            background: bgColor,
            color: isWon || isLost ? '#fff' : 'var(--color-muted)',
          }}
        >
          {t(`history.outcome.${match.outcome}` as any)}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
          {match.mode}
          {match.ranked && (
            <span style={{ marginLeft: '0.3rem', color: 'var(--color-accent)' }}>⚔</span>
          )}
        </span>
      </div>

      {/* Center: players */}
      <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', flex: 1, textAlign: 'center' }}>
        {match.players
          .slice()
          .sort((a, b) => a.seat - b.seat)
          .map((p) => p.username)
          .join(', ')}
      </span>

      {/* Right: scores + resume button + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
          {match.scores[0]} – {match.scores[1]}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
          {match.finishedAt
            ? new Date(match.finishedAt).toLocaleDateString()
            : new Date(match.createdAt).toLocaleDateString()}
        </span>
        {isInProgress && match.hasSnapshot && onResume && (
          <button
            className="btn-accent"
            style={{ padding: '0.25rem 0.7rem', fontSize: '0.8rem' }}
            onClick={() => onResume(match.matchId)}
            aria-label={t('history.resumeAriaLabel', { mode: match.mode })}
          >
            {t('history.resume')}
          </button>
        )}
      </div>
    </li>
  );
}
