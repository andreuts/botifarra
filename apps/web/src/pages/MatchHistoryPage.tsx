import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import type { RecentGameDTO } from '@botifarra/shared';
import { RecentGameRow } from '../components/RecentGameRow.js';
import { PlayerStatsSummary } from '../components/PlayerStatsSummary.js';

export function MatchHistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.user?.accessToken ?? '');

  const {
    data: matches,
    isLoading: matchesLoading,
    error: matchesError,
  } = useQuery<RecentGameDTO[]>({
    queryKey: ['matches'],
    queryFn: () => api.matches.list(token),
    enabled: !!token,
  });

  const { data: stats } = useQuery({
    queryKey: ['playerStats'],
    queryFn: () => api.users.myStats(token),
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

  return (
    <div className="section-page history-page">
      <header className="section-page-header">
        <div className="section-page-title">
          <h1>{t('history.heading')}</h1>
        </div>
        <img className="section-page-card" src="/cards/01-espadas.png" alt="" />
      </header>

      {/* Player statistics panel */}
      {stats && <PlayerStatsSummary stats={stats} />}

      {matchesLoading && <p className="section-page-message">{t('history.loading')}</p>}
      {matchesError && <p className="section-page-message is-error">{t('history.error')}</p>}

      {matches && matches.length === 0 && (
        <p className="section-page-message">{t('history.empty')}</p>
      )}

      {matches && matches.length > 0 && (
        <ul className="history-match-list">
          {matches.map((m) => (
            <RecentGameRow key={m.matchId} match={m} onResume={handleResume} />
          ))}
        </ul>
      )}
    </div>
  );
}

