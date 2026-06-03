/**
 * Top-level routing & layout tests for <App />.
 *
 * - Every public route renders the right page.
 * - The header shortlist badge reflects the live count and highlights
 *   when full (≥3).
 * - The 404 fallback is reached for unknown paths.
 *
 * The page-level pages are exercised in their own test files; here we
 * only assert that the route plumbing points at the right component and
 * that the header wiring is correct.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { SHORTLIST_MAX } from '../src/state/shortlist';
import { makeMatchedCity } from './fixtures';

function city(slug: string, name: string) {
  return makeMatchedCity({
    city: { ...makeMatchedCity().city, slug, name },
    score: 80,
    why: `${name} fits.`,
  });
}

describe('<App /> — routing & header', () => {
  it('renders the LandingPage at /', () => {
    render(<App />);
    // Header brand is always present; landing has its own h1.
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
    // The badge is a link to /compare.
    expect(screen.getByTestId('header-shortlist').getAttribute('href')).toBe('/compare');
  });

  it('header shortlist count reacts to adding cities from /results', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/results');
    // Simulate the form passing matched results via router state.
    // `window.history.state` is a read-only getter in modern browsers,
    // so we override it via `Object.defineProperty`.
    Object.defineProperty(window.history, 'state', {
      configurable: true,
      get: () => ({
        usr: {
          results: [city('lisbon', 'Lisbon'), city('berlin', 'Berlin'), city('tokyo', 'Tokyo')],
          generated_at: '2026-06-02T00:00:00Z',
        },
        key: 'test',
      }),
    });
    render(<App />);
    // Add Lisbon to the shortlist via its checkbox.
    await user.click(screen.getByTestId('rank-card-1-compare-checkbox'));
    expect(screen.getByTestId('header-shortlist-count').textContent).toBe('1/3');

    await user.click(screen.getByTestId('rank-card-2-compare-checkbox'));
    expect(screen.getByTestId('header-shortlist-count').textContent).toBe('2/3');

    await user.click(screen.getByTestId('rank-card-3-compare-checkbox'));
    const count = screen.getByTestId('header-shortlist-count');
    expect(count.textContent).toBe(`3/${SHORTLIST_MAX}`);
    // The "full" highlight is applied at ≥ 3.
    expect(count.className).toMatch(/--full/);
  });

  it('navigates to /compare when the header badge is clicked', async () => {
    const user = userEvent.setup();
    // Land on /results with two cities in state.
    window.history.pushState({}, '', '/results');
    Object.defineProperty(window.history, 'state', {
      configurable: true,
      get: () => ({
        usr: {
          results: [city('lisbon', 'Lisbon'), city('berlin', 'Berlin')],
          generated_at: '2026-06-02T00:00:00Z',
        },
        key: 'test',
      }),
    });
    render(<App />);
    await user.click(screen.getByTestId('rank-card-1-compare-checkbox'));
    await user.click(screen.getByTestId('rank-card-2-compare-checkbox'));
    await user.click(screen.getByTestId('header-shortlist'));
    expect(screen.getByTestId('compare-page')).toBeInTheDocument();
  });
});
