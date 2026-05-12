import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router';
import { api } from '../api/client.js';
import type { MonitoringSnapshot } from '../api/client.js';

const STORED_SECRET_KEY = 'botifarra-admin-secret';
const REFRESH_INTERVAL = 5_000;

export function MonitoringPage() {
  const [adminSecret, setAdminSecret] = useState(() => sessionStorage.getItem(STORED_SECRET_KEY) ?? '');
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
      setError('Invalid admin secret');
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
    } catch { /* ignore */ }
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
          <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>Monitoring</h2>
          <div className="form-group">
            <label>Admin Secret</label>
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="Enter admin secret"
              onKeyDown={(e) => e.key === 'Enter' && attemptAuth(secretInput)}
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button onClick={() => attemptAuth(secretInput)} style={{ width: '100%', marginTop: '0.5rem' }}>
            Authenticate
          </button>
          <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem' }}>
            <Link to="/" style={{ color: 'var(--color-muted)' }}>Back to Home</Link>
          </p>
        </div>
      </div>
    );
  }

  if (!snapshot) return <div className="page"><p>Loading…</p></div>;

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  const uptimeStr = formatUptime(snapshot.uptime);
  const memMB = (b: number) => (b / 1024 / 1024).toFixed(1);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ fontSize: '1.4rem' }}>Server Monitoring</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.8rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
          <button className="btn-outline" onClick={fetchSnapshot} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Refresh</button>
          <Link to="/admin" style={{ fontSize: '0.85rem' }}>Admin</Link>
          <Link to="/" style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>Home</Link>
        </div>
      </header>

      {lastRefresh && (
        <p style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginBottom: '1rem' }}>
          Last updated: {lastRefresh.toLocaleTimeString()}
        </p>
      )}

      {/* ── Key Metrics ──────────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <MetricCard label="Uptime" value={uptimeStr} />
        <MetricCard label="CPU" value={`${snapshot.cpuUsage.toFixed(1)}%`} accent={snapshot.cpuUsage > 80} />
        <MetricCard label="Heap Used" value={`${memMB(snapshot.memory.heapUsed)} MB`} />
        <MetricCard label="RSS" value={`${memMB(snapshot.memory.rss)} MB`} />
        <MetricCard label="Req/min" value={String(snapshot.requests.last1min)} accent={snapshot.requests.last1min > 100} />
        <MetricCard label="Req/5min" value={String(snapshot.requests.last5min)} />
        <MetricCard label="Avg Latency" value={`${snapshot.requests.avgDurationMs.toFixed(1)} ms`} />
        <MetricCard label="Error Rate" value={`${(snapshot.requests.errorRate * 100).toFixed(1)}%`} accent={snapshot.requests.errorRate > 0.05} />
      </section>

      {/* ── Queue & Rooms ────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Queue */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Queue</h3>
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem' }}>
            <div><span style={{ color: 'var(--color-muted)' }}>Total:</span> {snapshot.queue.size}</div>
            <div><span style={{ color: 'var(--color-muted)' }}>Singles:</span> {snapshot.queue.singles}</div>
            <div><span style={{ color: 'var(--color-muted)' }}>Pairs:</span> {snapshot.queue.pairs}</div>
          </div>
        </div>

        {/* Rooms */}
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>Active Rooms ({snapshot.rooms.active})</h3>
          {snapshot.rooms.roomList.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>No active rooms</p>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: '0.8rem' }}>
              {snapshot.rooms.roomList.map((r) => (
                <div key={r.roomId} style={{ padding: '0.3rem 0', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{r.roomId.slice(0, 10)}…</span>
                  <span>{r.clients}/{r.maxClients} players</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Per-Route Stats ───────────────────────────────── */}
      <div style={{ ...sectionStyle, marginBottom: '1.5rem' }}>
        <h3 style={sectionTitleStyle}>Routes Performance</h3>
        {snapshot.requests.perRoute.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>No request data yet</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={thStyle}>Method</th>
                  <th style={thStyle}>Route</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Requests</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Avg (ms)</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>P95 (ms)</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Errors</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.requests.perRoute.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.3rem', borderRadius: 3, background: methodColor(r.method), color: '#fff', fontWeight: 600 }}>
                        {r.method}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.route}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.totalRequests}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.avgDurationMs.toFixed(1)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.p95DurationMs.toFixed(1)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: r.errorCount > 0 ? 'var(--color-danger)' : 'inherit' }}>{r.errorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent Errors ─────────────────────────────────── */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>Recent Errors ({snapshot.errors.total} total)</h3>
        {snapshot.errors.recent.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.8rem' }}>No recent errors</p>
        ) : (
          <div style={{ maxHeight: 250, overflowY: 'auto', fontSize: '0.8rem' }}>
            {snapshot.errors.recent.map((e, i) => (
              <div key={i} style={{ padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.75rem' }}>{e.message}</span>
                  <span style={{ color: 'var(--color-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {e.route && <div style={{ color: 'var(--color-muted)', fontSize: '0.7rem', fontFamily: 'monospace' }}>{e.route}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── System Info ────────────────────────────────────── */}
      <p style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '1.5rem', textAlign: 'center' }}>
        Node {snapshot.nodeVersion} • {snapshot.platform} • PID {snapshot.pid} • Total requests: {snapshot.requests.total}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: '1rem',
      textAlign: 'center', border: accent ? '1px solid var(--color-danger)' : '1px solid var(--color-border)',
    }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: accent ? 'var(--color-danger)' : 'var(--color-text)' }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '0.2rem' }}>{label}</div>
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
  const colors: Record<string, string> = { GET: '#61affe', POST: '#49cc90', PUT: '#fca130', DELETE: '#f93e3e', PATCH: '#50e3c2' };
  return colors[method] ?? '#888';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyle: React.CSSProperties = {
  background: 'var(--color-surface)', borderRadius: 'var(--radius)', padding: '1rem',
  border: '1px solid var(--color-border)',
};
const sectionTitleStyle: React.CSSProperties = { fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 600 };
const thStyle: React.CSSProperties = { padding: '0.4rem', fontWeight: 600, color: 'var(--color-muted)', fontSize: '0.7rem', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '0.4rem', whiteSpace: 'nowrap' };
