import { useTranslation } from 'react-i18next';
import type { PlayerGameStateDTO } from '@botifarra/shared';

interface ScoreboardProps {
  gameState: PlayerGameStateDTO;
}

export function Scoreboard({ gameState }: ScoreboardProps) {
  const { t } = useTranslation();
  const names = gameState.playerNames;

  return (
    <div className="game-scoreboard" role="region" aria-label={t('scoreboard.aria')}>
      <div className="game-score-team game-score-team--0">
        <strong className="game-score-value">{gameState.scores[0]}</strong>
        <span className="game-score-names">{names[0]} &amp; {names[2]}</span>
      </div>

      <div className="game-score-round">
        <span className="game-score-label">{t('scoreboard.round')}</span>
        <strong className="game-round-number">{gameState.roundNumber}</strong>
        <span className="game-trick-progress">{gameState.completedTricks.length}/12</span>
      </div>

      <div className="game-score-team game-score-team--1">
        <strong className="game-score-value">{gameState.scores[1]}</strong>
        <span className="game-score-names">{names[1]} &amp; {names[3]}</span>
      </div>
    </div>
  );
}
