import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { useMatchmakingQueue } from '../hooks/useMatchmakingQueue.js';
import { useGameStore } from '../store/gameStore.js';
import { LobbyCard } from '../components/LobbyCard.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { useOnlineUserCount } from '../hooks/useOnlinePresence.js';

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

type PlayMode = 'online' | 'bots' | 'ranked';

function PlayModeSwitcher({
  name,
  label,
  value,
  options,
  disabled = false,
  onChange,
}: {
  name: string;
  label: string;
  value: PlayMode;
  options: Array<{ value: PlayMode; label: string }>;
  disabled?: boolean;
  onChange: (mode: PlayMode) => void;
}) {
  return (
    <div className="lobby-mode-switcher" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <label
          className={`lobby-mode-option${value === option.value ? ' is-selected' : ''}`}
          key={option.value}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const onlineUsers = useOnlineUserCount();
  const token = user?.accessToken ?? '';
  const { activeGame, activeGameRoomId, setActiveGame } = useGameStore();
  const resumableGame = activeGame ?? (activeGameRoomId
    ? { roomId: activeGameRoomId, matchId: activeGameRoomId, mode: 'botifarra' as const, canAbandon: false }
    : null);
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
  const [practiceInviteCode, setPracticeInviteCode] = useState('');
  const [practiceInviteError, setPracticeInviteError] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [roomError, setRoomError] = useState('');
  const [roomLoading, setRoomLoading] = useState(false);
  const [soloPlayMode, setSoloPlayMode] = useState<PlayMode>('online');
  const [pairPlayMode, setPairPlayMode] = useState<PlayMode>('online');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [abandonDialogOpen, setAbandonDialogOpen] = useState(false);
  const [abandonLoading, setAbandonLoading] = useState(false);
  const [abandonError, setAbandonError] = useState('');

  const playModeOptions: Array<{ value: PlayMode; label: string }> = [
    { value: 'online', label: t('home.modeOnline') },
    { value: 'bots', label: t('home.modeBots') },
    { value: 'ranked', label: t('home.modeRanked') },
  ];

  async function handleResume() {
    if (!resumableGame || resumeLoading) return;
    setResumeLoading(true);
    setResumeError('');
    try {
      const { roomId, mode } = await api.matches.resume(resumableGame.matchId, token);
      navigate(`/match/${roomId}?mode=${mode ?? resumableGame.mode}&resume=1`);
    } catch (err) {
      if (err instanceof ApiError && [403, 404, 409, 410, 422].includes(err.status)) {
        setActiveGame(null);
        void queryClient.invalidateQueries({ queryKey: ['matches'] });
      } else {
        setResumeError(t('home.resumeFailed'));
      }
      console.error('Failed to resume match', err);
    } finally {
      setResumeLoading(false);
    }
  }

  async function handleAbandon() {
    if (!resumableGame?.canAbandon || abandonLoading) return;
    setAbandonLoading(true);
    setAbandonError('');
    try {
      await api.matches.abandon(resumableGame.matchId, token);
      setActiveGame(null);
      setAbandonDialogOpen(false);
    } catch (err) {
      if (err instanceof ApiError && [403, 404, 409, 410, 422].includes(err.status)) {
        setActiveGame(null);
        setAbandonDialogOpen(false);
        void queryClient.invalidateQueries({ queryKey: ['matches'] });
      } else {
        setAbandonError(t('home.abandonFailed'));
      }
      console.error('Failed to abandon match', err);
    } finally {
      setAbandonLoading(false);
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

  async function handleCreatePracticeInvite() {
    setPracticeInviteError('');
    setRoomLoading(true);
    try {
      const { inviteCode: code } = await api.rooms.create(token, 'practice-duo');
      setPracticeInviteCode(code);
    } catch (err) {
      setPracticeInviteError(err instanceof Error ? err.message : t('home.practicePairCreateFailed'));
    } finally {
      setRoomLoading(false);
    }
  }

  async function handleJoinRoom(code: string) {
    if (!code.trim()) return;
    setRoomError('');
    setRoomLoading(true);
    try {
      // Entering a private room takes priority over either matchmaking queue.
      await leaveQueue();
      const { roomId, inviteCode: joinedCode, mode } = await api.rooms.join(code.trim().toUpperCase(), token);
      const gameMode = mode === 'practice-duo' ? 'practice-duo' : 'botifarra';
      navigate(`/match/${roomId}?mode=${gameMode}`, { state: { inviteCode: joinedCode } });
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : t('home.privateRoomJoinFailed'));
    } finally {
      setRoomLoading(false);
    }
  }

  async function handleStartPractice() {
    // Stop any solo or pair search before opening a bot game.
    await leaveQueue();
    navigate('/play?mode=practice');
  }

  return (
    <div className="lobby-page">
      {resumableGame && (
        <section className="resume-banner" aria-label={t('home.gameInProgress')}>
          <div className="resume-banner-copy">
            <p className="lobby-overline">{t('home.gameInProgress')}</p>
            <p className="resume-banner-hint">{t('home.gameInProgressHint')}</p>
            {resumeError && <p className="resume-banner-error" role="alert">{resumeError}</p>}
          </div>
          <div className="resume-banner-actions">
            <button className="btn-accent" onClick={() => void handleResume()} disabled={resumeLoading}>
              {resumeLoading ? t('home.loading') : t('home.rejoinGame')}
            </button>
            {resumableGame.canAbandon && (
              <button
                className="btn-outline"
                onClick={() => {
                  setAbandonError('');
                  setAbandonDialogOpen(true);
                }}
              >
                {t('home.abandon')}
              </button>
            )}
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
              <div className="lobby-play-heading-row">
                <h2 id="lobby-play-heading">{t('home.play')}</h2>
                {onlineUsers !== null && (
                  <span className="lobby-online-count">
                    <span className="lobby-online-dot" aria-hidden="true" />
                    {t('home.onlineNow', { count: onlineUsers })}
                  </span>
                )}
              </div>
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
              description={t(
                soloPlayMode === 'bots'
                  ? 'home.practiceSoloDesc'
                  : soloPlayMode === 'ranked'
                    ? 'home.quickMatchSoloRankedDesc'
                    : 'home.quickMatchSoloDesc',
              )}
              disabled={queueState !== 'idle' && queueMode !== 'single'}
            >
              <div className="lobby-mode-setting">
                <PlayModeSwitcher
                  name="solo-play-mode"
                  label={t('home.choosePlayMode')}
                  value={soloPlayMode}
                  options={playModeOptions}
                  disabled={queueState !== 'idle' || roomLoading}
                  onChange={setSoloPlayMode}
                />
                <RankedHelpTooltip
                  id="ranked-solo-help"
                  label={t('home.rankedHelpLabel')}
                  message={t('home.rankedHelp')}
                />
              </div>
              {queueState === 'idle' ? (
                <button
                  className="btn-accent lobby-primary-action"
                  onClick={() => {
                    if (soloPlayMode === 'bots') void handleStartPractice();
                    else void joinQueue('single', undefined, soloPlayMode === 'ranked');
                  }}
                >
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
              description={t(
                pairPlayMode === 'bots'
                  ? 'home.practicePairDesc'
                  : pairPlayMode === 'ranked'
                    ? 'home.quickMatchPairRankedDesc'
                    : 'home.quickMatchPairDesc',
              )}
              disabled={queueState !== 'idle' && queueMode !== 'pair'}
            >
              <div className="lobby-mode-setting">
                <PlayModeSwitcher
                  name="pair-play-mode"
                  label={t('home.choosePlayMode')}
                  value={pairPlayMode}
                  options={playModeOptions}
                  disabled={queueState !== 'idle' || roomLoading}
                  onChange={setPairPlayMode}
                />
                <RankedHelpTooltip
                  id="ranked-pair-help"
                  label={t('home.rankedHelpLabel')}
                  message={t('home.rankedHelp')}
                />
              </div>
              {pairPlayMode === 'bots' ? (
                practiceInviteCode ? (
                  <div className="practice-pair-invite">
                    <div className="practice-pair-invite-copy">
                      <div className="invite-code">{practiceInviteCode}</div>
                      <span>{t('home.practicePairShareHint')}</span>
                    </div>
                    <button
                      className="btn-accent lobby-primary-action"
                      onClick={() => void handleJoinRoom(practiceInviteCode)}
                      disabled={roomLoading}
                    >
                      {t('home.practicePairEnter')}
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-accent lobby-primary-action"
                    onClick={() => void handleCreatePracticeInvite()}
                    disabled={roomLoading}
                  >
                    {roomLoading ? t('home.privateRoomCreating') : t('home.practicePairCreate')}
                  </button>
                )
              ) : (
                <button
                  className="btn-accent lobby-primary-action"
                  onClick={() => navigate(`/friends?ranked=${pairPlayMode === 'ranked'}`)}
                >
                  {t('home.quickMatchPair')}
                </button>
              )}
              {practiceInviteError && pairPlayMode === 'bots' && (
                <p className="lobby-error" role="alert">
                  {practiceInviteError}
                </p>
              )}
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

        </section>
      </main>
      <ConfirmDialog
        open={abandonDialogOpen}
        title={t('home.abandonTitle')}
        message={t('home.abandonConfirm')}
        confirmLabel={abandonLoading ? t('home.loading') : t('home.abandon')}
        cancelLabel={t('game.leaveGameCancel')}
        dangerous
        confirmDisabled={abandonLoading}
        errorMessage={abandonError || undefined}
        onCancel={() => setAbandonDialogOpen(false)}
        onConfirm={() => void handleAbandon()}
      />
    </div>
  );
}
