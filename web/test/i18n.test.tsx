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
import { ProfileForm } from '../src/components/ProfileForm';
import { LandingPage } from '../src/pages/LandingPage';
import { LanguageToggle } from '../src/components/LanguageToggle';
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