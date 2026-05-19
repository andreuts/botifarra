import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { useMatchmakingQueue } from '../hooks/useMatchmakingQueue.js';
import { useGameStore } from '../store/gameStore.js';
import { RecentGameRow } from '../components/RecentGameRow.js';
import { LobbyCard } from '../components/LobbyCard.js';

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
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
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
                onClick={() => handleResume(activeGameRoomId!)}
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

      {/* Lobby cards */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>{t('home.play')}</h2>
        <div className="lobby-cards">
          {/* Solo Quick Match */}
          <LobbyCard
            title={t('home.quickMatchSolo')}
            description={t('home.quickMatchSoloDesc')}
            disabled={queueState !== 'idle' && queueMode !== 'single'}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: queueState === 'idle' ? 'pointer' : 'not-allowed', opacity: queueState !== 'idle' ? 0.5 : 1 }}>
              <input
                type="checkbox"
                checked={ranked}
                disabled={queueState !== 'idle'}
                onChange={(e) => setRanked(e.target.checked)}
              />
              {t('home.ranked')}
            </label>
            {queueState === 'idle' ? (
              <button onClick={() => joinQueue('single', undefined, ranked)}>
                {t('home.quickMatchSolo')}
              </button>
            ) : queueState === 'queued' && queueMode === 'single' ? (
              <button
                onClick={leaveQueue}
                style={{ background: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
                {t('home.searching', { mode: queueMode, count: queueSize })}
              </button>
            ) : (
              <button disabled style={{ opacity: 0.6 }}>{t('home.matchFound')}</button>
            )}
            {queueError && queueMode === 'single' && (
              <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', margin: 0 }}>{queueError}</p>
            )}
          </LobbyCard>

          {/* Pair Quick Match */}
          <LobbyCard
            title={t('home.quickMatchPair')}
            description={t('home.quickMatchPairDesc')}
            disabled={queueState !== 'idle' && queueMode !== 'pair'}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: queueState === 'idle' ? 'pointer' : 'not-allowed', opacity: queueState !== 'idle' ? 0.5 : 1 }}>
              <input
                type="checkbox"
                checked={rankedPair}
                disabled={queueState !== 'idle'}
                onChange={(e) => setRankedPair(e.target.checked)}
              />
              {t('home.ranked')}
            </label>
            <button className="btn-accent" onClick={() => navigate(`/friends?ranked=${rankedPair}`)}>
              {t('home.quickMatchPair')}
            </button>
          </LobbyCard>

          {/* Private Room */}
          <LobbyCard
            title={t('home.privateRoomSection')}
            description={t('home.privateRoomCreateHint')}
          >
            {/* Create */}
            {inviteCode ? (
              <div style={{ textAlign: 'center', width: '100%' }}>
                <div className="invite-code">{inviteCode}</div>
                <p style={{ color: 'var(--color-muted)', fontSize: '0.75rem', margin: '0.5rem 0 0.75rem' }}>
                  {t('home.privateRoomShareHint')}
                </p>
                <button className="btn-success" onClick={() => handleJoinRoom(inviteCode)} disabled={roomLoading}>
                  {t('home.privateRoomEnter')}
                </button>
              </div>
            ) : (
              <button onClick={handleCreateRoom} disabled={roomLoading}>
                {roomLoading ? t('home.privateRoomCreating') : t('home.privateRoomCreate')}
              </button>
            )}
            {/* Join */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder={t('home.privateRoomCodePlaceholder')}
                maxLength={6}
                style={{ width: '100%', textTransform: 'uppercase', letterSpacing: '0.15em', textAlign: 'center', fontSize: '1rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom(joinCode)}
              />
              <button onClick={() => handleJoinRoom(joinCode)} disabled={roomLoading || joinCode.length < 4} style={{ width: '100%' }}>
                {t('home.privateRoomJoin')}
              </button>
            </div>
            {roomError && (
              <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', margin: 0 }}>{roomError}</p>
            )}
          </LobbyCard>
        </div>

        {/* Practice bot — outside cards, secondary action */}
        <div style={{ marginTop: '0.75rem' }}>
          <button className="btn-outline" onClick={() => navigate('/play?mode=practice')}>
            {t('home.practiceBot')}
          </button>
        </div>
      </section>

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
