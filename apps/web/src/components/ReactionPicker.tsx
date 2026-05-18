import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EMOJI_DISPLAY } from '../hooks/useGameRoom.js';

const PREMADE_KEYS = [
  'bona_sort',
  'ben_jugat',
  'quina_sort',
  'au_va',
  'botifarra',
  'fill_meu_tingues_bo',
  'joc_de_muts',
  'salut_i_manilles',
  'sortida_animal',
  'gg',
] as const;

interface ReactionPickerProps {
  onReaction: (emoji: string) => void;
  onPremade: (key: string) => void;
}

export function ReactionPicker({ onReaction, onPremade }: ReactionPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'emoji' | 'premade'>('emoji');

  if (!open) {
    return (
      <button
        className="btn-outline"
        onClick={() => setOpen(true)}
        style={{ fontSize: '1.2rem', padding: '0.3rem 0.6rem' }}
        aria-label={t('reactions.open')}
      >
        😊
      </button>
    );
  }

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      padding: '0.5rem',
      position: 'relative',
    }}>
      {/* Close button */}
      <button
        onClick={() => setOpen(false)}
        style={{
          position: 'absolute', top: 2, right: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.9rem', color: 'var(--color-muted)',
        }}
      >
        ✕
      </button>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
        <button
          className={tab === 'emoji' ? '' : 'btn-outline'}
          onClick={() => setTab('emoji')}
          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
        >
          {t('reactions.emojis')}
        </button>
        <button
          className={tab === 'premade' ? '' : 'btn-outline'}
          onClick={() => setTab('premade')}
          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
        >
          {t('reactions.phrases')}
        </button>
      </div>

      {tab === 'emoji' ? (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {Object.entries(EMOJI_DISPLAY).map(([key, display]) => (
            <button
              key={key}
              onClick={() => { onReaction(key); setOpen(false); }}
              style={{
                fontSize: '1.3rem', padding: '0.3rem',
                background: 'none', border: 'none', cursor: 'pointer',
                borderRadius: 'var(--radius)',
              }}
              title={t(`reactions.emoji.${key}`)}
            >
              {display}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '150px', overflowY: 'auto' }}>
          {PREMADE_KEYS.map((key) => (
            <button
              key={key}
              className="btn-outline"
              onClick={() => { onPremade(key); setOpen(false); }}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.5rem', textAlign: 'left' }}
            >
              {t(`premade.${key}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
