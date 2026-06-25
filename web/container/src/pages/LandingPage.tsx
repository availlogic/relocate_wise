/**
 * LandingPage — the entry point of the RelocateWise journey.
 *
 * Per PRD v3.1.0 + Screen-Specs §1 + UI-Layouts §2 the homepage has
 * three required components:
 *   1. A hero with the value-prop headline + sub-headline + a single
 *      "Start Questionnaire" primary CTA.
 *   2. A 3-card value-props grid (Objective Matching / Deep
 *      Comparisons / Privacy First).
 *   3. A footer with the privacy link.
 *
 * All copy is localised via i18next (PRD v3.2.0 S11 / Acceptance-
 * Criteria AC-17 / E2E-5). The "Start Questionnaire" CTA routes to
 * /q. No marketing copy, no social proof, no signup wall (PRD S8 /
 * AC-7).
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './LandingPage.css';

export function LandingPage() {
  const { t } = useTranslation();
  return (
    <main className="landing" data-testid="landing">
      <section className="landing__hero">
        <h1 className="landing__title" data-testid="landing-title">
          {t('landing.title')}
        </h1>
        <p className="landing__sub" data-testid="landing-sub">
          {t('landing.sub')}
        </p>
        <Link
          to="/q"
          className="btn btn--primary landing__cta"
          data-testid="landing-cta"
        >
          {t('landing.cta')}
        </Link>
        <p className="landing__note">{t('landing.note')}</p>
      </section>

      <section className="landing__values" data-testid="landing-values">
        <ValueProp
          title={t('landing.values.objective.title')}
          body={t('landing.values.objective.body')}
          testid="value-objective"
        />
        <ValueProp
          title={t('landing.values.comparisons.title')}
          body={t('landing.values.comparisons.body')}
          testid="value-comparisons"
        />
        <ValueProp
          title={t('landing.values.privacy.title')}
          body={t('landing.values.privacy.body')}
          testid="value-privacy"
        />
      </section>

      <footer className="landing__footer">
        <Link to="/privacy" className="landing__privacy-link">
          {t('landing.footer')}
        </Link>
      </footer>
    </main>
  );
}

function ValueProp({
  title,
  body,
  testid,
}: {
  title: string;
  body: string;
  testid: string;
}) {
  return (
    <article className="landing__value" data-testid={testid}>
      <h3 className="landing__value-title">{title}</h3>
      <p className="landing__value-body">{body}</p>
    </article>
  );
}