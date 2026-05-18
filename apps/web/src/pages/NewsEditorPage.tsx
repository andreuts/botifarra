import { useState, useCallback, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link_ from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { api } from '../api/client.js';

const STORED_SECRET_KEY = 'botifarra-admin-secret';

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function Toolbar({
  editor,
  adminSecret,
  t,
}: {
  editor: ReturnType<typeof useEditor>;
  adminSecret: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  if (!editor) return null;

  const btn = (active: boolean): React.CSSProperties => ({
    padding: '0.25rem 0.5rem',
    background: active ? 'var(--color-accent)' : 'var(--color-surface-2)',
    color: active ? '#111' : 'var(--color-text)',
    border: '1px solid var(--color-border)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: active ? 700 : 400,
  });

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError('');
    try {
      const { url } = await api.news.adminUpload(adminSecret, file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      setUploadError(t('news.admin.uploadError'));
    } finally {
      setUploading(false);
    }
  }

  function insertImageUrl() {
    if (imageUrlInput.trim()) {
      editor.chain().focus().setImage({ src: imageUrlInput.trim() }).run();
      setImageUrlInput('');
      setShowImageDialog(false);
    }
  }

  function setLink() {
    const url = window.prompt('URL:');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.3rem',
        padding: '0.5rem',
        background: 'var(--color-surface-2)',
        borderRadius: '4px 4px 0 0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <button style={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} type="button"><b>B</b></button>
      <button style={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} type="button"><i>I</i></button>
      <button style={btn(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()} type="button"><s>S</s></button>
      <span style={{ borderLeft: '1px solid var(--color-border)', margin: '0 0.2rem' }} />
      <button style={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} type="button">H2</button>
      <button style={btn(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} type="button">H3</button>
      <span style={{ borderLeft: '1px solid var(--color-border)', margin: '0 0.2rem' }} />
      <button style={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()} type="button">• Lista</button>
      <button style={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()} type="button">1. Lista</button>
      <button style={btn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()} type="button">❝</button>
      <button style={btn(editor.isActive('codeBlock'))} onClick={() => editor.chain().focus().toggleCodeBlock().run()} type="button">{"</>"}</button>
      <span style={{ borderLeft: '1px solid var(--color-border)', margin: '0 0.2rem' }} />
      <button style={btn(editor.isActive('link'))} onClick={setLink} type="button">🔗</button>
      {editor.isActive('link') && (
        <button style={btn(false)} onClick={() => editor.chain().focus().unsetLink().run()} type="button">🔗✕</button>
      )}
      <span style={{ borderLeft: '1px solid var(--color-border)', margin: '0 0.2rem' }} />
      {/* Image upload */}
      <button
        style={btn(false)}
        type="button"
        onClick={() => setShowImageDialog((v) => !v)}
        disabled={uploading}
      >
        {uploading ? '…' : '🖼'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
          e.target.value = '';
        }}
      />
      {showImageDialog && (
        <div
          style={{
            position: 'absolute',
            zIndex: 10,
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            minWidth: 280,
            marginTop: 36,
          }}
        >
          <strong style={{ fontSize: '0.85rem' }}>{t('news.admin.insertImage')}</strong>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type="text"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              placeholder={t('news.admin.imageUrl')}
              style={{
                flex: 1,
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                color: 'var(--color-text)',
                padding: '0.3rem 0.5rem',
                fontSize: '0.8rem',
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') insertImageUrl(); }}
            />
            <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }} onClick={insertImageUrl}>
              {t('news.admin.insert')}
            </button>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>— or —</span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem' }}
            onClick={() => { fileInputRef.current?.click(); setShowImageDialog(false); }}
          >
            {t('news.admin.uploadImage')}
          </button>
          {uploadError && <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', margin: 0 }}>{uploadError}</p>}
          <button type="button" style={{ ...btn(false), fontSize: '0.75rem' }} onClick={() => setShowImageDialog(false)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor page
// ---------------------------------------------------------------------------

export function NewsEditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEditing = !!id;
  const qc = useQueryClient();

  const [adminSecret] = useState(() => sessionStorage.getItem(STORED_SECRET_KEY) ?? '');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [previewHtml, setPreviewHtml] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      Link_.configure({ openOnClick: false, defaultProtocol: 'https' }),
      Placeholder.configure({ placeholder: 'Write your news post here…' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        style: 'min-height:320px;padding:1rem;outline:none;',
      },
    },
  });

  // Load existing post when editing
  useQuery({
    queryKey: ['news-admin-edit', id],
    queryFn: () => api.news.get(id!),
    enabled: isEditing,
    staleTime: Infinity,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: (data: any) => data,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    placeholderData: undefined as any,
    // Set state when data loads
    // @ts-ignore - using onSuccess via refetchOnWindowFocus:false
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  // Separate effect-like query to hydrate form
  useQuery({
    queryKey: ['news-admin-hydrate', id],
    queryFn: async () => {
      const data = await api.news.get(id!);
      setTitle(data.title);
      setExcerpt(data.excerpt ?? '');
      setFeaturedImageUrl(data.featuredImageUrl ?? '');
      editor?.commands.setContent(data.bodyHtml);
      return data;
    },
    enabled: isEditing && !!editor,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const bodyHtml = editor?.getHTML() ?? '';
      if (!title.trim()) throw new Error(t('news.admin.title') + ' required');
      const payload = {
        title: title.trim(),
        bodyHtml,
        excerpt: excerpt.trim() || undefined,
        featuredImageUrl: featuredImageUrl.trim() || undefined,
        isPublished: publish,
      };
      if (isEditing) {
        return api.news.adminUpdate(adminSecret, id!, payload);
      }
      return api.news.adminCreate(adminSecret, payload);
    },
    onSuccess: (data) => {
      setStatusMessage(t('news.admin.saveSuccess'));
      void qc.invalidateQueries({ queryKey: ['news'] });
      if (!isEditing) {
        navigate(`/news/admin/${data.id}/edit`);
      }
    },
    onError: () => setStatusMessage(t('news.admin.saveError')),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.news.adminDelete(adminSecret, id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['news'] });
      navigate('/news/admin');
    },
    onError: () => setStatusMessage(t('news.admin.deleteError')),
  });

  const handlePreview = useCallback(() => {
    setPreviewHtml(editor?.getHTML() ?? '');
    setTab('preview');
  }, [editor]);

  return (
    <div className="page">
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Link to="/news/admin" style={{ textDecoration: 'none', color: 'var(--color-accent)' }}>
          ← {t('news.admin.manageNews')}
        </Link>
        <h1 style={{ margin: 0, fontSize: '1.2rem' }}>
          {isEditing ? t('news.admin.editPost') : t('news.admin.newPost')}
        </h1>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Title */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--color-muted)' }}>
            {t('news.admin.title')} *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('news.admin.titlePlaceholder')}
            maxLength={255}
            style={{
              width: '100%',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              color: 'var(--color-text)',
              padding: '0.6rem 0.9rem',
              fontSize: '1rem',
            }}
          />
        </div>

        {/* Featured image */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--color-muted)' }}>
            {t('news.admin.featuredImage')}
          </label>
          <input
            type="url"
            value={featuredImageUrl}
            onChange={(e) => setFeaturedImageUrl(e.target.value)}
            placeholder={t('news.admin.featuredImagePlaceholder')}
            style={{
              width: '100%',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              color: 'var(--color-text)',
              padding: '0.5rem 0.8rem',
              fontSize: '0.9rem',
            }}
          />
        </div>

        {/* Excerpt */}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--color-muted)' }}>
            {t('news.admin.excerpt')}
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder={t('news.admin.excerptPlaceholder')}
            rows={2}
            style={{
              width: '100%',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              color: 'var(--color-text)',
              padding: '0.5rem 0.8rem',
              fontSize: '0.9rem',
              resize: 'vertical',
            }}
          />
        </div>

        {/* Editor tabs */}
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0' }}>
            <button
              type="button"
              onClick={() => setTab('write')}
              style={{
                padding: '0.4rem 0.9rem',
                background: tab === 'write' ? 'var(--color-surface)' : 'transparent',
                border: '1px solid var(--color-border)',
                borderBottom: tab === 'write' ? '1px solid var(--color-surface)' : '1px solid var(--color-border)',
                borderRadius: '4px 4px 0 0',
                color: 'var(--color-text)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                marginBottom: '-1px',
              }}
            >
              {t('news.admin.write')}
            </button>
            <button
              type="button"
              onClick={handlePreview}
              style={{
                padding: '0.4rem 0.9rem',
                background: tab === 'preview' ? 'var(--color-surface)' : 'transparent',
                border: '1px solid var(--color-border)',
                borderBottom: tab === 'preview' ? '1px solid var(--color-surface)' : '1px solid var(--color-border)',
                borderRadius: '4px 4px 0 0',
                color: 'var(--color-text)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                marginBottom: '-1px',
              }}
            >
              {t('news.admin.preview')}
            </button>
          </div>

          <div
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: '0 var(--radius) var(--radius) var(--radius)',
              background: 'var(--color-surface)',
              position: 'relative',
            }}
          >
            {tab === 'write' ? (
              <>
                <Toolbar editor={editor} adminSecret={adminSecret} t={t} />
                <EditorContent
                  editor={editor}
                  style={{ minHeight: 320 }}
                />
              </>
            ) : (
              <div
                className="news-body"
                style={{ padding: '1rem', minHeight: 320 }}
                // Preview of the already-sanitized HTML the server will store
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(true)}
          >
            {saveMutation.isPending ? t('news.admin.saving') : t('news.admin.publish')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(false)}
          >
            {t('news.admin.saveDraft')}
          </button>
          {isEditing && (
            <button
              type="button"
              className="btn"
              style={{ background: 'var(--color-danger)', color: '#fff', border: 'none' }}
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(t('news.admin.deleteConfirm', { title }))) {
                  deleteMutation.mutate();
                }
              }}
            >
              {t('news.admin.delete')}
            </button>
          )}
          {statusMessage && (
            <span
              style={{
                fontSize: '0.85rem',
                color: statusMessage.includes('Error') ? 'var(--color-danger)' : 'var(--color-success)',
              }}
            >
              {statusMessage}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
