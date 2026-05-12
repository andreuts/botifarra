import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import type { MatchDTO } from '@botifarra/shared';

export function MatchHistoryPage() {
  const token = useAuthStore((s) => s.user?.accessToken ?? '');
  const { data: matches, isLoading, error } = useQuery<MatchDTO[]>({
    queryKey: ['matches'],
    queryFn: () => api.matches.list(token),
    enabled: !!token,
  });

  return (
    <div className="page">
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'var(--color-accent)' }}>
          ← Back
        </Link>
        <h1 style={{ margin: 0 }}>Match History</h1>
      </header>

      {isLoading && <p>Loading matches…</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>Failed to load matches.</p>}

      {matches && matches.length === 0 && (
        <p style={{ color: 'var(--color-muted)' }}>No matches played yet.</p>
      )}

      {matches && matches.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th style={th}>Mode</th>
              <th style={th}>Players</th>
              <th style={th}>Score</th>
              <th style={th}>Status</th>
              <th style={th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.matchId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={td}>{m.mode}</td>
                <td style={td}>
                  {m.players
                    .slice()
                    .sort((a, b) => a.seat - b.seat)
                    .map((p) => p.username)
                    .join(', ')}
                </td>
                <td style={td}>{m.scores[0]} – {m.scores[1]}</td>
                <td style={td}>{m.status}</td>
                <td style={td}>{new Date(m.createdAt).toLocaleDateString()}</td>
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
