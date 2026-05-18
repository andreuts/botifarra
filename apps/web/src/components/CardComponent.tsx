import { useState } from 'react';
import type { Card } from '@botifarra/core';

// ---------------------------------------------------------------------------
// Spanish (Catalan) deck — colour palette
// ---------------------------------------------------------------------------

const SUIT_COLOR: Record<Card['suit'], string> = {
  oros: '#B07800', // gold/amber
  copes: '#9B1B1B', // deep crimson
  espases: '#1E3166', // deep navy
  bastos: '#5A3315', // dark brown
};

// Map Catalan suit names to file naming (Spanish)
const SUIT_FILE: Record<Card['suit'], string> = {
  oros: 'oros',
  copes: 'copas',
  espases: 'espadas',
  bastos: 'bastos',
};

function getCardImagePath(card: Card): string {
  const rank = String(card.rank).padStart(2, '0');
  return `/cards/${rank}-${SUIT_FILE[card.suit]}.png`;
}

const RANK_LABEL: Record<number, string> = {
  1: 'A',
  10: 'S',
  11: 'C',
  12: 'R',
};
function cornerLabel(rank: number): string {
  return RANK_LABEL[rank] ?? String(rank);
}

const RANK_NAME: Record<number, string> = {
  1: 'As',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'Sota',
  11: 'Cavall',
  12: 'Rei',
};
const SUIT_LABEL: Record<Card['suit'], string> = {
  oros: 'Oros',
  copes: 'Copes',
  espases: 'Espases',
  bastos: 'Bastos',
};

// ---------------------------------------------------------------------------
// SVG suit symbols — viewBox="0 0 20 20"
// ---------------------------------------------------------------------------

function SuitPip({ suit, size }: { suit: Card['suit']; size: number }) {
  const c = SUIT_COLOR[suit];

  if (suit === 'oros') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" style={{ display: 'block' }}>
        <circle cx="10" cy="10" r="8.5" fill={c} opacity="0.13" stroke={c} strokeWidth="1.6" />
        <circle cx="10" cy="10" r="5.2" fill={c} opacity="0.10" stroke={c} strokeWidth="1.4" />
        <circle cx="10" cy="10" r="2.2" fill={c} />
      </svg>
    );
  }
  if (suit === 'copes') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill={c} style={{ display: 'block' }}>
        <path d="M5.5 2.5 h9 l-1.8 8 q-.7 2.8-2.7 3 q-2 .2-2.7-3 Z" />
        <rect x="9" y="13.5" width="2" height="3.5" />
        <rect x="5.5" y="16.5" width="9" height="2" rx="1" />
      </svg>
    );
  }
  if (suit === 'espases') {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill={c} style={{ display: 'block' }}>
        <polygon points="10,1.5 11.4,16 8.6,16" />
        <rect x="4.5" y="13.5" width="11" height="2" rx="1" />
        <rect x="9.2" y="15.5" width="1.6" height="3" />
        <circle cx="10" cy="19" r="1.5" />
      </svg>
    );
  }
  // bastos — three crossing batons
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      strokeLinecap="round"
      style={{ display: 'block' }}
    >
      <path d="M10 1.5 Q12 10 10 18.5" stroke={c} strokeWidth="3.5" />
      <path d="M4 4 Q10 10 16 16" stroke={c} strokeWidth="3" />
      <path d="M16 4 Q10 10 4 16" stroke={c} strokeWidth="3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Pip layout — [xFrac, yFrac] within the pip zone (0..1 each axis)
//
// Pip zone (fraction of card w/h):
//   x: 0.15 … 0.85
//   y: 0.24 … 0.80   (avoid corner labels)
// ---------------------------------------------------------------------------

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.5, 0.2],
    [0.5, 0.8],
  ],
  3: [
    [0.5, 0.15],
    [0.5, 0.5],
    [0.5, 0.85],
  ],
  4: [
    [0.22, 0.18],
    [0.78, 0.18],
    [0.22, 0.82],
    [0.78, 0.82],
  ],
  5: [
    [0.22, 0.18],
    [0.78, 0.18],
    [0.5, 0.5],
    [0.22, 0.82],
    [0.78, 0.82],
  ],
  6: [
    [0.22, 0.15],
    [0.78, 0.15],
    [0.22, 0.5],
    [0.78, 0.5],
    [0.22, 0.85],
    [0.78, 0.85],
  ],
  7: [
    [0.5, 0.08],
    [0.22, 0.25],
    [0.78, 0.25],
    [0.22, 0.5],
    [0.78, 0.5],
    [0.22, 0.75],
    [0.78, 0.75],
  ],
  8: [
    [0.22, 0.08],
    [0.78, 0.08],
    [0.22, 0.33],
    [0.78, 0.33],
    [0.22, 0.67],
    [0.78, 0.67],
    [0.22, 0.92],
    [0.78, 0.92],
  ],
  9: [
    [0.5, 0.05],
    [0.22, 0.2],
    [0.78, 0.2],
    [0.22, 0.4],
    [0.78, 0.4],
    [0.5, 0.55],
    [0.22, 0.7],
    [0.78, 0.7],
    [0.5, 0.88],
  ],
};

const COURT_RANKS = new Set([10, 11, 12]);
const ZONE_X: [number, number] = [0.15, 0.85];
const ZONE_Y: [number, number] = [0.24, 0.8];

// ---------------------------------------------------------------------------
// Card face contents (pips or court card)
// ---------------------------------------------------------------------------

function CardFace({ card, w, h, small }: { card: Card; w: number; h: number; small: boolean }) {
  const color = SUIT_COLOR[card.suit];
  const pipZoneW = w * (ZONE_X[1] - ZONE_X[0]);
  const pipZoneH = h * (ZONE_Y[1] - ZONE_Y[0]);
  const pipZoneLeft = w * ZONE_X[0];
  const pipZoneTop = h * ZONE_Y[0];

  if (COURT_RANKS.has(card.rank)) {
    const largePip = small ? 34 : 50;
    return (
      <>
        <div
          style={{
            position: 'absolute',
            inset: small ? 5 : 7,
            border: `1px solid ${color}`,
            borderRadius: 3,
            opacity: 0.3,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: small ? 2 : 5,
          }}
        >
          <span
            style={{
              fontSize: small ? '1.5rem' : '2.1rem',
              fontWeight: 900,
              color,
              lineHeight: 1,
              letterSpacing: '-1px',
              fontFamily: 'Georgia, serif',
            }}
          >
            {RANK_LABEL[card.rank]}
          </span>
          <SuitPip suit={card.suit} size={largePip} />
          {!small && (
            <span
              style={{
                fontSize: '0.58rem',
                fontWeight: 600,
                color,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                opacity: 0.65,
                fontFamily: 'Georgia, serif',
              }}
            >
              {RANK_NAME[card.rank]}
            </span>
          )}
        </div>
      </>
    );
  }

  const isAs = card.rank === 1;
  const pipSize = isAs ? (small ? 28 : 42) : small ? 11 : 17;
  const pips = PIP_LAYOUT[card.rank] ?? PIP_LAYOUT[1]!;

  return (
    <>
      {pips.map(([xf, yf], i) => {
        const left = pipZoneLeft + xf * pipZoneW - pipSize / 2;
        const top = pipZoneTop + yf * pipZoneH - pipSize / 2;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left,
              top,
              width: pipSize,
              height: pipSize,
              lineHeight: 0,
            }}
          >
            <SuitPip suit={card.suit} size={pipSize} />
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main card component
// ---------------------------------------------------------------------------

interface CardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  faceDown?: boolean;
  small?: boolean;
  /** CSS animation-delay in ms — used for deal animation */
  dealDelay?: number;
  /** Show the deal animation */
  animate?: boolean;
  /** Show the "just played" animation */
  playAnimate?: boolean;
  /** Custom CSS rotation for fan layout */
  rotation?: number;
}

export function CardComponent({
  card,
  onClick,
  disabled,
  selected,
  faceDown,
  small,
  dealDelay = 0,
  animate = false,
  playAnimate = false,
  rotation = 0,
}: CardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const w = small ? 50 : 74;
  const h = small ? 74 : 110;
  const cornerFs = small ? '0.6rem' : '0.82rem';
  const cornerPipSize = small ? 9 : 12;
  const color = SUIT_COLOR[card.suit];

  const borderColor = selected ? '#C8860A' : disabled ? 'rgba(200,185,165,0.4)' : '#C8BDA0';

  const shadow = selected
    ? '0 0 0 2px #C8860A, 0 8px 22px rgba(0,0,0,0.55)'
    : '2px 4px 10px rgba(0,0,0,0.45)';

  const animStyle: React.CSSProperties = animate
    ? { animation: `cardDeal 0.35s cubic-bezier(.22,1,.36,1) ${dealDelay}ms both` }
    : playAnimate
      ? { animation: 'cardPlay 0.3s ease forwards' }
      : {};

  const interactable = !!onClick && !disabled;
  const ariaLabel = faceDown
    ? 'Face-down card'
    : `${RANK_NAME[card.rank] ?? card.rank} de ${SUIT_LABEL[card.suit]}`;

  return (
    <div
      role={interactable ? 'button' : undefined}
      tabIndex={interactable ? 0 : undefined}
      aria-label={ariaLabel}
      aria-pressed={selected || undefined}
      aria-disabled={disabled || undefined}
      onClick={!disabled ? onClick : undefined}
      onKeyDown={(e) => {
        if (interactable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        position: 'relative',
        width: w,
        height: h,
        background: faceDown
          ? 'repeating-linear-gradient(50deg, #1e3d1a 0px, #1e3d1a 5px, #173315 5px, #173315 10px)'
          : '#FFFEF5',
        border: `2px solid ${borderColor}`,
        borderRadius: small ? 5 : 7,
        cursor: interactable ? 'pointer' : 'default',
        opacity: disabled ? 0.38 : 1,
        boxShadow: shadow,
        transition: 'transform 0.15s cubic-bezier(.34,1.56,.64,1), box-shadow 0.15s, opacity 0.15s',
        transform: `rotate(${rotation}deg) translateY(${selected ? -14 : 0}px)`,
        userSelect: 'none',
        flexShrink: 0,
        overflow: 'hidden',
        ...animStyle,
        outline: 'none',
      }}
      onFocus={(e) => {
        if (interactable)
          (e.currentTarget as HTMLElement).style.boxShadow =
            '0 0 0 3px #C8860A, 0 4px 12px rgba(0,0,0,0.4)';
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = shadow;
      }}
      onMouseEnter={(e) => {
        if (!interactable || disabled) return;
        (e.currentTarget as HTMLElement).style.transform =
          `rotate(${rotation}deg) translateY(${selected ? -14 : -7}px)`;
      }}
      onMouseLeave={(e) => {
        if (!interactable || disabled) return;
        (e.currentTarget as HTMLElement).style.transform =
          `rotate(${rotation}deg) translateY(${selected ? -14 : 0}px)`;
      }}
    >
      {faceDown ? (
        <img
          src="/cards/reverso.png"
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'inherit',
          }}
        />
      ) : !imgFailed ? (
        <img
          src={getCardImagePath(card)}
          alt={ariaLabel}
          draggable={false}
          loading="lazy"
          onError={() => setImgFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'inherit',
          }}
        />
      ) : (
        <>
          {/* SVG fallback — top-left corner label */}
          <div
            style={{
              position: 'absolute',
              top: 4,
              left: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1,
              zIndex: 1,
            }}
          >
            <span
              style={{
                fontSize: cornerFs,
                fontWeight: 800,
                color,
                fontFamily: 'Georgia, serif',
                lineHeight: 1,
              }}
            >
              {cornerLabel(card.rank)}
            </span>
            <div style={{ marginTop: 1 }}>
              <SuitPip suit={card.suit} size={cornerPipSize} />
            </div>
          </div>

          {/* Pip area / court card centre */}
          <CardFace card={card} w={w} h={h} small={!!small} />

          {/* Bottom-right corner label (rotated 180°) */}
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1,
              transform: 'rotate(180deg)',
              zIndex: 1,
            }}
          >
            <span
              style={{
                fontSize: cornerFs,
                fontWeight: 800,
                color,
                fontFamily: 'Georgia, serif',
                lineHeight: 1,
              }}
            >
              {cornerLabel(card.rank)}
            </span>
            <div style={{ marginTop: 1 }}>
              <SuitPip suit={card.suit} size={cornerPipSize} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty slot
// ---------------------------------------------------------------------------

export function EmptyCardSlot({ label, small }: { label?: string; small?: boolean }) {
  const w = small ? 50 : 74;
  const h = small ? 74 : 110;
  return (
    <div
      aria-label={label ?? 'Empty card slot'}
      style={{
        width: w,
        height: h,
        border: '2px dashed rgba(201,168,76,0.2)',
        borderRadius: small ? 5 : 7,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(201,168,76,0.2)',
        fontSize: '0.7rem',
        flexShrink: 0,
        background: 'rgba(0,0,0,0.15)',
      }}
    >
      {label}
    </div>
  );
}
