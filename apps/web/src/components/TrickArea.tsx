import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Seat } from '@botifarra/core';
import type { PlayerGameStateDTO } from '@botifarra/shared';
import { CardComponent, EmptyCardSlot } from './CardComponent.js';
import { WonCardsModal } from './WonCardsModal.js';

interface TrickAreaProps {
  gameState: PlayerGameStateDTO;
  mySeat: Seat;
  /** Live timer state from the store — overrides gameState.timers for real-time updates */
  timers?: PlayerGameStateDTO['timers'];
}

const BASE_TURN_MS = 30_000;
const ROUND_BUDGET_MS = 60_000;

function barColor(ratio: number): string {
  if (ratio > 0.5) return 'var(--color-success)';
  if (ratio > 0.25) return '#f39c12';
  return 'var(--color-danger)';
}

/** Thin vertical timer bar placed next to a card slot.
 *  Always renders a same-width spacer to avoid layout shifts when turns rotate. */
function TimerBar({
  seat,
  timers,
}: {
  seat: Seat;
  timers: PlayerGameStateDTO['timers'];
}) {
  const t = timers?.find((x) => x.seat === seat);
  const isTimedSeat = t !== undefined && t.baseTurnMs >= 0;
  const ratio = isTimedSeat
    ? (t!.baseTurnMs > 0
        ? Math.min(1, Math.max(0, t!.baseTurnMs / BASE_TURN_MS))
        : Math.min(1, Math.max(0, t!.roundBudgetMs / ROUND_BUDGET_MS)))
    : 0;
  const fill = barColor(ratio);

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
        // Fade in/out instead of mounting/unmounting to avoid layout shifts
        opacity: isTimedSeat ? 1 : 0,
        transition: 'opacity 0.3s ease',
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
          // Smooth fill changes every 50 ms from the interpolation hook
          transition: 'height 0.08s linear, background 0.5s ease',
        }}
      />
    </div>
  );
}

export function TrickArea({ gameState, mySeat, timers: liveTimers }: TrickAreaProps) {
  const { t } = useTranslation();
  const { currentTrick, playerNames, currentPlayerSeat, dealerSeat, declarantSeat, completedTricks } = gameState;
  // Prefer live timers from store (updated every second via timer_update);
  // fall back to the snapshot timers embedded in gameState.
  const timers = liveTimers ?? gameState.timers;

  const [wonModalTeam, setWonModalTeam] = useState<0 | 1 | null>(null);

  // Trick counts per team
  const team0Tricks = completedTricks.filter((tr) => tr.winner % 2 === 0).length;
  const team1Tricks = completedTricks.filter((tr) => tr.winner % 2 === 1).length;

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
          {/* Active indicator dot — always mounted, opacity toggled to avoid layout shift */}
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-success)',
              display: 'inline-block',
              animation: isActive ? 'pulse 1s infinite' : 'none',
              opacity: isActive ? 1 : 0,
              marginRight: isActive ? 0 : -10,
              transition: 'opacity 0.2s, margin-right 0.2s',
            }}
          />
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
    <>
      {wonModalTeam !== null && (
        <WonCardsModal
          team={wonModalTeam}
          completedTricks={completedTricks}
          playerNames={playerNames as Record<number, string>}
          onClose={() => setWonModalTeam(null)}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
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

        {/* Won-trick stacks — one per team, always visible during play */}
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: 2 }}>
          {([0, 1] as const).map((team) => {
            const count = team === 0 ? team0Tricks : team1Tricks;
            const color = team === 0 ? 'var(--color-team0)' : 'var(--color-team1)';
            const myTeam = mySeat % 2 === team;
            return (
              <button
                key={team}
                onClick={() => setWonModalTeam(team)}
                disabled={count === 0}
                title={`See last 4 tricks won by ${team === 0 ? `${playerNames[0]} & ${playerNames[2]}` : `${playerNames[1]} & ${playerNames[3]}`}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: `1px solid ${color}44`,
                  borderRadius: 'var(--radius)',
                  padding: '4px 10px',
                  cursor: count === 0 ? 'default' : 'pointer',
                  opacity: count === 0 ? 0.35 : 1,
                  transition: 'opacity 0.2s, border-color 0.2s',
                }}
              >
                {/* Mini face-down card stack */}
                <div style={{ position: 'relative', width: 22, height: 32, flexShrink: 0 }}>
                  {[2, 1, 0].map((offset) => (
                    <div
                      key={offset}
                      style={{
                        position: 'absolute',
                        top: offset * 2,
                        left: offset * 2,
                        width: 16,
                        height: 24,
                        borderRadius: 2,
                        background: `linear-gradient(135deg, ${color}44 0%, ${color}22 100%)`,
                        border: `1px solid ${color}66`,
                        boxShadow: '1px 1px 3px rgba(0,0,0,0.4)',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color, lineHeight: 1 }}>
                    {count}
                  </span>
                  <span style={{ fontSize: '0.55rem', color: 'var(--color-muted)', lineHeight: 1.2 }}>
                    {myTeam ? t('wonCards.ourTricks') : t('wonCards.theirTricks')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
