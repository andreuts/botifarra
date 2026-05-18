import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settingsStore.js';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onOpenAbout: () => void;
}

export function SettingsPanel({ open, onClose, onOpenAbout }: SettingsPanelProps) {
  const { t } = useTranslation();
  const { soundEnabled, soundVolume, language, setSoundEnabled, setSoundVolume, setLanguage } =
    useSettingsStore();
  const [localVolume, setLocalVolume] = useState(soundVolume);

  useEffect(() => {
    setLocalVolume(soundVolume);
  }, [soundVolume]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Trap focus when open
  useEffect(() => {
    if (!open) return;
    const panel = document.getElementById('settings-panel');
    if (panel) panel.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="settings-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        id="settings-panel"
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.heading')}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>{t('settings.heading')}</h2>
          <button
            className="btn-outline settings-close"
            onClick={onClose}
            aria-label={t('settings.close')}
          >
            ✕
          </button>
        </div>

        <div className="settings-body">
          {/* Sound toggle */}
          <div className="settings-row">
            <label htmlFor="sound-toggle">{t('settings.sound')}</label>
            <button
              id="sound-toggle"
              role="switch"
              aria-checked={soundEnabled}
              className={`toggle-switch ${soundEnabled ? 'toggle-on' : ''}`}
              onClick={() => setSoundEnabled(!soundEnabled)}
            >
              <span className="toggle-knob" />
            </button>
          </div>

          {/* Volume slider */}
          <div className="settings-row">
            <label htmlFor="volume-slider">{t('settings.volume')}</label>
            <input
              id="volume-slider"
              type="range"
              min="0"
              max="100"
              value={Math.round(localVolume * 100)}
              disabled={!soundEnabled}
              onChange={(e) => {
                const v = Number(e.target.value) / 100;
                setLocalVolume(v);
                setSoundVolume(v);
              }}
              aria-label={t('settings.volume')}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(localVolume * 100)}
            />
            <span className="volume-value">{Math.round(localVolume * 100)}%</span>
          </div>

          {/* Language selector */}
          <div className="settings-row">
            <label htmlFor="language-select">{t('settings.language')}</label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="ca">Català</option>
              <option value="es">Español</option>
            </select>
          </div>

          {/* About link */}
          <div className="settings-row settings-row-about">
            <button className="btn-outline" onClick={onOpenAbout}>
              {t('settings.about')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
