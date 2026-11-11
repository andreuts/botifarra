import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CompletedTrick, Seat } from '@botifarra/core';
import type { PlayerGameStateDTO } from '@botifarra/shared';
import { TRICK_ANIMATION_DURATION_MS } from '@botifarra/shared';
import { CardComponent, EmptyCardSlot } from './CardComponent.js';
import { getContraDecidingTeam } from '../gamePhase.js';
import {
  CARD_TURN_MS,
  DECLARATION_TURN_MS,
  CONTRA_TIMEOUT_MS,
  remainingTurnTimeMs,
} from '../utils/timerUtils.js';

interface TrickAreaProps {
  gameState: PlayerGameStateDTO;
  mySeat: Seat;
  /** Live timer state from the store — overrides gameState.timers for real-time updates */
  timers?: PlayerGameStateDTO['timers'];
  /** Keep the most recently completed trick on the table during the synchronized reveal. */
  trickReveal?: CompletedTrick | null;
  /** Animate the completed trick into the winning team's pile after the read pause. */
  trickRevealAnimating?: boolean;
  /** Final trick stays on the table briefly after all twelve tricks are complete. */
  finalTrickReveal?: CompletedTrick | null;
  /** Animate the revealed final trick into the winning team's pile. */
  finalTrickAnimating?: boolean;
}

const TRUMP_CARD_IMAGES: Record<string, string> = {
  oros: '/cards/01-oros.png',
  copes: '/cards/01-copas.png',
  espases: '/cards/01-espadas.png',
  bastos: '/cards/01-bastos.png',
  botifarra: '/cards/botifarra.png',
};

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
  maxTimeMs,
}: {
  seat: Seat;
  timers: PlayerGameStateDTO['timers'];
  maxTimeMs: number;
}) {
  const t = timers?.find((x) => x.seat === seat);
  const isTimedSeat = t !== undefined && t.baseTurnMs >= 0;
  const ratio = isTimedSeat
    ? Math.min(1, Math.max(0, remainingTurnTimeMs(t!) / maxTimeMs))
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

export function TrickArea({
  gameState,
  mySeat,
  timers: liveTimers,
  trickReveal = null,
  trickRevealAnimating = false,
  finalTrickReveal = null,
  finalTrickAnimating = false,
}: TrickAreaProps) {
  const { t } = useTranslation();
  const { currentTrick, playerNames, currentPlayerSeat, declarantSeat, completedTricks } = gameState;
  const contraTeam = getContraDecidingTeam(gameState);
  const maxTimerMs = contraTeam !== null
    ? CONTRA_TIMEOUT_MS
    : gameState.trump === null
      ? DECLARATION_TURN_MS
      : CARD_TURN_MS;
  const trickPauseLeader = gameState.trickPauseLeader ?? null;
  const activeSeat = trickPauseLeader ?? currentPlayerSeat;
  // Prefer live timers from store (updated every second via timer_update);
  // fall back to the snapshot timers embedded in gameState.
  const timers = liveTimers ?? gameState.timers;

  const [selectedLastTrickTeam, setSelectedLastTrickTeam] = useState<0 | 1 | null>(null);
  const myTeam = (mySeat % 2) as 0 | 1;
  const cardWrapperRefs = useRef<Partial<Record<Seat, HTMLDivElement | null>>>({});
  const teamPileRefs = useRef<Partial<Record<0 | 1, HTMLButtonElement | null>>>({});
  const [trickOffsets, setTrickOffsets] = useState<Partial<Record<Seat, { x: number; y: number }>>>({});
  const animatedTrick = finalTrickAnimating && finalTrickReveal
    ? finalTrickReveal
    : trickRevealAnimating && trickReveal
      ? trickReveal
      : null;
  const visibleTrick = finalTrickReveal?.cards ?? trickReveal?.cards ?? currentTrick;

  // Trick counts per team
  const team0Tricks = completedTricks.filter((tr) => tr.winner % 2 === 0).length;
  const team1Tricks = completedTricks.filter((tr) => tr.winner % 2 === 1).length;
  const selectedLastTrick = selectedLastTrickTeam === null
    ? null
    : completedTricks.filter((tr) => tr.winner % 2 === selectedLastTrickTeam).at(-1) ?? null;

  useLayoutEffect(() => {
    if (!animatedTrick) {
      setTrickOffsets({});
      return;
    }

    const winningTeam = (animatedTrick.winner % 2) as 0 | 1;
    const pile = teamPileRefs.current[winningTeam];
    if (!pile) return;

    const pileBounds = pile.getBoundingClientRect();
    const targetX = pileBounds.left + pileBounds.width / 2;
    const targetY = pileBounds.top + pileBounds.height / 2;
    const offsets: Partial<Record<Seat, { x: number; y: number }>> = {};

    for (const trickCard of animatedTrick.cards) {
      const card = cardWrapperRefs.current[trickCard.seat];
      if (!card) continue;
      const bounds = card.getBoundingClientRect();
      offsets[trickCard.seat] = {
        x: targetX - (bounds.left + bounds.width / 2),
        y: targetY - (bounds.top + bounds.height / 2),
      };
    }

    const frame = window.requestAnimationFrame(() => setTrickOffsets(offsets));
    return () => window.cancelAnimationFrame(frame);
  }, [animatedTrick]);

  function teamName(team: 0 | 1) {
    const partnerSeat = (team + 2) as Seat;
    return `${playerNames[team] ?? `S${team}`} & ${playerNames[partnerSeat] ?? `S${partnerSeat}`}`;
  }

  // Relative seat positions around the table
  const partner = ((mySeat + 2) % 4) as Seat;
  const leftOpp = ((mySeat + 1) % 4) as Seat;
  const rightOpp = ((mySeat + 3) % 4) as Seat;

  function cardFor(seat: Seat) {
    return visibleTrick.find((tc) => tc.seat === seat)?.card ?? null;
  }

  function trickCardFor(seat: Seat) {
    return visibleTrick.find((tc) => tc.seat === seat) ?? null;
  }

  function Slot({ seat, position }: { seat: Seat; position: string }) {
    const card = cardFor(seat);
    const trickCard = trickCardFor(seat);
    const isMovingTrickCard = animatedTrick !== null && trickCard !== null;
    const offset = trickOffsets[seat];
    const name = seat === mySeat ? t('trick.you') : (playerNames[seat] ?? t('trick.seatFallback', { seat }));
    const isActive = contraTeam !== null ? contraTeam === seat % 2 : activeSeat === seat;
    const isDeclarant = declarantSeat !== undefined && seat === declarantSeat;
    const teamClass = seat % 2 === 0 ? 'team-0' : 'team-1';
    const seatDescription = card
      ? name
      : isActive && contraTeam !== null
        ? t('game.playerContraDecision', { name })
        : isActive
          ? t('trick.waitingToPlay', { name })
          : name;

    return (
      <div
        className={`${position} trick-seat`}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
        aria-label={seatDescription}
      >
        <div className="trick-seat-roles">
          {isDeclarant && (
            <span
              className="trick-seat-declarant-icon"
              role="img"
              aria-label={t('trick.declarant')}
              title={t('trick.declarant')}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path d="M2.8 8.1h3.3l6.2-3v9.8l-6.2-3H2.8z" />
                <path d="m6.2 12 1.2 4.2h2.1L8.4 13" />
                <path d="M14.2 7.4c1.3 1 1.3 4.2 0 5.2M16.3 5.3c2.4 1.8 2.4 7.6 0 9.4" />
              </svg>
            </span>
          )}
        </div>
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
              marginRight: 0,
              transition: 'opacity 0.2s, margin-right 0.2s',
            }}
          />
          {name}
        </span>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {card ? (
            <div
              ref={(element) => { cardWrapperRefs.current[seat] = element; }}
              className={isMovingTrickCard ? 'trick-card-mover is-moving' : 'trick-card-mover'}
              style={{
                transition: `transform ${TRICK_ANIMATION_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${TRICK_ANIMATION_DURATION_MS}ms ease`,
                transform: isMovingTrickCard && offset
                  ? `translate3d(${offset.x}px, ${offset.y}px, 0) scale(0.24)`
                  : undefined,
              }}
            >
              <CardComponent card={card} magnifyOnHover />
            </div>
          ) : <EmptyCardSlot label="" />}
          <TimerBar seat={seat} timers={timers} maxTimeMs={maxTimerMs} />
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
        <div
          className="trick-area"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', width: '100%' }}
        >
        <div className="trick-grid" role="region" aria-label={t('trick.currentTrick')}>
          <Slot seat={partner} position="top" />
          <Slot seat={leftOpp} position="left" />
          <div
            className="center trick-center"
            aria-label={
              gameState.trump
                ? t('trick.trumpLabel', { trump: trumpLabel[gameState.trump] ?? gameState.trump })
                : t('trick.noTrumpYet')
            }
          >
            <div className={`trick-trump-display${gameState.trump === 'botifarra' ? ' is-botifarra' : ''}`}>
              <span className="trick-trump-label">{t('trick.trump')}</span>
              {gameState.trump && (
                <img
                  className="trick-trump-card"
                  src={TRUMP_CARD_IMAGES[gameState.trump]}
                  alt=""
                  draggable={false}
                />
              )}
              <strong>
                {gameState.trump ? trumpLabel[gameState.trump] ?? gameState.trump : t('trick.noTrumpYet')}
              </strong>
            </div>
          </div>
          <Slot seat={rightOpp} position="right" />
          <Slot seat={mySeat} position="bottom" />
          {selectedLastTrickTeam !== null && (
            <div
              key={selectedLastTrickTeam}
              className="won-trick-board-panel"
              role="region"
              aria-label={t('wonCards.lastTrick')}
            >
              <div className="won-trick-board-heading">
                <div className="won-trick-board-title">
                  <span className="won-trick-board-eyebrow">
                    {selectedLastTrickTeam === myTeam ? t('wonCards.lastWon') : t('wonCards.lastLost')}
                  </span>
                  <strong>{teamName(selectedLastTrickTeam)}</strong>
                </div>
                <button
                  className="won-trick-board-close"
                  type="button"
                  onClick={() => setSelectedLastTrickTeam(null)}
                  aria-label={t('wonCards.closeAria')}
                >
                  ×
                </button>
              </div>
              {selectedLastTrick ? (
                <div className="won-trick-board-cards">
                  {selectedLastTrick.cards.map((tc) => (
                    <div className="won-trick-board-card" key={tc.seat}>
                      <CardComponent card={tc.card} small />
                      <span className={tc.seat === selectedLastTrick.winner ? 'is-winner' : undefined}>
                        {playerNames[tc.seat] ?? `S${tc.seat}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="won-trick-board-empty">{t('wonCards.noTricks')}</p>
              )}
            </div>
          )}
        </div>

        {/* Won-trick stacks — one per team, always visible during play */}
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: 2 }}>
          {([0, 1] as const).map((team) => {
            const count = team === 0 ? team0Tricks : team1Tricks;
            const color = team === 0 ? 'var(--color-team0)' : 'var(--color-team1)';
            const isMyTeam = myTeam === team;
            const label = isMyTeam ? t('wonCards.lastWon') : t('wonCards.lastLost');
            const names = teamName(team);
            const isOpen = selectedLastTrickTeam === team;
            return (
              <button
                ref={(element) => { teamPileRefs.current[team] = element; }}
                key={team}
                className={`won-trick-toggle${isOpen ? ' is-open' : ''}`}
                onClick={() => setSelectedLastTrickTeam(isOpen ? null : team)}
                disabled={count === 0}
                title={`${label}: ${names}`}
                aria-pressed={isOpen}
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
                    {label}
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
