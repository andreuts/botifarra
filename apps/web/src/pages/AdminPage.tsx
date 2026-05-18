import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import type { AdminStats, AdminUser, AdminMatch, Pagination } from '../api/client.js';

const STORED_SECRET_KEY = 'botifarra-admin-secret';

export function AdminPage() {
  const { t } = useTranslation();
  const [adminSecret, setAdminSecret] = useState(
    () => sessionStorage.getItem(STORED_SECRET_KEY) ?? '',
  );
  const [authenticated, setAuthenticated] = useState(false);
  const [secretInput, setSecretInput] = useState('');
  const [error, setError] = useState('');

  // Tab state
  const [tab, setTab] = useState<'overview' | 'users' | 'matches'>('overview');

  // Overview
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userPagination, setUserPagination] = useState<Pagination | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);

  // Matches
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [matchPagination, setMatchPagination] = useState<Pagination | null>(null);
  const [matchStatusFilter, setMatchStatusFilter] = useState('');
  const [matchPage, setMatchPage] = useState(1);

  // Actions
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  const attemptAuth = useCallback(async (secret: string) => {
    try {
      await api.admin.getStats(secret);
      setAdminSecret(secret);
      sessionStorage.setItem(STORED_SECRET_KEY, secret);
      setAuthenticated(true);
      setError('');
    } catch {
      setError(t('admin.invalidSecret'));
      setAuthenticated(false);
    }
  }, []);

  // Auto-authenticate if secret is stored
  useEffect(() => {
    if (adminSecret) {
      void attemptAuth(adminSecret);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadStats = useCallback(async () => {
    try {
      const data = await api.admin.getStats(adminSecret);
      setStats(data);
    } catch {
      /* ignore */
    }
  }, [adminSecret]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.admin.listUsers(adminSecret, {
        page: userPage,
        limit: 20,
        search: userSearch || undefined,
      });
      setUsers(data.users);
      setUserPagination(data.pagination);
    } catch {
      /* ignore */
    }
  }, [adminSecret, userPage, userSearch]);

  const loadMatches = useCallback(async () => {
    try {
      const data = await api.admin.listMatches(adminSecret, {
        page: matchPage,
        limit: 20,
        status: matchStatusFilter || undefined,
      });
      setMatches(data.matches);
      setMatchPagination(data.pagination);
    } catch {
      /* ignore */
    }
  }, [adminSecret, matchPage, matchStatusFilter]);

  useEffect(() => {
    if (!authenticated) return;
    if (tab === 'overview') void loadStats();
    if (tab === 'users') void loadUsers();
    if (tab === 'matches') void loadMatches();
  }, [authenticated, tab, loadStats, loadUsers, loadMatches]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  async function handleDeleteUser(userId: string, username: string) {
    if (!confirm(t('admin.users.deleteConfirm', { username }))) return;
    setActionLoading(true);
    try {
      const res = await api.admin.deleteUser(adminSecret, userId);
      setActionMessage(res.message);
      void loadUsers();
      void loadStats();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : t('admin.users.deleteError'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteMatch(matchId: string) {
    if (!confirm(t('admin.matches.deleteConfirm', { matchId }))) return;
    setActionLoading(true);
    try {
      const res = await api.admin.deleteMatch(adminSecret, matchId);
      setActionMessage(res.message);
      void loadMatches();
      void loadStats();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : t('admin.matches.deleteError'));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCleanupMatches() {
    if (!confirm(t('admin.matches.cleanupConfirm'))) return;
    setActionLoading(true);
    try {
      const res = await api.admin.cleanupMatches(adminSecret, 60);
      setActionMessage(res.message);
      void loadMatches();
      void loadStats();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : t('admin.matches.cleanupError'));
    } finally {
      setActionLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Login screen
  // ---------------------------------------------------------------------------

  if (!authenticated) {
    return (
      <div className="page">
        <div className="card" style={{ maxWidth: 400 }}>
          <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>{t('admin.heading')}</h2>
          <div className="form-group">
            <label>{t('admin.adminSecret')}</label>
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder={t('admin.adminSecretPlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && attemptAuth(secretInput)}
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button
            onClick={() => attemptAuth(secretInput)}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {t('admin.authenticate')}
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

  // ---------------------------------------------------------------------------
  // Main admin UI
  // ---------------------------------------------------------------------------

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.4rem' }}>{t('admin.heading')}</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link to="/monitoring" style={{ fontSize: '0.85rem' }}>
            {t('admin.monitoring')}
          </Link>
          <Link to="/news/admin" style={{ fontSize: '0.85rem' }}>
            {t('news.admin.manageNews')}
          </Link>
          <Link to="/" style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
            {t('nav.home')}
          </Link>
          <button
            className="btn-outline"
            onClick={() => {
              sessionStorage.removeItem(STORED_SECRET_KEY);
              setAuthenticated(false);
              setAdminSecret('');
            }}
            style={{ padding: '0.3rem 0.8rem', fontSize: '0.75rem' }}
          >
            {t('admin.logout')}
          </button>
        </div>
      </header>

      {/* Action message */}
      {actionMessage && (
        <div
          style={{
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-gold)',
            borderRadius: 'var(--radius)',
            padding: '0.75rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{actionMessage}</span>
          <button
            className="btn-outline"
            onClick={() => setActionMessage('')}
            style={{ padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}
          >
            {t('admin.dismiss')}
          </button>
        </div>
      )}

      {/* Tabs */}
      <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['overview', 'users', 'matches'] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={tab === tabKey ? '' : 'btn-outline'}
            style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
          >
            {t(`admin.tabs.${tabKey}`)}
          </button>
        ))}
      </nav>

      {/* ── Overview ──────────────────────────────────────── */}
      {tab === 'overview' && stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
          }}
        >
          <StatCard label={t('admin.stats.totalUsers')} value={stats.totalUsers} />
          <StatCard label={t('admin.stats.newUsers24h')} value={stats.newUsersLast24h} />
          <StatCard label={t('admin.stats.totalMatches')} value={stats.totalMatches} />
          <StatCard label={t('admin.stats.activeMatches')} value={stats.activeMatches} accent />
          <StatCard label={t('admin.stats.finished')} value={stats.finishedMatches} />
          <StatCard label={t('admin.stats.waiting')} value={stats.waitingMatches} />
        </div>
      )}

      {/* ── Users ─────────────────────────────────────────── */}
      {tab === 'users' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder={t('admin.users.searchPlaceholder')}
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setUserPage(1);
              }}
              style={{ maxWidth: 300 }}
            />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={thStyle}>{t('admin.users.username')}</th>
                  <th style={thStyle}>{t('admin.users.rating')}</th>
                  <th style={thStyle}>{t('admin.users.wl')}</th>
                  <th style={thStyle}>{t('admin.users.joined')}</th>
                  <th style={thStyle}>{t('admin.users.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={tdStyle}>{u.username}</td>
                    <td style={tdStyle}>{u.rating}</td>
                    <td style={tdStyle}>
                      {u.matchesWon}/{u.matchesLost}
                    </td>
                    <td style={tdStyle}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td style={tdStyle}>
                      <button
                        className="btn-outline"
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        disabled={actionLoading}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.7rem',
                          color: 'var(--color-danger)',
                          borderColor: 'var(--color-danger)',
                        }}
                      >
                        {t('admin.users.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-muted)' }}
                    >
                      {t('admin.users.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {userPagination && userPagination.totalPages > 1 && (
            <PaginationControls
              pagination={userPagination}
              page={userPage}
              onChange={setUserPage}
            />
          )}
        </div>
      )}

      {/* ── Matches ───────────────────────────────────────── */}
      {tab === 'matches' && (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <select
              value={matchStatusFilter}
              onChange={(e) => {
                setMatchStatusFilter(e.target.value);
                setMatchPage(1);
              }}
              style={{ maxWidth: 200 }}
            >
              <option value="">{t('admin.matches.allStatuses')}</option>
              <option value="WAITING">{t('admin.matches.waiting')}</option>
              <option value="IN_PROGRESS">{t('admin.matches.inProgress')}</option>
              <option value="FINISHED">{t('admin.matches.finished')}</option>
            </select>
            <button
              className="btn-outline"
              onClick={handleCleanupMatches}
              disabled={actionLoading}
              style={{
                fontSize: '0.8rem',
                padding: '0.4rem 0.8rem',
                color: 'var(--color-warning)',
                borderColor: 'var(--color-warning)',
              }}
            >
              {t('admin.matches.cleanupStale')}
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={thStyle}>{t('admin.matches.id')}</th>
                  <th style={thStyle}>{t('admin.matches.mode')}</th>
                  <th style={thStyle}>{t('admin.matches.status')}</th>
                  <th style={thStyle}>{t('admin.matches.score')}</th>
                  <th style={thStyle}>{t('admin.matches.players')}</th>
                  <th style={thStyle}>{t('admin.matches.created')}</th>
                  <th style={thStyle}>{t('admin.matches.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {m.id.slice(0, 12)}…
                    </td>
                    <td style={tdStyle}>{m.mode}</td>
                    <td style={tdStyle}>
                      <StatusBadge status={m.status} />
                    </td>
                    <td style={tdStyle}>
                      {m.score0} – {m.score1}
                    </td>
                    <td style={{ ...tdStyle, fontSize: '0.75rem' }}>
                      {m.players.map((p) => p.username).join(', ')}
                    </td>
                    <td style={tdStyle}>{new Date(m.createdAt).toLocaleString()}</td>
                    <td style={tdStyle}>
                      <button
                        className="btn-outline"
                        onClick={() => handleDeleteMatch(m.id)}
                        disabled={actionLoading}
                        style={{
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.7rem',
                          color: 'var(--color-danger)',
                          borderColor: 'var(--color-danger)',
                        }}
                      >
                        {t('admin.matches.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
                {matches.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-muted)' }}
                    >
                      {t('admin.matches.empty')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {matchPagination && matchPagination.totalPages > 1 && (
            <PaginationControls
              pagination={matchPagination}
              page={matchPage}
              onChange={setMatchPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius)',
        padding: '1.25rem',
        textAlign: 'center',
        border: accent ? '1px solid var(--color-gold)' : '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: accent ? 'var(--color-gold)' : 'var(--color-text)',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '0.25rem' }}>
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    WAITING: 'var(--color-warning)',
    IN_PROGRESS: 'var(--color-accent)',
    FINISHED: 'var(--color-success)',
  };
  const color = colors[status] ?? 'var(--color-muted)';
  return (
    <span
      style={{
        fontSize: '0.7rem',
        padding: '0.15rem 0.4rem',
        borderRadius: '4px',
        background: `${color}22`,
        color,
        fontWeight: 600,
        border: `1px solid ${color}44`,
      }}
    >
      {status}
    </span>
  );
}

function PaginationControls({
  pagination,
  page,
  onChange,
}: {
  pagination: Pagination;
  page: number;
  onChange: (p: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '0.5rem',
        marginTop: '1rem',
        alignItems: 'center',
        fontSize: '0.85rem',
      }}
    >
      <button
        className="btn-outline"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
      >
        {t('admin.pagination.prev')}
      </button>
      <span style={{ color: 'var(--color-muted)' }}>
        {t('admin.pagination.page', { page, total: pagination.totalPages, count: pagination.total })}
      </span>
      <button
        className="btn-outline"
        onClick={() => onChange(page + 1)}
        disabled={page >= pagination.totalPages}
        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
      >
        {t('admin.pagination.next')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const thStyle: React.CSSProperties = {
  padding: '0.5rem',
  fontWeight: 600,
  color: 'var(--color-muted)',
  fontSize: '0.75rem',
  whiteSpace: 'nowrap',
};
const tdStyle: React.CSSProperties = { padding: '0.5rem', whiteSpace: 'nowrap' };
