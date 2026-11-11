import { useTranslation } from 'react-i18next';

const CARD_IMAGES = [
  '/cards/01-oros.png',
  '/cards/01-copas.png',
  '/cards/01-espadas.png',
  '/cards/01-bastos.png',
];

interface AuthLayoutProps {
  title: string;
  intro: string;
  children: React.ReactNode;
}

export function AuthLayout({ title, intro, children }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <main className="auth-page">
      <div className="auth-panel">
        <aside className="auth-brand-panel">
          <div className="auth-brand-lockup">
            <span className="app-nav-mark" aria-hidden="true">B</span>
            <span>{t('app.title')}</span>
          </div>

          <div className="auth-brand-copy">
            <p className="auth-eyebrow">{t('auth.eyebrow')}</p>
            <p className="auth-brand-line">{t('auth.brandLine')}</p>
          </div>

          <div className="auth-card-fan" aria-hidden="true">
            {CARD_IMAGES.map((src) => (
              <img key={src} src={src} alt="" draggable={false} />
            ))}
          </div>
        </aside>

        <section
          className="auth-form-panel"
          aria-labelledby="auth-form-title"
          aria-describedby="auth-form-intro"
        >
          <div className="auth-form-heading">
            <p className="auth-form-eyebrow">{t('auth.eyebrow')}</p>
            <h1 id="auth-form-title">{title}</h1>
            <p id="auth-form-intro" className="auth-form-intro">{intro}</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
