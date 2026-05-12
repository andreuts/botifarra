import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { useMatchmakingQueue } from '../hooks/useMatchmakingQueue.js';
import { useGameStore } from '../store/gameStore.js';

export function HomePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const token = user?.accessToken ?? '';
  const { activeGameRoomId, setActiveGameRoomId } = useGameStore();
  const { state: queueState, queueSize, error: queueError, mode: queueMode, joinQueue, leaveQueue } =
    useMatchmakingQueue();

  // Private room state
  const [showRoomPanel, setShowRoomPanel] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [roomError, setRoomError] = useState('');
  const [roomLoading, setRoomLoading] = useState(false);

  const { data: matches, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.matches.list(token),
    enabled: !!token,
  });

  async function handleCreateRoom() {
    setRoomError('');
    setRoomLoading(true);
    try {
      const { inviteCode: code } = await api.rooms.create(token);
      setInviteCode(code);
    } catch (err) {
      setRoomError(err instanceof Error ? err.message : 'Failed to create room');
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
      setRoomError(err instanceof Error ? err.message : 'Failed to join room');
    } finally {
      setRoomLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Botifarra Online</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
            {user?.username}
          </span>
          <button className="btn-outline" onClick={logout} style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
            Sign out
          </button>
        </div>
      </header>

      {/* Nav links */}
      <nav style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', fontSize: '0.9rem' }}>
        <Link to="/history" style={{ color: 'var(--color-accent)' }}>Match History</Link>
        <Link to="/rankings" style={{ color: 'var(--color-accent)' }}>Rankings</Link>
      </nav>

      {/* Rejoin active game */}
      {activeGameRoomId && (
        <section style={{
          background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(52, 152, 219, 0.15) 100%)',
          border: '2px solid var(--color-success)',
          borderRadius: 'var(--radius)',
          padding: '1.25rem',
          marginBottom: '2rem',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: '1rem', marginBottom: '0.25rem', color: 'var(--color-success)' }}>
                🎮 Game in Progress
              </h2>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem' }}>
                You have an active game. Click to rejoin.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn-success"
                onClick={() => navigate(`/match/${activeGameRoomId}?mode=botifarra`)}
                style={{ fontWeight: 600 }}
              >
                Rejoin Game
              </button>
              <button
                className="btn-outline"
                onClick={() => {
                  if (confirm('Are you sure you want to abandon this game? You won\'t be able to rejoin.')) {
                    setActiveGameRoomId(null);
                  }
                }}
                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
              >
                Abandon
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Play section */}
      <section style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Play</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {queueState === 'idle' ? (
            <>
              <button onClick={() => joinQueue('single')}>Quick Match (Solo)</button>
              <button className="btn-accent" onClick={() => joinQueue('pair', { userId: 'TODO_PARTNER', username: 'Partner' })} disabled title="Coming soon — invite your partner first">
                Quick Match (Pair)
              </button>
            </>
          ) : queueState === 'queued' ? (
            <button
              onClick={leaveQueue}
              style={{ background: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
              Searching ({queueMode})… ({queueSize} in queue) — Cancel
            </button>
          ) : (
            <button disabled style={{ opacity: 0.6 }}>Match found!</button>
          )}
          <button
            className="btn-outline"
            onClick={() => navigate('/play?mode=practice')}
          >
            Practice vs Bot
          </button>
          <button
            className="btn-accent"
            onClick={() => { setShowRoomPanel(!showRoomPanel); setRoomError(''); }}
          >
            Private Room
          </button>
        </div>
        {queueError && <p style={{ marginTop: '0.5rem', color: 'var(--color-danger)', fontSize: '0.85rem' }}>{queueError}</p>}
      </section>

      {/* Private room panel */}
      {showRoomPanel && (
        <section style={{
          background: 'var(--color-surface)', borderRadius: 'var(--radius)',
          padding: '1.5rem', marginBottom: '2rem',
          border: '1px solid var(--color-accent)', animation: 'fadeIn 0.2s ease',
        }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>Private Room</h3>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Create */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Create a room and share the code with friends:
              </p>
              {inviteCode ? (
                <div style={{ textAlign: 'center' }}>
                  <div className="invite-code">{inviteCode}</div>
                  <p style={{ color: 'var(--color-muted)', fontSize: '0.75rem', margin: '0.5rem 0 1rem' }}>
                    Share this code · Expires in 30 min
                  </p>
                  <button
                    className="btn-success"
                    onClick={() => handleJoinRoom(inviteCode)}
                    disabled={roomLoading}
                  >
                    Enter Room
                  </button>
                </div>
              ) : (
                <button onClick={handleCreateRoom} disabled={roomLoading}>
                  {roomLoading ? 'Creating…' : 'Create Room'}
                </button>
              )}
            </div>

            {/* Divider */}
            <div style={{ width: 1, background: 'var(--color-border)', alignSelf: 'stretch' }} />

            {/* Join */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Join a friend's room with their code:
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  maxLength={6}
                  style={{
                    flex: 1, textTransform: 'uppercase', letterSpacing: '0.15em',
                    textAlign: 'center', fontSize: '1.1rem', fontFamily: 'monospace',
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom(joinCode)}
                />
                <button onClick={() => handleJoinRoom(joinCode)} disabled={roomLoading || joinCode.length < 4}>
                  Join
                </button>
              </div>
            </div>
          </div>

          {roomError && (
            <p style={{ marginTop: '0.75rem', color: 'var(--color-danger)', fontSize: '0.85rem', textAlign: 'center' }}>
              {roomError}
            </p>
          )}
        </section>
      )}

      {/* Recent matches */}
      <section>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Recent Matches</h2>
        {isLoading && <p style={{ color: 'var(--color-muted)' }}>Loading…</p>}
        {matches && matches.length === 0 && (
          <p style={{ color: 'var(--color-muted)' }}>No matches yet. Start playing!</p>
        )}
        {matches && matches.length > 0 && (
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {matches.map((m) => (
              <li
                key={m.matchId}
                style={{
                  background: 'var(--color-surface)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                  {m.mode} — {m.status}
                </span>
                <span>
                  {m.scores[0]} – {m.scores[1]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
