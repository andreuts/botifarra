import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import type { TournamentCoupleDTO, TournamentRoundDTO } from '@botifarra/shared';

export function TournamentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const token = user?.accessToken ?? '';

  const [partnerId, setPartnerId] = useState('');
  const [password, setPassword] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => api.tournaments.get(id!, token),
    enabled: !!token && !!id,
    refetchInterval: 10_000,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['tournament', id] });

  const tournament = data?.tournament;
  const couples = data?.couples ?? [];
  const rounds = data?.rounds ?? [];
  const isCreator = tournament?.createdById === user?.userId;
  const isRegistrationOpen = tournament?.status === 'registration_open';
  const isInProgress = tournament?.status === 'in_progress';

  async function doAction(fn: () => Promise<unknown>) {
    setActionError('');
    setActionLoading(true);
    try {
      await fn();
      refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error');
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) return <p>{t('common.loading')}</p>;
  if (!tournament) return <p>{t('tournaments.notFound')}</p>;

  return (
    <div style={{ padding: '1rem', maxWidth: 800, margin: '0 auto' }}>
      <Link to="/tournaments">← {t('tournaments.title')}</Link>
      <h1>
        {tournament.hasPassword && <span title={t('tournaments.passwordProtected')}>🔒 </span>}
        {tournament.name}
      </h1>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>
        {t('tournaments.createdBy')} <strong>{tournament.createdByUsername}</strong>
        {' · '}{tournament.registeredUsersCount} {t('tournaments.users')}
      </p>
      <p>
        {t(`tournaments.format${tournament.format === 'swiss' ? 'Swiss' : 'Eliminatory'}`)} ·{' '}
        {t(`tournaments.status.${tournament.status}`)}
        {tournament.activeRound > 0 && ` · ${t('tournaments.round')} ${tournament.activeRound}`}
      </p>

      {actionError && <p style={{ color: 'red' }}>{actionError}</p>}

      {/* Registration actions */}
      {isRegistrationOpen && (
        <div style={{ marginBottom: '1rem', border: '1px solid #ccc', padding: '1rem', borderRadius: 8 }}>
          <h3>{t('tournaments.register')}</h3>
          {tournament.hasPassword && (
            <div style={{ marginBottom: '0.5rem' }}>
              <input
                type="password"
                placeholder={t('tournaments.enterPassword')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ marginRight: '0.5rem' }}
              />
            </div>
          )}
          <div style={{ marginBottom: '0.5rem' }}>
            <input
              placeholder={t('tournaments.partnerIdPlaceholder')}
              value={partnerId}
              onChange={(e) => setPartnerId(e.target.value)}
              style={{ marginRight: '0.5rem' }}
            />
            <button
              disabled={actionLoading || !partnerId.trim()}
              onClick={() => doAction(() => api.tournaments.registerCouple(id!, partnerId.trim(), token, password || undefined))}
            >
              {t('tournaments.registerCouple')}
            </button>
          </div>
          <button
            disabled={actionLoading}
            onClick={() => doAction(() => api.tournaments.registerSolo(id!, token, password || undefined))}
          >
            {t('tournaments.registerSolo')}
          </button>
        </div>
      )}

      {/* Admin actions */}
      {isCreator && (
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isRegistrationOpen && (
            <>
              <button disabled={actionLoading} onClick={() => doAction(() => api.tournaments.pairSolos(id!, token))}>
                {t('tournaments.pairSolos')}
              </button>
              <button disabled={actionLoading} onClick={() => doAction(() => api.tournaments.start(id!, token))}>
                {t('tournaments.start')}
              </button>
            </>
          )}
          {isInProgress && (
            <>
              <button disabled={actionLoading} onClick={() => doAction(() => api.tournaments.nextRound(id!, token))}>
                {t('tournaments.nextRound')}
              </button>
              <button disabled={actionLoading} onClick={() => doAction(() => api.tournaments.finalize(id!, token))}>
                {t('tournaments.finalize')}
              </button>
            </>
          )}
        </div>
      )}

      {/* Classification Board */}
      <h2>{t('tournaments.classification')}</h2>
      <ClassificationTable couples={couples} t={t} />

      {/* Rounds */}
      {rounds.length > 0 && (
        <>
          <h2>{t('tournaments.rounds')}</h2>
          {rounds.map((round) => (
            <RoundView key={round.roundNumber} round={round} t={t} />
          ))}
        </>
      )}
    </div>
  );
}

function ClassificationTable({ couples, t }: { couples: TournamentCoupleDTO[]; t: (k: string) => string }) {
  const sorted = [...couples].sort((a, b) => a.position - b.position || b.points - a.points);
  if (sorted.length === 0) return <p>{t('tournaments.noCouples')}</p>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #333' }}>
          <th style={{ textAlign: 'left', padding: '0.3rem' }}>#</th>
          <th style={{ textAlign: 'left', padding: '0.3rem' }}>{t('tournaments.couple')}</th>
          <th style={{ textAlign: 'center', padding: '0.3rem' }}>{t('tournaments.points')}</th>
          <th style={{ textAlign: 'center', padding: '0.3rem' }}>{t('tournaments.won')}</th>
          <th style={{ textAlign: 'center', padding: '0.3rem' }}>{t('tournaments.lost')}</th>
          <th style={{ textAlign: 'center', padding: '0.3rem' }}>{t('tournaments.statusCol')}</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((c) => (
          <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
            <td style={{ padding: '0.3rem' }}>{c.position}</td>
            <td style={{ padding: '0.3rem' }}>{c.user1Username} &amp; {c.user2Username}</td>
            <td style={{ textAlign: 'center', padding: '0.3rem' }}>{c.points}</td>
            <td style={{ textAlign: 'center', padding: '0.3rem' }}>{c.matchesWon}</td>
            <td style={{ textAlign: 'center', padding: '0.3rem' }}>{c.matchesLost}</td>
            <td style={{ textAlign: 'center', padding: '0.3rem', fontSize: '0.8rem' }}>
              {t(`tournaments.coupleStatus.${c.status}`)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RoundView({ round, t }: { round: TournamentRoundDTO; t: (k: string) => string }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3>{t('tournaments.round')} {round.roundNumber}</h3>
      {round.matches.map((m) => (
        <div
          key={m.id}
          style={{
            border: '1px solid #ddd',
            padding: '0.5rem',
            marginBottom: '0.3rem',
            borderRadius: 4,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>
            {m.couple0.user1Username}/{m.couple0.user2Username}
            {' vs '}
            {m.couple1
              ? `${m.couple1.user1Username}/${m.couple1.user2Username}`
              : t('tournaments.bye')}
          </span>
          <span style={{ fontWeight: m.status === 'finished' ? 'bold' : 'normal' }}>
            {m.status === 'finished' || m.status === 'in_progress'
              ? `${m.score0} - ${m.score1}`
              : t(`tournaments.matchStatus.${m.status}`)}
          </span>
        </div>
      ))}
    </div>
  );
}
