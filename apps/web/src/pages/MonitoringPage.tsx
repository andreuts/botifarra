import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import type { MonitoringSnapshot } from '../api/client.js';

const STORED_SECRET_KEY = 'botifarra-admin-secret';
const REFRESH_INTERVAL = 5_000;

export function MonitoringPage() {
  const { t } = useTranslation();
  const [adminSecret, setAdminSecret] = useState(
    () => sessionStorage.getItem(STORED_SECRET_KEY) ?? '',
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [error, setError] = useState('');

  const [snapshot, setSnapshot] = useState<MonitoringSnapshot | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  const attemptAuth = useCallback(async (secret: string) => {
    try {
      await api.monitoring.getSnapshot(secret);
      setAdminSecret(secret);
      sessionStorage.setItem(STORED_SECRET_KEY, secret);
      setAuthenticated(true);
      setError('');
    } catch {
      setError(t('monitoring.invalidSecret'));
      setAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    if (adminSecret) void attemptAuth(adminSecret);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchSnapshot = useCallback(async () => {
    try {
      const data = await api.monitoring.getSnapshot(adminSecret);
      setSnapshot(data);
      setLastRefresh(new Date());
    } catch {
      /* ignore */
    }
  }, [adminSecret]);

  useEffect(() => {
    if (!authenticated) return;
    void fetchSnapshot();
  }, [authenticated, fetchSnapshot]);

  useEffect(() => {
    if (!authenticated || !autoRefresh) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(fetchSnapshot, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [authenticated, autoRefresh, fetchSnapshot]);

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  if (!authenticated) {
    return (
      <div className="page">
        <div className="card" style={{ maxWidth: 400 }}>
          <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>{t('monitoring.heading')}</h2>
          <div className="form-group">
            <label>{t('monitoring.adminSecret')}</label>
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder={t('monitoring.adminSecretPlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && attemptAuth(secretInput)}
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button
            onClick={() => attemptAuth(secretInput)}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {t('monitoring.authenticate')}
          </button>
          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem' }}>
            <Link to="/" style={{ color: 'var(--color-muted)' }}>
              {t('nav.home')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (!snapshot)
    return (
      <div className="page">
        <p>{t('monitoring.loading')}</p>
      </div>
    );

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  const uptimeStr = formatUptime(snapshot.uptime);
  const memMB = (b: number) => (b / 1024 / 1024).toFixed(1);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.4rem' }}>{t('monitoring.heading')}</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.8rem' }}>
          <label
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            {t('monitoring.autoRefresh')}
          </label>
          <button
            className="btn-outline"
            onClick={fetchSnapshot}
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
          >
            {t('monitoring.refresh')}
          </button>
          <Link to="/admin" style={{ fontSize: '0.85rem' }}>
            {t('monitoring.admin')}
          </Link>
          <Link to="/" style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            {t('nav.home')}
          </Link>
        </div>
      </header>

      {lastRefresh && (
        <p style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
          {t('monitoring.lastUpdated', { time: lastRefresh.toLocaleTimeString() })}
        </p>
      )}

      {/* ── Key Metrics ──────────────────────────────────── */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        <MetricCard label={t('monitoring.metrics.uptime')} value={uptimeStr} />
        <MetricCard
          label={t('monitoring.metrics.cpu')}
          value={`${snapshot.cpuUsage.toFixed(1)}%`}
          accent={snapshot.cpuUsage > 80}
        />
        <MetricCard label={t('monitoring.metrics.heapUsed')} value={`${memMB(snapshot.memory.heapUsed)} MB`} />
        <MetricCard label={t('monitoring.metrics.rss')} value={`${memMB(snapshot.memory.rss)} MB`} />
        <MetricCard
          label={t('monitoring.metrics.reqMin')}
          value={String(snapshot.requests.last1min)}
          accent={snapshot.requests.last1min > 100}
        />
        <MetricCard label={t('monitoring.metrics.req5min')} value={String(snapshot.requests.last5min)} />
        <MetricCard
          label={t('monitoring.metrics.avgLatency')}
          value={`${snapshot.requests.avgDurationMs.toFixed(1)} ms`}
        />
        <MetricCard
          label={t('monitoring.metrics.errorRate')}
          value={`${(snapshot.requests.errorRate * 100).toFixed(1)}%`}
          accent={snapshot.requests.errorRate > 0.05}
        />
      </section>

      {/* ── Queue & Rooms ────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Queue */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>{t('monitoring.queue.heading')}</h3>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
            <div>
              <span style={{ color: 'var(--color-muted)' }}>{t('monitoring.queue.total')}</span> {snapshot.queue.size}
            </div>
            <div>
              <span style={{ color: 'var(--color-muted)' }}>{t('monitoring.queue.singles')}</span> {snapshot.queue.singles}
            </div>
            <div>
              <span style={{ color: 'var(--color-muted)' }}>{t('monitoring.queue.pairs')}</span> {snapshot.queue.pairs}
            </div>
          </div>
        </div>

        {/* Rooms */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>{t('monitoring.rooms.heading', { count: snapshot.rooms.active })}</h3>
          {snapshot.rooms.roomList.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>{t('monitoring.rooms.empty')}</p>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: '0.8rem' }}>
              {snapshot.rooms.roomList.map((r) => (
                <div
                  key={r.roomId}
                  style={{
                    padding: '0.3rem 0',
                    borderBottom: '1px solid var(--color-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                    {r.roomId.slice(0, 10)}…
                  </span>
                  <span>
                    {t('monitoring.rooms.players', { clients: r.clients, maxClients: r.maxClients })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Per-Route Stats ───────────────────────────────── */}
      <div style={{ ...sectionStyle, marginBottom: '1.5rem' }}>
        <h3 style={sectionTitleStyle}>{t('monitoring.routes.heading')}</h3>
        {snapshot.requests.perRoute.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>{t('monitoring.routes.empty')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={thStyle}>{t('monitoring.routes.method')}</th>
                  <th style={thStyle}>{t('monitoring.routes.route')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t('monitoring.routes.requests')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t('monitoring.routes.avgMs')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t('monitoring.routes.p95ms')}</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>{t('monitoring.routes.errors')}</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.requests.perRoute.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={tdStyle}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.1rem 0.3rem',
                          borderRadius: 3,
                          background: methodColor(r.method),
                          color: '#fff',
                          fontWeight: 600,
                        }}
                      >
                        {r.method}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {r.route}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.totalRequests}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.avgDurationMs.toFixed(1)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.p95DurationMs.toFixed(1)}</td>
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: 'right',
                        color: r.errorCount > 0 ? 'var(--color-danger)' : 'inherit',
                      }}
                    >
                      {r.errorCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent Errors ─────────────────────────────────── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>{t('monitoring.errors.heading', { total: snapshot.errors.total })}</h3>
        {snapshot.errors.recent.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>{t('monitoring.errors.empty')}</p>
        ) : (
          <div style={{ maxHeight: 250, overflowY: 'auto', fontSize: '0.8rem' }}>
            {snapshot.errors.recent.map((e, i) => (
              <div
                key={i}
                style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span
                    style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.75rem' }}
                  >
                    {e.message}
                  </span>
                  <span
                    style={{
                      color: 'var(--color-muted)',
                      fontSize: '0.7rem',
                      whiteSpace: 'nowrap',
                      marginLeft: '1rem',
                    }}
                  >
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {e.route && (
                  <div
                    style={{
                      color: 'var(--color-muted)',
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    {e.route}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── System Info ────────────────────────────────────── */}
      <p
        style={{
          fontSize: '0.7rem',
          color: 'var(--color-muted)',
          marginTop: '1.5rem',
          textAlign: 'center',
        }}
      >
        {t('monitoring.systemInfo', {
          version: snapshot.nodeVersion,
          platform: snapshot.platform,
          pid: snapshot.pid,
          n: snapshot.requests.total,
        })}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius)',
        padding: '1rem',
        textAlign: 'center',
        border: accent ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          fontSize: '1.3rem',
          fontWeight: 700,
          color: accent ? 'var(--color-danger)' : 'var(--color-text)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(seconds % 60)}s`;
}

function methodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: '#61affe',
    POST: '#49cc90',
    PUT: '#fca130',
    DELETE: '#f93e3e',
    PATCH: '#50e3c2',
  };
  return colors[method] ?? '#888';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyle: React.CSSProperties = {
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius)',
  padding: '1rem',
  border: '1px solid var(--color-border)',
};
const sectionTitleStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  marginBottom: '0.75rem',
  fontWeight: 600,
};
const thStyle: React.CSSProperties = {
  padding: '0.4rem',
  fontWeight: 600,
  color: 'var(--color-muted)',
  fontSize: '0.7rem',
  whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = { padding: '0.4rem', whiteSpace: 'nowrap' };
