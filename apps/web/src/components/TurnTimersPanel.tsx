import type { TimerState } from '../store/gameStore.js';

const BASE_TURN_MS = 15_000;
const ROUND_BUDGET_MS = 60_000;

function formatMs(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return s > 0 ? `${s}s` : '0s';
}

function timerColor(ratio: number): string {
  if (ratio > 0.5) return 'var(--color-success)';
  if (ratio > 0.25) return 'var(--color-warning, #f39c12)';
  return 'var(--color-danger)';
}

interface TurnTimersPanelProps {
  timers: TimerState[];
  playerNames: Record<0 | 1 | 2 | 3, string>;
  mySeat: 0 | 1 | 2 | 3;
}

export function TurnTimersPanel({ timers, playerNames, mySeat }: TurnTimersPanelProps) {
  // Order: show mySeat first, then the rest in seat order
  const order: (0 | 1 | 2 | 3)[] = [mySeat, ...([0, 1, 2, 3] as (0 | 1 | 2 | 3)[]).filter((s) => s !== mySeat)];

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--color-border)',
        padding: '0.5rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
      }}
    >
      {order.map((seat) => {
        const t = timers.find((x) => x.seat === seat);
        if (!t) return null;

        const isActive = t.baseTurnMs >= 0;
        const budgetRatio = t.roundBudgetMs / ROUND_BUDGET_MS;
        const budgetColor = timerColor(budgetRatio);
        const baseRatio = isActive ? t.baseTurnMs / BASE_TURN_MS : 1;
        const baseColor = timerColor(baseRatio);
        const isMe = seat === mySeat;

        return (
          <div
            key={seat}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: isActive ? 1 : 0.65,
            }}
          >
            {/* Name + active indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
              {isActive && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--color-success)',
                    flexShrink: 0,
                    animation: 'pulse 1s infinite',
                  }}
                />
              )}
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: isMe ? 700 : 400,
                  color: isMe ? 'var(--color-gold)' : 'var(--color-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {playerNames[seat]}
              </span>
            </div>

            {/* 15s turn bar (active player only) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: 80 }}>
              {isActive ? (
                <>
                  <div
                    style={{
                      flex: 1,
                      height: 5,
                      borderRadius: 3,
                      background: 'var(--color-border)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round(baseRatio * 100)}%`,
                        height: '100%',
                        background: baseColor,
                        transition: 'width 0.9s linear, background 0.3s',
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.65rem', color: baseColor, fontVariantNumeric: 'tabular-nums', minWidth: 22, textAlign: 'right' }}>
                    {formatMs(t.baseTurnMs)}
                  </span>
                </>
              ) : (
                <div style={{ width: 80 }} />
              )}
            </div>

            {/* 1-min round budget bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: 80 }}>
              <div
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 3,
                  background: 'var(--color-border)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.round(budgetRatio * 100)}%`,
                    height: '100%',
                    background: budgetColor,
                    transition: 'width 0.9s linear, background 0.3s',
                    borderRadius: 3,
                  }}
                />
              </div>
              <span style={{ fontSize: '0.65rem', color: budgetColor, fontVariantNumeric: 'tabular-nums', minWidth: 22, textAlign: 'right' }}>
                {formatMs(t.roundBudgetMs)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
