import { useTranslation } from 'react-i18next';

export function RulesPage() {
  const { t } = useTranslation();

  return (
    <main className="section-page rules-page">
      <header className="section-page-header rules-page-header">
        <div className="section-page-title">
          <p className="rules-page-kicker">{t('rules.kicker')}</p>
          <h1>{t('rules.heading')}</h1>
          <p className="rules-page-intro">{t('rules.intro')}</p>
        </div>
        <img className="section-page-card" src="/cards/botifarra.png" alt="" />
      </header>

      <div className="rules-content-grid">
        <section className="rules-card rules-card--wide" aria-labelledby="rules-play-heading">
          <h2 id="rules-play-heading">{t('rules.playHeading')}</h2>
          <ul className="rules-list">
            <li>{t('rules.followSuitText')}</li>
            <li>{t('rules.beatText')}</li>
            <li>{t('rules.lowCardText')}</li>
            <li>{t('rules.secondPlayerText')}</li>
          </ul>
        </section>

        <section className="rules-card" aria-labelledby="rules-cards-heading">
          <h2 id="rules-cards-heading">{t('rules.cardsHeading')}</h2>
          <p>{t('rules.pointCardsText')}</p>
        </section>

        <section className="rules-card" aria-labelledby="rules-botifarra-heading">
          <h2 id="rules-botifarra-heading">{t('rules.botifarraTitle')}</h2>
          <p>{t('rules.botifarraText')}</p>
        </section>
      </div>

      <p className="rules-variant-note">{t('rules.variantNote')}</p>
      <p className="rules-source">
        {t('rules.source')}{' '}
        <a href="https://www.cccj.es/reglaments/botifarra.htm" target="_blank" rel="noreferrer">
          {t('rules.sourceLink')}
        </a>
      </p>
    </main>
  );
}
