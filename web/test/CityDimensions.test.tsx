/**
 * Tests for CityDimensions. The component renders a city dimension
 * payload as three grouped lists of bar rows (Overall, Career by
 * industry, Community). The "Climate" row uses the city climate label
 * as a sub-string instead of a numeric bar, per the visualization
 * design in the PRD.
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CityDimensions } from '../src/components/CityDimensions';
import { makeCity } from './fixtures';
import type { CityDimensions as CityDimensionsT } from '@relocatewise/shared';

function dimensionsWithClimate(label: string, cost: number): CityDimensionsT {
  return {
    climate: { label: label as CityDimensionsT['climate']['label'] },
    cost,
    housing: 1,
    education: 1,
    healthcare: 1,
    career: { tech: 1, finance: 1, healthcare: 1, creative: 1, manufacturing: 1 },
    community: {
      urban: 1, suburban: 1, coastal: 1, mountain: 1,
      arts_culture: 1, family_oriented: 1, expat_friendly: 1,
    },
  };
}

describe('<CityDimensions />', () => {
  it('renders all three groups with the right headings', () => {
    render(<CityDimensions dimensions={makeCity().dimensions} />);
    expect(screen.getByRole('heading', { name: 'Overall' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Career by industry' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Community' })).toBeInTheDocument();
  });

  it('renders five Overall rows including Climate, Cost, Housing, Education, Healthcare', () => {
    const dims: CityDimensionsT = {
      climate: { label: 'Mediterranean' },
      cost: 3, housing: 4, education: 5, healthcare: 2,
      career: { tech: 3, finance: 2, healthcare: 3, creative: 4, manufacturing: 2 },
      community: {
        urban: 4, suburban: 3, coastal: 5, mountain: 1,
        arts_culture: 5, family_oriented: 3, expat_friendly: 5,
      },
    };
    render(<CityDimensions dimensions={dims} />);
    const overall = screen.getByRole('heading', { name: 'Overall' }).parentElement!;
    const rows = within(overall).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    const labels = rows.map((r) => r.querySelector('.city-dims__label')!.textContent);
    expect(labels).toEqual([
      'Climate',
      'Cost of living',
      'Housing',
      'Education',
      'Healthcare',
    ]);
  });

  it('shows the city climate label as the Climate sub-value (not a bar)', () => {
    render(<CityDimensions dimensions={dimensionsWithClimate('Tropical', 1)} />);
    expect(screen.getByText('Tropical')).toBeInTheDocument();
    const climateRow = screen.getByTestId('dim-climate');
    expect(within(climateRow).getByText('Tropical')).toBeInTheDocument();
    expect(within(climateRow).queryByText('0.0')).not.toBeInTheDocument();
  });

  it('renders 5 career rows and 7 community rows', () => {
    render(<CityDimensions dimensions={makeCity().dimensions} />);
    const careerHeading = screen.getByRole('heading', { name: 'Career by industry' });
    const communityHeading = screen.getByRole('heading', { name: 'Community' });
    expect(within(careerHeading.parentElement!).getAllByRole('listitem')).toHaveLength(5);
    expect(within(communityHeading.parentElement!).getAllByRole('listitem')).toHaveLength(7);
  });

  it('sets the fill width proportional to the 0..5 score', () => {
    const dims: CityDimensionsT = {
      climate: { label: 'Mediterranean' },
      cost: 5, housing: 1, education: 1, healthcare: 1,
      career: { tech: 1, finance: 1, healthcare: 1, creative: 1, manufacturing: 1 },
      community: {
        urban: 1, suburban: 1, coastal: 1, mountain: 1,
        arts_culture: 1, family_oriented: 1, expat_friendly: 1,
      },
    };
    render(<CityDimensions dimensions={dims} />);
    const costFill = screen
      .getByTestId('dim-cost-of-living')
      .querySelector('.city-dims__fill') as HTMLElement;
    expect(costFill.style.width).toBe('100%');
    const housingFill = screen
      .getByTestId('dim-housing')
      .querySelector('.city-dims__fill') as HTMLElement;
    expect(housingFill.style.width).toBe('20%');
  });

  it('clamps out-of-range values to the 0..5 scale', () => {
    const dims: CityDimensionsT = {
      climate: { label: 'Tropical' },
      cost: 99, housing: -2, education: 1, healthcare: 1,
      career: { tech: 1, finance: 1, healthcare: 1, creative: 1, manufacturing: 1 },
      community: {
        urban: 1, suburban: 1, coastal: 1, mountain: 1,
        arts_culture: 1, family_oriented: 1, expat_friendly: 1,
      },
    };
    render(<CityDimensions dimensions={dims} />);
    const costFill = screen
      .getByTestId('dim-cost-of-living')
      .querySelector('.city-dims__fill') as HTMLElement;
    const housingFill = screen
      .getByTestId('dim-housing')
      .querySelector('.city-dims__fill') as HTMLElement;
    expect(costFill.style.width).toBe('100%');
    expect(housingFill.style.width).toBe('0%');
  });

  it('color-codes the bar fill by tier (high / mid / low)', () => {
    const dims: CityDimensionsT = {
      climate: { label: 'Tropical' },
      cost: 4, housing: 3, education: 1, healthcare: 1,
      career: { tech: 1, finance: 1, healthcare: 1, creative: 1, manufacturing: 1 },
      community: {
        urban: 1, suburban: 1, coastal: 1, mountain: 1,
        arts_culture: 1, family_oriented: 1, expat_friendly: 1,
      },
    };
    render(<CityDimensions dimensions={dims} />);
    const costFill = screen
      .getByTestId('dim-cost-of-living')
      .querySelector('.city-dims__fill') as HTMLElement;
    const housingFill = screen
      .getByTestId('dim-housing')
      .querySelector('.city-dims__fill') as HTMLElement;
    const educationFill = screen
      .getByTestId('dim-education')
      .querySelector('.city-dims__fill') as HTMLElement;
    expect(costFill.className).toMatch(/--high/);
    expect(housingFill.className).toMatch(/--mid/);
    expect(educationFill.className).toMatch(/--low/);
  });

  it('uses a stable data-testid per row derived from the label', () => {
    render(<CityDimensions dimensions={makeCity().dimensions} />);
    expect(screen.getByTestId('dim-tech')).toBeInTheDocument();
    expect(screen.getByTestId('dim-coastal')).toBeInTheDocument();
    expect(screen.getByTestId('dim-arts-culture')).toBeInTheDocument();
    expect(screen.getByTestId('city-dims')).toBeInTheDocument();
  });

  it('shows a formatted float in the value cell for non-climate rows', () => {
    const dims = dimensionsWithClimate('Continental', 3);
    render(<CityDimensions dimensions={dims} />);
    expect(within(screen.getByTestId('dim-climate')).getByText('Continental')).toBeInTheDocument();
    expect(within(screen.getByTestId('dim-cost-of-living')).getByText('3.0')).toBeInTheDocument();
    expect(within(screen.getByTestId('dim-housing')).getByText('1.0')).toBeInTheDocument();
  });
});
