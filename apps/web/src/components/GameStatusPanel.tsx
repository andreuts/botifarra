import { useTranslation } from 'react-i18next';
import type { PlayerGameStateDTO } from '@botifarra/shared';

interface GameStatusPanelProps {
  gameState: PlayerGameStateDTO;
  modeLabel: string | null;
  modeTone: 'practice' | 'ranked' | 'normal';
}

const CONTRA_KEYS = {
  1: 'game_terms.contra',
  2: 'game_terms.recontro',
  3: 'game_terms.santVicenc',
} as const;

export function GameStatusPanel({ gameState, modeLabel, modeTone }: GameStatusPanelProps) {
  const { t } = useTranslation();
  const contraLevel = gameState.contraLevel ?? 0;
  const currentContraLabel =
    contraLevel > 0
      ? t(CONTRA_KEYS[contraLevel as keyof typeof CONTRA_KEYS] ?? CONTRA_KEYS[1])
      : null;

  if (!modeLabel && !currentContraLabel) return null;

  return (
    <section className="game-status-strip">
      {modeLabel && (
        <span className={'game-mode-badge game-mode-badge--' + modeTone + ' game-mode-indicator'}>
          {modeLabel}
        </span>
      )}
      {currentContraLabel && (
        <span
          className={'game-contra-badge game-contra-badge--' + contraLevel + ' game-status-contra-badge'}
          aria-label={currentContraLabel}
          title={currentContraLabel}
        >
          {currentContraLabel}
        </span>
      )}
    </section>
  );
}