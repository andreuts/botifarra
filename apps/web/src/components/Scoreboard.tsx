import { useTranslation } from 'react-i18next';
import type { PlayerGameStateDTO } from '@botifarra/shared';

interface ScoreboardProps {
  gameState: PlayerGameStateDTO;
}

export function Scoreboard({ gameState }: ScoreboardProps) {
  const { t } = useTranslation();
  const names = gameState.playerNames;

  return (
    <div
      role="region"
      aria-label={t('scoreboard.aria')}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.45)',
        border: '1px solid rgba(201,168,76,0.3)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.7rem 1rem',
        gap: '0.5rem',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Team 0 (seats 0,2) */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: '1.8rem',
            color: 'var(--color-team0)',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {gameState.scores[0]}
        </div>
        <div
          style={{ color: 'var(--color-team0)', fontSize: '0.7rem', marginTop: 3, opacity: 0.85 }}
        >
          {names[0]} &amp; {names[2]}
        </div>
      </div>

      {/* Center divider */}
      <div
        style={{
          textAlign: 'center',
          padding: '0 0.5rem',
          borderLeft: '1px solid rgba(201,168,76,0.2)',
          borderRight: '1px solid rgba(201,168,76,0.2)',
        }}
      >
        <div
          style={{
            fontSize: '0.6rem',
            color: 'var(--color-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          {t('scoreboard.round')}
        </div>
        <div
          style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-gold)', lineHeight: 1.2 }}
        >
          {gameState.roundNumber}
        </div>
        <div style={{ fontSize: '0.55rem', color: 'var(--color-muted)', marginTop: 2 }}>
          {gameState.completedTricks.length}/12
        </div>
      </div>

      {/* Team 1 (seats 1,3) */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: '1.8rem',
            color: 'var(--color-team1)',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {gameState.scores[1]}
        </div>
        <div
          style={{ color: 'var(--color-team1)', fontSize: '0.7rem', marginTop: 3, opacity: 0.85 }}
        >
          {names[1]} &amp; {names[3]}
        </div>
      </div>
    </div>
  );
}
