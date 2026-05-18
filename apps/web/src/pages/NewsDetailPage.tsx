import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';

export function NewsDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['news', id],
    queryFn: () => api.news.get(id!),
    enabled: !!id,
  });

  return (
    <div className="page">
      <header style={{ marginBottom: '2rem' }}>
        <Link
          to="/news"
          style={{ textDecoration: 'none', color: 'var(--color-accent)', fontSize: '0.9rem' }}
        >
          {t('news.backToNews')}
        </Link>
      </header>

      {isLoading && <p style={{ color: 'var(--color-muted)' }}>{t('news.loading')}</p>}
      {error && <p style={{ color: 'var(--color-danger)' }}>{t('news.error')}</p>}

      {!isLoading && !error && !data && (
        <p style={{ color: 'var(--color-muted)' }}>{t('news.notFound')}</p>
      )}

      {data && (
        <article>
          {data.featuredImageUrl && (
            <img
              src={data.featuredImageUrl}
              alt=""
              style={{
                width: '100%',
                maxHeight: 320,
                objectFit: 'cover',
                borderRadius: 'var(--radius)',
                marginBottom: '1.5rem',
              }}
            />
          )}
          <h1 style={{ marginBottom: '0.5rem' }}>{data.title}</h1>
          <div
            style={{
              fontSize: '0.85rem',
              color: 'var(--color-muted)',
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
              marginBottom: '2rem',
            }}
          >
            {data.publishedAt && (
              <span>
                {t('news.publishedAt', {
                  date: new Date(data.publishedAt).toLocaleDateString(),
                })}
              </span>
            )}
            {data.authorUsername && (
              <span>{t('news.by', { author: data.authorUsername })}</span>
            )}
          </div>

          {/* Render sanitized HTML from the server */}
          <div
            className="news-body"
            // The server already sanitizes the HTML — only trusted stored content is rendered.
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
          />
        </article>
      )}
    </div>
  );
}
