import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import type { HandSortDirection } from '@botifarra/shared';
import { useAuthStore } from '../store/authStore.js';
import { BugReportWidget } from './BugReportWidget.js';
import { SettingsPanel } from './SettingsPanel.js';

declare const __APP_VERSION__: string;

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t, i18n } = useTranslation();
  const { user, logout, setHandSortDirection } = useAuthStore();
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [handSortSaving, setHandSortSaving] = useState(false);
  const [handSortSaveError, setHandSortSaveError] = useState(false);
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof api.auth.me>> | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.users.myStats>> | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const accessToken = user?.accessToken;
  const profileUserId = user?.userId;
  const handSortDirection = user?.handSortDirection ?? 'left-to-right';
  const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.1';

  // Don't show nav on game page (keep it fullscreen)
  const isGamePage = location.pathname.startsWith('/match/') || location.pathname === '/play';

  useEffect(() => {
    if (!accessToken) return;

    let active = true;
    setProfileLoading(true);
    setProfileError(false);
    setProfile(null);

    api.auth.me(accessToken)
      .then((nextProfile) => {
        if (!active) return;
        setProfile(nextProfile);
        setHandSortDirection(nextProfile.handSortDirection);
      })
      .catch(() => {
        if (active) setProfileError(true);
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });

    return () => { active = false; };
  }, [accessToken, profileUserId, setHandSortDirection]);

  useEffect(() => {
    if (!profileOpen || !accessToken) return;

    let active = true;
    setStatsLoading(true);
    setStatsError(false);
    setStats(null);

    api.users.myStats(accessToken)
      .then((nextStats) => {
        if (active) setStats(nextStats);
      })
      .catch(() => {
        if (active) setStatsError(true);
      })
      .finally(() => {
        if (active) setStatsLoading(false);
      });

    return () => { active = false; };
  }, [profileOpen, accessToken]);

  useEffect(() => {
    if (!profileOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        profileTriggerRef.current?.focus();
      }
    };
    const closeOnFocusOutside = (event: FocusEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('focusin', closeOnFocusOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('focusin', closeOnFocusOutside);
    };
  }, [profileOpen]);

  async function saveHandSortDirection(direction: HandSortDirection) {
    if (!accessToken || !user || direction === handSortDirection || handSortSaving) return;

    const previousDirection = handSortDirection;
    setHandSortSaving(true);
    setHandSortSaveError(false);
    setHandSortDirection(direction);

    try {
      const response = await api.users.updatePreferences({ handSortDirection: direction }, accessToken);
      setHandSortDirection(response.handSortDirection);
    } catch {
      setHandSortDirection(previousDirection);
      setHandSortSaveError(true);
    } finally {
      setHandSortSaving(false);
    }
  }

  if (!user) {
    return (
      <>
        {children}
        <BugReportWidget appVersion={appVersion} />
      </>
    );
  }

  return (
    <>
      {!isGamePage && (
        <nav className="app-nav" aria-label={t('nav.home')}>
          <div className="app-nav-inner">
            <Link to="/" className="app-nav-brand">
              <span className="app-nav-mark" aria-hidden="true">B</span>
              {t('app.title')}
            </Link>
            <div className="app-nav-links">
              <Link to="/news" className={location.pathname.startsWith('/news') ? 'active' : ''}>
                {t('nav.news')}
              </Link>
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
            <div className="app-nav-user">
              <div className="app-nav-profile" ref={profileRef}>
                <button
                  ref={profileTriggerRef}
                  className="app-nav-profile-trigger"
                  type="button"
                  aria-label={t('playerProfile.open', { username: user.username })}
                  aria-expanded={profileOpen}
                  aria-controls="app-nav-player-profile"
                  onClick={() => setProfileOpen((open) => !open)}
                >
                  <svg className="app-nav-profile-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
                  </svg>
                  <span className="app-nav-username">{user.username}</span>
                  <svg className="app-nav-profile-chevron" viewBox="0 0 12 12" aria-hidden="true">
                    <path d="m3 4.5 3 3 3-3" />
                  </svg>
                </button>
                {profileOpen && (
                  <section
                    className="app-nav-profile-dropdown"
                    id="app-nav-player-profile"
                    aria-labelledby="app-nav-player-profile-heading"
                    aria-live="polite"
                  >
                    <h2 id="app-nav-player-profile-heading">{t('playerProfile.heading')}</h2>
                    {profileLoading || statsLoading ? (
                      <p className="app-nav-profile-message">{t('playerProfile.loading')}</p>
                    ) : profileError || statsError || !profile || !stats ? (
                      <p className="app-nav-profile-message app-nav-profile-error">
                        {t('playerProfile.error')}
                      </p>
                    ) : (
                      <dl className="app-nav-profile-details">
                        <div>
                          <dt>{t('playerProfile.elo')}</dt>
                          <dd>{stats.currentElo}</dd>
                        </div>
                        <div>
                          <dt>{t('playerProfile.gamesPlayed')}</dt>
                          <dd>{stats.totalGames}</dd>
                        </div>
                        <div>
                          <dt>{t('playerProfile.joined')}</dt>
                          <dd>
                            {new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
                              dateStyle: 'medium',
                            }).format(new Date(profile.createdAt))}
                          </dd>
                        </div>
                      </dl>
                    )}
                    <div className="app-nav-profile-preference">
                      <label htmlFor="app-nav-hand-sort-direction">
                        {t('playerProfile.handSort')}
                      </label>
                      <select
                        id="app-nav-hand-sort-direction"
                        value={handSortDirection}
                        disabled={handSortSaving || profileLoading}
                        onChange={(event) => {
                          void saveHandSortDirection(event.currentTarget.value as HandSortDirection);
                        }}
                      >
                        <option value="left-to-right">{t('playerProfile.leftToRight')}</option>
                        <option value="right-to-left">{t('playerProfile.rightToLeft')}</option>
                      </select>
                      {handSortSaveError && (
                        <p className="app-nav-profile-message app-nav-profile-error">
                          {t('playerProfile.saveError')}
                        </p>
                      )}
                    </div>
                  </section>
                )}
              </div>
              <button className="btn-outline app-nav-signout" onClick={logout}>
                {t('auth.signOut')}
              </button>
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

      <BugReportWidget appVersion={appVersion} />
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
