import { useTranslation } from 'react-i18next';
import type { PlayerStatsDTO } from '@botifarra/shared';
import { EloGraph } from './EloGraph.js';

interface PlayerStatsSummaryProps {
  stats: PlayerStatsDTO;
}

export function PlayerStatsSummary({ stats }: PlayerStatsSummaryProps) {
  const { t } = useTranslation();

  return (
    <section className="stats-panel">
      <h2 className="stats-panel-title">
        {t('history.stats.heading')}
      </h2>

      {/* Summary numbers */}
      <div className="stats-grid">
        <StatCard label={t('history.stats.totalGames')} value={stats.totalGames} />
        <StatCard
          label={t('history.stats.wins')}
          value={stats.wins}
          tone="positive"
        />
        <StatCard
          label={t('history.stats.losses')}
          value={stats.losses}
          tone="negative"
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
          tone={stats.averageEloChange >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {/* ELO graphs */}
      <div className="stats-graphs">
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
      <div className="stats-top-lists">
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
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className={`stats-card${tone ? ` stats-card--${tone}` : ''}`}>
      <strong className="stats-card-value">
        {value}
      </strong>
      <span className="stats-card-label">
        {label}
      </span>
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
    <div className="stats-top-list">
      <h3 className="stats-top-list-title">
        {title}
      </h3>
      {players.length === 0 ? (
        <p className="stats-no-data">
          {t('history.stats.noData')}
        </p>
      ) : (
        <ol className="stats-player-list">
          {players.map((p) => (
            <li key={p.userId}>
              <strong>{p.username}</strong>{' '}
              <span>
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
