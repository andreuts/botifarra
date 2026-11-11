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
    <div className="section-page news-page">
      <header className="section-page-header">
        <div className="section-page-title">
          <Link to="/" className="section-page-back">
            {t('nav.back')}
          </Link>
          <h1>{t('news.heading')}</h1>
        </div>
        <img className="section-page-card" src="/cards/01-bastos.png" alt="" />
      </header>

      {isLoading && <p className="section-page-message">{t('news.loading')}</p>}
      {error && <p className="section-page-message is-error">{t('news.error')}</p>}

      {data && data.posts.length === 0 && (
        <p className="section-page-message">{t('news.empty')}</p>
      )}

      {data && data.posts.length > 0 && (
        <div className="news-list">
          {data.posts.map((post) => (
            <article key={post.id} className={`news-card${post.featuredImageUrl ? ' has-image' : ''}`}>
              {post.featuredImageUrl && (
                <img
                  src={post.featuredImageUrl}
                  alt=""
                  className="news-card-image"
                />
              )}
              <div className="news-card-content">
                <Link
                  to={`/news/${post.id}`}
                  className="news-card-title-link"
                >
                  <h2>{post.title}</h2>
                </Link>
                {post.excerpt && (
                  <p className="news-card-excerpt">
                    {post.excerpt}
                  </p>
                )}
                <div className="news-card-meta">
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
                  className="news-read-more"
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
        <div className="news-pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-outline news-page-button"
          >
            {t('history.pagination.prev')}
          </button>
          <span className="news-page-count">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-outline news-page-button"
          >
            {t('history.pagination.next')}
          </button>
        </div>
      )}
    </div>
  );
}
