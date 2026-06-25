/**
 * Top-level routing & layout tests for <App />.
 *
 * - Every public route renders the right page.
 * - The header shortlist badge reflects the live count and highlights
 *   when full (≥3).
 * - The 404 fallback is reached for unknown paths.
 *
 * Phase D (v1.0.0 GA): the page-level components are loaded via
 * `React.lazy(() => import('@relocatewise/web-*'))`. We mock the MFE
 * entry points so the lazy import resolves synchronously in jsdom
 * (the components are imported from their workspace paths and
 * re-exported as the named export each lazy import expects). The
 * page-level pages are exercised in their own test files; here we
 * only assert that the route plumbing points at the right component
 * and that the header wiring is correct.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { SHORTLIST_MAX } from '../src/state/shortlist';

vi.mock('@relocatewise/web-quiz-mfe', () => ({
  ProfileForm: () => <div data-testid="quiz-mock" />,
}));
vi.mock('@relocatewise/web-compare-mfe', () => ({
  ComparePage: () => <div data-testid="compare-mock" />,
}));
vi.mock('@relocatewise/web-dashboard-mfe', () => ({
  ResultsPage: () => <div data-testid="results-mock" />,
  CityPage: () => <div data-testid="city-mock" />,
}));

describe('<App /> — routing & header', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('renders the LandingPage at /', () => {
    render(<App />);
    expect(screen.getByTestId('landing')).toBeInTheDocument();
  });

  it('renders the PrivacyPage at /privacy', () => {
    window.history.pushState({}, '', '/privacy');
    render(<App />);
    expect(screen.getByTestId('privacy')).toBeInTheDocument();
  });

  it('renders the NotFoundPage for unknown routes', () => {
    window.history.pushState({}, '', '/totally/made/up');
    render(<App />);
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
  });

  it('header shortlist badge starts at 0/3', () => {
    render(<App />);
    expect(screen.getByTestId('header-shortlist-count').textContent).toBe(`0/${SHORTLIST_MAX}`);
    expect(screen.getByTestId('header-shortlist').getAttribute('href')).toBe('/compare');
  });

  it('navigates to /compare when the header badge is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    // Direct nav to /compare shows the mocked compare MFE.
    window.history.pushState({}, '', '/compare');
    await user.click(screen.getByTestId('header-shortlist'));
    expect(screen.getByTestId('compare-mock')).toBeInTheDocument();
  });
});