import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';

const STORED_SECRET_KEY = 'botifarra-admin-secret';

export function NewsAdminListPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [adminSecret] = useState(() => sessionStorage.getItem(STORED_SECRET_KEY) ?? '');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['news-admin-all', page],
    queryFn: () => api.news.adminListAll(adminSecret, { page, limit }),
    enabled: !!adminSecret,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.news.adminDelete(adminSecret, id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['news-admin-all'] }),
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  if (!adminSecret) {
    return (
      <div className="page">
        <p style={{ color: 'var(--color-muted)' }}>
          {t('admin.invalidSecret')} — visit <Link to="/admin">/admin</Link> first.
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <header
        style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}
      >
        <Link to="/admin" style={{ textDecoration: 'none', color: 'var(--color-accent)' }}>
          {t('nav.back')}
        </Link>
        <h1 style={{ margin: 0 }}>{t('news.admin.manageNews')}</h1>
        <Link
          to="/news/admin/new"
          className="btn btn-primary"
          style={{ marginLeft: 'auto', textDecoration: 'none', fontSize: '0.85rem' }}
        >
          + {t('news.admin.newPost')}
        </Link>
      </header>

      {isLoading && <p style={{ color: 'var(--color-muted)' }}>{t('news.loading')}</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{t('news.error')}</p>}

      {data && data.posts.length === 0 && (
        <p style={{ color: 'var(--color-muted)' }}>{t('news.empty')}</p>
      )}

      {data && data.posts.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th style={th}>{t('news.admin.title')}</th>
              <th style={th}>Status</th>
              <th style={th}>Published</th>
              <th style={th}>{t('admin.matches.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {data.posts.map((post) => (
              <tr key={post.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={td}>
                  <Link to={`/news/admin/${post.id}/edit`} style={{ color: 'var(--color-gold)' }}>
                    {post.title}
                  </Link>
                </td>
                <td style={td}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 4,
                      background: (post as any).isPublished ? 'var(--color-success)' : 'var(--color-surface-2)',
                      color: (post as any).isPublished ? '#111' : 'var(--color-muted)',
                    }}
                  >
                    {(post as any).isPublished ? t('news.published') : t('news.draft')}
                  </span>
                </td>
                <td style={td}>
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString()
                    : '—'}
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link
                      to={`/news/${post.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--color-accent)', fontSize: '0.8rem' }}
                    >
                      {t('news.admin.newTab')} ↗
                    </Link>
                    <button
                      type="button"
                      style={{
                        background: 'var(--color-danger)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        padding: '0.2rem 0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(t('news.admin.deleteConfirm', { title: post.title }))) {
                          deleteMutation.mutate(post.id);
                        }
                      }}
                    >
                      {t('news.admin.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', alignItems: 'center' }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary">
            ←
          </button>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
            {page} / {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-secondary">
            →
          </button>
        </div>
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
