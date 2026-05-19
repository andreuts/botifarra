import { useTranslation } from 'react-i18next';
import type { TrumpDeclaration } from '@botifarra/core';
import type { PlayerGameStateDTO } from '@botifarra/shared';

interface DeclareTrumpPanelProps {
  gameState: PlayerGameStateDTO;
  mySeat: number;
  /** Live timer state from the store — overrides gameState.timers for real-time updates */
  timers?: PlayerGameStateDTO['timers'];
  onDeclare: (declaration: TrumpDeclaration) => void;
  onPass?: () => void;
  onContra?: () => void;
}

const BASE_TURN_MS = 15_000;
const ROUND_BUDGET_MS = 60_000;

function cdColor(ratio: number): string {
  if (ratio > 0.5) return 'var(--color-success)';
  if (ratio > 0.25) return '#f39c12';
  return 'var(--color-danger)';
}

const DECLARATIONS: { value: TrumpDeclaration; label: string; symbol: string; color: string }[] = [
  { value: 'oros', label: 'Oros', symbol: '◎', color: 'var(--card-gold)' },
  { value: 'copes', label: 'Copes', symbol: '♦', color: 'var(--card-red)' },
  { value: 'espases', label: 'Espases', symbol: '✦', color: 'var(--card-black)' },
  { value: 'bastos', label: 'Bastos', symbol: '♣', color: 'var(--card-green)' },
  { value: 'botifarra', label: 'Botifarra', symbol: '✕', color: 'var(--color-primary)' },
];

const CONTRA_LABELS: Record<number, string> = { 1: 'Contra', 2: 'Recontro', 3: 'Sant Vicenç' };

export function DeclareTrumpPanel({
  gameState,
  mySeat,
  timers: liveTimers,
  onDeclare,
  onPass,
  onContra,
}: DeclareTrumpPanelProps) {
  const { t } = useTranslation();
  const isDeclarant = gameState.declarantSeat === mySeat;
  const { trump, contraLevel = 0, dealerPassed = false, dealerSeat } = gameState;

  const myTeam = mySeat % 2;
  const declarantTeam = gameState.declarantSeat % 2;

  // --- Contra/Recontro/Sant Vicenç eligibility ---
  // Level 1 (contra):      non-declarant team calls
  // Level 2 (recontro):    declarant team calls
  // Level 3 (sant vicenç): non-declarant team calls (blocked on botifarra)
  const nextLevel = contraLevel + 1;
  const nextCallerIsDeclarantTeam = nextLevel === 2; // recontro → declarant team
  const iCanCallContra =
    trump !== null &&
    contraLevel < 3 &&
    // Sant Vicenç blocked on botifarra
    !(nextLevel === 3 && trump === 'botifarra') &&
    // No cards played yet
    gameState.currentTrick.length === 0 &&
    gameState.completedTricks.length === 0 &&
    // Team check
    (nextCallerIsDeclarantTeam ? myTeam === declarantTeam : myTeam !== declarantTeam);

  // In contra phase but it's the OTHER team's turn to decide
  const isWaitingContraPhase =
    trump !== null &&
    contraLevel < 3 &&
    !(nextLevel === 3 && trump === 'botifarra') &&
    gameState.currentTrick.length === 0 &&
    gameState.completedTricks.length === 0 &&
    !iCanCallContra;

  if (trump !== null && !iCanCallContra && !isWaitingContraPhase) return null;

  const canPass = isDeclarant && trump === null && !dealerPassed && mySeat === dealerSeat;

  const nextContraLabel = CONTRA_LABELS[nextLevel] ?? 'Contra';

  // Countdown: show when it's my turn to decide (declare or call contra).
  // The server marks the active seat with baseTurnMs >= 0; others get -1.
  // We rely on this signal rather than isMyDecision so the bar only appears
  // when the server is actually counting down for this seat.
  const timerSource = liveTimers ?? gameState.timers;
  const myTimer = timerSource?.find((t) => t.seat === mySeat);
  const iAmTimedSeat = myTimer !== undefined && myTimer.baseTurnMs >= 0;
  const cdMs = iAmTimedSeat
    ? (myTimer!.baseTurnMs > 0 ? myTimer!.baseTurnMs : myTimer!.roundBudgetMs)
    : null;
  const cdTotal = iAmTimedSeat
    ? (myTimer!.baseTurnMs > 0 ? BASE_TURN_MS : ROUND_BUDGET_MS)
    : null;
  const cdRatio = cdMs !== null && cdTotal ? Math.max(0, cdMs / cdTotal) : null;
  const cdSecs = cdMs !== null ? Math.ceil(cdMs / 1000) : null;

  return (
    <div
      role="region"
      aria-label={iCanCallContra ? nextContraLabel : t('declare.heading')}
      style={{
        background: 'rgba(0,0,0,0.45)',
        border: '1px solid rgba(201,168,76,0.3)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        textAlign: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Countdown bar — shown when it's this player's turn to decide */}
      {cdRatio !== null && cdSecs !== null && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.3rem' }}>
            <span
              style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                fontSize: '1.1rem',
                color: cdColor(cdRatio),
                letterSpacing: '0.05em',
              }}
            >
              {cdSecs}s
            </span>
          </div>
          <div
            style={{
              height: 4,
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${cdRatio * 100}%`,
                background: cdColor(cdRatio),
                borderRadius: 2,
              }}
            />
          </div>
        </div>
      )}
      {iCanCallContra ? (
        <>
          <p
            style={{
              color: 'var(--color-gold)',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
            }}
          >
            Trump: <strong>{trump}</strong>
            {contraLevel > 0 && <> · {CONTRA_LABELS[contraLevel]}</>}
          </p>
          <p style={{ color: 'var(--color-muted)', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
            {nextContraLabel}? {t('declare.contraBid', { contra: nextContraLabel })}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={onContra}
              aria-label={t('declare.callContra', { contra: nextContraLabel })}
              style={{ background: 'rgba(200,50,50,0.4)', border: '2px solid red', color: '#fff' }}
            >
              {nextContraLabel}!
            </button>
          </div>
        </>
      ) : isWaitingContraPhase ? (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
          Trump: <strong>{trump}</strong>
          {contraLevel > 0 && <> · {CONTRA_LABELS[contraLevel]}</>}
          <br />
          {contraLevel === 0
            ? t('declare.waitingContra')
            : t('declare.waitingDecision')}
        </p>
      ) : isDeclarant ? (
        <>
          <p
            style={{
              color: 'var(--color-gold)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {t('declare.heading')}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {DECLARATIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => onDeclare(d.value)}
                aria-label={t('declare.declareAria', { label: d.label })}
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: `2px solid ${d.color}`,
                  color: d.color === 'var(--card-black)' ? '#eee' : d.color,
                  padding: '0.6rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  minWidth: 68,
                  boxShadow: 'none',
                }}
              >
                <span style={{ fontSize: '1.2em', lineHeight: 1 }}>{d.symbol}</span>
                <span style={{ fontSize: '0.75rem' }}>{d.label}</span>
              </button>
            ))}
          </div>
          {canPass && (
            <button
              onClick={onPass}
              aria-label={t('declare.passToPartnerAria')}
              style={{
                marginTop: '0.75rem',
                background: 'rgba(0,0,0,0.3)',
                border: '2px solid var(--color-muted)',
                color: 'var(--color-muted)',
                padding: '0.4rem 1.2rem',
                fontSize: '0.85rem',
              }}
            >
              {t('declare.passToPartner')}
            </button>
          )}
        </>
      ) : (
        <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
          {t('declare.waitingForDeclarant', {
            name: gameState.playerNames?.[gameState.declarantSeat as 0 | 1 | 2 | 3],
          })}
        </p>
      )}
    </div>
  );
}
