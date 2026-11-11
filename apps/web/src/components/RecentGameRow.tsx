import { useTranslation } from 'react-i18next';
import type { RecentGameDTO } from '@botifarra/shared';

interface RecentGameRowProps {
  match: RecentGameDTO;
  onResume?: (matchId: string) => void;
}

export function RecentGameRow({ match, onResume }: RecentGameRowProps) {
  const { t } = useTranslation();
  const resultLabel = t(`history.outcome.${match.outcome}` as any);
  const playedAt = match.finishedAt ?? match.createdAt;
  const isWon = match.outcome === 'won';
  const isLost = match.outcome === 'lost';
  const isInProgress = match.outcome === 'in-progress';

  return (
    <li
      className={`recent-game-row recent-game-row--${match.outcome}`}
      aria-label={resultLabel}
      style={{
        background: isWon
          ? 'rgba(39, 174, 96, 0.12)'
          : isLost
            ? 'rgba(231, 76, 60, 0.12)'
            : 'var(--color-surface)',
      }}
    >
      <div className="recent-game-info">
        <span className="recent-game-outcome">{resultLabel}</span>
        <span className="recent-game-mode">
          {match.mode}
          {match.ranked && (
            <span className="recent-game-ranked" aria-label={t('home.ranked')} title={t('home.ranked')}>
              ★
            </span>
          )}
        </span>
      </div>

      <span className="recent-game-players">
        {match.players
          .slice()
          .sort((a, b) => a.seat - b.seat)
          .map((player) => player.username)
          .join(', ')}
      </span>

      <div className="recent-game-meta">
        <span className="recent-game-score">
          {match.scores[0]} <span aria-hidden="true">–</span> {match.scores[1]}
        </span>
        <time className="recent-game-date" dateTime={playedAt}>
          {new Date(playedAt).toLocaleDateString()}
        </time>
        {isInProgress && match.hasSnapshot && onResume && (
          <button
            className="btn-accent recent-game-resume"
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
