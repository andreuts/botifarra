/**
 * News routes.
 *
 * Public endpoints:
 *   GET  /api/news          — list published posts (paginated)
 *   GET  /api/news/:id      — get a single published post
 *   GET  /api/news/slug/:slug — get a single published post by slug
 *
 * Admin endpoints (protected by X-Admin-Secret header):
 *   GET    /api/news/admin/all          — list all posts (published + drafts)
 *   POST   /api/news/admin              — create post
 *   PUT    /api/news/admin/:id          — update post
 *   DELETE /api/news/admin/:id          — delete post
 *   POST   /api/news/admin/uploads      — upload image, returns { url }
 */

import { join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import sanitizeHtml from 'sanitize-html';
import type {
  NewsPostListDTO,
  NewsPostDetailDTO,
  NewsPostSummaryDTO,
  CreateNewsPostRequest,
  UpdateNewsPostRequest,
} from '@botifarra/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_SECRET = process.env['ADMIN_SECRET'] ?? 'admin-dev-secret';

/** Directory where uploaded images are stored. */
const UPLOADS_DIR = resolve(process.env['UPLOADS_DIR'] ?? join(process.cwd(), 'uploads'));

/** URL prefix used when returning upload URLs. */
const UPLOADS_URL_PREFIX = process.env['UPLOADS_URL_PREFIX'] ?? '/uploads';

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const secret = request.headers['x-admin-secret'];
  if (secret !== ADMIN_SECRET) {
    return reply.status(403).send({ error: 'Forbidden — invalid admin secret' });
  }
}

/** Generate a URL-friendly slug from a title. Ensures uniqueness via a counter suffix. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Sanitize HTML from the editor before storing. */
function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 'u', 's', 'del',
      'ol', 'ul', 'li',
      'a', 'img',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'figure', 'figcaption', 'hr', 'div', 'span',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['class'],
    },
    allowedSchemes: ['https', 'http', 'data'],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          // Force noopener/noreferrer on external links
          ...(attribs['target'] === '_blank'
            ? { rel: 'noopener noreferrer' }
            : {}),
        },
      }),
    },
  });
}

/** Auto-derive a plain-text excerpt from bodyHtml (max 200 chars). */
function deriveExcerpt(html: string): string {
  const plain = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return plain.slice(0, 200).trim();
}

/** Map a Prisma NewsPost to a DTO. */
function toSummary(post: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  publishedAt: Date | null;
  authorUsername: string | null;
  createdAt: Date;
}): NewsPostSummaryDTO {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    featuredImageUrl: post.featuredImageUrl,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    authorUsername: post.authorUsername,
    createdAt: post.createdAt.toISOString(),
  };
}

function toDetail(post: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImageUrl: string | null;
  publishedAt: Date | null;
  authorUsername: string | null;
  createdAt: Date;
  bodyHtml: string;
  updatedAt: Date;
}): NewsPostDetailDTO {
  return {
    ...toSummary(post),
    bodyHtml: post.bodyHtml,
    updatedAt: post.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const newsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Ensure uploads directory exists
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // -----------------------------------------------------------------------
  // Public — GET /api/news
  // -----------------------------------------------------------------------

  app.get<{ Querystring: { page?: string; limit?: string } }>(
    '/',
    async (request, reply) => {
      const page = Math.max(1, parseInt(request.query.page ?? '1', 10));
      const limit = Math.min(50, Math.max(1, parseInt(request.query.limit ?? '20', 10)));

      const [posts, total] = await Promise.all([
        app.prisma.newsPost.findMany({
          where: { isPublished: true },
          orderBy: { publishedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true, title: true, slug: true, excerpt: true,
            featuredImageUrl: true, publishedAt: true, authorUsername: true, createdAt: true,
          },
        }),
        app.prisma.newsPost.count({ where: { isPublished: true } }),
      ]);

      const response: NewsPostListDTO = {
        posts: posts.map(toSummary),
        total,
        page,
        limit,
      };
      return reply.send(response);
    },
  );

  // -----------------------------------------------------------------------
  // Public — GET /api/news/slug/:slug
  // (must be before /:id to avoid route conflicts)
  // -----------------------------------------------------------------------

  app.get<{ Params: { slug: string } }>(
    '/slug/:slug',
    async (request, reply) => {
      const post = await app.prisma.newsPost.findFirst({
        where: { slug: request.params.slug, isPublished: true },
      });
      if (!post) return reply.status(404).send({ error: 'Not found' });
      return reply.send(toDetail(post));
    },
  );

  // -----------------------------------------------------------------------
  // Public — GET /api/news/:id
  // -----------------------------------------------------------------------

  app.get<{ Params: { id: string } }>(
    '/:id',
    async (request, reply) => {
      const post = await app.prisma.newsPost.findFirst({
        where: { id: request.params.id, isPublished: true },
      });
      if (!post) return reply.status(404).send({ error: 'Not found' });
      return reply.send(toDetail(post));
    },
  );

  // -----------------------------------------------------------------------
  // Admin — GET /api/news/admin/all
  // -----------------------------------------------------------------------

  app.get<{ Querystring: { page?: string; limit?: string } }>(
    '/admin/all',
    { onRequest: [requireAdmin] },
    async (request, reply) => {
      const page = Math.max(1, parseInt(request.query.page ?? '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt(request.query.limit ?? '20', 10)));

      const [posts, total] = await Promise.all([
        app.prisma.newsPost.findMany({
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true, title: true, slug: true, excerpt: true,
            featuredImageUrl: true, publishedAt: true, authorUsername: true,
            createdAt: true, isPublished: true,
          },
        }),
        app.prisma.newsPost.count(),
      ]);

      return reply.send({ posts: posts.map(toSummary), total, page, limit });
    },
  );

  // -----------------------------------------------------------------------
  // Admin — POST /api/news/admin   (create)
  // -----------------------------------------------------------------------

  app.post<{ Body: CreateNewsPostRequest }>(
    '/admin',
    { onRequest: [requireAdmin] },
    async (request, reply) => {
      const { title, bodyHtml, excerpt, isPublished, publishedAt, featuredImageUrl } =
        request.body;

      if (!title?.trim()) return reply.status(400).send({ error: 'title is required' });
      if (!bodyHtml) return reply.status(400).send({ error: 'bodyHtml is required' });
      if (title.length > 255) return reply.status(400).send({ error: 'title too long' });
      if (bodyHtml.length > 200_000) return reply.status(400).send({ error: 'bodyHtml too large' });

      const safeHtml = sanitize(bodyHtml);
      const baseSlug = slugify(title);

      // Make slug unique
      let slug = baseSlug;
      let counter = 1;
      while (await app.prisma.newsPost.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${counter++}`;
      }

      const post = await app.prisma.newsPost.create({
        data: {
          title: title.trim(),
          slug,
          bodyHtml: safeHtml,
          excerpt: excerpt?.trim() || deriveExcerpt(safeHtml),
          isPublished: isPublished ?? false,
          publishedAt: isPublished
            ? (publishedAt ? new Date(publishedAt) : new Date())
            : (publishedAt ? new Date(publishedAt) : null),
          featuredImageUrl: featuredImageUrl ?? null,
          authorUsername: null,
        },
      });

      return reply.status(201).send(toDetail(post));
    },
  );

  // -----------------------------------------------------------------------
  // Admin — PUT /api/news/admin/:id   (update)
  // -----------------------------------------------------------------------

  app.put<{ Params: { id: string }; Body: UpdateNewsPostRequest }>(
    '/admin/:id',
    { onRequest: [requireAdmin] },
    async (request, reply) => {
      const { title, bodyHtml, excerpt, isPublished, publishedAt, featuredImageUrl } =
        request.body;

      const existing = await app.prisma.newsPost.findUnique({
        where: { id: request.params.id },
      });
      if (!existing) return reply.status(404).send({ error: 'Not found' });

      if (title !== undefined && title.length > 255)
        return reply.status(400).send({ error: 'title too long' });
      if (bodyHtml !== undefined && bodyHtml.length > 200_000)
        return reply.status(400).send({ error: 'bodyHtml too large' });

      const safeHtml = bodyHtml !== undefined ? sanitize(bodyHtml) : undefined;

      // Re-slug if title changed
      let slug = existing.slug;
      if (title && title.trim() !== existing.title) {
        const baseSlug = slugify(title.trim());
        slug = baseSlug;
        let counter = 1;
        while (
          await app.prisma.newsPost.findFirst({
            where: { slug, NOT: { id: existing.id } },
          })
        ) {
          slug = `${baseSlug}-${counter++}`;
        }
      }

      const updatedIsPublished = isPublished ?? existing.isPublished;
      let updatedPublishedAt = existing.publishedAt;
      if (publishedAt !== undefined) {
        updatedPublishedAt = publishedAt ? new Date(publishedAt) : null;
      } else if (isPublished === true && !existing.publishedAt) {
        updatedPublishedAt = new Date();
      }

      const post = await app.prisma.newsPost.update({
        where: { id: request.params.id },
        data: {
          ...(title !== undefined ? { title: title.trim(), slug } : {}),
          ...(safeHtml !== undefined
            ? {
                bodyHtml: safeHtml,
                excerpt: excerpt?.trim() || deriveExcerpt(safeHtml),
              }
            : {}),
          ...(excerpt !== undefined ? { excerpt: excerpt.trim() } : {}),
          ...(isPublished !== undefined ? { isPublished: updatedIsPublished } : {}),
          publishedAt: updatedPublishedAt,
          ...(featuredImageUrl !== undefined ? { featuredImageUrl } : {}),
        },
      });

      return reply.send(toDetail(post));
    },
  );

  // -----------------------------------------------------------------------
  // Admin — DELETE /api/news/admin/:id
  // -----------------------------------------------------------------------

  app.delete<{ Params: { id: string } }>(
    '/admin/:id',
    { onRequest: [requireAdmin] },
    async (request, reply) => {
      const existing = await app.prisma.newsPost.findUnique({
        where: { id: request.params.id },
      });
      if (!existing) return reply.status(404).send({ error: 'Not found' });
      await app.prisma.newsPost.delete({ where: { id: request.params.id } });
      return reply.status(204).send();
    },
  );

  // -----------------------------------------------------------------------
  // Admin — POST /api/news/admin/uploads   (image upload)
  // -----------------------------------------------------------------------

  app.post(
    '/admin/uploads',
    { onRequest: [requireAdmin] },
    async (request, reply) => {
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: 'No file uploaded' });

      const allowedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (!allowedMime.includes(data.mimetype)) {
        return reply.status(400).send({ error: 'Unsupported image type' });
      }

      const maxBytes = 5 * 1024 * 1024; // 5 MB
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of data.file) {
        size += chunk.length;
        if (size > maxBytes) {
          return reply.status(413).send({ error: 'File too large (max 5 MB)' });
        }
        chunks.push(chunk as Buffer);
      }

      const ext = data.filename.split('.').pop()?.toLowerCase() ?? 'bin';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const dest = join(UPLOADS_DIR, filename);
      await writeFile(dest, Buffer.concat(chunks));

      const url = `${UPLOADS_URL_PREFIX}/${filename}`;
      return reply.status(201).send({ url });
    },
  );
};
