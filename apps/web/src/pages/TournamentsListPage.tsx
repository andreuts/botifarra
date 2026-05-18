import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import type { TournamentFormat } from '@botifarra/shared';

export function TournamentsListPage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const token = user?.accessToken ?? '';

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [format, setFormat] = useState<TournamentFormat>('swiss');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => api.tournaments.list(token),
    enabled: !!token,
    refetchInterval: 15_000,
  });

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      await api.tournaments.create(name.trim(), format, token, password.trim() || undefined);
      setName('');
      setPassword('');
      setShowCreate(false);
      void queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tournaments.createFailed'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 700, margin: '0 auto' }}>
      <Link to="/">← {t('nav.home')}</Link>
      <h1>{t('tournaments.title')}</h1>

      <button onClick={() => setShowCreate(!showCreate)} style={{ marginBottom: '1rem' }}>
        {showCreate ? t('common.cancel') : t('tournaments.create')}
      </button>

      {showCreate && (
        <div style={{ border: '1px solid #ccc', padding: '1rem', marginBottom: '1rem', borderRadius: 8 }}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>{t('tournaments.name')}: </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('tournaments.namePlaceholder')}
            />
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>{t('tournaments.format')}: </label>
            <select value={format} onChange={(e) => setFormat(e.target.value as TournamentFormat)}>
              <option value="swiss">{t('tournaments.formatSwiss')}</option>
              <option value="eliminatory">{t('tournaments.formatEliminatory')}</option>
            </select>
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>{t('tournaments.password')}: </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('tournaments.passwordPlaceholder')}
            />
          </div>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button onClick={handleCreate} disabled={creating}>
            {creating ? '...' : t('tournaments.createBtn')}
          </button>
        </div>
      )}

      {isLoading && <p>{t('common.loading')}</p>}

      {data?.tournaments && data.tournaments.length === 0 && (
        <p>{t('tournaments.empty')}</p>
      )}

      {data?.tournaments?.map((tourney) => (
        <Link
          key={tourney.id}
          to={`/tournaments/${tourney.id}`}
          style={{
            display: 'block',
            border: '1px solid #ddd',
            padding: '0.75rem',
            marginBottom: '0.5rem',
            borderRadius: 6,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <strong>{tourney.name}</strong>
            <span style={{ fontSize: '0.85rem', color: '#666' }}>
              {tourney.hasPassword ? '🔒 ' : ''}
              {t(`tournaments.status.${tourney.status}`)}
            </span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#888', marginTop: 2 }}>
            {t(`tournaments.format${tourney.format === 'swiss' ? 'Swiss' : 'Eliminatory'}`)} · {tourney.registeredUsersCount} {t('tournaments.users')} · {t('tournaments.createdBy')} {tourney.createdByUsername}
          </div>
        </Link>
      ))}
    </div>
  );
}
