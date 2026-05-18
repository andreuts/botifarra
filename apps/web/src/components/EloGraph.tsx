import { useTranslation } from 'react-i18next';
import type { EloSnapshotDTO } from '@botifarra/shared';

interface EloGraphProps {
  data: EloSnapshotDTO[];
  label: string;
  width?: number;
  height?: number;
}

export function EloGraph({ data, label, width = 320, height = 120 }: EloGraphProps) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius)',
          color: 'var(--color-muted)',
          fontSize: '0.8rem',
        }}
        aria-label={label}
      >
        {t('history.stats.noData')}
      </div>
    );
  }

  const pad = 16;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const elos = data.map((d) => d.eloAfter);
  const minElo = Math.min(...elos);
  const maxElo = Math.max(...elos);
  const eloRange = maxElo - minElo || 1;

  const toX = (i: number) => pad + (i / Math.max(data.length - 1, 1)) * innerW;
  const toY = (elo: number) => pad + innerH - ((elo - minElo) / eloRange) * innerH;

  const points = data.map((d, i) => `${toX(i)},${toY(d.eloAfter)}`).join(' ');

  return (
    <figure style={{ margin: 0 }} aria-label={label}>
      <figcaption
        style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }}
      >
        {label}
      </figcaption>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{
          display: 'block',
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius)',
        }}
        role="img"
        aria-label={label}
      >
        {/* Grid lines */}
        <line
          x1={pad}
          y1={pad}
          x2={pad}
          y2={height - pad}
          stroke="var(--color-border)"
          strokeWidth="1"
        />
        <line
          x1={pad}
          y1={height - pad}
          x2={width - pad}
          y2={height - pad}
          stroke="var(--color-border)"
          strokeWidth="1"
        />

        {/* ELO polyline */}
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-accent, #3498db)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {data.map((d, i) => (
          <circle
            key={d.matchId}
            cx={toX(i)}
            cy={toY(d.eloAfter)}
            r={3}
            fill={d.eloChange >= 0 ? 'var(--color-success, #27ae60)' : 'var(--color-danger, #e74c3c)'}
          />
        ))}

        {/* Min/max ELO labels */}
        <text x={pad + 2} y={pad + 10} fontSize="9" fill="var(--color-muted)">
          {Math.round(maxElo)}
        </text>
        <text x={pad + 2} y={height - pad - 2} fontSize="9" fill="var(--color-muted)">
          {Math.round(minElo)}
        </text>
      </svg>

      {/* Accessible fallback table — visually hidden */}
      <table
        style={{
          position: 'absolute',
          left: -9999,
          width: 1,
          height: 1,
          overflow: 'hidden',
        }}
        aria-label={t('history.eloTableCaption', { label })}
      >
        <caption>{t('history.eloTableCaption', { label })}</caption>
        <thead>
          <tr>
            <th>{t('history.eloTableColGame')}</th>
            <th>{t('history.eloTableColElo')}</th>
            <th>{t('history.eloTableColChange')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={d.matchId}>
              <td>{i + 1}</td>
              <td>{Math.round(d.eloAfter)}</td>
              <td>{d.eloChange >= 0 ? `+${Math.round(d.eloChange)}` : Math.round(d.eloChange)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
