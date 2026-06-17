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
 * The "Start Questionnaire" CTA routes to /q. No marketing copy,
 * no social proof, no signup wall (PRD S8 / AC-7).
 */
import { Link } from 'react-router-dom';
import './LandingPage.css';

export function LandingPage() {
  return (
    <main className="landing" data-testid="landing">
      <section className="landing__hero">
        <h1 className="landing__title">Find Your Next Home, Powered by Data.</h1>
        <p className="landing__sub">
          Answer a 5-minute questionnaire and get objective city
          recommendations tailored to your budget, climate, and lifestyle.
        </p>
        <Link
          to="/q"
          className="btn btn--primary landing__cta"
          data-testid="landing-cta"
        >
          Start the questionnaire
        </Link>
        <p className="landing__note">
          No sign-up, no email, no tracking. Your answers stay on this
          device.
        </p>
      </section>

      <section className="landing__values" data-testid="landing-values">
        <ValueProp
          title="Objective matching"
          body="No sponsor bias. Rankings come from primary open data (UN, OECD, Numbeo, government portals)."
          testid="value-objective"
        />
        <ValueProp
          title="Deep comparisons"
          body="Compare 2–3 cities side-by-side on 8 dimensions, with the best match in each row highlighted."
          testid="value-comparisons"
        />
        <ValueProp
          title="Privacy first"
          body="No account, no tracking cookies, no email capture. The whole experience is state-free on the server."
          testid="value-privacy"
        />
      </section>

      <footer className="landing__footer">
        <Link to="/privacy" className="landing__privacy-link">
          How your data is handled
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
