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
    <div className="page">
      <header
        style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}
      >
        <Link to="/" style={{ textDecoration: 'none', color: 'var(--color-accent)' }}>
          {t('nav.back')}
        </Link>
        <h1 style={{ margin: 0 }}>{t('history.heading')}</h1>
      </header>

      {/* Player statistics panel */}
      {stats && <PlayerStatsSummary stats={stats} />}

      {matchesLoading && <p>{t('history.loading')}</p>}
      {matchesError && <p style={{ color: 'var(--color-danger)' }}>{t('history.error')}</p>}

      {matches && matches.length === 0 && (
        <p style={{ color: 'var(--color-muted)' }}>{t('history.empty')}</p>
      )}

      {matches && matches.length > 0 && (
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {matches.map((m) => (
            <RecentGameRow key={m.matchId} match={m} onResume={handleResume} />
          ))}
        </ul>
      )}
    </div>
  );
}

