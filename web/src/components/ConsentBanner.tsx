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
 * Storage key: `rw:cookie_consent` → `"accepted" | "declined" | null`.
 * The banner is rendered when the key is absent and dismissed on click.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './ConsentBanner.css';

const STORAGE_KEY = 'rw:cookie_consent';
type ConsentState = 'accepted' | 'declined';

function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === 'accepted' || raw === 'declined') return raw;
  return null;
}

function writeConsent(value: ConsentState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, value);
}

export function ConsentBanner() {
  // `null` while we don't know yet; `'accepted' | 'declined'` once the
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
        We don’t collect personal data and don’t set tracking cookies. We
        only remember this choice on this device.{' '}
        <Link to="/privacy" className="consent-banner__link">
          Read the privacy notice
        </Link>
        .
      </p>
      <div className="consent-banner__actions">
        <button
          type="button"
          className="btn btn--secondary consent-banner__btn"
          onClick={() => choose('declined')}
          data-testid="consent-decline"
        >
          Decline
        </button>
        <button
          type="button"
          className="btn btn--primary consent-banner__btn"
          onClick={() => choose('accepted')}
          data-testid="consent-accept"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
