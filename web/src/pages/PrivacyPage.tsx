/**
 * PrivacyPage — the data-handling commitment spelled out in plain language.
 *
 * Content here is grounded in:
 *   - PRD §3.1 S8 ("users can read a clear privacy notice before they start")
 *   - Architecture §11 ("no accounts, no PII collection, no third-party
 *     tracking, no cookies, no server-side history")
 *   - Constraints.md ("server must not persist or share input data")
 *
 * All copy is localised via i18next. We deliberately avoid legalese.
 * The point is to make the commitment legible to a non-lawyer in under
 * 60 seconds.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './PrivacyPage.css';

export function PrivacyPage() {
  const { t } = useTranslation();
  return (
    <main className="privacy" data-testid="privacy">
      <h1>{t('privacy.title')}</h1>
      <p className="privacy__lead">{t('privacy.lead')}</p>

      <section>
        <h2>{t('privacy.collectHeading')}</h2>
        <ul>
          <li>
            <strong>{t('privacy.collectAnswers')}</strong>
          </li>
          <li>
            <strong>{t('privacy.collectNothing')}</strong>
          </li>
        </ul>
      </section>

      <section>
        <h2>{t('privacy.useHeading')}</h2>
        <ul>
          <li>{t('privacy.useMatch')}</li>
          <li>{t('privacy.useNoStore')}</li>
          <li>{t('privacy.useShortlist')}</li>
        </ul>
      </section>

      <section>
        <h2>{t('privacy.neverHeading')}</h2>
        <ul>
          <li>{t('privacy.never1')}</li>
          <li>{t('privacy.never2')}</li>
          <li>{t('privacy.never3')}</li>
        </ul>
      </section>

      <section>
        <h2>{t('privacy.contactHeading')}</h2>
        <p>{t('privacy.contact')}</p>
      </section>

      <footer className="privacy__footer">
        <Link to="/">{t('privacy.back')}</Link>
      </footer>
    </main>
  );
}