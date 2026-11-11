import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@botifarra/core';
import { legalMoves } from '@botifarra/core';
import type { PlayerGameStateDTO } from '@botifarra/shared';
import { getContraDecidingTeam } from '../gamePhase.js';
import { useAuthStore } from '../store/authStore.js';
import { CardComponent } from './CardComponent.js';

function useIsMobile() {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.innerWidth <= 480;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(max-width: 480px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
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
  const rejectionVersion = useRef(0);
  const rejectionTimeout = useRef<number | null>(null);
  const prevHandLen = useRef(gameState.hand.length);
  const prevCommandErrorVersion = useRef(commandErrorVersion);
  const liveRef = useRef<HTMLDivElement>(null);

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

  // Fan parameters — cards fan out when there are many
  const count = gameState.hand.length;
  const maxFan = 10; // max overlap kicks in
  const overlapRatio = count > maxFan ? 0.42 : 0;
  // Mobile: use small (50px wide) to fit 12 cards; desktop: compact (60px)
  const cardW = isMobile ? 50 : 60;
  const gap = overlapRatio > 0 ? -cardW * overlapRatio : isMobile ? 3 : 6;

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
        style={{
          display: 'flex',
          gap,
          flexWrap: count <= maxFan ? 'nowrap' : 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '4px 4px 8px',
        }}
      >
        {sortHand(gameState.hand, handSortDirection).map((card, i) => {
          const key = `${card.suit}-${card.rank}`;
          const isSel = selected?.suit === card.suit && selected?.rank === card.rank;
          // Subtle fan rotation (-2° to +2°)
          const rotation = count > 3 ? (i / (count - 1) - 0.5) * 4 : 0;
          return (
            <CardComponent
              key={key}
              card={card}
              onClick={() => handleCardClick(card)}
              selected={isSel}
              compact={!isMobile}
              small={isMobile}
              animate={true}
              dealDelay={i * 55}
              rotation={rotation}
              magnifyOnHover
              rejectionAnimationVersion={rejectedCard?.key === key ? rejectedCard.version : 0}
            />
          );
        })}
      </div>
    </div>
  );
}
