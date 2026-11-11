import { useTranslation } from 'react-i18next';
import type { Seat, TrumpDeclaration } from '@botifarra/core';
import type { PlayerGameStateDTO } from '@botifarra/shared';
import { getContraDecidingTeam } from '../gamePhase.js';
import {
  CONTRA_TIMEOUT_MS,
  DECLARATION_TURN_MS,
  isTimerActive,
  remainingTurnTimeMs,
} from '../utils/timerUtils.js';

interface DeclareTrumpPanelProps {
  gameState: PlayerGameStateDTO;
  mySeat: number;
  /** Live timer state from the store — overrides gameState.timers for real-time updates */
  timers?: PlayerGameStateDTO['timers'];
  onDeclare: (declaration: TrumpDeclaration) => void;
  onPass?: () => void;
  onPassContra?: () => void;
  onContra?: () => void;
}

function cdColor(ratio: number): string {
  if (ratio > 0.5) return 'var(--color-success)';
  if (ratio > 0.25) return '#f39c12';
  return 'var(--color-danger)';
}

const DECLARATIONS: { value: TrumpDeclaration; labelKey: string; image: string }[] = [
  { value: 'oros', labelKey: 'suits.O', image: '/cards/01-oros.png' },
  { value: 'copes', labelKey: 'suits.C', image: '/cards/01-copas.png' },
  { value: 'espases', labelKey: 'suits.E', image: '/cards/01-espadas.png' },
  { value: 'bastos', labelKey: 'suits.B', image: '/cards/01-bastos.png' },
  { value: 'botifarra', labelKey: 'game_terms.botifarra', image: '/cards/botifarra.png' },
];

const CONTRA_KEYS = {
  1: 'game_terms.contra',
  2: 'game_terms.recontro',
  3: 'game_terms.santVicenc',
} as const;

const TRUMP_KEYS: Record<string, string> = {
  oros: 'suits.O',
  copes: 'suits.C',
  espases: 'suits.E',
  bastos: 'suits.B',
  botifarra: 'game_terms.botifarra',
};

export function DeclareTrumpPanel({
  gameState,
  mySeat,
  timers: liveTimers,
  onDeclare,
  onPass,
  onPassContra,
  onContra,
}: DeclareTrumpPanelProps) {
  const { t } = useTranslation();
  const isDeclarant = gameState.declarantSeat === mySeat;
  const { trump, contraLevel = 0, dealerPassed = false, dealerSeat } = gameState;
  const trumpLabel = trump
    ? TRUMP_KEYS[trump]
      ? t(TRUMP_KEYS[trump]!)
      : trump
    : t('trick.noTrumpYet');

  const myTeam = mySeat % 2;

  // --- Contra/Recontro/Sant Vicenç eligibility ---
  // Level 1 (contra):      non-declarant team calls
  // Level 2 (recontro):    declarant team calls
  // Level 3 (sant vicenç): non-declarant team calls (blocked on botifarra)
  const nextLevel = contraLevel + 1;
  const contraTeam = getContraDecidingTeam(gameState);
  const iCanCallContra = contraTeam !== null && myTeam === contraTeam;
  const contraPassVotes = gameState.contraPassVotes ?? [];
  const teammateSeat = ((gameState.mySeat + 2) % 4) as Seat;
  const iHavePassed = contraPassVotes.includes(gameState.mySeat);
  const teammateHasPassed = contraPassVotes.includes(teammateSeat);

  // In contra phase but it's the OTHER team's turn to decide
  const isWaitingContraPhase =
    contraTeam !== null && !iCanCallContra;

  if (trump !== null && !iCanCallContra && !isWaitingContraPhase) return null;

  const canPass = isDeclarant && trump === null && !dealerPassed && mySeat === dealerSeat;

  const nextContraLabel = t(CONTRA_KEYS[nextLevel as keyof typeof CONTRA_KEYS] ?? CONTRA_KEYS[1]);
  const currentContraLabel = t(CONTRA_KEYS[contraLevel as keyof typeof CONTRA_KEYS] ?? CONTRA_KEYS[1]);

  // Countdown: show when it's my turn to decide (declare or call contra).
  // The server marks the active seat with baseTurnMs >= 0; others get -1.
  // We rely on this signal rather than isMyDecision so the bar only appears
  // when the server is actually counting down for this seat.
  const timerSource = liveTimers ?? gameState.timers;
  const myTimer = timerSource?.find((t) => t.seat === mySeat);
  const iAmTimedSeat = isTimerActive(myTimer);
  const cdMs = iAmTimedSeat ? remainingTurnTimeMs(myTimer!) : null;
  const cdTotal = iAmTimedSeat
    ? contraTeam !== null
      ? CONTRA_TIMEOUT_MS
      : DECLARATION_TURN_MS
    : null;
  const cdRatio = cdMs !== null && cdTotal ? Math.min(1, Math.max(0, cdMs / cdTotal)) : null;
  const cdSecs = cdMs !== null ? Math.max(0, Math.ceil(cdMs / 1000)) : null;

  return (
    <div
      className="game-declare-panel"
      role="region"
      aria-label={iCanCallContra ? nextContraLabel : t('declare.heading')}
    >
      {/* Countdown bar — always takes up the same vertical space to avoid layout shifts.
          Uses opacity to hide when this player is not the active decision-maker. */}
      <div className={`game-declare-timer${cdRatio !== null ? ' is-visible' : ''}`}>
        <div className="game-declare-timer-readout">
          <span
            style={{
              color: cdRatio !== null ? cdColor(cdRatio) : 'transparent',
            }}
          >
            {cdSecs !== null ? `${cdSecs}s` : ''}
          </span>
        </div>
        <div className="game-declare-timer-track">
          <div
            className="game-declare-timer-fill"
            style={{
              width: `${(cdRatio ?? 0) * 100}%`,
              background: cdRatio !== null ? cdColor(cdRatio) : 'transparent',
            }}
          />
        </div>
      </div>
      {iCanCallContra ? (
        <>
          <p className="game-declare-current">
            {t('trick.trump')}: <strong>{trumpLabel}</strong>
            {contraLevel > 0 && <> · {currentContraLabel}</>}
          </p>
          <p className="game-declare-help">
            {iHavePassed
              ? t('declare.contraPassConfirmed')
              : teammateHasPassed
                ? t('declare.teammateContraPassed', {
                    name: gameState.playerNames[teammateSeat],
                  })
                : t('declare.contraBid', { contra: nextContraLabel })}
          </p>
          <div className="game-declare-actions">
            <button
              className="game-contra-button"
              onClick={onContra}
              aria-label={t('declare.callContra', { contra: nextContraLabel })}
            >
              {nextContraLabel}!
            </button>
            {onPassContra && (
              <button
                className="game-pass-button"
                onClick={onPassContra}
                disabled={iHavePassed}
                aria-label={t('declare.passContraAria')}
              >
                {t('declare.passContra')}
              </button>
            )}
          </div>
        </>
      ) : isWaitingContraPhase ? (
        <p className="game-declare-waiting">
          {t('trick.trump')}: <strong>{trumpLabel}</strong>
          {contraLevel > 0 && <> · {currentContraLabel}</>}
          <br />
          {contraLevel === 0
            ? t('declare.waitingContra')
            : t('declare.waitingDecision')}
        </p>
      ) : isDeclarant ? (
        <>
          <p className="game-declare-heading">
            {t('declare.heading')}
          </p>
          <div className="game-declare-options">
            {DECLARATIONS.map((d) => (
              <button
                key={d.value}
                className={`game-declare-option game-declare-option--${d.value}`}
                onClick={() => onDeclare(d.value)}
                aria-label={t('declare.declareAria', { label: t(d.labelKey) })}
              >
                <img
                  className="declare-card-art"
                  src={d.image}
                  alt=""
                  draggable={false}
                />
                <span>{t(d.labelKey)}</span>
              </button>
            ))}
          </div>
          {canPass && (
            <button
              className="game-pass-button"
              onClick={onPass}
              aria-label={t('declare.passToPartnerAria')}
            >
              {t('declare.passToPartner')}
            </button>
          )}
        </>
      ) : (
        <p className="game-declare-waiting">
          {t('declare.waitingForDeclarant', {
            name: gameState.playerNames?.[gameState.declarantSeat as 0 | 1 | 2 | 3],
          })}
        </p>
      )}
    </div>
  );
}
