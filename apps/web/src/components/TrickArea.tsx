import { useTranslation } from 'react-i18next';
import type { Seat } from '@botifarra/core';
import type { PlayerGameStateDTO } from '@botifarra/shared';
import { CardComponent, EmptyCardSlot } from './CardComponent.js';

interface TrickAreaProps {
  gameState: PlayerGameStateDTO;
  mySeat: Seat;
}

export function TrickArea({ gameState, mySeat }: TrickAreaProps) {
  const { t } = useTranslation();
  const { currentTrick, playerNames, currentPlayerSeat } = gameState;

  // Relative seat positions around the table
  const partner = ((mySeat + 2) % 4) as Seat;
  const leftOpp = ((mySeat + 1) % 4) as Seat;
  const rightOpp = ((mySeat + 3) % 4) as Seat;

  function cardFor(seat: Seat) {
    return currentTrick.find((tc) => tc.seat === seat)?.card ?? null;
  }

  function Slot({ seat, position }: { seat: Seat; position: string }) {
    const card = cardFor(seat);
    const name = seat === mySeat ? t('trick.you') : (playerNames[seat] ?? t('trick.seatFallback', { seat }));
    const isActive = currentPlayerSeat === seat;
    const teamClass = seat % 2 === 0 ? 'team-0' : 'team-1';

    return (
      <div
        className={position}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
        aria-label={`${name}${card ? '' : isActive ? ' — waiting to play' : ''}`}
      >
        <span className={`seat-badge ${teamClass}${isActive ? ' active' : ''}`}>
          {isActive && (
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--color-success)',
                display: 'inline-block',
                animation: 'pulse 1s infinite',
              }}
            />
          )}
          {name}
        </span>
        {card ? <CardComponent card={card} small playAnimate /> : <EmptyCardSlot small label="" />}
      </div>
    );
  }

  // Trump label for center
  const trumpLabel: Record<string, string> = {
    oros: t('suits.O'),
    copes: t('suits.C'),
    espases: t('suits.E'),
    bastos: t('suits.B'),
    botifarra: t('game_terms.botifarra'),
  };

  return (
    <div className="trick-grid" role="region" aria-label={t('trick.currentTrick')}>
      <Slot seat={partner} position="top" />
      <Slot seat={leftOpp} position="left" />
      <div
        className="center"
        aria-label={
          gameState.trump
            ? t('trick.trumpLabel', { trump: trumpLabel[gameState.trump] ?? gameState.trump })
            : t('trick.noTrumpYet')
        }
        style={{
          width: 54,
          height: 64,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        {gameState.trump && gameState.trump !== 'botifarra' ? (
          <>
            <span
              style={{
                fontSize: '0.6rem',
                color: 'var(--color-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {t('trick.trump')}
            </span>
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-gold)',
                fontWeight: 700,
                textTransform: 'capitalize',
              }}
            >
              {gameState.trump}
            </span>
          </>
        ) : gameState.trump === 'botifarra' ? (
          <span style={{ fontSize: '0.65rem', color: 'var(--color-primary)', fontWeight: 700 }}>
            {t('game_terms.botifarra').toUpperCase()}
          </span>
        ) : null}
      </div>
      <Slot seat={rightOpp} position="right" />
      <Slot seat={mySeat} position="bottom" />
    </div>
  );
}
