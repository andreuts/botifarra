import { useTranslation } from 'react-i18next';
import type { PlayerStatsDTO } from '@botifarra/shared';
import { EloGraph } from './EloGraph.js';

interface PlayerStatsSummaryProps {
  stats: PlayerStatsDTO;
}

export function PlayerStatsSummary({ stats }: PlayerStatsSummaryProps) {
  const { t } = useTranslation();

  return (
    <section
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
        marginBottom: '2rem',
      }}
    >
      <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>
        {t('history.stats.heading')}
      </h2>

      {/* Summary numbers */}
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
      >
        <StatCard label={t('history.stats.totalGames')} value={stats.totalGames} />
        <StatCard
          label={t('history.stats.wins')}
          value={stats.wins}
          color="var(--color-success, #27ae60)"
        />
        <StatCard
          label={t('history.stats.losses')}
          value={stats.losses}
          color="var(--color-danger, #e74c3c)"
        />
        <StatCard
          label={t('history.stats.winRate')}
          value={`${(stats.winRate * 100).toFixed(1)}%`}
        />
        <StatCard
          label={t('history.stats.currentElo')}
          value={Math.round(stats.currentElo)}
        />
        <StatCard
          label={t('history.stats.avgEloChange')}
          value={
            stats.averageEloChange >= 0
              ? `+${stats.averageEloChange.toFixed(1)}`
              : stats.averageEloChange.toFixed(1)
          }
          color={stats.averageEloChange >= 0 ? 'var(--color-success, #27ae60)' : 'var(--color-danger, #e74c3c)'}
        />
      </div>

      {/* ELO graphs */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <EloGraph
          data={stats.eloHistory}
          label={t('history.stats.eloOverall')}
        />
        <EloGraph
          data={stats.rankedEloHistory}
          label={t('history.stats.eloRanked')}
        />
      </div>

      {/* Top players lists */}
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <TopPlayerList
          title={t('history.stats.topPlayedWith')}
          players={stats.topPlayedWith}
        />
        <TopPlayerList
          title={t('history.stats.topPlayedAgainst')}
          players={stats.topPlayedAgainst}
        />
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--color-bg, #0f0f1a)',
        borderRadius: 8,
        padding: '0.6rem 1rem',
        minWidth: 80,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '1.35rem',
          fontWeight: 700,
          color: color ?? 'var(--color-text)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function TopPlayerList({
  title,
  players,
}: {
  title: string;
  players: PlayerStatsDTO['topPlayedWith'];
}) {
  const { t } = useTranslation();

  return (
    <div>
      <h3 style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--color-muted)' }}>
        {title}
      </h3>
      {players.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>
          {t('history.stats.noData')}
        </p>
      ) : (
        <ol style={{ paddingLeft: '1rem', margin: 0 }}>
          {players.map((p) => (
            <li key={p.userId} style={{ fontSize: '0.82rem', marginBottom: '0.25rem' }}>
              <strong>{p.username}</strong>{' '}
              <span style={{ color: 'var(--color-muted)' }}>
                {p.gamesPlayed}{' '}
                {t('history.stats.games', { count: p.gamesPlayed })}{' '}
                — {(p.winRateVsOpponent * 100).toFixed(0)}% {t('history.stats.wr')}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
