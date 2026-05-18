# News page (News feed)

Status: Draft

## Summary

Add a News page where all users can read published news posts. Only users with the `admin` role may create, edit and delete news posts using an HTML/WYSIWYG editor that supports formatting, images and links.

## Goals

- Provide a public, read-only news feed accessible to all users (authenticated or not).
- Allow `admin` role to create rich HTML content (formatting, images, links) via a WYSIWYG/HTML editor.
- Ensure all stored HTML is sanitized server-side to prevent XSS and unsafe embeds.
- Support image uploads via a secure upload endpoint (uploads return safe CDN/hosted URLs).

## Non-Goals

- Comments, reactions, or subscription/notification features (out of scope for initial work).

## User Stories

- As any user, I can view a list of published news posts and read a full post detail.
- As an admin, I can create a new news post using a rich-text/HTML editor, include images and links, and publish it.
- As an admin, I can edit and delete my news posts.

## Roles & Permissions

- `admin`: full CRUD on news posts and access to upload API.
- `any user` (including unauthenticated): can GET list and GET single news post.

Enforcement: server-side middleware must verify the `admin` role on POST/PUT/DELETE and on upload endpoints.

## UI / UX

- Public news index: `/news`
  - Lists published posts in reverse-chronological order.
  - Each card shows: title, excerpt (auto-generated or optional field), published date, author, optional thumbnail.
  - Pagination or infinite scroll; API supports `limit` and `offset` or cursor.

- Post detail: `/news/:id` or `/news/:slug`
  - Renders `title`, `author`, `published_at`, and sanitized `body_html`.

- Admin editor: `/admin/news/new` and `/admin/news/:id/edit`
  - WYSIWYG/HTML editor (examples: TipTap/ProseMirror, Quill, CKEditor). The editor should provide controls for headings, lists, bold/italic, links, image insert/upload, code blocks and blockquotes.
  - Image insertion: two options — paste an external URL (validated) or upload via `POST /api/admin/uploads` which returns a secure hosted URL to embed.
  - Preview mode: admin can preview the sanitized rendered HTML before publishing.

## Data model (suggested)

- `news_post`
  - `id` (uuid)
  - `title` (string, required, max 255)
  - `slug` (string, unique, indexed)
  - `body_html` (text) — store raw HTML produced by the editor
  - `excerpt` (string, optional) — if absent, derive from body_html
  - `author_id` (uuid)
  - `is_published` (boolean)
  - `published_at` (datetime, nullable)
  - `featured_image_url` (string, nullable)
  - `created_at`, `updated_at`

Attachments or images may be stored separately (file metadata table) but surfaced via URLs in `body_html` and `featured_image_url`.

## API Contract

Public endpoints (read-only):

- `GET /api/news?limit=20&offset=0` — returns list of published posts (id, title, excerpt, slug, featured_image_url, published_at, author{name,id}).
- `GET /api/news/:id` or `GET /api/news/slug/:slug` — returns full post including `body_html`.

Admin endpoints (require `admin` role):

- `POST /api/admin/news` — create post. Body: `{ title, body_html, excerpt?, is_published?, published_at?, featured_image_url? }`.
- `PUT /api/admin/news/:id` — update post.
- `DELETE /api/admin/news/:id` — delete post.
- `POST /api/admin/uploads` — accepts multipart/form-data image file, stores it and returns `{ url }` for embedding.

Authentication: admin endpoints require auth token and role check. Public endpoints should optionally return user-specific fields only when requested with an authenticated token.

## HTML Sanitization & Security

- Server-side sanitization is required for any submitted `body_html`. Client-side sanitization is helpful for UX but never trusted.
- Recommended libraries: `DOMPurify` (server-side DOMPurify or node-dompurify via jsdom) or `sanitize-html`.
- Allow-list approach: whitelist tags and attributes rather than blacklisting.
  - Allowed tags (example): `p, br, h1,h2,h3,h4,h5,h6, strong, em, u, ol, ul, li, a, img, blockquote, pre, code, table, thead, tbody, tr, th, td`.
  - Allowed attributes: `href` (on `a`), `src, alt, title` (on `img`), `title` (generic). Strip `style` unless a tightly controlled subset is required.
  - Strictly strip event handlers (`on*` attributes), `<script>` tags, and inline JavaScript in URLs (`javascript:`). Normalize links: add `rel="noopener noreferrer"` for `target="_blank"`.
  - Disallow or strictly validate `<iframe>` embeds; prefer oEmbed or sanitized provider-based embedding.

- Input validation:
  - Max length for `title` and `body_html` (e.g. 100k chars) to avoid abuse.
  - Validate uploaded images by MIME type and size; scan for malware if available.

## Image handling

- Provide `POST /api/admin/uploads` for image uploads. The endpoint should:
  - Require admin auth.
  - Accept common image types and limit file size.
  - Return a secure, CORS-friendly URL (prefer HTTPS) suitable for embedding in `img` tags.
  - Optionally store image metadata in DB (uploader, original filename, size, created_at).

- When embedding external images (editor paste of external URL): validate protocol (https) and optionally proxy images through our CDN or allow only whitelisted hosts.

## Accessibility

- Ensure rendered HTML uses semantic elements, images include `alt` text, and editor encourages accessible content.

## Testing & Acceptance Criteria

- Public listing: visiting `/news` shows only published posts; pagination works.
- Post detail: the full post renders HTML as expected (headings, lists, links, images).
- Admin posting: an `admin` can create a post with formatted content and images via the editor and publish it; the post appears on `/news`.
- Permission enforcement: non-admin attempts to POST/PUT/DELETE or upload must be rejected with 403.
- Sanitization: attempts to submit `<script>` tags, `onerror`/`onclick` attributes, or `javascript:` URLs must not execute and must be removed from stored `body_html`.
- Image upload: uploading an image returns a URL and the image appears in the post detail.

Suggested tests:

- Unit tests for sanitization (inputs with XSS payloads are sanitized).
- Integration tests: create post as admin, fetch list as anonymous user, verify content and images render.

## Implementation notes

- Editor: pick an editor that outputs HTML and is compatible with the web app stack (TipTap, Quill, TinyMCE, CKEditor). Prefer TipTap for modern React + ProseMirror flows.
- Server sanitize: use robust server-side sanitizer (DOMPurify or sanitize-html) and document the allowlist.
- Storage: reuse existing file storage/asset pipeline; prefer returning stable CDN URLs for uploaded images.
- Consider adding drafts and scheduled publishing later as enhancements.

## Acceptance checklist (quick)

- [ ] Public news index page (`/news`) implemented
- [ ] Post detail page implemented
- [ ] Admin editor available and creates sanitized `body_html`
- [ ] Admin image upload API implemented
- [ ] Permission checks enforced on admin endpoints
- [ ] Sanitization unit tests and integration tests added
