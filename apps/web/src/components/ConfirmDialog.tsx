import { useEffect, useId, useRef, type KeyboardEvent } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  dangerous?: boolean;
  confirmDisabled?: boolean;
  extraAction?: { label: string; onClick: () => void; dangerous?: boolean };
  errorMessage?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  dangerous = false,
  confirmDisabled = false,
  extraAction,
  errorMessage,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    cancelRef.current?.focus();
    return () => previousFocus?.focus();
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key !== 'Tab') return;
    const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
    if (!buttons?.length) return;

    const first = buttons.item(0);
    const last = buttons.item(buttons.length - 1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="confirm-dialog-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="confirm-dialog-title">{title}</h2>
        <p id={messageId} className="confirm-dialog-message">{message}</p>
        {errorMessage && <p className="confirm-dialog-error" role="alert">{errorMessage}</p>}
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} className="confirm-dialog-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          {extraAction && (
            <button
              className={`confirm-dialog-extra${extraAction.dangerous ? ' is-dangerous' : ''}`}
              onClick={extraAction.onClick}
              disabled={confirmDisabled}
            >
              {extraAction.label}
            </button>
          )}
          <button
            className={`confirm-dialog-confirm${dangerous ? ' is-dangerous' : ''}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
