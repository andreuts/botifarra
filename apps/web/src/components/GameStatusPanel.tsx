import { useTranslation } from 'react-i18next';
import type { PlayerGameStateDTO } from '@botifarra/shared';
import { getContraDecidingTeam } from '../gamePhase.js';

interface GameStatusPanelProps {
  gameState: PlayerGameStateDTO;
  isMyTurn: boolean;
}

const TRUMP_SUIT_INFO = {
  oros: { key: 'O', image: '/cards/01-oros.png' },
  copes: { key: 'C', image: '/cards/01-copas.png' },
  espases: { key: 'E', image: '/cards/01-espadas.png' },
  bastos: { key: 'B', image: '/cards/01-bastos.png' },
} as const;

const CONTRA_KEYS = {
  1: 'game_terms.contra',
  2: 'game_terms.recontro',
  3: 'game_terms.santVicenc',
} as const;

export function GameStatusPanel({ gameState, isMyTurn }: GameStatusPanelProps) {
  const { t } = useTranslation();
  const trump = gameState.trump;
  const trumpInfo = trump && trump !== 'botifarra' ? TRUMP_SUIT_INFO[trump] : null;
  const contraTeam = getContraDecidingTeam(gameState);
  const myTeam = gameState.mySeat % 2;
  const contraLevel = gameState.contraLevel ?? 0;
  const nextContraLabel = t(
    CONTRA_KEYS[(contraLevel + 1) as keyof typeof CONTRA_KEYS] ?? CONTRA_KEYS[1],
  );
  const trumpLabel =
    trump === null
      ? t('trick.noTrumpYet')
      : trump === 'botifarra'
        ? t('game_terms.botifarra')
        : trumpInfo
          ? t(`suits.${trumpInfo.key}`)
          : t('game_terms.botifarra');

  const trickPauseLeader = gameState.trickPauseLeader ?? null;
  const turnSeat =
    contraTeam === null
      ? trickPauseLeader ?? gameState.currentPlayerSeat ?? (trump === null ? gameState.declarantSeat : null)
      : null;
  const yourTurn =
    contraTeam !== null ? contraTeam === myTeam : isMyTurn || turnSeat === gameState.mySeat;
  const turnName =
    contraTeam !== null
      ? t(contraTeam === myTeam ? 'game.yourTeam' : 'game.opponents')
      : turnSeat === null
        ? t('game.waiting')
        : turnSeat === gameState.mySeat
          ? t('trick.you')
          : (gameState.playerNames[turnSeat] ?? t('trick.seatFallback', { seat: turnSeat }));
  const dealerName =
    gameState.playerNames[gameState.dealerSeat] ??
    t('trick.seatFallback', { seat: gameState.dealerSeat });
  const turnDetail =
    contraTeam !== null
      ? contraTeam === myTeam
        ? t('declare.callContra', { contra: nextContraLabel })
        : contraLevel === 0
          ? t('declare.waitingContra')
          : t('declare.waitingDecision')
      : turnSeat === null
        ? t('game.waiting')
        : trickPauseLeader === turnSeat
          ? yourTurn
            ? t('trickPause.continue')
            : t('trickPause.waitingFor', { name: turnName })
          : yourTurn
            ? trump === null
              ? t('declare.heading')
              : t('game.yourTurn')
            : t('game.waitingFor', { name: turnName });

  return (
    <section className="game-status-strip" role="region" aria-label={t('game.tableStatus')}>
      <div className="game-status-item game-status-item--trump">
        <img
          className="game-status-card"
          src={
            trumpInfo?.image ??
            (trump === 'botifarra' ? '/cards/botifarra.png' : '/cards/reverso.png')
          }
          alt=""
          draggable={false}
        />
        <div className="game-status-copy">
          <span className="game-status-label">{t('trick.trump')}</span>
          <strong>{trumpLabel}</strong>
        </div>
      </div>

      <div className="game-status-item game-status-item--dealer">
        <span className="game-status-dealer-mark" aria-hidden="true" />
        <div className="game-status-copy">
          <span className="game-status-label">{t('trick.dealer')}</span>
          <strong>{dealerName}</strong>
        </div>
      </div>

      <div
        className={`game-status-item game-status-item--turn${yourTurn ? ' is-my-turn' : ''}`}
        aria-live="polite"
      >
        <span
          className={`game-status-turn-mark${turnSeat !== null || contraTeam !== null ? ' is-active' : ''}`}
          aria-hidden="true"
        />
        <div className="game-status-copy">
          <span className="game-status-label">{t('game.currentTurn')}</span>
          <strong>{turnName}</strong>
          <span className="game-status-detail">{turnDetail}</span>
        </div>
      </div>
    </section>
  );
}
