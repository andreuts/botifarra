import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { AuthLayout } from '../components/AuthLayout.js';

export function RegisterPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await api.auth.register({ username, password });
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registrationFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t('auth.createAccount')} intro={t('auth.registerIntro')}>
      <form className="auth-form" onSubmit={handleSubmit}>
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
