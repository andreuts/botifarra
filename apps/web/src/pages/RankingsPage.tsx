import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  api,
  type RankingEntry,
  type RankingPageResult,
  type RankingPageSize,
  type RankingSort,
} from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';

export function RankingsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const token = user?.accessToken ?? '';
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<RankingSort>('rating');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<RankingPageSize>(20);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [playerToInvite, setPlayerToInvite] = useState<RankingEntry | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{
    userId: string;
    message: string;
    left: number;
    top: number;
    placement: 'above' | 'below';
  } | null>(null);
  const [inviteFeedback, setInviteFeedback] = useState<{
    userId: string;
    status: 'pending' | 'success' | 'error';
    message: string;
    relationship?: 'friend' | 'pending';
  } | null>(null);

  const { data, isLoading, error } = useQuery<RankingPageResult>({
    queryKey: ['rankings', sort, page, pageSize],
    queryFn: () => api.rankings.list(token, sort, page, pageSize),
    enabled: !!token,
  });

  const { data: friendsData } = useQuery({
    queryKey: ['friends'],
    queryFn: () => api.friends.list(token),
    enabled: !!token,
  });

  const friendIds = new Set(friendsData?.friends.map((friend) => friend.userId) ?? []);
  const pendingRequestIds = new Set([
    ...(friendsData?.outgoing.map((request) => request.toUserId) ?? []),
    ...(friendsData?.incoming.map((request) => request.fromUserId) ?? []),
  ]);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  function showPlayerTooltip(userId: string, message: string, anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    const maxTooltipWidth = Math.min(280, window.innerWidth - 24);
    const halfTooltipWidth = maxTooltipWidth / 2;
    const left = Math.max(
      halfTooltipWidth + 12,
      Math.min(window.innerWidth - halfTooltipWidth - 12, rect.left + rect.width / 2),
    );
    const placement = rect.top > 100 ? 'above' : 'below';

    setActiveTooltip({
      userId,
      message,
      left,
      top: placement === 'above' ? rect.top - 8 : rect.bottom + 8,
      placement,
    });
  }

  async function invitePlayer(entry: RankingEntry) {
    setSendingInviteId(entry.userId);
    setInviteFeedback({
      userId: entry.userId,
      status: 'pending',
      message: t('rankings.inviteSending', { username: entry.username }),
    });
      setActiveTooltip((current) => current?.userId === entry.userId
        ? { ...current, message: t('rankings.inviteSending', { username: entry.username }) }
        : current);

    try {
      await api.friends.sendRequest(entry.username, token);
      setInviteFeedback({
        userId: entry.userId,
        status: 'success',
        message: t('rankings.inviteSent', { username: entry.username }),
      });
      setActiveTooltip((current) => current?.userId === entry.userId
        ? { ...current, message: t('rankings.inviteSent', { username: entry.username }) }
        : current);
      void queryClient.invalidateQueries({ queryKey: ['friends'] });
    } catch (err) {
      const serverMessage = err instanceof Error ? err.message : '';
      const message = serverMessage === 'Already friends'
        ? t('rankings.alreadyFriend')
        : serverMessage === 'Friend request already exists'
          ? t('rankings.requestPending')
          : t('rankings.inviteFailed');
      const relationship = serverMessage === 'Already friends'
        ? 'friend'
        : serverMessage === 'Friend request already exists'
          ? 'pending'
          : undefined;
      const status = relationship === 'friend'
        ? 'success'
        : relationship === 'pending'
          ? 'pending'
          : 'error';
      setInviteFeedback({ userId: entry.userId, status, message, relationship });
      setActiveTooltip((current) => current?.userId === entry.userId
        ? { ...current, message }
        : current);
    } finally {
      setSendingInviteId(null);
    }
  }

  function renderPlayerName(entry: RankingEntry) {
    if (entry.userId === user?.userId) {
      return (
        <span className="rankings-player-self">
          {entry.username} <span className="rankings-you-badge">{t('rankings.you')}</span>
        </span>
      );
    }

    const feedback = inviteFeedback?.userId === entry.userId ? inviteFeedback : null;
    const isFriend = friendIds.has(entry.userId) || feedback?.relationship === 'friend';
    const hasPendingRequest = pendingRequestIds.has(entry.userId) || feedback?.relationship === 'pending';
    const isSending = sendingInviteId === entry.userId;
    const requestWasSent = feedback?.status === 'success' && feedback.relationship !== 'friend';
    const anotherInviteSending = sendingInviteId !== null && !isSending;
    const disabled = isFriend || hasPendingRequest || requestWasSent || sendingInviteId !== null;
    const tooltipMessage = feedback?.message ?? (isFriend
      ? t('rankings.alreadyFriend')
      : hasPendingRequest
        ? t('rankings.requestPending')
        : isSending
          ? t('rankings.inviteSending', { username: entry.username })
          : requestWasSent
            ? t('rankings.requestPending')
            : anotherInviteSending
              ? t('rankings.inviteBusy')
              : t('rankings.inviteByName', { username: entry.username }));

    return (
      <div className="rankings-player-cell">
        <span
          className="rankings-player-hover"
          onMouseEnter={(event) => showPlayerTooltip(entry.userId, tooltipMessage, event.currentTarget)}
          onMouseLeave={() => setActiveTooltip((current) => current?.userId === entry.userId ? null : current)}
          onFocusCapture={(event) => showPlayerTooltip(entry.userId, tooltipMessage, event.currentTarget)}
          onBlurCapture={() => {
            if (playerToInvite?.userId !== entry.userId) {
              setActiveTooltip((current) => current?.userId === entry.userId ? null : current);
            }
          }}
        >
          <button
            className="rankings-player-invite"
            type="button"
            disabled={disabled}
            aria-label={tooltipMessage}
            aria-describedby={activeTooltip?.userId === entry.userId ? 'rankings-player-tooltip' : undefined}
            aria-busy={isSending}
            onClick={() => setPlayerToInvite(entry)}
          >
            {entry.username}
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="section-page rankings-page">
      <header className="section-page-header">
        <div className="section-page-title">
          <h1>{t('rankings.heading')}</h1>
        </div>
        <img className="section-page-card" src="/cards/01-oros.png" alt="" />
      </header>

      <div className="rankings-toolbar">
        <div className="rankings-toolbar-field">
          <label htmlFor="rankings-sort">{t('rankings.sortBy')}</label>
          <select
            id="rankings-sort"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as RankingSort);
              setPage(1);
            }}
          >
            <option value="rating">{t('rankings.sortRating')}</option>
            <option value="wins">{t('rankings.sortWins')}</option>
            <option value="games">{t('rankings.sortGames')}</option>
            <option value="winRate">{t('rankings.sortWinRate')}</option>
          </select>
        </div>
        <div className="rankings-toolbar-field">
          <label htmlFor="rankings-page-size">{t('rankings.pageSize')}</label>
          <select
            id="rankings-page-size"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value) as RankingPageSize);
              setPage(1);
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <p className="rankings-metrics-note">{t('rankings.metricsHelp')}</p>

      {isLoading && <p className="section-page-message">{t('rankings.loading')}</p>}
      {error && <p className="section-page-message is-error">{t('rankings.error')}</p>}

      {data && data.entries.length === 0 && (
        <p className="section-page-message">{t('rankings.empty')}</p>
      )}

      {data && data.entries.length > 0 && (
        <>
          <div className="rankings-table-panel">
            <div className="rankings-table-scroll">
              <table className="rankings-table">
                <thead>
                  <tr>
                    <th>{t('rankings.rank')}</th>
                    <th>{t('rankings.player')}</th>
                    <th>{t('rankings.sortRating')}</th>
                    <th>{t('rankings.wins')}</th>
                    <th>{t('rankings.losses')}</th>
                    <th>{t('rankings.matchesPlayed')}</th>
                    <th>{t('rankings.winPct')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr
                      key={entry.userId}
                      className={entry.userId === user?.userId ? 'rankings-row--self' : undefined}
                      aria-current={entry.userId === user?.userId ? 'true' : undefined}
                    >
                      <td className="rankings-rank">{entry.rank}</td>
                      <td className="rankings-player">{renderPlayerName(entry)}</td>
                      <td className="rankings-rating">{entry.rating}</td>
                      <td>{entry.matchesWon}</td>
                      <td>{entry.matchesLost}</td>
                      <td className="rankings-games">{entry.matchesPlayed}</td>
                      <td>{entry.winRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <nav className="rankings-pagination" aria-label={t('rankings.pagination')}>
              <button
                className="btn-outline"
                type="button"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {t('rankings.previous')}
              </button>
              <span className="rankings-page-summary" aria-live="polite">
                {t('rankings.pageSummary', {
                  start: (page - 1) * pageSize + 1,
                  end: Math.min(page * pageSize, data.total),
                  total: data.total,
                })}
              </span>
              <button
                className="btn-outline"
                type="button"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                {t('rankings.next')}
              </button>
            </nav>
          )}
        </>
      )}
      <ConfirmDialog
        open={playerToInvite !== null}
        title={t('rankings.inviteConfirmTitle', { username: playerToInvite?.username ?? '' })}
        message={t('rankings.inviteConfirmMessage', { username: playerToInvite?.username ?? '' })}
        confirmLabel={t('rankings.inviteConfirmAction')}
        cancelLabel={t('rankings.cancelInvite')}
        onCancel={() => setPlayerToInvite(null)}
        onConfirm={() => {
          const player = playerToInvite;
          setPlayerToInvite(null);
          if (player) void invitePlayer(player);
        }}
      />
      {activeTooltip && createPortal(
        <div
          id="rankings-player-tooltip"
          className={`rankings-player-tooltip is-${activeTooltip.placement}`}
          role="tooltip"
          style={{ left: activeTooltip.left, top: activeTooltip.top }}
        >
          {activeTooltip.message}
        </div>,
        document.body,
      )}
    </div>
  );
}
