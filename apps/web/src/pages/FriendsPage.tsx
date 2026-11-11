import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { useMatchmakingQueue, type SeatReservationData } from '../hooks/useMatchmakingQueue.js';
import type { FriendDTO, FriendRequestDTO, PairInviteDTO } from '@botifarra/shared';
import { ConfirmDialog } from '../components/ConfirmDialog.js';

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
  const [friendToRemove, setFriendToRemove] = useState<{ userId: string; username: string } | null>(null);

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
      // The invite may already have produced a match, so check for either a
      // queued entry or a seat reservation before deciding whether to poll.
      void fetch('/api/matches/queue/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { inQueue: boolean; reservation?: SeatReservationData } | null) => {
          if (body?.reservation) startPollingOnly('pair', body.reservation);
          else if (body?.inQueue) startPollingOnly();
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
    <div className="section-page friends-page">
      <header className="section-page-header">
        <div className="section-page-title">
          <h1>{t('friends.heading')}</h1>
        </div>
        <img className="section-page-card" src="/cards/01-copas.png" alt="" />
      </header>

      {/* Queue status banner — shown when waiting for match after pair invite */}
      {queueState !== 'idle' && (
        <section className="friends-notice friends-notice--queue">
          <div className="friends-notice-row">
            <span className="friends-status-dot" aria-hidden="true" />
            <span className="friends-notice-message">
              {queueState === 'matched'
                ? t('home.matchFound')
                : t('friends.searchingWithPartner', { count: queueSize })}
            </span>
          </div>
          {queueState === 'queued' && (
            <button
              className="btn-outline friends-small-button"
              onClick={() => void leaveQueue()}
            >
              {t('friends.cancelQueue')}
            </button>
          )}
        </section>
      )}

      {/* Error display */}
      {actionError && (
        <p className="friends-error" role="alert">
          {actionError}
        </p>
      )}

      {/* Pair invite notifications */}
      {incomingPairInvites.length > 0 && (
        <section className="friends-notice friends-notice--invites">
          <h2 className="friends-section-title">{t('friends.pairInvites')}</h2>
          {incomingPairInvites.map((inv) => (
            <div key={inv.inviteId} className="friends-row friends-pair-invite">
              <span className="friends-row-copy">
                <strong>{inv.fromUsername}</strong> {t('friends.wantsToQueueWithYou')}
                {inv.ranked && <em className="friends-ranked">({t('home.ranked')})</em>}
              </span>
              <div className="friends-actions">
                <button className="btn-success friends-small-button" onClick={() => handlePairInviteRespond(inv.inviteId, 'accept')}>
                  {t('friends.accept')}
                </button>
                <button className="btn-outline friends-small-button" onClick={() => handlePairInviteRespond(inv.inviteId, 'reject')}>
                  {t('friends.reject')}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Send friend request */}
      <section className="friends-panel friends-request-panel">
        <h2 className="friends-section-title">{t('friends.addFriend')}</h2>
        <div className="friends-request-form">
          <input
            type="text"
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            placeholder={t('friends.usernamePlaceholder')}
            className="friends-username-input"
            onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
          />
          <button onClick={handleSendRequest} disabled={actionLoading || !searchUsername.trim()}>
            {actionLoading ? t('friends.sending') : t('friends.sendRequest')}
          </button>
        </div>
      </section>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <section className="friends-panel">
          <h2 className="friends-section-title">{t('friends.incomingRequests')}</h2>
          {incoming.map((req) => (
            <div key={req.friendshipId} className="friends-row">
              <span className="friends-row-copy"><strong>{req.fromUsername}</strong></span>
              <div className="friends-actions">
                <button className="btn-success friends-small-button" onClick={() => handleRespond(req.friendshipId, 'accept')}>
                  {t('friends.accept')}
                </button>
                <button className="btn-outline friends-small-button" onClick={() => handleRespond(req.friendshipId, 'reject')}>
                  {t('friends.reject')}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <section className="friends-panel">
          <h2 className="friends-section-title">{t('friends.outgoingRequests')}</h2>
          {outgoing.map((req) => (
            <div key={req.friendshipId} className="friends-row">
              <span className="friends-row-copy">{t('friends.sentTo')} <strong>{req.toUsername}</strong></span>
              <span className="friends-pending">{t('friends.pending')}</span>
            </div>
          ))}
        </section>
      )}

      {/* Friends list */}
      <section className="friends-panel friends-list-panel">
        <h2 className="friends-section-title">{t('friends.yourFriends')}</h2>
        {isLoading && <p className="section-page-message">{t('friends.loading')}</p>}
        {!isLoading && friends.length === 0 && (
          <p className="section-page-message">{t('friends.noFriends')}</p>
        )}
        {friends.map((friend) => (
          <div key={friend.userId} className="friends-row friends-list-row">
            <div className="friends-identity">
              <div className="friends-identity-line">
                <strong>{friend.username}</strong>
                {friend.rankPosition !== undefined && (
                  <span className="friends-rank-badge">
                    #{friend.rankPosition}
                  </span>
                )}
                {friend.individualRating !== undefined && (
                  <span className="friends-rating">
                    {friend.individualRating} pts
                  </span>
                )}
                {friend.inGame && (
                  <span className="friends-status-badge">
                    {t('friends.inGame')}
                  </span>
                )}
              </div>
            </div>
            <div className="friends-actions friends-actions--friend">
              {friend.inGame && friend.activeRoomId && (
                <button
                  className="btn-accent friends-small-button"
                  onClick={() => navigate(`/match/${friend.activeRoomId}?mode=botifarra&observe=true`)}
                >
                  {t('friends.spectate')}
                </button>
              )}
              {!friend.inGame && (
                <button
                  className="friends-small-button"
                  disabled={queueState !== 'idle'}
                  title={queueState !== 'idle' ? t('friends.alreadyQueued') : undefined}
                  onClick={() => handleSendPairInvite(friend.userId)}
                >
                  {t('friends.queueTogether')}
                </button>
              )}
              <button
                className="btn-outline friends-small-button friends-remove-button"
                onClick={() => setFriendToRemove({ userId: friend.userId, username: friend.username })}
              >
                {t('friends.remove')}
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Outgoing pair invites */}
      {outgoingPairInvites.length > 0 && (
        <section className="friends-panel">
          <h2 className="friends-section-title">{t('friends.sentPairInvites')}</h2>
          {outgoingPairInvites.map((inv) => (
            <div key={inv.inviteId} className="friends-row">
              <span className="friends-row-copy">{t('friends.waitingFor')} <strong>{inv.toUsername}</strong></span>
              <span className="friends-pending">{t('friends.pending')}</span>
            </div>
          ))}
        </section>
      )}

      <ConfirmDialog
        open={friendToRemove !== null}
        title={t('friends.removeConfirmTitle')}
        message={t('friends.removeConfirm', { username: friendToRemove?.username ?? '' })}
        confirmLabel={t('friends.remove')}
        cancelLabel={t('friends.cancel')}
        dangerous
        onCancel={() => setFriendToRemove(null)}
        onConfirm={() => {
          const friend = friendToRemove;
          setFriendToRemove(null);
          if (friend) void handleRemoveFriend(friend.userId);
        }}
      />
    </div>
  );
}
