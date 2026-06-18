/**
 * Tests for RankCard. Renders a single matched city as a list row,
 * including rank, name/country/region, score badge (color-coded by
 * tier), the "why this fits" sentence, and a link to the full profile.
 *
 * Link is a real react-router Link, so we wrap the component in
 * MemoryRouter and assert against the generated anchor's `href`.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RankCard } from '../src/components/RankCard';
import { makeMatchedCity } from './fixtures';

function renderCard(rank: number, overrides = {}) {
  return render(
    <MemoryRouter>
      <RankCard rank={rank} result={makeMatchedCity(overrides)} />
    </MemoryRouter>,
  );
}

describe('<RankCard />', () => {
  it('renders the rank, city name, country, and region', () => {
    renderCard(1, {
      city: {
        slug: 'lisbon',
        name: 'Lisbon',
        country: 'Portugal',
        country_code: 'PT',
        region: 'Europe',
        lat: 38.7,
        lng: -9.1,
        description: 'desc',
        last_updated: '2026-05-15',
        dimensions: {
          climate: { label: 'Mediterranean' },
          cost: 3, housing: 3, education: 4, healthcare: 4,
          career: { tech: 3, finance: 2, healthcare: 3, creative: 4, manufacturing: 2 },
          community: {
            urban: 4, suburban: 3, coastal: 5, mountain: 1,
            arts_culture: 5, family_oriented: 3, expat_friendly: 5,
          },
        },
      },
    });

    const card = screen.getByTestId('rank-card-1');
    expect(within(card).getByText('#1')).toBeInTheDocument();
    expect(within(card).getByText('Lisbon')).toBeInTheDocument();
    expect(within(card).getByText(', Portugal')).toBeInTheDocument();
    expect(within(card).getByText('Europe')).toBeInTheDocument();
  });

  it('renders the integer score inside the badge', () => {
    renderCard(2, { score: 88 });
    expect(screen.getByTestId('rank-card-2-score').textContent).toBe('88');
  });

  it('applies the high tier class for score >= 75', () => {
    renderCard(1, { score: 92 });
    const card = screen.getByTestId('rank-card-1');
    expect(card.className).toMatch(/rank-card--high/);
    expect(screen.getByTestId('rank-card-1-score').className).toMatch(/--high/);
  });

  it('applies the medium tier class for 50..74', () => {
    renderCard(1, { score: 60 });
    expect(screen.getByTestId('rank-card-1').className).toMatch(/rank-card--medium/);
  });

  it('applies the low tier class for < 50', () => {
    renderCard(1, { score: 30 });
    expect(screen.getByTestId('rank-card-1').className).toMatch(/rank-card--low/);
  });

  it('renders the templated "why" sentence', () => {
    renderCard(1, { why: 'Strong overall fit with great food and culture.' });
    const why = screen.getByTestId('rank-card-1-why');
    expect(why.textContent).toMatch(/Strong overall fit with great food and culture/);
  });

  it('links to /city/:slug using an encoded slug', () => {
    renderCard(1, {
      city: {
        slug: 'sao paulo',
        name: 'São Paulo',
        country: 'Brazil',
        country_code: 'BR',
        region: 'South America',
        lat: -23.5,
        lng: -46.6,
        description: 'desc',
        last_updated: '2026-05-15',
        dimensions: {
          climate: { label: 'Tropical' },
          cost: 3, housing: 3, education: 4, healthcare: 4,
          career: { tech: 3, finance: 2, healthcare: 3, creative: 4, manufacturing: 2 },
          community: {
            urban: 4, suburban: 3, coastal: 5, mountain: 1,
            arts_culture: 5, family_oriented: 3, expat_friendly: 5,
          },
        },
      },
    });
    const link = screen.getByTestId('rank-card-1-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/city/sao%20paulo');
    expect(link.textContent).toMatch(/view profile/i);
  });

  it('does not render the compare checkbox when no shortlist props are passed', () => {
    renderCard(1);
    expect(screen.queryByTestId('rank-card-1-compare')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('rank-card-1-compare-checkbox'),
    ).not.toBeInTheDocument();
  });

  it('renders an unchecked "Add to compare" checkbox when not in the shortlist', () => {
    render(
      <MemoryRouter>
        <RankCard
          rank={1}
          result={makeMatchedCity()}
          inShortlist={false}
          onToggleShortlist={() => {}}
        />
      </MemoryRouter>,
    );
    const cb = screen.getByTestId(
      'rank-card-1-compare-checkbox',
    ) as HTMLInputElement;
    expect(cb.checked).toBe(false);
    expect(cb.disabled).toBe(false);
    expect(screen.getByText(/add to compare/i)).toBeInTheDocument();
  });

  it('renders a checked "In compare set" checkbox when in the shortlist', () => {
    render(
      <MemoryRouter>
        <RankCard
          rank={2}
          result={makeMatchedCity()}
          inShortlist={true}
          onToggleShortlist={() => {}}
        />
      </MemoryRouter>,
    );
    const cb = screen.getByTestId(
      'rank-card-2-compare-checkbox',
    ) as HTMLInputElement;
    expect(cb.checked).toBe(true);
    expect(screen.getByText(/in compare set/i)).toBeInTheDocument();
  });

  it('disables the checkbox and appends (max 3) when the shortlist is full', () => {
    render(
      <MemoryRouter>
        <RankCard
          rank={3}
          result={makeMatchedCity()}
          inShortlist={false}
          onToggleShortlist={() => {}}
          shortlistFull
        />
      </MemoryRouter>,
    );
    const cb = screen.getByTestId(
      'rank-card-3-compare-checkbox',
    ) as HTMLInputElement;
    expect(cb.disabled).toBe(true);
    expect(screen.getByText(/max 3/i)).toBeInTheDocument();
  });

  it('keeps the checkbox enabled for an already-selected city even when full', () => {
    render(
      <MemoryRouter>
        <RankCard
          rank={4}
          result={makeMatchedCity()}
          inShortlist={true}
          onToggleShortlist={() => {}}
          shortlistFull
        />
      </MemoryRouter>,
    );
    const cb = screen.getByTestId(
      'rank-card-4-compare-checkbox',
    ) as HTMLInputElement;
    // Already in the list — user can still deselect it to free a slot.
    expect(cb.disabled).toBe(false);
    expect(cb.checked).toBe(true);
  });

  it('invokes onToggleShortlist when the checkbox is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <MemoryRouter>
        <RankCard
          rank={5}
          result={makeMatchedCity()}
          inShortlist={false}
          onToggleShortlist={onToggle}
        />
      </MemoryRouter>,
    );
    await user.click(screen.getByTestId('rank-card-5-compare-checkbox'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
