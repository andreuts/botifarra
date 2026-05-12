import { useState, useEffect, useRef } from 'react';
import type { Card } from '@botifarra/core';
import { legalMoves } from '@botifarra/core';
import type { PlayerGameStateDTO } from '@botifarra/shared';
import { CardComponent } from './CardComponent.js';

interface HandProps {
  gameState: PlayerGameStateDTO;
  onPlayCard: (card: Card) => void;
}

export function HandComponent({ gameState, onPlayCard }: HandProps) {
  const [selected, setSelected] = useState<Card | null>(null);
  const [dealKey, setDealKey] = useState(0);
  const prevHandLen = useRef(gameState.hand.length);
  const liveRef = useRef<HTMLDivElement>(null);

  const isMyTurn = gameState.currentPlayerSeat === gameState.mySeat &&
    gameState.hand.length > 0;

  // Trigger deal animation when a new hand arrives (more cards than before)
  useEffect(() => {
    if (gameState.hand.length > prevHandLen.current) {
      setDealKey((k) => k + 1);
      setSelected(null);
    }
    prevHandLen.current = gameState.hand.length;
  }, [gameState.hand.length]);

  // Compute legal moves
  const legal = gameState.trump !== null && gameState.currentPlayerSeat !== null
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
  const cardW = 74;
  const gap = overlapRatio > 0 ? -cardW * overlapRatio : 6;

  const statusText = isMyTurn
    ? selected
      ? 'Click again to confirm, or select another card'
      : `Your turn — ${legal.length} legal move${legal.length !== 1 ? 's' : ''}`
    : 'Waiting for your turn…';

  return (
    <div>
      {/* Screen-reader live region for turn announcements */}
      <div
        ref={liveRef}
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
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
        aria-label="Your hand"
        style={{
          display: 'flex',
          gap,
          flexWrap: count <= maxFan ? 'nowrap' : 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '4px 4px 8px',
        }}
      >
        {gameState.hand.map((card, i) => {
          const key = `${card.suit}-${card.rank}`;
          const isLegal = legalSet.has(key);
          const isSel = selected?.suit === card.suit && selected?.rank === card.rank;
          // Subtle fan rotation (-2° to +2°)
          const rotation = count > 3
            ? ((i / (count - 1)) - 0.5) * 4
            : 0;
          return (
            <CardComponent
              key={key}
              card={card}
              onClick={() => handleCardClick(card)}
              disabled={isMyTurn && !isLegal}
              selected={isSel}
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

