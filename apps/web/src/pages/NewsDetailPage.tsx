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
    <div className="section-page news-page news-detail-page">
      <header className="section-page-header">
        <div className="section-page-title">
          <Link to="/news" className="section-page-back">
            {t('news.backToNews')}
          </Link>
          <h2>{t('news.heading')}</h2>
        </div>
        <img className="section-page-card" src="/cards/01-bastos.png" alt="" />
      </header>

      {isLoading && <p className="section-page-message">{t('news.loading')}</p>}
      {error && <p className="section-page-message is-error">{t('news.error')}</p>}

      {!isLoading && !error && !data && (
        <p className="section-page-message">{t('news.notFound')}</p>
      )}

      {data && (
        <article className="news-detail-panel">
          {data.featuredImageUrl && (
            <img
              src={data.featuredImageUrl}
              alt=""
              className="news-detail-cover"
            />
          )}
          <h1 className="news-detail-title">{data.title}</h1>
          <div className="news-detail-meta">
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
            dangerouslySetInnerHTML={{ __html: data.bodyHtml }}
          />
        </article>
      )}
    </div>
  );
}
