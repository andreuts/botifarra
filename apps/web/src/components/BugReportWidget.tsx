import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  BugReportEnvironment,
  CreateBugReportResponse,
} from '@botifarra/shared';
import { api } from '../api/client.js';
import { useSettingsStore } from '../store/settingsStore.js';

type ReportError = 'submitError' | 'unavailable' | 'rateLimit';

function collectEnvironment(appVersion: string): BugReportEnvironment {
  const route = window.location.pathname
    .replace(/^\/match\/[^/]+/, '/match/:id')
    .replace(/^\/tournaments\/[^/]+/, '/tournaments/:id')
    .replace(/^\/news\/admin\/[^/]+(?:\/edit)?$/, '/news/admin/:id')
    .replace(/^\/news\/[^/]+$/, '/news/:id');

  let timeZone = 'unknown';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || timeZone;
  } catch {
    // Time-zone data is optional browser metadata.
  }

  return {
    appVersion,
    route,
    userAgent: navigator.userAgent,
    language: navigator.language,
    timeZone,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    screen: { width: window.screen.width, height: window.screen.height },
    pixelRatio: window.devicePixelRatio || 1,
    online: navigator.onLine,
  };
}

function formatViewport(value: { width: number; height: number }) {
  return `${value.width} × ${value.height}`;
}

interface BugReportWidgetProps {
  appVersion: string;
}

export function BugReportWidget({ appVersion }: BugReportWidgetProps) {
  const { t } = useTranslation();
  const enabled = useSettingsStore((state) => state.bugReportWidgetEnabled);
  const [open, setOpen] = useState(false);
  const [environment, setEnvironment] = useState<BugReportEnvironment | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ReportError | null>(null);
  const [createdIssue, setCreatedIssue] = useState<CreateBugReportResponse | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    const focusFrame = window.requestAnimationFrame(() => titleRef.current?.focus());
    setEnvironment(collectEnvironment(appVersion));

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], summary',
      );
      if (!focusable?.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, appVersion]);

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!environment || submitting || createdIssue) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await api.bugs.report({
        title,
        description,
        stepsToReproduce,
        expectedBehavior,
        actualBehavior,
        environment,
      });
      setCreatedIssue(result);
    } catch (submitError) {
      const code = submitError instanceof Error ? submitError.message : '';
      if (code === 'BUG_REPORTING_UNAVAILABLE') setError('unavailable');
      else if (code === 'BUG_REPORT_RATE_LIMITED') setError('rateLimit');
      else setError('submitError');
    } finally {
      setSubmitting(false);
    }
  }

  if (!enabled) return null;

  return (
    <>
      <button
        ref={triggerRef}
        className="bug-report-trigger"
        type="button"
        aria-label={t('bugReport.trigger')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="bug-report-dialog"
        onClick={() => {
          setError(null);
          setCreatedIssue(null);
          setOpen(true);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 7.5 7 5M15 7.5 17 5M7 10H4M17 10h3M8 15l-2 3m10-3 2 3" />
          <ellipse cx="12" cy="12" rx="5.5" ry="7" />
          <path d="M12 5V3M9 3h6M12 9v4m0 0-2 2m2-2 2 2" />
        </svg>
      </button>

      {open && (
        <div
          className="bug-report-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) handleClose();
          }}
        >
          <section
            ref={dialogRef}
            className="bug-report-dialog"
            id="bug-report-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bug-report-heading"
            tabIndex={-1}
          >
            <header className="bug-report-header">
              <div>
                <h2 id="bug-report-heading">
                  {createdIssue ? t('bugReport.successTitle') : t('bugReport.heading')}
                </h2>
                {!createdIssue && <p>{t('bugReport.intro')}</p>}
              </div>
              <button
                className="bug-report-close"
                type="button"
                aria-label={t('bugReport.close')}
                onClick={handleClose}
              >
                ×
              </button>
            </header>

            {createdIssue ? (
              <div className="bug-report-success" role="status">
                <p>{t('bugReport.successMessage', { number: createdIssue.issueNumber })}</p>
                <a href={createdIssue.issueUrl} target="_blank" rel="noreferrer">
                  {t('bugReport.viewIssue')} ↗
                </a>
                <button className="btn-outline" type="button" onClick={handleClose}>
                  {t('bugReport.close')}
                </button>
              </div>
            ) : (
              <form className="bug-report-form" onSubmit={handleSubmit}>
                <label>
                  {t('bugReport.title')}
                  <input
                    ref={titleRef}
                    value={title}
                    onChange={(event) => setTitle(event.currentTarget.value)}
                    maxLength={120}
                    required
                    placeholder={t('bugReport.titlePlaceholder')}
                  />
                </label>
                <label>
                  {t('bugReport.description')}
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.currentTarget.value)}
                    maxLength={5000}
                    minLength={10}
                    required
                    rows={3}
                    placeholder={t('bugReport.descriptionPlaceholder')}
                  />
                </label>
                <label>
                  {t('bugReport.steps')}
                  <textarea
                    value={stepsToReproduce}
                    onChange={(event) => setStepsToReproduce(event.currentTarget.value)}
                    maxLength={3000}
                    rows={2}
                    placeholder={t('bugReport.stepsPlaceholder')}
                  />
                </label>
                <label>
                  {t('bugReport.expected')}
                  <textarea
                    value={expectedBehavior}
                    onChange={(event) => setExpectedBehavior(event.currentTarget.value)}
                    maxLength={2000}
                    rows={2}
                    placeholder={t('bugReport.expectedPlaceholder')}
                  />
                </label>
                <label>
                  {t('bugReport.actual')}
                  <textarea
                    value={actualBehavior}
                    onChange={(event) => setActualBehavior(event.currentTarget.value)}
                    maxLength={2000}
                    rows={2}
                    placeholder={t('bugReport.actualPlaceholder')}
                  />
                </label>

                <div className="bug-report-environment">
                  <h3>{t('bugReport.environment')}</h3>
                  <p>{t('bugReport.environmentNote')}</p>
                  {environment && (
                    <details>
                      <summary>{t('bugReport.reviewDetails')}</summary>
                      <dl>
                        <div><dt>{t('bugReport.appVersion')}</dt><dd>{environment.appVersion}</dd></div>
                        <div><dt>{t('bugReport.route')}</dt><dd>{environment.route}</dd></div>
                        <div><dt>{t('bugReport.userAgent')}</dt><dd>{environment.userAgent}</dd></div>
                        <div><dt>{t('bugReport.language')}</dt><dd>{environment.language}</dd></div>
                        <div><dt>{t('bugReport.timeZone')}</dt><dd>{environment.timeZone}</dd></div>
                        <div><dt>{t('bugReport.viewport')}</dt><dd>{formatViewport(environment.viewport)}</dd></div>
                        <div><dt>{t('bugReport.screen')}</dt><dd>{formatViewport(environment.screen)}</dd></div>
                        <div><dt>{t('bugReport.pixelRatio')}</dt><dd>{environment.pixelRatio}</dd></div>
                        <div><dt>{t('bugReport.network')}</dt><dd>{t(environment.online ? 'bugReport.online' : 'bugReport.offline')}</dd></div>
                      </dl>
                    </details>
                  )}
                </div>

                {error && <p className="bug-report-error" role="alert">{t(`bugReport.${error}`)}</p>}

                <footer className="bug-report-actions">
                  <button className="btn-outline" type="button" onClick={handleClose}>
                    {t('bugReport.cancel')}
                  </button>
                  <button className="btn-accent" type="submit" disabled={submitting || !environment}>
                    {submitting ? t('bugReport.submitting') : t('bugReport.submit')}
                  </button>
                </footer>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
