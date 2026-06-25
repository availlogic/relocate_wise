/**
 * ConsentBanner — first-visit consent banner (PRD FR-13, AC-11, AC-12).
 *
 * The MVP collects no personal data and sets no cookies (Architecture §11),
 * so the only thing this banner does is record the user's *intent* in
 * `localStorage` so we can hide the prompt and link to the Privacy page.
 * It does not gate any tracking, because the MVP has none. Future
 * analytics can read the same key to decide whether to load.
 *
 * v0.3.0 changes:
 *   - Storage key renamed from `rw:consent` to `rw:cookie_consent`
 *     to match Functional-Test-Cases FTC-1.
 *   - Banner is now bottom-fixed (Screen-Specs §1 + UI-Layouts §1)
 *     instead of a top strip.
 *
 * Storage key: `rw:cookie_consent` → `"true" | "false"`. The banner is
 * rendered when the key is absent and dismissed on click. FTC-1
 * expects the boolean string `"false"` for decline and `"true"` for
 * accept.
 *
 * All copy is localised via i18next (PRD v3.2.0 S11).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './ConsentBanner.css';

const STORAGE_KEY = 'rw:cookie_consent';
type ConsentState = 'true' | 'false';

function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'true' || raw === 'false') return raw;
  return null;
}

function writeConsent(value: ConsentState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, value);
}

export function ConsentBanner() {
  const { t } = useTranslation();
  // `null` while we don't know yet; `'true' | 'false'` once the
  // user has chosen; `'show'` while the banner is up.
  const [state, setState] = useState<ConsentState | 'show' | 'pending'>(
    'pending',
  );

  useEffect(() => {
    setState(readConsent() ?? 'show');
  }, []);

  if (state !== 'show') return null;

  const choose = (value: ConsentState) => {
    writeConsent(value);
    setState(value);
  };

  return (
    <div
      className="consent-banner"
      role="region"
      aria-label="Consent notice"
      data-testid="consent-banner"
    >
      <p className="consent-banner__text">
        {t('app.consent.text')}{' '}
        <Link to="/privacy" className="consent-banner__link">
          {t('app.consent.readPolicy')}
        </Link>
        .
      </p>
      <div className="consent-banner__actions">
        <button
          type="button"
          className="btn btn--secondary consent-banner__btn"
          onClick={() => choose('false')}
          data-testid="consent-decline"
        >
          {t('app.consent.decline')}
        </button>
        <button
          type="button"
          className="btn btn--primary consent-banner__btn"
          onClick={() => choose('true')}
          data-testid="consent-accept"
        >
          {t('app.consent.accept')}
        </button>
      </div>
    </div>
  );
}