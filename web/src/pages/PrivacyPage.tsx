/**
 * PrivacyPage — the data-handling commitment spelled out in plain language.
 *
 * Content here is grounded in:
 *   - PRD §3.1 S8 ("users can read a clear privacy notice before they start")
 *   - Architecture §11 ("no accounts, no PII collection, no third-party
 *     tracking, no cookies, no server-side history")
 *   - Constraints.md ("server must not persist or share input data")
 *
 * We deliberately avoid legalese. The point is to make the commitment
 * legible to a non-lawyer in under 60 seconds.
 */
import { Link } from 'react-router-dom';
import './PrivacyPage.css';

export function PrivacyPage() {
  return (
    <main className="privacy" data-testid="privacy">
      <h1>Your privacy on RelocateWise</h1>
      <p className="privacy__lead">
        RelocateWise ranks cities based on your answers. We do not collect
        personal information. There is no account, no email, and no
        third-party tracking.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>The answers you give</strong> in the questionnaire
            (climate preference, cost priorities, career industry, etc.).
          </li>
          <li>
            <strong>Nothing else.</strong> No name, no email, no IP-based
            profile, no advertising ID.
          </li>
        </ul>
      </section>

      <section>
        <h2>What we do with it</h2>
        <ul>
          <li>
            We send your answers to our matching engine, which returns a
            ranked list of cities.
          </li>
          <li>
            The engine runs in a single request — your answers are not
            stored on our servers and are not used to train any model.
          </li>
          <li>
            The shortlist you build for comparison lives only in your
            browser tab. Refreshing the page clears it.
          </li>
        </ul>
      </section>

      <section>
        <h2>What we never do</h2>
        <ul>
          <li>We never sell or share your data.</li>
          <li>We never set tracking cookies or third-party analytics.</li>
          <li>We never require you to sign up.</li>
        </ul>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          If you have a privacy question, open an issue on the public
          repository that hosts this project. There is no support inbox
          collecting emails.
        </p>
      </section>

      <footer className="privacy__footer">
        <Link to="/">← Back to the homepage</Link>
      </footer>
    </main>
  );
}
