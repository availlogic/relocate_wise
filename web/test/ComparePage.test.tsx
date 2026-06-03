/**
 * Tests for ComparePage (PRD S6 / FR-8).
 *
 * Covers the three states (empty / 1 / 2+) and the two mutations
 * (remove a single city, clear all). The "best match" highlight in
 * the dimension table is verified for the case where the max is
 * uniquely owned by one city.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ComparePage } from '../src/pages/ComparePage';
import { ShortlistProvider } from '../src/state/shortlist';
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
    <MemoryRouter>
      <ShortlistProvider initial={initial}>
        <ComparePage />
      </ShortlistProvider>
    </MemoryRouter>,
  );
}

describe('<ComparePage />', () => {
  it('shows the empty state with a CTA to start the questionnaire when nothing is shortlisted', () => {
    renderPage();
    const empty = screen.getByTestId('compare-empty');
    expect(empty).toBeInTheDocument();
    expect(
      within(empty).getByRole('link', { name: /start the questionnaire/i }),
    ).toHaveAttribute('href', '/');
  });

  it('prompts the user to add a second city when only one is shortlisted', () => {
    renderPage([makeCity('lisbon', 'Lisbon', 'PT')]);
    const one = screen.getByTestId('compare-one');
    expect(one).toBeInTheDocument();
    expect(within(one).getByText(/Lisbon/)).toBeInTheDocument();
    expect(within(one).getByRole('link', { name: /back to results/i })).toHaveAttribute('href', '/results');
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
    expect(within(grid2).queryByTestId('compare-card-tokyo')).not.toBeInTheDocument();

    // Provider state persists across `rerender`, so we have to unmount
    // and remount to switch to a different initial shortlist.
    unmount();
    renderPage([a, b, c]);
    const grid3 = screen.getByTestId('compare-grid');
    expect(grid3.style.gridTemplateColumns).toMatch(/repeat\(3,/);
    expect(within(grid3).getByTestId('compare-card-tokyo')).toBeInTheDocument();
  });

  it('renders the dimension comparison table with one row per dimension', () => {
    renderPage([
      makeCity('lisbon', 'Lisbon', 'PT'),
      makeCity('berlin', 'Berlin', 'DE'),
    ]);
    const table = screen.getByTestId('compare-table');
    expect(within(table).getByTestId('compare-row-cost-of-living')).toBeInTheDocument();
    expect(within(table).getByTestId('compare-row-housing')).toBeInTheDocument();
    expect(within(table).getByTestId('compare-row-education')).toBeInTheDocument();
    expect(within(table).getByTestId('compare-row-healthcare')).toBeInTheDocument();
  });

  it('highlights the cell that uniquely owns the max for a dimension', () => {
    const lisbon = makeCity('lisbon', 'Lisbon', 'PT', {
      city: {
        ...makeMatchedCity().city,
        slug: 'lisbon',
        name: 'Lisbon',
        country: 'Portugal',
        country_code: 'PT',
        dimensions: {
          ...makeMatchedCity().city.dimensions,
          healthcare: 5, // unique max
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
    const lisbonCell = screen.getByTestId('compare-cell-healthcare-lisbon');
    const berlinCell = screen.getByTestId('compare-cell-healthcare-berlin');
    expect(lisbonCell.className).toMatch(/--best/);
    expect(berlinCell.className).not.toMatch(/--best/);
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

  it('removes a single city when the "Remove" button is clicked', async () => {
    const user = userEvent.setup();
    const a = makeCity('lisbon', 'Lisbon', 'PT');
    const b = makeCity('berlin', 'Berlin', 'DE');
    renderPage([a, b]);
    await user.click(screen.getByTestId('compare-remove-lisbon'));
    // Now there's only 1 city, the 1-state message should appear.
    expect(screen.getByTestId('compare-one')).toBeInTheDocument();
    expect(screen.queryByTestId('compare-card-lisbon')).not.toBeInTheDocument();
  });

  it('clears the shortlist when "Clear all" is clicked', async () => {
    const user = userEvent.setup();
    const a = makeCity('lisbon', 'Lisbon', 'PT');
    const b = makeCity('berlin', 'Berlin', 'DE');
    renderPage([a, b]);
    await user.click(screen.getByTestId('compare-clear'));
    expect(screen.getByTestId('compare-empty')).toBeInTheDocument();
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
