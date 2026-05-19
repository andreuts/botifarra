import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { useMatchmakingQueue } from '../hooks/useMatchmakingQueue.js';
import type { FriendDTO, FriendRequestDTO, PairInviteDTO } from '@botifarra/shared';

export function FriendsPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rankedParam = searchParams.get('ranked') === 'true';
  const queryClient = useQueryClient();
  const token = user?.accessToken ?? '';
  const { state: queueState, queueSize, leaveQueue, startPollingOnly } = useMatchmakingQueue();

  const [searchUsername, setSearchUsername] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { data: friendsData, isLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.friends.list(token),
    enabled: !!token,
    refetchInterval: 10_000, // Refresh every 10s for live game status
  });

  const { data: pairInvites } = useQuery({
    queryKey: ['pair-invites'],
    queryFn: () => api.pairInvite.pending(token),
    enabled: !!token,
    refetchInterval: 5_000,
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['friends'] });
    void queryClient.invalidateQueries({ queryKey: ['pair-invites'] });
  };

  async function handleSendRequest() {
    if (!searchUsername.trim()) return;
    setActionError('');
    setActionLoading(true);
    try {
      await api.friends.sendRequest(searchUsername.trim(), token);
      setSearchUsername('');
      refreshAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('friends.sendFailed'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRespond(friendshipId: string, action: 'accept' | 'reject') {
    setActionError('');
    try {
      await api.friends.respond(friendshipId, action, token);
      refreshAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('friends.respondFailed'));
    }
  }

  async function handleRemoveFriend(friendUserId: string) {
    setActionError('');
    try {
      await api.friends.remove(friendUserId, token);
      refreshAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('friends.removeFailed'));
    }
  }

  async function handleSendPairInvite(friendUserId: string) {
    setActionError('');
    try {
      await api.pairInvite.send(friendUserId, token, rankedParam);
      refreshAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('friends.pairInviteFailed'));
    }
  }

  async function handlePairInviteRespond(inviteId: string, action: 'accept' | 'reject') {
    setActionError('');
    try {
      await api.pairInvite.respond(inviteId, action, token);
      if (action === 'accept') {
        // Server just enqueued both players — start polling without a POST
        startPollingOnly();
      }
      refreshAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('friends.pairRespondFailed'));
    }
  }

  // Detect when the inviter's outgoing pair invite disappears (was accepted).
  // The invite is deleted server-side on accept, so it vanishes from the poll result.
  // We check queue status to confirm the invite was accepted (not rejected/expired).
  const prevOutgoingCountRef = useRef<number | null>(null);
  const outgoingPairInvites = (pairInvites ?? []).filter(
    (inv) => inv.fromUserId === user?.userId && inv.status === 'pending',
  );
  useEffect(() => {
    const prev = prevOutgoingCountRef.current;
    prevOutgoingCountRef.current = outgoingPairInvites.length;
    if (prev !== null && prev > 0 && outgoingPairInvites.length === 0 && queueState === 'idle') {
      // An outgoing invite just disappeared — check if we're now in queue
      void fetch('/api/matches/queue/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { inQueue: boolean } | null) => {
          if (body?.inQueue) startPollingOnly();
        });
    }
  }, [outgoingPairInvites.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const friends = friendsData?.friends ?? [];
  const incoming = friendsData?.incoming ?? [];
  const outgoing = friendsData?.outgoing ?? [];
  const incomingPairInvites = (pairInvites ?? []).filter(
    (inv) => inv.toUserId === user?.userId && inv.status === 'pending',
  );

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>{t('friends.heading')}</h1>
      </header>

      {/* Queue status banner — shown when waiting for match after pair invite */}
      {queueState !== 'idle' && (
        <section style={{
          background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(52, 152, 219, 0.15) 100%)',
          border: '2px solid var(--color-success)',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
              background: 'var(--color-success)', animation: 'pulse 1s infinite', flexShrink: 0,
            }} />
            <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: '0.9rem' }}>
              {queueState === 'matched'
                ? t('home.matchFound')
                : t('friends.searchingWithPartner', { count: queueSize })}
            </span>
          </div>
          {queueState === 'queued' && (
            <button
              className="btn-outline"
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
              onClick={() => void leaveQueue()}
            >
              {t('friends.cancelQueue')}
            </button>
          )}
        </section>
      )}

      {/* Error display */}
      {actionError && (
        <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {actionError}
        </p>
      )}

      {/* Pair invite notifications */}
      {incomingPairInvites.length > 0 && (
        <section style={{
          background: 'linear-gradient(135deg, rgba(52, 152, 219, 0.15) 0%, rgba(155, 89, 182, 0.15) 100%)',
          border: '2px solid var(--color-accent)',
          borderRadius: 'var(--radius)',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>{t('friends.pairInvites')}</h3>
          {incomingPairInvites.map((inv) => (
            <div key={inv.inviteId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem' }}>
                <strong>{inv.fromUsername}</strong> {t('friends.wantsToQueueWithYou')}
                {inv.ranked && <em style={{ marginLeft: '0.4rem', color: 'var(--color-gold)' }}>({t('home.ranked')})</em>}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-success" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handlePairInviteRespond(inv.inviteId, 'accept')}>
                  {t('friends.accept')}
                </button>
                <button className="btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handlePairInviteRespond(inv.inviteId, 'reject')}>
                  {t('friends.reject')}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Send friend request */}
      <section style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
        marginBottom: '1.5rem',
      }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>{t('friends.addFriend')}</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            placeholder={t('friends.usernamePlaceholder')}
            style={{ flex: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
          />
          <button onClick={handleSendRequest} disabled={actionLoading || !searchUsername.trim()}>
            {actionLoading ? t('friends.sending') : t('friends.sendRequest')}
          </button>
        </div>
      </section>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <section style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>{t('friends.incomingRequests')}</h2>
          {incoming.map((req) => (
            <div key={req.friendshipId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <span><strong>{req.fromUsername}</strong></span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-success" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleRespond(req.friendshipId, 'accept')}>
                  {t('friends.accept')}
                </button>
                <button className="btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleRespond(req.friendshipId, 'reject')}>
                  {t('friends.reject')}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <section style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>{t('friends.outgoingRequests')}</h2>
          {outgoing.map((req) => (
            <div key={req.friendshipId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
              <span>{t('friends.sentTo')} <strong>{req.toUsername}</strong></span>
              <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>{t('friends.pending')}</span>
            </div>
          ))}
        </section>
      )}

      {/* Friends list */}
      <section style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
      }}>
        <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>{t('friends.yourFriends')}</h2>
        {isLoading && <p style={{ color: 'var(--color-muted)' }}>{t('friends.loading')}</p>}
        {!isLoading && friends.length === 0 && (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>{t('friends.noFriends')}</p>
        )}
        {friends.map((friend) => (
          <div key={friend.userId} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)',
          }}>
            <div>
              <strong>{friend.username}</strong>
              {friend.inGame && (
                <span style={{
                  marginLeft: '0.5rem',
                  background: 'rgba(46, 204, 113, 0.15)',
                  color: 'var(--color-success)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.75rem',
                }}>
                  {t('friends.inGame')}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {friend.inGame && friend.activeRoomId && (
                <button
                  className="btn-accent"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={() => navigate(`/match/${friend.activeRoomId}?mode=botifarra&observe=true`)}
                >
                  {t('friends.spectate')}
                </button>
              )}
              {!friend.inGame && (
                <button
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  disabled={queueState !== 'idle'}
                  title={queueState !== 'idle' ? t('friends.alreadyQueued') : undefined}
                  onClick={() => handleSendPairInvite(friend.userId)}
                >
                  {t('friends.queueTogether')}
                </button>
              )}
              <button
                className="btn-outline"
                style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}
                onClick={() => handleRemoveFriend(friend.userId)}
              >
                {t('friends.remove')}
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Outgoing pair invites */}
      {outgoingPairInvites.length > 0 && (
        <section style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius)',
          padding: '1.25rem',
          marginTop: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>{t('friends.sentPairInvites')}</h2>
          {outgoingPairInvites.map((inv) => (
            <div key={inv.inviteId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
              <span>{t('friends.waitingFor')} <strong>{inv.toUsername}</strong></span>
              <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>{t('friends.pending')}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
