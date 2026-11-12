import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card, CompletedTrick, Seat } from '@botifarra/core';
import type { PlayerGameStateDTO, ReactionMood } from '@botifarra/shared';
import { TRICK_ANIMATION_DURATION_MS } from '@botifarra/shared';
import { CardComponent, EmptyCardSlot } from './CardComponent.js';
import { HandComponent } from './HandComponent.js';
import { ReactionPicker } from './ReactionPicker.js';
import type { ActiveGameReaction } from '../hooks/useGameRoom.js';
import { reactionAssetClass, reactionAssetPath } from '../utils/reactionAssets.js';
import { getContraDecidingTeam } from '../gamePhase.js';
import { avatarImageSrc } from '../utils/avatar.js';
import {
  CARD_TURN_MS,
  DECLARATION_TURN_MS,
  CONTRA_TIMEOUT_MS,
  isTimerActive,
  remainingTurnTimeMs,
} from '../utils/timerUtils.js';

interface TrickAreaProps {
  gameState: PlayerGameStateDTO;
  mySeat: Seat;
  playerConnectivity?: Partial<Record<Seat, boolean>>;
  onPlayCard: (card: Card) => void;
  commandErrorVersion?: number;
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
  onReaction?: (reaction: ReactionMood) => void;
  activeReactions?: Partial<Record<Seat, ActiveGameReaction>>;
}

const COMPACT_TABLE_QUERY = '(orientation: landscape) and (max-height: 760px)';
const TINY_TABLE_QUERY = '(orientation: landscape) and (max-height: 620px)';
const COMPACT_PORTRAIT_QUERY = '(orientation: portrait) and (max-width: 700px)';

function useCompactLandscape() {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mediaQuery = window.matchMedia(COMPACT_TABLE_QUERY);
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    },
    () => typeof window !== 'undefined' && !!window.matchMedia?.(COMPACT_TABLE_QUERY).matches,
    () => false,
  );
}

function useTinyLandscape() {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mediaQuery = window.matchMedia(TINY_TABLE_QUERY);
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    },
    () => typeof window !== 'undefined' && !!window.matchMedia?.(TINY_TABLE_QUERY).matches,
    () => false,
  );
}

function useCompactPortrait() {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mediaQuery = window.matchMedia(COMPACT_PORTRAIT_QUERY);
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    },
    () => typeof window !== 'undefined' && !!window.matchMedia?.(COMPACT_PORTRAIT_QUERY).matches,
    () => false,
  );
}

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
  compact,
  tiny,
}: {
  seat: Seat;
  timers: PlayerGameStateDTO['timers'];
  maxTimeMs: number;
  compact: boolean;
  tiny: boolean;
}) {
  const t = timers?.find((x) => x.seat === seat);
  const isTimedSeat = isTimerActive(t);
  const ratio = isTimedSeat
    ? Math.min(1, Math.max(0, remainingTurnTimeMs(t!) / maxTimeMs))
    : 0;
  const fill = barColor(ratio);

  return (
    <div
      aria-hidden="true"
      style={{
        width: 5,
        height: tiny ? 62 : compact ? 74 : 110,
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
  playerConnectivity = {},
  onPlayCard,
  commandErrorVersion = 0,
  timers: liveTimers,
  trickReveal = null,
  trickRevealAnimating = false,
  finalTrickReveal = null,
  finalTrickAnimating = false,
  onReaction,
  activeReactions = {},
}: TrickAreaProps) {
  const { t } = useTranslation();
  const compactLandscape = useCompactLandscape();
  const tinyLandscape = useTinyLandscape();
  const compactPortrait = useCompactPortrait();
  const compactTable = compactLandscape || compactPortrait;
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
  const trickGridRef = useRef<HTMLDivElement | null>(null);
  const cardWrapperRefs = useRef<Partial<Record<Seat, HTMLDivElement | null>>>({});
  const avatarRefs = useRef<Partial<Record<Seat, HTMLButtonElement | null>>>({});
  const [trickOffsets, setTrickOffsets] = useState<Partial<Record<Seat, { x: number; y: number }>>>({});
  const [reactionPositions, setReactionPositions] = useState<Partial<Record<Seat, {
    x: number;
    y: number;
    width: number;
    height: number;
  }>>>({});
  const animatedTrick = finalTrickAnimating && finalTrickReveal
    ? finalTrickReveal
    : trickRevealAnimating && trickReveal
      ? trickReveal
      : null;
  const visibleTrick = finalTrickReveal?.cards ?? trickReveal?.cards ?? currentTrick;

  const selectedLastTrick = selectedLastTrickTeam === null
    ? null
    : completedTricks.filter((tr) => tr.winner % 2 === selectedLastTrickTeam).at(-1) ?? null;

  useLayoutEffect(() => {
    if (!animatedTrick) {
      setTrickOffsets({});
      return;
    }

    const winnerAvatar = avatarRefs.current[animatedTrick.winner];
    if (!winnerAvatar) return;

    const avatarBounds = winnerAvatar.getBoundingClientRect();
    const targetX = avatarBounds.left + avatarBounds.width / 2;
    const targetY = avatarBounds.top + avatarBounds.height / 2;
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

  useLayoutEffect(() => {
    const updatePositions = () => {
      const grid = trickGridRef.current;
      if (!grid) return;
      const gridBounds = grid.getBoundingClientRect();
      const positions: typeof reactionPositions = {};

      for (const seat of [0, 1, 2, 3] as const) {
        if (seat !== mySeat && !activeReactions[seat]) continue;
        const avatar = avatarRefs.current[seat];
        if (!avatar) continue;
        const bounds = avatar.getBoundingClientRect();
        positions[seat] = {
          x: bounds.left + bounds.width / 2 - gridBounds.left,
          y: bounds.top + bounds.height / 2 - gridBounds.top,
          width: bounds.width,
          height: bounds.height,
        };
      }
      setReactionPositions(positions);
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [activeReactions, mySeat, compactLandscape, compactPortrait]);

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

  function renderOpponentHand(seat: Seat, position: string) {
    if (seat === mySeat) return null;
    const count = Math.max(0, Math.min(gameState.handSizes[seat] ?? 0, 12));
    if (count === 0) return null;

    const isTopSeat = position === 'top';
    const isSideSeat = position === 'left' || position === 'right';
    const cardWidth = isSideSeat ? 17 : 22;
    const cardHeight = isSideSeat ? 28 : 36;
    const sideCardAxisWidth = isSideSeat ? cardHeight : cardWidth;
    const sideCardAxisHeight = isSideSeat ? cardWidth : cardHeight;
    const step = isSideSeat ? 5.2 : 8.1;
    const fanStrength = Math.min(1, (count - 1) / 5);
    const fanCurve = (isSideSeat ? 10 : 14) * fanStrength;
    const inwardDirection = position === 'left' ? 1 : position === 'right' ? -1 : 0;
    const fanWidth = isSideSeat
      ? sideCardAxisWidth + fanCurve
      : cardWidth + (count - 1) * step;
    const fanHeight = isSideSeat
      ? sideCardAxisHeight + (count - 1) * step
      : cardHeight + (isTopSeat ? fanCurve : 0);
    const maxRotation = isSideSeat ? 5 : 17;
    const sideCardCenter = position === 'left'
      ? sideCardAxisWidth / 2
      : fanWidth - sideCardAxisWidth / 2;

    return (
      <div
        className={`opponent-card-fan${isSideSeat ? ' opponent-card-fan--side' : ''}`}
        style={{ width: fanWidth, height: fanHeight }}
        aria-hidden="true"
      >
        {Array.from({ length: count }, (_, index) => {
          const offset = index - (count - 1) / 2;
          const normalizedOffset = count > 1 ? offset / ((count - 1) / 2) : 0;
          const edgeOffset = fanCurve * normalizedOffset ** 2;
          const inwardOffset = fanCurve * (1 - normalizedOffset ** 2) * inwardDirection;
          const rotationDirection = position === 'top' || position === 'right' ? -1 : 1;
          const rotation = normalizedOffset * maxRotation * fanStrength;
          const sideFacingRotation = position === 'left' ? 90 : position === 'right' ? -90 : 0;
          const transformOrigin = isTopSeat
            ? '50% 0%'
            : position === 'left'
              ? '0% 50%'
              : '100% 50%';

          return (
            <img
              key={index}
              className="opponent-hand-card"
              src="/cards/reverso.png"
              alt=""
              draggable={false}
              style={{
                left: isSideSeat
                  ? `${sideCardCenter + inwardOffset}px`
                  : `calc(50% + ${offset * step}px)`,
                top: isSideSeat ? `calc(50% + ${offset * step}px)` : undefined,
                bottom: isTopSeat ? edgeOffset : undefined,
                width: cardWidth,
                height: cardHeight,
                zIndex: Math.round((1 - Math.abs(normalizedOffset)) * 100) + 1,
                transform: `${isSideSeat ? 'translate(-50%, -50%)' : 'translateX(-50%)'} rotate(${sideFacingRotation + rotation * rotationDirection}deg)`,
                transformOrigin: isSideSeat ? '50% 50%' : transformOrigin,
              }}
            />
          );
        })}
      </div>
    );
  }

  function renderSlot(seat: Seat, position: string) {
    const card = cardFor(seat);
    const name = seat === mySeat ? t('trick.you') : (playerNames[seat] ?? t('trick.seatFallback', { seat }));
    const isActive = contraTeam !== null ? contraTeam === seat % 2 : activeSeat === seat;
    const isDeclarant = declarantSeat !== undefined && seat === declarantSeat;
    const teamClass = seat % 2 === 0 ? 'team-0' : 'team-1';
    const seatTeam = (seat % 2) as 0 | 1;
    const isOnline = playerConnectivity[seat] ?? true;
    const statusLabel = t(isOnline ? 'game.online' : 'game.offline');
    const historyAction = t(seatTeam === myTeam ? 'wonCards.showLastWon' : 'wonCards.showLastLost');
    const seatDescription = card
      ? name
      : isActive && contraTeam !== null
        ? t('game.playerContraDecision', { name })
        : isActive
          ? t('trick.waitingToPlay', { name })
          : name;

    return (
      <div
        className={`${position} trick-seat${seat === mySeat ? ' trick-seat--current' : ''}`}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
        aria-label={seatDescription}
      >
        <div className="trick-seat-roles" />
        {seat === mySeat ? (
          <div className="current-player-hand">
            <HandComponent
              gameState={gameState}
              onPlayCard={onPlayCard}
              commandErrorVersion={commandErrorVersion}
              compactLandscape={compactLandscape}
            />
          </div>
        ) : renderOpponentHand(seat, position)}
        <div className="seat-identity">
          <button
            ref={(element) => { avatarRefs.current[seat] = element; }}
            type="button"
            className={`seat-badge seat-history-trigger ${teamClass}${isActive ? ' active' : ''}`}
            onClick={() => setSelectedLastTrickTeam(seatTeam)}
            aria-label={historyAction + ': ' + name + ' (' + statusLabel + ')'}
            aria-expanded={selectedLastTrickTeam === seatTeam}
            title={historyAction + ': ' + statusLabel}
          >
            <img
              className="seat-avatar"
              src={avatarImageSrc(gameState.playerAvatarIds?.[seat] ?? null)}
              alt=""
              draggable={false}
            />
            <span
              className={'seat-online-indicator ' + (isOnline ? 'is-online' : 'is-offline')}
              aria-hidden="true"
            />
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
          </button>
          <span className="seat-name">{name}</span>
        </div>
      </div>
    );
  }
  function renderPlayedCard(seat: Seat, position: string) {
    const card = cardFor(seat);
    const trickCard = trickCardFor(seat);
    const isMovingTrickCard = animatedTrick !== null && trickCard !== null;
    const offset = trickOffsets[seat];
    const name = seat === mySeat ? t('trick.you') : (playerNames[seat] ?? t('trick.seatFallback', { seat }));
    const isActive = contraTeam !== null ? contraTeam === seat % 2 : activeSeat === seat;
    const seatDescription = card
      ? name
      : isActive && contraTeam !== null
        ? t('game.playerContraDecision', { name })
        : isActive
          ? t('trick.waitingToPlay', { name })
          : name;

    return (
      <div className={`trick-card-seat ${position}`} aria-label={seatDescription}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {card ? (
            <div
              ref={(element) => { cardWrapperRefs.current[seat] = element; }}
              className={isMovingTrickCard ? 'trick-card-mover is-moving' : 'trick-card-mover'}
              style={{
                transition: `transform ${TRICK_ANIMATION_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${TRICK_ANIMATION_DURATION_MS}ms ease`,
                transform: isMovingTrickCard && offset
                  ? `translate3d(${offset.x}px, ${offset.y}px, 0) scale(0.2)`
                  : undefined,
              }}
            >
              <CardComponent
                card={card}
                small={compactTable}
                tiny={tinyLandscape}
                sizeScale={1.2}
                magnifyOnHover
              />
            </div>
          ) : <EmptyCardSlot label="" small={compactTable} tiny={tinyLandscape} sizeScale={1.2} />}
          <TimerBar seat={seat} timers={timers} maxTimeMs={maxTimerMs} compact={compactTable} tiny={tinyLandscape} />
        </div>
      </div>
    );
  }

  return (
    <>
        <div
          className="trick-area"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', width: '100%' }}
        >
        <div ref={trickGridRef} className="trick-grid" role="region" aria-label={t('trick.currentTrick')}>
          {renderSlot(partner, 'top')}
          {renderSlot(leftOpp, 'left')}
          {renderSlot(rightOpp, 'right')}
          {renderSlot(mySeat, 'bottom')}
          <div className="trick-card-layout">
            {renderPlayedCard(partner, 'top')}
            {renderPlayedCard(leftOpp, 'left')}
            {renderPlayedCard(rightOpp, 'right')}
            {renderPlayedCard(mySeat, 'bottom')}
          </div>
          <div className="game-reaction-layer" aria-live="polite">
            {onReaction && reactionPositions[mySeat] && (
              <div
                className="reaction-control-anchor"
                style={{
                  left: reactionPositions[mySeat]!.x + reactionPositions[mySeat]!.width / 2 + 5,
                  top: reactionPositions[mySeat]!.y,
                }}
              >
                <ReactionPicker onReaction={onReaction} />
              </div>
            )}
            {([0, 1, 2, 3] as const).map((seat) => {
              const reaction = activeReactions[seat];
              const position = reactionPositions[seat];
              if (!reaction || !position) return null;
              const isTopSeat = seat === partner;
              const isLeftSeat = seat === leftOpp;
              const isRightSeat = seat === rightOpp;
              const placement = isTopSeat
                ? 'below'
                : isLeftSeat
                  ? 'right'
                  : isRightSeat
                    ? 'left'
                    : 'above';

              return (
                <div
                  key={reaction.id}
                  className={`game-reaction-bubble game-reaction-bubble--${placement}`}
                  style={{
                    left: isLeftSeat
                      ? position.x + position.width / 2 + 6
                      : isRightSeat
                        ? position.x - position.width / 2 - 6
                        : position.x,
                    top: isTopSeat
                      ? position.y + position.height / 2 + 6
                      : isLeftSeat || isRightSeat
                        ? position.y
                        : position.y - position.height / 2 - 6,
                  }}
                  role="status"
                  aria-label={`${reaction.fromUsername}: ${t(`reactions.${reaction.reaction}`)}`}
                >
                  <img
                    className={reactionAssetClass(reaction.reaction)}
                    src={reactionAssetPath(reaction.reaction)}
                    alt=""
                    draggable={false}
                  />
                </div>
              );
            })}
          </div>
          {selectedLastTrickTeam !== null && (
            <div
              key={selectedLastTrickTeam}
              className="won-trick-board-panel"
              role="region"
              id="won-trick-history"
              aria-label={t(selectedLastTrickTeam === myTeam ? 'wonCards.lastWon' : 'wonCards.lastLost')}
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
                      <CardComponent card={tc.card} small magnifyOnHover />
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


      </div>
    </>
  );
}
