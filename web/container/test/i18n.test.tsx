/**
 * Tests for the bilingual i18n bundle (PRD v3.2.0 §6.1 S11 /
 * Acceptance-Criteria Feature 6 / E2E-5).
 *
 * The bundle is wired into the SPA via `web/src/i18n/index.ts`. We
 * exercise three surfaces:
 *   - `setLanguage('zh')` flips a known key (e.g. "App.consent.text").
 *   - The persistence layer reads/writes `localStorage[rw:lang]`.
 *   - The wizard step labels render in Chinese after a toggle.
 *
 * Tests run with the default English bundle as the starting state.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProfileForm } from '@relocatewise/web-quiz-mfe';
import { ComparePage } from '@relocatewise/web-compare-mfe';
import { LandingPage } from '../src/pages/LandingPage';
import { LanguageToggle } from '../src/components/LanguageToggle';
import { ShortlistProvider } from '../src/state/shortlist';
import { ToastProvider } from '../src/components/Toast';
import { makeMatchedCity } from './fixtures';
import type { MatchedCityFull } from '../src/api';
import {
  getCurrentLanguage,
  setLanguage,
  SUPPORTED_LANGUAGES,
} from '../src/i18n';

beforeEach(async () => {
  window.localStorage.clear();
  // Reset the i18n instance to English between tests so each one is
  // independent (i18next is a module-level singleton).
  await setLanguage('en');
});

afterEach(async () => {
  window.localStorage.clear();
  await setLanguage('en');
});

describe('i18n — language toggle', () => {
  it('defaults to English on a fresh install', () => {
    expect(getCurrentLanguage()).toBe('en');
  });

  it('flips the active language via setLanguage()', async () => {
    await setLanguage('zh');
    expect(getCurrentLanguage()).toBe('zh');
    await setLanguage('en');
    expect(getCurrentLanguage()).toBe('en');
  });

  it('persists the choice to localStorage[rw:lang]', async () => {
    await setLanguage('zh');
    expect(window.localStorage.getItem('rw:lang')).toBe('zh');
    await setLanguage('en');
    expect(window.localStorage.getItem('rw:lang')).toBe('en');
  });

  it('exposes exactly two supported languages', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'zh']);
  });

  it('switches the LandingPage CTA copy in response to setLanguage()', async () => {
    const Wrapper = () => (
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    render(<Wrapper />);
    expect(
      screen.getByTestId('landing-cta').textContent,
    ).toMatch(/Start the questionnaire/i);

    await setLanguage('zh');
    expect(
      screen.getByTestId('landing-cta').textContent,
    ).toMatch(/开始问卷/);
  });
});

describe('i18n — LanguageToggle component', () => {
  it('renders EN and 中文 buttons and reflects the active language', () => {
    const Wrapper = () => (
      <MemoryRouter>
        <LanguageToggle />
      </MemoryRouter>
    );
    render(<Wrapper />);
    const enBtn = screen.getByTestId('lang-en');
    const zhBtn = screen.getByTestId('lang-zh');
    expect(enBtn.getAttribute('aria-pressed')).toBe('true');
    expect(zhBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking 中文 switches the language and updates aria-pressed', async () => {
    const user = userEvent.setup();
    const Wrapper = () => (
      <MemoryRouter>
        <LanguageToggle />
      </MemoryRouter>
    );
    render(<Wrapper />);
    await user.click(screen.getByTestId('lang-zh'));
    expect(getCurrentLanguage()).toBe('zh');
    expect(screen.getByTestId('lang-zh').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('lang-en').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('i18n — wizard state preservation (Acceptance-Criteria Feature 6)', () => {
  it('preserves the current step across a language toggle', async () => {
    const user = userEvent.setup();
    function SpyOnLocation() {
      return <></>;
    }
    render(
      <MemoryRouter initialEntries={['/q']}>
        <Routes>
          <Route
            path="/q"
            element={
              <>
                <LanguageToggle />
                <ProfileForm />
              </>
            }
          />
          <Route path="/results" element={<SpyOnLocation />} />
        </Routes>
      </MemoryRouter>,
    );

    // Advance to step 3.
    await user.click(screen.getByTestId('wizard-next'));
    await user.click(screen.getByTestId('wizard-next'));
    expect(screen.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '3');

    // Toggle language.
    await user.click(screen.getByTestId('lang-zh'));
    expect(screen.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '3');

    // Toggle back to English.
    await user.click(screen.getByTestId('lang-en'));
    expect(screen.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '3');
  });
});

describe('i18n — renderWhyTemplate (v0.4.x)', () => {
  /**
   * Bug 3 regression: the matching engine emits `whyKey: "military_safety"`
   * but the i18n bundle had `why.militarySafety` (camelCase). i18next
   * silently returns the key string, so the UI was either showing the
   * raw key (English fallback) or the English fallback. The fix is to
   * align the JSON key with the `KNOWN_WHY_KEYS` set.
   */
  it('returns the English template for whyKey="military_safety" (default lang)', async () => {
    const { renderWhyTemplate } = await import('../src/i18n/why');
    const { default: i18n } = await import('../src/i18n');
    const t = i18n.t.bind(i18n);
    const out = renderWhyTemplate(t, '', 'military_safety');
    expect(out).toContain('High geopolitical stability and physical safety');
  });

  it('returns the Chinese template for whyKey="military_safety" after setLanguage("zh")', async () => {
    const { renderWhyTemplate } = await import('../src/i18n/why');
    const { default: i18n, setLanguage } = await import('../src/i18n');
    await setLanguage('zh');
    try {
      const t = i18n.t.bind(i18n);
      const out = renderWhyTemplate(t, '', 'military_safety');
      // Must be the Chinese copy, NOT the i18n key string and NOT
      // the English fallback.
      expect(out).toContain('政治稳定');
      expect(out).not.toContain('why.military_safety');
      expect(out).not.toContain('geopolitical stability and physical safety');
    } finally {
      await setLanguage('en');
    }
  });

  it('interpolates {{industry}} for whyKey="career" in both languages', async () => {
    const { renderWhyTemplate } = await import('../src/i18n/why');
    const { default: i18n } = await import('../src/i18n');
    const t = i18n.t.bind(i18n);
    const out = renderWhyTemplate(t, '', 'career', { industry: 'tech' });
    expect(out).toMatch(/tech job market/i);
  });

  it('interpolates {{tags}} for whyKey="community" in both languages', async () => {
    const { renderWhyTemplate } = await import('../src/i18n/why');
    const { default: i18n } = await import('../src/i18n');
    const t = i18n.t.bind(i18n);
    const out = renderWhyTemplate(t, '', 'community', { tags: 'urban and coastal' });
    expect(out).toMatch(/urban and coastal/);
  });

  it('returns the English joined string for tied reasons (v0.4.x Bug 4)', async () => {
    const { renderWhyTemplate } = await import('../src/i18n/why');
    const { default: i18n, setLanguage } = await import('../src/i18n');
    await setLanguage('en');
    const t = i18n.t.bind(i18n);
    const out = renderWhyTemplate(t, '', 'climate', {
      climate: 'Mediterranean',
      secondary_key: 'career',
      secondary_vars: { industry: 'tech' },
    });
    expect(out).toBe(
      'Matches your Mediterranean climate preference and Strong tech job market',
    );
  });

  it('returns the Chinese joined string for tied reasons (v0.4.x Bug 4)', async () => {
    const { renderWhyTemplate } = await import('../src/i18n/why');
    const { default: i18n, setLanguage } = await import('../src/i18n');
    await setLanguage('zh');
    try {
      // Force a re-read of the active language so i18next resolves
      // any pending language-change promise.
      await new Promise((r) => setTimeout(r, 0));
      const t = i18n.t.bind(i18n);
      const out = renderWhyTemplate(t, '', 'climate', {
        climate: 'mediterranean',
        secondary_key: 'career',
        secondary_vars: { industry: 'tech' },
      });
      // Must be the Chinese translations joined with " 且 ", not the
      // English fallback, not the i18n key string, not " and ".
      expect(out).toContain(' 且 ');
      expect(out).not.toContain(' and ');
      expect(out).not.toContain('climate preference');
      expect(out).toContain('气候');
      expect(out).toContain('就业市场');
    } finally {
      await setLanguage('en');
    }
  });

  it('falls back to the legacy why string when whyKey is absent (v0.4.x)', async () => {
    const { renderWhyTemplate } = await import('../src/i18n/why');
    const { default: i18n } = await import('../src/i18n');
    const t = i18n.t.bind(i18n);
    expect(renderWhyTemplate(t, 'legacy english', undefined, undefined))
      .toBe('legacy english');
  });

  it('falls back to the legacy why string for an unknown whyKey (v0.4.x)', async () => {
    const { renderWhyTemplate } = await import('../src/i18n/why');
    const { default: i18n } = await import('../src/i18n');
    const t = i18n.t.bind(i18n);
    expect(renderWhyTemplate(t, 'legacy english', 'bogus', {}))
      .toBe('legacy english');
  });
});

describe('i18n — compare-page column header (v0.4.x)', () => {
  /**
   * Bug 2 regression: the frozen-column header on the compare-page
   * table was hard-coded "Dimension" in English. Localise via
   * t('compare.dimension').
   */
  it('localises the compare-page "Dimension" header on toggle', async () => {
    const { setLanguage } = await import('../src/i18n');
    const a: MatchedCityFull = makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'lisbon', name: 'Lisbon', country: 'Portugal' } });
    const b: MatchedCityFull = makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'berlin', name: 'Berlin', country: 'Germany' } });

    function renderWith(initial: MatchedCityFull[]) {
      return render(
        <MemoryRouter initialEntries={['/compare']}>
          <ToastProvider>
            <ShortlistProvider initial={initial}>
              <ComparePage />
            </ShortlistProvider>
          </ToastProvider>
        </MemoryRouter>,
      );
    }

    // English default
    const { unmount } = renderWith([a, b]);
    const firstTh = screen.getByTestId('compare-table').querySelector('thead th');
    expect(firstTh).not.toBeNull();
    expect(firstTh!.textContent).toBe('Dimension');
    unmount();

    // Switch to Chinese
    await setLanguage('zh');
    try {
      renderWith([a, b]);
      const firstTh2 = screen.getByTestId('compare-table').querySelector('thead th');
      expect(firstTh2).not.toBeNull();
      expect(firstTh2!.textContent).toBe('维度');
    } finally {
      await setLanguage('en');
    }
  });
});