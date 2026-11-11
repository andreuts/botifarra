import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { TOWN_CATALOG, type TownOption } from '@botifarra/shared';
import { api } from '../api/client.js';
import { AuthLayout } from '../components/AuthLayout.js';

function normalizeTownQuery(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function RegisterPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [townValue, setTownValue] = useState('');
  const [selectedTown, setSelectedTown] = useState<TownOption | null>(null);
  const [townOpen, setTownOpen] = useState(false);
  const [activeTownIndex, setActiveTownIndex] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const townInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

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

  function selectTown(town: TownOption) {
    setSelectedTown(town);
    setTownValue(`${town.name} — ${town.region}`);
    setTownOpen(false);
    setActiveTownIndex(0);
    setError('');
  }

  function handleTownKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const activeTown = townSuggestions[activeTownIndex];
    if (e.key === 'ArrowDown' && townSuggestions.length > 0) {
      e.preventDefault();
      setTownOpen(true);
      setActiveTownIndex((index) => (index + 1) % townSuggestions.length);
    } else if (e.key === 'ArrowUp' && townSuggestions.length > 0) {
      e.preventDefault();
      setTownOpen(true);
      setActiveTownIndex((index) => (index - 1 + townSuggestions.length) % townSuggestions.length);
    } else if (e.key === 'Enter' && townOpen && activeTown) {
      e.preventDefault();
      selectTown(activeTown);
    } else if (e.key === 'Escape') {
      setTownOpen(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedTown) {
      setError(t('auth.townSelectionRequired'));
      townInputRef.current?.focus();
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await api.auth.register({ username, password, townId: selectedTown.id });
      navigate('/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message === 'Town must be selected from the list'
        ? t('auth.townSelectionRequired')
        : message || t('auth.registrationFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t('auth.createAccount')} intro={t('auth.registerIntro')}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group town-autocomplete">
          <label htmlFor="town">{t('auth.town')}</label>
          <input
            ref={townInputRef}
            id="town"
            type="text"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={townOpen && townValue.trim().length >= 2}
            aria-controls={townOpen && townValue.trim().length >= 2 ? 'town-options' : undefined}
            aria-activedescendant={townOpen && townSuggestions[activeTownIndex]
              ? `town-option-${activeTownIndex}`
              : undefined}
            aria-describedby="auth-town-hint"
            aria-invalid={!!error && !selectedTown}
            placeholder={t('auth.townPlaceholder')}
            value={townValue}
            onFocus={() => setTownOpen(townValue.trim().length >= 2)}
            onBlur={() => setTownOpen(false)}
            onKeyDown={handleTownKeyDown}
            onChange={(e) => {
              setTownValue(e.target.value);
              setSelectedTown(null);
              setTownOpen(true);
              setActiveTownIndex(0);
              setError('');
            }}
            required
          />
          {townOpen && townValue.trim().length >= 2 && (
            <div className="town-suggestions" id="town-options" role="listbox" aria-label={t('auth.town')}>
              {townSuggestions.length > 0 ? townSuggestions.map((town, index) => (
                <button
                  className={`town-suggestion${index === activeTownIndex ? ' is-active' : ''}`}
                  id={`town-option-${index}`}
                  key={town.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeTownIndex}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectTown(town)}
                >
                  <span className="town-suggestion-name">{town.name}</span>
                  <span className="town-suggestion-region">{town.region}</span>
                </button>
              )) : (
                <p className="town-suggestions-empty" role="status">{t('auth.townNoResults')}</p>
              )}
            </div>
          )}
          <p id="auth-town-hint" className="auth-field-hint">{t('auth.townHint')}</p>
        </div>
        <div className="form-group">
          <label htmlFor="username">{t('auth.username')}</label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            aria-describedby="auth-username-hint"
          />
          <p id="auth-username-hint" className="auth-field-hint">{t('auth.usernameHint')}</p>
        </div>
        <div className="form-group">
          <label htmlFor="password">{t('auth.password')}</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            required
            minLength={6}
            aria-describedby="auth-password-hint"
          />
          <p id="auth-password-hint" className="auth-field-hint">{t('auth.passwordHint')}</p>
        </div>
        <div className="form-group">
          <label htmlFor="confirm-password">{t('auth.confirmPassword')}</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError('');
            }}
            required
            minLength={6}
            aria-describedby="auth-confirm-password-hint"
          />
          <p id="auth-confirm-password-hint" className="auth-field-hint">
            {t('auth.confirmPasswordHint')}
          </p>
        </div>
        {error && <p className="error-msg" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={loading}>
          {loading ? t('auth.registering') : t('auth.register')}
        </button>
      </form>
      <p className="auth-switch">
        {t('auth.alreadyHaveAccount')} <Link to="/login">{t('auth.signIn')}</Link>
      </p>
    </AuthLayout>
  );
}
