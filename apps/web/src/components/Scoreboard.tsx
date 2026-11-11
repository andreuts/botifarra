import { useTranslation } from 'react-i18next';
import type { PlayerGameStateDTO } from '@botifarra/shared';

interface ScoreboardProps {
  gameState: PlayerGameStateDTO;
}

const MATCH_TARGET_SCORE = 101;

function TeamIcon() {
  return (
    <svg className="game-score-team-icon" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="10" cy="9" r="4" />
      <circle cx="20" cy="10" r="3.2" />
      <path d="M2.5 23c.5-5 3.2-7.6 7.5-7.6s7 2.6 7.5 7.6z" />
      <path d="M17 16.2c4.5-.7 7.7 1.8 8.2 6.8h-5.3c-.2-2.7-1.1-5-2.9-6.8z" />
    </svg>
  );
}

function RoundLaurel({ reversed = false }: { reversed?: boolean }) {
  return (
    <svg
      className={`game-round-laurel${reversed ? ' is-reversed' : ''}`}
      viewBox="0 0 28 52"
      aria-hidden="true"
    >
      <path d="M20 47C9 36 6 23 8 5" />
      <path d="M8 11C4 10 2 7 2 3c5 1 8 3 9 7M7 19c-4 0-7-3-7-7 5 0 8 2 10 6M8 27c-4 1-7-1-9-5 5-1 8 0 11 4M11 35c-4 2-7 1-10-2 4-2 8-2 12 1M15 42c-3 3-7 3-10 1 3-3 7-4 12-3" />
    </svg>
  );
}

export function Scoreboard({ gameState }: ScoreboardProps) {
  const { t } = useTranslation();
  const myTeam = gameState.mySeat % 2;

  function renderTeam(team: 0 | 1) {
    const isMyTeam = myTeam === team;
    const label = t(isMyTeam ? 'scoreboard.us' : 'scoreboard.rivals');

    return (
      <div
        className={`game-score-team game-score-team--${team}`}
        aria-label={`${label}: ${gameState.scores[team]}`}
      >
        <TeamIcon />
        <div className="game-score-team-copy">
          <strong className="game-score-team-label">{label}</strong>
        </div>
        <div className="game-score-numeric">
          <strong className="game-score-value">{gameState.scores[team]}</strong>
        </div>
      </div>
    );
  }

  return (
    <div className="game-scoreboard" role="region" aria-label={t('scoreboard.aria')}>
      {renderTeam(0)}

      <div className="game-score-round">
        <div className="game-score-round-heading">
          <RoundLaurel />
          <div className="game-score-round-copy">
            <span className="game-score-label">{t('scoreboard.round')}</span>
            <strong className="game-round-number">{gameState.roundNumber}</strong>
          </div>
          <RoundLaurel reversed />
        </div>
        <span className="game-score-objective">
          {t('scoreboard.objective', { score: MATCH_TARGET_SCORE })}
        </span>
      </div>

      {renderTeam(1)}
    </div>
  );
}
