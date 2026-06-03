/**
 * LandingPage — the entry point of the RelocateWise journey.
 *
 * Per Vision.md and PRD §4.1 the homepage is intentionally restrained:
 * a single sentence that promises the value, one CTA that routes to the
 * questionnaire, and a privacy link so the data-handling commitment is
 * visible before the user even starts. No marketing copy, no social
 * proof, no signup wall (PRD S8 / AC-7: zero account, zero PII capture).
 */
import { Link } from 'react-router-dom';
import './LandingPage.css';

export function LandingPage() {
  return (
    <main className="landing" data-testid="landing">
      <section className="landing__hero">
        <h1 className="landing__title">
          Find a city that fits how you actually want to live.
        </h1>
        <p className="landing__sub">
          Answer ~10 quick questions about climate, cost, career, and
          community. We rank 40 cities against your priorities and show
          you the best matches — no account, no email, no tracking.
        </p>
        <Link
          to="/q"
          className="btn btn--primary landing__cta"
          data-testid="landing-cta"
        >
          Start the questionnaire
        </Link>
        <p className="landing__note">
          Takes about two minutes. Your answers stay on this device.
        </p>
      </section>
      <footer className="landing__footer">
        <Link to="/privacy" className="landing__privacy-link">
          How your data is handled
        </Link>
      </footer>
    </main>
  );
}
