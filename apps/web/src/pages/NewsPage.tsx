import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';

export function NewsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ['news', page],
    queryFn: () => api.news.list({ page, limit }),
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  return (
    <div className="page">
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link to="/" style={{ textDecoration: 'none', color: 'var(--color-accent)' }}>
          {t('nav.back')}
        </Link>
        <h1 style={{ margin: 0 }}>{t('news.heading')}</h1>
      </header>

      {isLoading && <p style={{ color: 'var(--color-muted)' }}>{t('news.loading')}</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{t('news.error')}</p>}

      {data && data.posts.length === 0 && (
        <p style={{ color: 'var(--color-muted)' }}>{t('news.empty')}</p>
      )}

      {data && data.posts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {data.posts.map((post) => (
            <article
              key={post.id}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                gap: '1.25rem',
              }}
            >
              {post.featuredImageUrl && (
                <img
                  src={post.featuredImageUrl}
                  alt=""
                  style={{
                    width: 120,
                    height: 80,
                    objectFit: 'cover',
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  to={`/news/${post.id}`}
                  style={{ color: 'var(--color-gold)', textDecoration: 'none' }}
                >
                  <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.1rem' }}>{post.title}</h2>
                </Link>
                {post.excerpt && (
                  <p style={{ margin: '0 0 0.6rem', color: 'var(--color-muted)', fontSize: '0.9rem' }}>
                    {post.excerpt}
                  </p>
                )}
                <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {post.publishedAt && (
                    <span>
                      {t('news.publishedAt', {
                        date: new Date(post.publishedAt).toLocaleDateString(),
                      })}
                    </span>
                  )}
                  {post.authorUsername && (
                    <span>{t('news.by', { author: post.authorUsername })}</span>
                  )}
                </div>
                <Link
                  to={`/news/${post.id}`}
                  style={{ color: 'var(--color-accent)', textDecoration: 'none', fontSize: '0.85rem', marginTop: '0.5rem', display: 'inline-block' }}
                >
                  {t('news.readMore')}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem', alignItems: 'center' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary"
          >
            ← Anterior
          </button>
          <span style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn btn-secondary"
          >
            Següent →
          </button>
        </div>
      )}
    </div>
  );
}
