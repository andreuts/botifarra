import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore.js';
import { SettingsPanel } from './SettingsPanel.js';

declare const __APP_VERSION__: string;

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Don't show nav on game page (keep it fullscreen)
  const isGamePage = location.pathname.startsWith('/match/') || location.pathname === '/play';

  if (!user) return <>{children}</>;

  return (
    <>
      {!isGamePage && (
        <nav className="app-nav" aria-label={t('nav.home')}>
          <div className="app-nav-inner">
            <Link to="/" className="app-nav-brand">
              {t('app.title')}
            </Link>
            <div className="app-nav-links">
              <Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>
                {t('nav.matchHistory')}
              </Link>
              <Link to="/rankings" className={location.pathname === '/rankings' ? 'active' : ''}>
                {t('nav.rankings')}
              </Link>
              <Link to="/friends" className={location.pathname === '/friends' ? 'active' : ''}>
                {t('friends.heading')}
              </Link>
            </div>
            <button
              className="settings-gear"
              onClick={() => setSettingsOpen(true)}
              aria-label={t('settings.heading')}
              title={t('settings.heading')}
            >
              ⚙
            </button>
          </div>
        </nav>
      )}

      {isGamePage && (
        <button
          className="settings-gear settings-gear-game"
          onClick={() => setSettingsOpen(true)}
          aria-label={t('settings.heading')}
          title={t('settings.heading')}
        >
          ⚙
        </button>
      )}

      {children}

      <SettingsPanel
        open={settingsOpen || showAbout}
        onClose={() => { setSettingsOpen(false); setShowAbout(false); }}
        onOpenAbout={() => { setSettingsOpen(false); setShowAbout(true); }}
      />

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="settings-overlay" onClick={onClose} role="presentation">
      <div
        className="settings-panel about-panel"
        role="dialog"
        aria-modal="true"
        aria-label={t('about.heading')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>{t('about.heading')}</h2>
          <button
            className="btn-outline settings-close"
            onClick={onClose}
            aria-label={t('settings.close')}
          >
            ✕
          </button>
        </div>
        <div className="settings-body about-body">
          <h3 className="about-title">{t('app.title')}</h3>
          <p className="about-version">v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.1'}</p>
          <p className="about-desc">{t('about.description')}</p>

          <div className="about-section">
            <h4>{t('about.credits')}</h4>
            <p>{t('about.cardAttribution')}</p>
          </div>

          <div className="about-section">
            <h4>{t('about.license')}</h4>
            <p>{t('about.licenseText')}</p>
          </div>

          <p className="about-copyright">{t('about.copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </div>
  );
}
