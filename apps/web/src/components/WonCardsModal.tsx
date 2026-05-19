import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { CompletedTrick } from '@botifarra/core';
import { CardComponent } from './CardComponent.js';

interface WonCardsModalProps {
  team: 0 | 1;
  completedTricks: CompletedTrick[];
  playerNames: Record<number, string>;
  onClose: () => void;
}

const TEAM_COLOR = { 0: 'var(--color-team0)', 1: 'var(--color-team1)' } as const;

export function WonCardsModal({ team, completedTricks, playerNames, onClose }: WonCardsModalProps) {
  const { t } = useTranslation();

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Last trick won by this team
  const lastTrick = completedTricks.filter((tr) => tr.winner % 2 === team).at(-1) ?? null;

  const teamColor = TEAM_COLOR[team];
  const teamName = `${playerNames[team] ?? `S${team}`} & ${playerNames[team + 2] ?? `S${team + 2}`}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('wonCards.lastTrick')}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: '1.5rem',
        cursor: 'pointer',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(18,18,28,0.97)',
          border: `1px solid ${teamColor}55`,
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          maxWidth: 360,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem',
          cursor: 'default',
          boxShadow: `0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px ${teamColor}33`,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
              {t('wonCards.lastTrick')}
            </div>
            <div style={{ color: teamColor, fontWeight: 700, fontSize: '1rem' }}>{teamName}</div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('wonCards.closeAria')}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--color-muted)',
              borderRadius: 'var(--radius)',
              width: 28,
              height: 28,
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Cards */}
        {lastTrick === null ? (
          <div style={{ color: 'var(--color-muted)', textAlign: 'center', padding: '1rem 0' }}>
            {t('wonCards.noTricks')}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {lastTrick.cards.map((tc) => (
              <div key={tc.seat} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <CardComponent card={tc.card} small />
                <span
                  style={{
                    fontSize: '0.55rem',
                    color: tc.seat === lastTrick.winner ? teamColor : 'var(--color-muted)',
                    fontWeight: tc.seat === lastTrick.winner ? 700 : 400,
                    maxWidth: 52,
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {playerNames[tc.seat] ?? `S${tc.seat}`}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: '0.6rem', color: 'var(--color-muted)', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '0.5rem' }}>
          {t('wonCards.clickToClose')}
        </div>
      </div>
    </div>
  );
}


