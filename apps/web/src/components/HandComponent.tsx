import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@botifarra/core';
import { legalMoves } from '@botifarra/core';
import type { PlayerGameStateDTO } from '@botifarra/shared';
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
// Rank display order within a suit (low index = leftmost in hand)
// Groups: As, 3, 2, Rei(12), Cavall(11), Sota(10), 9, 8, 7, 6, 5, 4
const RANK_DISPLAY: Record<number, number> = {
  1: 0, 3: 1, 2: 2, 12: 3, 11: 4, 10: 5, 9: 6, 8: 7, 7: 8, 6: 9, 5: 10, 4: 11,
};
function sortHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const sd = (SUIT_ORDER[a.suit] ?? 0) - (SUIT_ORDER[b.suit] ?? 0);
    if (sd !== 0) return sd;
    return (RANK_DISPLAY[a.rank] ?? a.rank) - (RANK_DISPLAY[b.rank] ?? b.rank);
  });
}

interface HandProps {
  gameState: PlayerGameStateDTO;
  onPlayCard: (card: Card) => void;
}

export function HandComponent({ gameState, onPlayCard }: HandProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<Card | null>(null);
  const [dealKey, setDealKey] = useState(0);
  const [pendingPlay, setPendingPlay] = useState(false);
  const prevHandLen = useRef(gameState.hand.length);
  const liveRef = useRef<HTMLDivElement>(null);

  const isMyTurn = !pendingPlay && gameState.currentPlayerSeat === gameState.mySeat && gameState.hand.length > 0;

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
    if (!legalSet.has(key)) return;
    if (selected && selected.suit === card.suit && selected.rank === card.rank) {
      setPendingPlay(true);
      onPlayCard(card);
      setSelected(null);
    } else {
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

  const statusText = isMyTurn
    ? selected
      ? t('hand.clickToConfirm')
      : t(legal.length !== 1 ? 'hand.yourTurnMoves_plural' : 'hand.yourTurnMoves', {
          count: legal.length,
        })
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
        {sortHand(gameState.hand).map((card, i) => {
          const key = `${card.suit}-${card.rank}`;
          const isLegal = legalSet.has(key);
          const isSel = selected?.suit === card.suit && selected?.rank === card.rank;
          // Subtle fan rotation (-2° to +2°)
          const rotation = count > 3 ? (i / (count - 1) - 0.5) * 4 : 0;
          return (
            <CardComponent
              key={key}
              card={card}
              onClick={() => handleCardClick(card)}
              disabled={isMyTurn && !isLegal}
              selected={isSel}
              compact={!isMobile}
              small={isMobile}
              animate={true}
              dealDelay={i * 55}
              rotation={rotation}
            />
          );
        })}
      </div>
    </div>
  );
}
