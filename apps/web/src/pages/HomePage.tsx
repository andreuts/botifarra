import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { useMatchmakingQueue } from '../hooks/useMatchmakingQueue.js';
import { useGameStore } from '../store/gameStore.js';
import { RecentGameRow } from '../components/RecentGameRow.js';

export function HomePage() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const token = user?.accessToken ?? '';
  const { activeGameRoomId, setActiveGameRoomId } = useGameStore();
  const {
    state: queueState,
    queueSize,
    error: queueError,
    mode: queueMode,
    joinQueue,
    leaveQueue,
  } = useMatchmakingQueue();

  // Private room state
  const [showRoomPanel, setShowRoomPanel] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [roomError, setRoomError] = useState('');
  const [roomLoading, setRoomLoading] = useState(false);
  const [ranked, setRanked] = useState(false);

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
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.4rem', fontFamily: 'Georgia, serif', color: 'var(--color-gold-light)' }}>{t('app.title')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>{user?.username}</span>
          <button
            className="btn-outline"
            onClick={logout}
            style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
          >
            {t('auth.signOut')}
          </button>
        </div>
      </header>

      {/* Rejoin active game */}
      {activeGameRoomId && (
        <section
          style={{
            background:
              'linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(52, 152, 219, 0.15) 100%)',
            border: '2px solid var(--color-success)',
            borderRadius: 'var(--radius)',
            padding: '1.25rem',
            marginBottom: '2rem',
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2
                style={{ fontSize: '1rem', marginBottom: '0.25rem', color: 'var(--color-success)' }}
              >
                {t('home.gameInProgress')}
              </h2>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                {t('home.gameInProgressHint')}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn-success"
                onClick={() => navigate(`/match/${activeGameRoomId}?mode=botifarra`)}
                style={{ fontWeight: 600 }}
              >
                {t('home.rejoinGame')}
              </button>
              <button
                className="btn-outline"
                onClick={() => {
                  if (
                    confirm(
                      t('home.abandonConfirm'),
                    )
                  ) {
                    setActiveGameRoomId(null);
                  }
                }}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
              >
                {t('home.abandon')}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Play section */}
      <section
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius)',
          padding: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>{t('home.play')}</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {queueState === 'idle' ? (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ranked}
                  onChange={(e) => setRanked(e.target.checked)}
                />
                {t('home.ranked')}
              </label>
              <button onClick={() => joinQueue('single', undefined, ranked)}>{t('home.quickMatchSolo')}</button>
              <button
                className="btn-accent"
                onClick={() => navigate('/friends')}
              >
                {t('home.quickMatchPair')}
              </button>
            </>
          ) : queueState === 'queued' ? (
            <button
              onClick={leaveQueue}
              style={{
                background: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#fff',
                  animation: 'pulse 1s infinite',
                }}
              />
              {t('home.searching', { mode: queueMode, count: queueSize })} — {t('nav.back')}
            </button>
          ) : (
            <button disabled style={{ opacity: 0.6 }}>
              {t('home.matchFound')}
            </button>
          )}
          <button className="btn-outline" onClick={() => navigate('/play?mode=practice')}>
            {t('home.practiceBot')}
          </button>
          <button
            className="btn-accent"
            onClick={() => {
              setShowRoomPanel(!showRoomPanel);
              setRoomError('');
            }}
          >
            {t('home.privateRoom')}
          </button>
        </div>
        {queueError && (
          <p style={{ marginTop: '0.5rem', color: 'var(--color-danger)', fontSize: '0.85rem' }}>
            {queueError}
          </p>
        )}
      </section>

      {/* Private room panel */}
      {showRoomPanel && (
        <section
          style={{
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius)',
            padding: '1.5rem',
            marginBottom: '2rem',
            border: '1px solid var(--color-accent)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>{t('home.privateRoomSection')}</h3>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Create */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <p
                style={{
                  color: 'var(--color-muted)',
                  fontSize: '0.85rem',
                  marginBottom: '0.75rem',
                }}
              >
                {t('home.privateRoomCreateHint')}
              </p>
              {inviteCode ? (
                <div style={{ textAlign: 'center' }}>
                  <div className="invite-code">{inviteCode}</div>
                  <p
                    style={{
                      color: 'var(--color-muted)',
                      fontSize: '0.75rem',
                      margin: '0.5rem 0 1rem',
                    }}
                  >
                    {t('home.privateRoomShareHint')}
                  </p>
                  <button
                    className="btn-success"
                    onClick={() => handleJoinRoom(inviteCode)}
                    disabled={roomLoading}
                  >
                    {t('home.privateRoomEnter')}
                  </button>
                </div>
              ) : (
                <button onClick={handleCreateRoom} disabled={roomLoading}>
                  {roomLoading ? t('home.privateRoomCreating') : t('home.privateRoomCreate')}
                </button>
              )}
            </div>

            {/* Divider */}
            <div style={{ width: 1, background: 'var(--color-border)', alignSelf: 'stretch' }} />

            {/* Join */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <p
                style={{
                  color: 'var(--color-muted)',
                  fontSize: '0.85rem',
                  marginBottom: '0.75rem',
                }}
              >
                {t('home.privateRoomJoinHint')}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder={t('home.privateRoomCodePlaceholder')}
                  maxLength={6}
                  style={{
                    flex: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    textAlign: 'center',
                    fontSize: '1.1rem',
                    fontFamily: 'monospace',
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom(joinCode)}
                />
                <button
                  onClick={() => handleJoinRoom(joinCode)}
                  disabled={roomLoading || joinCode.length < 4}
                >
                  {t('home.privateRoomJoin')}
                </button>
              </div>
            </div>
          </div>

          {roomError && (
            <p
              style={{
                marginTop: '0.75rem',
                color: 'var(--color-danger)',
                fontSize: '0.85rem',
                textAlign: 'center',
              }}
            >
              {roomError}
            </p>
          )}
        </section>
      )}

      {/* Recent matches */}
      <section>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>{t('home.recentMatches')}</h2>
        {isLoading && <p style={{ color: 'var(--color-muted)' }}>{t('home.loading')}</p>}
        {matches && matches.length === 0 && (
          <p style={{ color: 'var(--color-muted)' }}>{t('home.noMatches')}</p>
        )}
        {matches && matches.length > 0 && (
          <ul
            style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
          >
            {matches.map((m) => (
              <RecentGameRow key={m.matchId} match={m} onResume={handleResume} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
