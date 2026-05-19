import { useTranslation } from 'react-i18next';
import type { Seat } from '@botifarra/core';
import type { PlayerGameStateDTO } from '@botifarra/shared';
import { CardComponent, EmptyCardSlot } from './CardComponent.js';

interface TrickAreaProps {
  gameState: PlayerGameStateDTO;
  mySeat: Seat;
  /** Live timer state from the store — overrides gameState.timers for real-time updates */
  timers?: PlayerGameStateDTO['timers'];
}

const BASE_TURN_MS = 15_000;
const ROUND_BUDGET_MS = 60_000;

function barColor(ratio: number): string {
  if (ratio > 0.5) return 'var(--color-success)';
  if (ratio > 0.25) return '#f39c12';
  return 'var(--color-danger)';
}

/** Thin vertical timer bar placed next to a card slot */
function TimerBar({
  seat,
  timers,
}: {
  seat: Seat;
  timers: PlayerGameStateDTO['timers'];
}) {
  if (!timers) return null;
  const t = timers.find((x) => x.seat === seat);
  if (!t) return null;

  // Server marks the active/timed seat with baseTurnMs >= 0.
  // All other seats get baseTurnMs = -1.
  // This works for both the playing phase (currentPlayerSeat) and the
  // declaring phase (declarantSeat), where currentPlayerSeat is null.
  const isTimedSeat = t.baseTurnMs >= 0;
  // Show the 15-second turn bar while it is counting; switch to round budget when exhausted.
  const ratio = isTimedSeat && t.baseTurnMs > 0
    ? Math.max(0, t.baseTurnMs / BASE_TURN_MS)
    : Math.max(0, t.roundBudgetMs / ROUND_BUDGET_MS);
  const fill = barColor(ratio);

  // Don't render an empty bar for idle seats where budget is full
  // (they have nothing meaningful to show until their turn starts).
  if (!isTimedSeat) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        width: 5,
        height: 110,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 3,
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          height: `${ratio * 100}%`,
          background: fill,
          borderRadius: 3,
        }}
      />
    </div>
  );
}

export function TrickArea({ gameState, mySeat, timers: liveTimers }: TrickAreaProps) {
  const { t } = useTranslation();
  const { currentTrick, playerNames, currentPlayerSeat, dealerSeat, declarantSeat } = gameState;
  // Prefer live timers from store (updated every second via timer_update);
  // fall back to the snapshot timers embedded in gameState.
  const timers = liveTimers ?? gameState.timers;

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
    const isDealer = seat === dealerSeat;
    const isDeclarant = declarantSeat !== undefined && seat === declarantSeat;
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
          {isDealer && (
            <span
              aria-label={t('trick.dealer')}
              title={t('trick.dealer')}
              style={{ marginLeft: 3, color: 'var(--color-gold)', fontSize: '0.7em', lineHeight: 1 }}
            >
              ★
            </span>
          )}
          {isDeclarant && !isDealer && (
            <span
              aria-label={t('trick.declarant')}
              title={t('trick.declarant')}
              style={{ marginLeft: 3, color: 'var(--color-primary)', fontSize: '0.7em', lineHeight: 1 }}
            >
              ♦
            </span>
          )}
        </span>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {card ? <CardComponent card={card} /> : <EmptyCardSlot label="" />}
          <TimerBar seat={seat} timers={timers} />
        </div>
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
          width: 70,
          height: 80,
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
