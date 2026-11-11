import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { TOWN_CATALOG, type TownOption } from '@botifarra/shared';

interface TownPickerDialogProps {
  open: boolean;
  currentTownId: string | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (townId: string) => void;
}

function normalizeTownQuery(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function formatTown(town: TownOption) {
  return `${town.name} — ${town.region}`;
}

export function TownPickerDialog({
  open,
  currentTownId,
  saving,
  error,
  onClose,
  onSave,
}: TownPickerDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [townValue, setTownValue] = useState('');
  const [selectedTown, setSelectedTown] = useState<TownOption | null>(null);
  const [townOpen, setTownOpen] = useState(false);
  const [activeTownIndex, setActiveTownIndex] = useState(0);
  const [selectionError, setSelectionError] = useState(false);

  const townSuggestions = useMemo(() => {
    const query = normalizeTownQuery(townValue);
    if (query.length < 2) return [];

    return TOWN_CATALOG
      .filter((town) => [town.name, town.region, ...(town.searchTerms ?? [])]
        .some((term) => normalizeTownQuery(term).includes(query)))
      .sort((a, b) => {
        const aStartsWith = normalizeTownQuery(a.name).startsWith(query) ? 0 : 1;
        const bStartsWith = normalizeTownQuery(b.name).startsWith(query) ? 0 : 1;
        return aStartsWith - bStartsWith
          || a.name.localeCompare(b.name, 'ca')
          || a.region.localeCompare(b.region, 'ca');
      })
      .slice(0, 10);
  }, [townValue]);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const town = TOWN_CATALOG.find((option) => option.id === currentTownId) ?? null;
    setSelectedTown(town);
    setTownValue(town ? formatTown(town) : '');
    setTownOpen(false);
    setActiveTownIndex(0);
    setSelectionError(false);
    inputRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, currentTownId]);

  if (!open) return null;

  function selectTown(town: TownOption) {
    setSelectedTown(town);
    setTownValue(formatTown(town));
    setTownOpen(false);
    setActiveTownIndex(0);
    setSelectionError(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'input:not(:disabled), button:not(:disabled):not([tabindex="-1"])',
    );
    if (!focusable?.length) return;

    const first = focusable.item(0);
    const last = focusable.item(focusable.length - 1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleTownKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const activeTown = townSuggestions[activeTownIndex];
    if (event.key === 'ArrowDown' && townSuggestions.length > 0) {
      event.preventDefault();
      setTownOpen(true);
      setActiveTownIndex((index) => (index + 1) % townSuggestions.length);
    } else if (event.key === 'ArrowUp' && townSuggestions.length > 0) {
      event.preventDefault();
      setTownOpen(true);
      setActiveTownIndex((index) => (index - 1 + townSuggestions.length) % townSuggestions.length);
    } else if (event.key === 'Enter' && townOpen && activeTown) {
      event.preventDefault();
      selectTown(activeTown);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedTown) {
      setSelectionError(true);
      inputRef.current?.focus();
      return;
    }
    if (selectedTown.id !== currentTownId) onSave(selectedTown.id);
  }

  return createPortal(
    <div
      className="confirm-dialog-overlay town-picker-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="confirm-dialog town-picker-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="confirm-dialog-title">{t('playerProfile.editTownTitle')}</h2>
        <p className="confirm-dialog-message">{t('playerProfile.editTownIntro')}</p>
        <form onSubmit={handleSubmit}>
          <div className="town-picker-field">
            <label htmlFor="profile-town-search">{t('auth.town')}</label>
            <input
              ref={inputRef}
              id="profile-town-search"
              className="town-picker-input"
              type="text"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={townOpen && townValue.trim().length >= 2}
              aria-controls={townOpen && townValue.trim().length >= 2 ? 'profile-town-options' : undefined}
              aria-activedescendant={townOpen && townSuggestions[activeTownIndex]
                ? `profile-town-option-${activeTownIndex}`
                : undefined}
              aria-describedby="profile-town-hint"
              aria-invalid={selectionError}
              placeholder={t('auth.townPlaceholder')}
              value={townValue}
              onFocus={() => setTownOpen(townValue.trim().length >= 2)}
              onBlur={() => setTownOpen(false)}
              onKeyDown={handleTownKeyDown}
              onChange={(event) => {
                setTownValue(event.target.value);
                setSelectedTown(null);
                setTownOpen(true);
                setActiveTownIndex(0);
                setSelectionError(false);
              }}
              required
            />
            {townOpen && townValue.trim().length >= 2 && (
              <div className="town-picker-options" id="profile-town-options" role="listbox" aria-label={t('auth.town')}>
                {townSuggestions.length > 0 ? townSuggestions.map((town, index) => (
                  <button
                    className={`town-picker-option${index === activeTownIndex ? ' is-active' : ''}`}
                    id={`profile-town-option-${index}`}
                    key={town.id}
                    type="button"
                    role="option"
                    aria-selected={index === activeTownIndex}
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectTown(town)}
                  >
                    <span className="town-picker-option-name">{town.name}</span>
                    <span className="town-picker-option-region">{town.region}</span>
                  </button>
                )) : (
                  <p className="town-picker-empty" role="status">{t('auth.townNoResults')}</p>
                )}
              </div>
            )}
            <p id="profile-town-hint" className="town-picker-hint">{t('auth.townHint')}</p>
          </div>
          {(selectionError || error) && (
            <p className="town-picker-error" role="alert">
              {selectionError ? t('auth.townSelectionRequired') : error}
            </p>
          )}
          <div className="confirm-dialog-actions">
            <button className="confirm-dialog-cancel" type="button" disabled={saving} onClick={onClose}>
              {t('playerProfile.cancelTownEdit')}
            </button>
            <button
              className="confirm-dialog-confirm"
              type="submit"
              disabled={saving || !selectedTown || selectedTown.id === currentTownId}
            >
              {saving ? t('playerProfile.savingTown') : t('playerProfile.saveTown')}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
