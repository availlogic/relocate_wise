/**
 * Tests for ComparePage (PRD S6 / FR-8 / Acceptance-Criteria Feature 5).
 *
 * Covers the three states:
 *   - <2 cities → redirect to /results with a notice (Acceptance-Criteria
 *     Feature 5 Rule, E2E-2).
 *   - 2 cities → comparison grid + table.
 *   - 3 cities → comparison grid + table.
 *
 * Plus the row-level rules:
 *   - 8 dimensions are rendered (climate, cost, housing, career avg,
 *     education, healthcare, community max, military safety) — v0.3.0.
 *   - Cost / Housing are inverted: lower index wins (Acceptance-Criteria
 *     Feature 5).
 *   - Removing the last-but-one (drops below 2) navigates with a
 *     "fewer than 2 cities" notice.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ComparePage } from '../src/pages/ComparePage';
import { ShortlistProvider } from '../src/state/shortlist';
import { ToastProvider } from '../src/components/Toast';
import { makeMatchedCity } from './fixtures';
import type { MatchedCityFull } from '../src/api';

function makeCity(
  slug: string,
  name: string,
  country: string,
  overrides: Partial<MatchedCityFull> = {},
): MatchedCityFull {
  return makeMatchedCity({
    city: {
      ...makeMatchedCity().city,
      slug,
      name,
      country,
      country_code: country.slice(0, 2).toUpperCase(),
    },
    score: 80,
    why: `${name} fits.`,
    ...overrides,
  });
}

function renderPage(initial: MatchedCityFull[] = []) {
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

describe('<ComparePage />', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    // The ToastProvider schedules `setTimeout` for auto-dismiss that
    // can keep the event loop alive after the test finishes. Unmount
    // every component and run with fake timers so any pending
    // dismissals are flushed and the runner can exit cleanly.
    cleanup();
    vi.useRealTimers();
  });

  it('redirects to /results when shortlist is empty (E2E-2)', () => {
    render(
      <MemoryRouter initialEntries={['/compare']}>
        <ToastProvider>
          <ShortlistProvider>
            <ComparePage />
          </ShortlistProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    // The redirect navigates to /results; the ResultsPage then renders.
    // We just need to confirm we are no longer on /compare.
    expect(screen.queryByTestId('compare-page')).not.toBeInTheDocument();
  });

  it('renders one column per shortlisted city (2 and 3 cities)', () => {
    const a = makeCity('lisbon', 'Lisbon', 'PT');
    const b = makeCity('berlin', 'Berlin', 'DE');
    const c = makeCity('tokyo', 'Tokyo', 'JP');
    const { unmount } = renderPage([a, b]);
    const grid2 = screen.getByTestId('compare-grid');
    expect(grid2.style.gridTemplateColumns).toMatch(/repeat\(2,/);
    expect(within(grid2).getByTestId('compare-card-lisbon')).toBeInTheDocument();
    expect(within(grid2).getByTestId('compare-card-berlin')).toBeInTheDocument();

    unmount();
    renderPage([a, b, c]);
    const grid3 = screen.getByTestId('compare-grid');
    expect(grid3.style.gridTemplateColumns).toMatch(/repeat\(3,/);
    expect(within(grid3).getByTestId('compare-card-tokyo')).toBeInTheDocument();
  });

  it('renders all 8 dimension rows (v0.3.0)', () => {
    renderPage([
      makeCity('lisbon', 'Lisbon', 'PT'),
      makeCity('berlin', 'Berlin', 'DE'),
    ]);
    const table = screen.getByTestId('compare-table');
    expect(within(table).getByTestId('compare-row-climate')).toBeInTheDocument();
    expect(within(table).getByTestId('compare-row-cost-of-living')).toBeInTheDocument();
    expect(within(table).getByTestId('compare-row-housing')).toBeInTheDocument();
    expect(within(table).getByTestId('compare-row-career-avg')).toBeInTheDocument();
    expect(within(table).getByTestId('compare-row-education')).toBeInTheDocument();
    expect(within(table).getByTestId('compare-row-healthcare')).toBeInTheDocument();
    expect(within(table).getByTestId('compare-row-community-max')).toBeInTheDocument();
    expect(within(table).getByTestId('compare-row-military-safety')).toBeInTheDocument();
  });

  it('military safety row highlights the higher score (FTC-13 v0.3.0)', () => {
    const safe = makeCity('safe', 'Safe', 'PT', {
      city: {
        ...makeMatchedCity().city,
        slug: 'safe', name: 'Safe', country: 'Portugal', country_code: 'PT',
        dimensions: { ...makeMatchedCity().city.dimensions, military_safety: 5 },
      },
    });
    const risky = makeCity('risky', 'Risky', 'DE', {
      city: {
        ...makeMatchedCity().city,
        slug: 'risky', name: 'Risky', country: 'Germany', country_code: 'DE',
        dimensions: { ...makeMatchedCity().city.dimensions, military_safety: 1 },
      },
    });
    renderPage([safe, risky]);
    expect(screen.getByTestId('compare-cell-military-safety-safe').className).toMatch(/--best/);
    expect(screen.getByTestId('compare-cell-military-safety-risky').className).not.toMatch(/--best/);
  });

  it('inverts the winner on cost (lower index wins)', () => {
    const lisbon = makeCity('lisbon', 'Lisbon', 'PT', {
      city: {
        ...makeMatchedCity().city,
        slug: 'lisbon',
        name: 'Lisbon',
        country: 'Portugal',
        country_code: 'PT',
        dimensions: {
          ...makeMatchedCity().city.dimensions,
          cost: 2, // cheaper
        },
      },
    });
    const nyc = makeCity('nyc', 'New York City', 'US', {
      city: {
        ...makeMatchedCity().city,
        slug: 'nyc',
        name: 'New York City',
        country: 'United States',
        country_code: 'US',
        dimensions: {
          ...makeMatchedCity().city.dimensions,
          cost: 5,
        },
      },
    });
    renderPage([lisbon, nyc]);
    expect(
      screen.getByTestId('compare-cell-cost-of-living-lisbon').className,
    ).toMatch(/--best/);
    expect(
      screen.getByTestId('compare-cell-cost-of-living-nyc').className,
    ).not.toMatch(/--best/);
  });

  it('highlights the cell that uniquely owns the max for a non-inverted dimension', () => {
    const lisbon = makeCity('lisbon', 'Lisbon', 'PT', {
      city: {
        ...makeMatchedCity().city,
        slug: 'lisbon',
        name: 'Lisbon',
        country: 'Portugal',
        country_code: 'PT',
        dimensions: {
          ...makeMatchedCity().city.dimensions,
          healthcare: 5,
        },
      },
    });
    const berlin = makeCity('berlin', 'Berlin', 'DE', {
      city: {
        ...makeMatchedCity().city,
        slug: 'berlin',
        name: 'Berlin',
        country: 'Germany',
        country_code: 'DE',
        dimensions: {
          ...makeMatchedCity().city.dimensions,
          healthcare: 3,
        },
      },
    });
    renderPage([lisbon, berlin]);
    expect(screen.getByTestId('compare-cell-healthcare-lisbon').className).toMatch(/--best/);
    expect(screen.getByTestId('compare-cell-healthcare-berlin').className).not.toMatch(/--best/);
  });

  it('does NOT highlight anyone when the max is tied', () => {
    const lisbon = makeCity('lisbon', 'Lisbon', 'PT', {
      city: {
        ...makeMatchedCity().city,
        slug: 'lisbon', name: 'Lisbon', country: 'Portugal', country_code: 'PT',
        dimensions: { ...makeMatchedCity().city.dimensions, education: 4 },
      },
    });
    const berlin = makeCity('berlin', 'Berlin', 'DE', {
      city: {
        ...makeMatchedCity().city,
        slug: 'berlin', name: 'Berlin', country: 'Germany', country_code: 'DE',
        dimensions: { ...makeMatchedCity().city.dimensions, education: 4 },
      },
    });
    renderPage([lisbon, berlin]);
    expect(screen.getByTestId('compare-cell-education-lisbon').className).not.toMatch(/--best/);
    expect(screen.getByTestId('compare-cell-education-berlin').className).not.toMatch(/--best/);
  });

  it('removing a city that drops below 2 navigates to /results', async () => {
    const user = userEvent.setup();
    const a = makeCity('lisbon', 'Lisbon', 'PT');
    const b = makeCity('berlin', 'Berlin', 'DE');
    renderPage([a, b]);
    await user.click(screen.getByTestId('compare-remove-lisbon'));
    // The <Navigate replace /> pushes us to /results; the compare page
    // is no longer present.
    expect(screen.queryByTestId('compare-page')).not.toBeInTheDocument();
  });

  it('renders the localised "Dimension" column header (v0.4.x)', () => {
    const a = makeCity('lisbon', 'Lisbon', 'PT');
    const b = makeCity('berlin', 'Berlin', 'DE');
    renderPage([a, b]);
    const table = screen.getByTestId('compare-table');
    // The first <th> in the table head is the frozen-column header
    // for the row labels. It must use t('compare.dimension').
    const firstTh = table.querySelector('thead th');
    expect(firstTh).not.toBeNull();
    expect(firstTh!.textContent).toBe('Dimension');
  });

  it('clears the shortlist when "Clear all" is clicked', async () => {
    const user = userEvent.setup();
    const a = makeCity('lisbon', 'Lisbon', 'PT');
    const b = makeCity('berlin', 'Berlin', 'DE');
    renderPage([a, b]);
    await user.click(screen.getByTestId('compare-clear'));
    expect(screen.queryByTestId('compare-page')).not.toBeInTheDocument();
  });

  it('shows the city score on each card', () => {
    const a = makeCity('lisbon', 'Lisbon', 'PT', { score: 91 });
    const b = makeCity('berlin', 'Berlin', 'DE', { score: 67 });
    renderPage([a, b]);
    const card = screen.getByTestId('compare-card-lisbon');
    expect(within(card).getByText('91')).toBeInTheDocument();
    expect(within(card).getByText('/100')).toBeInTheDocument();
    expect(within(screen.getByTestId('compare-card-berlin')).getByText('67')).toBeInTheDocument();
  });

  it('shows the templated "why" sentence on each card', () => {
    const a = makeCity('lisbon', 'Lisbon', 'PT', { why: 'Sunny and affordable.' });
    const b = makeCity('berlin', 'Berlin', 'DE', { why: 'Great for tech careers.' });
    renderPage([a, b]);
    expect(screen.getByText(/Sunny and affordable/)).toBeInTheDocument();
    expect(screen.getByText(/Great for tech careers/)).toBeInTheDocument();
  });
});