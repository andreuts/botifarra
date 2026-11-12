import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@botifarra/core';
import { legalMoves } from '@botifarra/core';
import type { PlayerGameStateDTO } from '@botifarra/shared';
import { getContraDecidingTeam } from '../gamePhase.js';
import { useAuthStore } from '../store/authStore.js';
import { CardComponent } from './CardComponent.js';

const COMPACT_HAND_QUERY = '(max-width: 480px), (orientation: landscape) and (max-height: 620px), (hover: none), (any-pointer: coarse)';

function useIsMobile() {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};
      const mediaQuery = window.matchMedia(COMPACT_HAND_QUERY);
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    },
    () => typeof window !== 'undefined' && !!window.matchMedia?.(COMPACT_HAND_QUERY).matches,
    () => false,
  );
}

// Suit display order: oros, copes, espases, bastos
const SUIT_ORDER: Record<string, number> = { oros: 0, copes: 1, espases: 2, bastos: 3 };
// Botifarra strength order, displayed highest to lowest from left to right.
const RANK_DISPLAY: Record<number, number> = {
  9: 0, 1: 1, 12: 2, 11: 3, 10: 4, 8: 5, 7: 6, 6: 7, 5: 8, 4: 9, 3: 10, 2: 11,
};
function sortHand(cards: Card[], direction: 'left-to-right' | 'right-to-left'): Card[] {
  const sorted = [...cards].sort((a, b) => {
    const sd = (SUIT_ORDER[a.suit] ?? 0) - (SUIT_ORDER[b.suit] ?? 0);
    if (sd !== 0) return sd;
    return (RANK_DISPLAY[a.rank] ?? a.rank) - (RANK_DISPLAY[b.rank] ?? b.rank);
  });
  return direction === 'right-to-left' ? sorted.reverse() : sorted;
}

interface HandProps {
  gameState: PlayerGameStateDTO;
  onPlayCard: (card: Card) => void;
  commandErrorVersion?: number;
}

export function HandComponent({ gameState, onPlayCard, commandErrorVersion = 0 }: HandProps) {
  const { t } = useTranslation();
  const handSortDirection = useAuthStore(
    (state) => state.user?.handSortDirection ?? 'left-to-right',
  );
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<Card | null>(null);
  const [rejectedCard, setRejectedCard] = useState<{ key: string; version: number } | null>(null);
  const [dealKey, setDealKey] = useState(0);
  const [pendingPlay, setPendingPlay] = useState(false);
  const [handWidth, setHandWidth] = useState(0);
  const rejectionVersion = useRef(0);
  const rejectionTimeout = useRef<number | null>(null);
  const prevHandLen = useRef(gameState.hand.length);
  const prevCommandErrorVersion = useRef(commandErrorVersion);
  const liveRef = useRef<HTMLDivElement>(null);
  const handCardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = handCardsRef.current;
    if (!element) return;

    const measure = () => setHandWidth(Math.max(0, element.clientWidth - 8));
    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (rejectionTimeout.current !== null) window.clearTimeout(rejectionTimeout.current);
    },
    [],
  );

  const isMyTurn =
    !pendingPlay &&
    getContraDecidingTeam(gameState) === null &&
    gameState.currentPlayerSeat === gameState.mySeat &&
    gameState.hand.length > 0;

  // Trigger deal animation when a new hand arrives (more cards than before).
  // Also clear pendingPlay whenever the hand changes (server acknowledged our move).
  useEffect(() => {
    if (gameState.hand.length > prevHandLen.current) {
      setDealKey((k) => k + 1);
      setSelected(null);
    }
    if (gameState.hand.length !== prevHandLen.current) {
      setPendingPlay(false);
    }
    prevHandLen.current = gameState.hand.length;
  }, [gameState.hand.length]);

  // A rejected/stale submission does not change the hand, so unlock it on the
  // server's command-error response as well as on a successful hand update.
  useEffect(() => {
    if (commandErrorVersion === prevCommandErrorVersion.current) return;
    prevCommandErrorVersion.current = commandErrorVersion;
    setPendingPlay(false);
  }, [commandErrorVersion]);

  // Compute legal moves
  const legal =
    gameState.trump !== null && gameState.currentPlayerSeat !== null
      ? legalMoves({
          hand: gameState.hand,
          currentTrick: gameState.currentTrick,
          trump: gameState.trump,
          playerSeat: gameState.mySeat,
        })
      : [];
  const legalSet = new Set(legal.map((c) => `${c.suit}-${c.rank}`));

  function handleCardClick(card: Card) {
    if (!isMyTurn) return;
    const key = `${card.suit}-${card.rank}`;
    if (selected && selected.suit === card.suit && selected.rank === card.rank) {
      if (!legalSet.has(key)) {
        rejectionVersion.current += 1;
        setRejectedCard({ key, version: rejectionVersion.current });
        setSelected(null);
        if (rejectionTimeout.current !== null) window.clearTimeout(rejectionTimeout.current);
        rejectionTimeout.current = window.setTimeout(() => {
          setRejectedCard(null);
          rejectionTimeout.current = null;
        }, 700);
        return;
      }
      setRejectedCard(null);
      if (rejectionTimeout.current !== null) window.clearTimeout(rejectionTimeout.current);
      setPendingPlay(true);
      onPlayCard(card);
      setSelected(null);
    } else {
      setRejectedCard(null);
      if (rejectionTimeout.current !== null) window.clearTimeout(rejectionTimeout.current);
      setSelected(card);
    }
  }

  // Keep the full faces readable and calculate only as much overlap as the
  // current board width needs as the viewport rotates or changes size.
  const count = gameState.hand.length;
  const availableWidth = handWidth || (typeof window !== 'undefined' ? window.innerWidth - 32 : 360);
  const gap = isMobile ? 0 : 5;
  const smallCardFitWidth = 50 + Math.max(0, count - 1) * 25;
  const cardW = isMobile && availableWidth < smallCardFitWidth ? 42 : isMobile ? 50 : 60;
  const maxOverlap = isMobile ? (cardW === 42 ? 0.62 : 0.5) : 0.42;
  const naturalWidth = count * cardW + Math.max(0, count - 1) * gap;
  const neededOverlap = count > 1 && naturalWidth > availableWidth
    ? (naturalWidth - availableWidth) / ((count - 1) * cardW)
    : 0;
  const overlapRatio = Math.min(maxOverlap, neededOverlap);

  const statusText = rejectedCard
    ? t('hand.invalidMove')
    : isMyTurn
      ? selected
        ? t('hand.clickToConfirm')
        : t('game.currentTurn')
      : t('hand.waitingTurn');

  return (
    <div>
      {/* Screen-reader live region for turn announcements */}
      <div
        ref={liveRef}
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
        }}
      >
        {statusText}
      </div>

      <div
        aria-label={statusText}
        style={{
          fontSize: '0.78rem',
          color: isMyTurn ? 'var(--color-gold)' : 'var(--color-muted)',
          marginBottom: 10,
          minHeight: '1.2em',
          fontWeight: isMyTurn ? 600 : 400,
          textAlign: 'center',
          letterSpacing: '0.02em',
        }}
      >
        {statusText}
      </div>

      <div
        role="group"
        aria-label={t('hand.yourHand')}
        ref={handCardsRef}
        style={{
          display: 'flex',
          gap,
          flexWrap: 'nowrap',
          alignItems: 'flex-end',
          justifyContent: overlapRatio > 0 ? 'flex-start' : 'center',
          padding: '4px 4px 8px',
        }}
      >
        {sortHand(gameState.hand, handSortDirection).map((card, i) => {
          const key = `${card.suit}-${card.rank}`;
          const isSel = selected?.suit === card.suit && selected?.rank === card.rank;
          const normalizedOffset = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
          const fanStrength = Math.min(1, Math.max(0, (count - 1) / 5));
          const rotation = normalizedOffset * 9 * fanStrength;
          const fanLift = Math.round(24 * (1 - normalizedOffset ** 2) * fanStrength);
          return (
            <CardComponent
              key={key}
              card={card}
              overlapBefore={i > 0 ? cardW * overlapRatio : 0}
              disabled={!isMyTurn || !legalSet.has(key)}
              onClick={() => handleCardClick(card)}
              selected={isSel}
              tiny={isMobile && cardW === 42}
              small={isMobile && cardW === 50}
              compact={!isMobile}
              animate={true}
              dealDelay={i * 55}
              rotation={rotation}
              fanLift={fanLift}
              rejectionAnimationVersion={rejectedCard?.key === key ? rejectedCard.version : 0}
            />
          );
        })}
      </div>
    </div>
  );
}
