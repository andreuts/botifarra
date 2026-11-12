import { useTranslation } from 'react-i18next';
import type { PlayerGameStateDTO } from '@botifarra/shared';

interface GameStatusPanelProps {
  gameState: PlayerGameStateDTO;
  modeLabel: string | null;
  modeTone: 'practice' | 'ranked' | 'normal';
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

export function GameStatusPanel({ gameState, modeLabel, modeTone }: GameStatusPanelProps) {
  const { t } = useTranslation();
  const trump = gameState.trump;
  const trumpInfo = trump && trump !== 'botifarra' ? TRUMP_SUIT_INFO[trump] : null;
  const contraLevel = gameState.contraLevel ?? 0;
  const currentContraLabel =
    contraLevel > 0
      ? t(CONTRA_KEYS[contraLevel as keyof typeof CONTRA_KEYS] ?? CONTRA_KEYS[1])
      : null;
  const compactContraLabel = contraLevel === 3 ? 'SV' : contraLevel === 2 ? 'R' : 'C';
  const trumpLabel =
    trump === null
      ? t('trick.noTrumpYet')
      : trump === 'botifarra'
        ? t('game_terms.botifarra')
        : trumpInfo
          ? t(`suits.${trumpInfo.key}`)
          : trump;


  return (
    <section className="game-status-strip" role="region" aria-label={t('trick.trump')}>
      {modeLabel && (
        <span className={`game-mode-badge game-mode-badge--${modeTone} game-mode-indicator`}>
          {modeLabel}
        </span>
      )}
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
          <div className="game-status-trump-value">
            <strong>{trumpLabel}</strong>
            {currentContraLabel && (
              <span
                className={`game-contra-badge game-contra-badge--${contraLevel} game-status-contra-badge`}
                aria-label={currentContraLabel}
                title={currentContraLabel}
              >
                <span className="game-status-contra-full">{currentContraLabel}</span>
                <span className="game-status-contra-compact" aria-hidden="true">
                  {compactContraLabel}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
