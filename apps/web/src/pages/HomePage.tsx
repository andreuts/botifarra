import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { useMatchmakingQueue } from '../hooks/useMatchmakingQueue.js';
import { useGameStore } from '../store/gameStore.js';
import { RecentGameRow } from '../components/RecentGameRow.js';
import { LobbyCard } from '../components/LobbyCard.js';

const SUITS = [
  { key: 'O', suit: 'oros', image: '/cards/01-oros.png' },
  { key: 'C', suit: 'copes', image: '/cards/01-copas.png' },
  { key: 'E', suit: 'espases', image: '/cards/01-espadas.png' },
  { key: 'B', suit: 'bastos', image: '/cards/01-bastos.png' },
] as const;

function RankedHelpTooltip({ id, label, message }: { id: string; label: string; message: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const halfWidth = Math.min(150, Math.max(0, (window.innerWidth - 24) / 2));
      const minLeft = halfWidth + 12;
      const maxLeft = window.innerWidth - halfWidth - 12;
      const left = Math.max(minLeft, Math.min(rect.left + rect.width / 2, maxLeft));
      setPosition({ left, top: rect.top - 8 });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="ranked-help-button"
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open && createPortal(
        <span
          id={id}
          className="ranked-help-tooltip"
          role="tooltip"
          style={{ left: position.left, top: position.top }}
        >
          {message}
        </span>,
        document.body,
      )}
    </>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const token = user?.accessToken ?? '';
  const { activeGameRoomId, setActiveGameRoomId } = useGameStore();
  const queryClient = useQueryClient();
  const {
    state: queueState,
    queueSize,
    error: queueError,
    mode: queueMode,
    joinQueue,
    leaveQueue,
  } = useMatchmakingQueue();

  // Private room state
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [roomError, setRoomError] = useState('');
  const [roomLoading, setRoomLoading] = useState(false);
  const [ranked, setRanked] = useState(false);
  const [rankedPair, setRankedPair] = useState(false);

  const { data: matches, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.matches.list(token),
    enabled: !!token,
  });

  async function handleResume(matchId: string) {
    try {
      const { roomId } = await api.matches.resume(matchId, token);
      navigate(`/match/${roomId}?mode=botifarra`);
    } catch (err) {
      // If the match has expired (410) or is no longer in-progress (409),
      // refresh the match list so the stale "Resume" button disappears.
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('expired') || msg.includes('not in-progress') || msg.includes('not-in-progress')) {
        setActiveGameRoomId(null);
        void queryClient.invalidateQueries({ queryKey: ['matches'] });
      }
      console.error('Failed to resume match', err);
    }
  }

  async function handleCreateRoom() {
    setRoomError('');
    setRoomLoading(true);
    try {
      const { inviteCode: code } = await api.rooms.create(token);
      setInviteCode(code);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : t('home.privateRoomCreateFailed'));
    } finally {
      setRoomLoading(false);
    }
  }

  async function handleJoinRoom(code: string) {
    if (!code.trim()) return;
    setRoomError('');
    setRoomLoading(true);
    try {
      const { roomId } = await api.rooms.join(code.trim().toUpperCase(), token);
      navigate(`/match/${roomId}?mode=botifarra`);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : t('home.privateRoomJoinFailed'));
    } finally {
      setRoomLoading(false);
    }
  }

  return (
    <div className="lobby-page">
      {activeGameRoomId && (
        <section className="resume-banner" aria-label={t('home.gameInProgress')}>
          <div className="resume-banner-mark" aria-hidden="true">↻</div>
          <div className="resume-banner-copy">
            <p className="lobby-overline">{t('home.gameInProgress')}</p>
            <p className="resume-banner-hint">{t('home.gameInProgressHint')}</p>
          </div>
          <div className="resume-banner-actions">
            <button className="btn-accent" onClick={() => handleResume(activeGameRoomId!)}>
              {t('home.rejoinGame')}
            </button>
            <button
              className="btn-outline"
              onClick={() => {
                if (confirm(t('home.abandonConfirm'))) setActiveGameRoomId(null);
              }}
            >
              {t('home.abandon')}
            </button>
          </div>
        </section>
      )}

      <header className="lobby-hero">
        <div className="lobby-hero-copy">
          <p className="lobby-overline">{t('home.heroEyebrow')}</p>
          <h1>{t('home.heroTitle')}</h1>
          <p className="lobby-hero-intro">{t('home.heroIntro')}</p>
          <div className="lobby-hero-rule" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="lobby-deck" aria-hidden="true">
          {SUITS.map((suit) => (
            <div className={`lobby-deck-card lobby-deck-card--${suit.suit}`} key={suit.key}>
              <img src={suit.image} alt="" draggable={false} />
            </div>
          ))}
        </div>
      </header>

      <main className="lobby-content">
        <section className="lobby-section" aria-labelledby="lobby-play-heading">
          <div className="lobby-section-heading">
            <div className="lobby-section-title-wrap">
              <p className="lobby-overline">{t('home.playOptions')}</p>
              <h2 id="lobby-play-heading">{t('home.play')}</h2>
            </div>
            <div className="lobby-suit-line" aria-hidden="true">
              {SUITS.map((suit) => (
                <img key={suit.key} src={suit.image} alt="" draggable={false} />
              ))}
            </div>
          </div>

          <div className="lobby-cards">
            <LobbyCard
              variant="solo"
              markerImage="/cards/01-oros.png"
              title={t('home.quickMatchSolo')}
              description={t('home.quickMatchSoloDesc')}
              disabled={queueState !== 'idle' && queueMode !== 'single'}
            >
              <div className="lobby-ranked-setting">
                <label className="lobby-ranked-toggle" htmlFor="ranked-solo">
                  <input
                    id="ranked-solo"
                    type="checkbox"
                    checked={ranked}
                    disabled={queueState !== 'idle'}
                    onChange={(e) => setRanked(e.target.checked)}
                  />
                  {t('home.ranked')}
                </label>
                <RankedHelpTooltip
                  id="ranked-solo-help"
                  label={t('home.rankedHelpLabel')}
                  message={t('home.rankedHelp')}
                />
              </div>
              {queueState === 'idle' ? (
                <button className="btn-accent lobby-primary-action" onClick={() => joinQueue('single', undefined, ranked)}>
                  {t('home.quickMatchSolo')}
                </button>
              ) : queueState === 'queued' && queueMode === 'single' ? (
                <button
                  className="lobby-searching-button lobby-primary-action"
                  onClick={leaveQueue}
                >
                  <span className="lobby-search-dot" />
                  {t('home.searching', { mode: queueMode, count: queueSize })}
                </button>
              ) : (
                <button className="btn-accent lobby-primary-action" disabled>{t('home.matchFound')}</button>
              )}
              {queueError && queueMode === 'single' && (
                <p className="lobby-error">{queueError}</p>
              )}
            </LobbyCard>

            <LobbyCard
              variant="pair"
              markerImage="/cards/01-copas.png"
              title={t('home.quickMatchPair')}
              description={t('home.quickMatchPairDesc')}
              disabled={queueState !== 'idle' && queueMode !== 'pair'}
            >
              <div className="lobby-ranked-setting">
                <label className="lobby-ranked-toggle" htmlFor="ranked-pair">
                  <input
                    id="ranked-pair"
                    type="checkbox"
                    checked={rankedPair}
                    disabled={queueState !== 'idle'}
                    onChange={(e) => setRankedPair(e.target.checked)}
                  />
                  {t('home.ranked')}
                </label>
                <RankedHelpTooltip
                  id="ranked-pair-help"
                  label={t('home.rankedHelpLabel')}
                  message={t('home.rankedHelp')}
                />
              </div>
              <button className="btn-accent lobby-primary-action" onClick={() => navigate(`/friends?ranked=${rankedPair}`)}>
                {t('home.quickMatchPair')}
              </button>
            </LobbyCard>

            <LobbyCard
              variant="private"
              markerImage="/cards/01-espadas.png"
              title={t('home.privateRoomSection')}
              description={t('home.privateRoomCreateHint')}
            >
              {inviteCode ? (
                <div className="private-room-created">
                  <div className="invite-code">{inviteCode}</div>
                  <p className="private-room-hint">{t('home.privateRoomShareHint')}</p>
                  <button className="btn-accent lobby-primary-action" onClick={() => handleJoinRoom(inviteCode)} disabled={roomLoading}>
                    {t('home.privateRoomEnter')}
                  </button>
                </div>
              ) : (
                <button className="btn-accent lobby-primary-action" onClick={handleCreateRoom} disabled={roomLoading}>
                  {roomLoading ? t('home.privateRoomCreating') : t('home.privateRoomCreate')}
                </button>
              )}
              <div className="private-room-join">
                <label className="private-room-join-label" htmlFor="private-room-code">
                  {t('home.privateRoomJoinHint')}
                </label>
                <input
                  id="private-room-code"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder={t('home.privateRoomCodePlaceholder')}
                  maxLength={6}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom(joinCode)}
                />
                <button
                  className="btn-accent lobby-primary-action"
                  onClick={() => handleJoinRoom(joinCode)}
                  disabled={roomLoading || joinCode.length < 4}
                >
                  {t('home.privateRoomJoin')}
                </button>
              </div>
              {roomError && <p className="lobby-error">{roomError}</p>}
            </LobbyCard>
          </div>

          <div className="lobby-secondary-actions">
            <button className="practice-button" onClick={() => navigate('/play?mode=practice')}>
              {t('home.practiceBot')}
            </button>
          </div>
        </section>

        <section className="lobby-section lobby-activity" aria-labelledby="lobby-activity-heading">
          <div className="lobby-section-heading lobby-section-heading--activity">
            <div className="lobby-section-title-wrap">
              <p className="lobby-overline">{t('nav.matchHistory')}</p>
              <h2 id="lobby-activity-heading">{t('home.recentMatches')}</h2>
            </div>
          </div>

          {isLoading && <p className="recent-match-empty">{t('home.loading')}</p>}
          {matches && matches.length === 0 && (
            <p className="recent-match-empty">{t('home.noMatches')}</p>
          )}
          {matches && matches.length > 0 && (
            <ul className="recent-match-list">
              {matches.map((match) => (
                <RecentGameRow key={match.matchId} match={match} onResume={handleResume} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
