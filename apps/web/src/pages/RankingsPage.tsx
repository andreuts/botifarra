import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api, type RankingEntry } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';

export function RankingsPage() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.user?.accessToken ?? '');
  const { data, isLoading, error } = useQuery<RankingEntry[]>({
    queryKey: ['rankings'],
    queryFn: () => api.rankings.list(token),
    enabled: !!token,
  });

  return (
    <div className="page">
      <header
        style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}
      >
        <Link to="/" style={{ textDecoration: 'none', color: 'var(--color-accent)' }}>
          {t('nav.back')}
        </Link>
        <h1 style={{ margin: 0 }}>{t('rankings.heading')}</h1>
      </header>

      {isLoading && <p>{t('rankings.loading')}</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{t('rankings.error')}</p>}

      {data && data.length === 0 && (
        <p style={{ color: 'var(--color-muted)' }}>{t('rankings.empty')}</p>
      )}

      {data && data.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th style={th}>{t('rankings.rank')}</th>
              <th style={th}>{t('rankings.player')}</th>
              <th style={th}>{t('rankings.rating')}</th>
              <th style={th}>{t('rankings.wl')}</th>
              <th style={th}>{t('rankings.winPct')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.userId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={td}>{entry.rank}</td>
                <td style={td}>{entry.username}</td>
                <td style={td}>{entry.rating}</td>
                <td style={td}>
                  {entry.matchesWon} / {entry.matchesPlayed - entry.matchesWon}
                </td>
                <td style={td}>{entry.winRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  fontWeight: 600,
};

const td: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
};
