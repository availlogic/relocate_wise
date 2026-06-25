/**
 * Claymorphism tests for the Dashboard MFE (PRD v3.4.0 FR-22…FR-27,
 * Acceptance-Criteria v1.3.0 AC-21…AC-24, Visual-Guidelines v1.4.0).
 *
 * Asserts (via parsing CSS source files):
 *   - RankCard score badges use sage green / lavender / peach pastels
 *     for high / medium / low tiers.
 *   - RankCard outer container has a 24-32px radius + multi-layered
 *     clay shadow.
 *   - CityDimensions bars are 12px clay grooves (FR-27).
 *   - CityPage flag wrapper uses 12px border-radius (Visual-Guidelines
 *     §4.5).
 *   - CityPage landmark <figure> uses 24-32px radius (FR-23).
 */
import { describe, expect, it, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { RankCard } from '../src/components/RankCard';
import { CityDimensions } from '../src/components/CityDimensions';
import type { CityDimensions as CityDimensionsT } from '@relocatewise/shared';
import './setup';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');

let rankCardCss = '';
let cityPageCss = '';
let cityDimensionsCss = '';

beforeAll(async () => {
  rankCardCss = await readFile(
    resolve(REPO_ROOT, 'web/dashboard-mfe/src/components/RankCard.css'),
    'utf8',
  );
  cityPageCss = await readFile(
    resolve(REPO_ROOT, 'web/dashboard-mfe/src/components/CityPage.css'),
    'utf8',
  );
  cityDimensionsCss = await readFile(
    resolve(REPO_ROOT, 'web/dashboard-mfe/src/components/CityDimensions.css'),
    'utf8',
  );
});

const baseDimensions: CityDimensionsT = {
  climate: { label: 'Mediterranean' },
  cost: 3,
  housing: 3,
  career: { tech: 3, finance: 3, healthcare: 3, creative: 3, manufacturing: 3 },
  education: 3,
  healthcare: 3,
  community: {
    urban: 3,
    suburban: 2,
    rural: 2,
    coastal: 4,
    mountain: 1,
    arts_culture: 3,
    family_oriented: 2,
    expat_friendly: 3,
  },
  military_safety: 4,
};

function makeMatchedCity(score: number) {
  return {
    city: {
      slug: 'lisbon-pt',
      name: 'Lisbon',
      country: 'Portugal',
      country_code: 'PT',
      region: 'Europe',
      lat: 38.7223,
      lng: -9.1393,
      description: 'Coastal city.',
      last_updated: '2026-06-10',
      flag_image_url: '/flags/pt.svg',
      landmark_image_url: '/landmarks/lisbon.jpg',
      dimensions: baseDimensions,
    },
    score,
    why: 'matches',
    why_key: 'neutral' as const,
  };
}

describe('Phase F — Claymorphism RankCard', () => {
  it('renders a card with the rank-card testid', () => {
    render(
      <MemoryRouter>
        <RankCard rank={1} result={makeMatchedCity(80)} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('rank-card-1')).toBeInTheDocument();
  });

  it('the RankCard outer container uses a 32px radius + multi-layered clay shadow', () => {
    expect(rankCardCss).toMatch(
      /\.rank-card\s*\{[^}]*border-radius:\s*var\(--radius-xl\)/,
    );
    expect(rankCardCss).toMatch(
      /\.rank-card\s*\{[^}]*box-shadow:\s*var\(--shadow-clay-outer\),\s*var\(--shadow-clay-inner-light\),\s*var\(--shadow-clay-inner-dark\)/,
    );
  });

  it('high-match score badge uses sage green pastel', () => {
    const block = rankCardCss.match(/\.rank-card__score--high\s*\{[^}]*\}/);
    expect(block).toBeTruthy();
    if (block) {
      expect(block[0]).toMatch(/background:\s*var\(--color-accent-green\)/);
    }
  });

  it('low-match score badge uses peach pastel', () => {
    const block = rankCardCss.match(/\.rank-card__score--low\s*\{[^}]*\}/);
    expect(block).toBeTruthy();
    if (block) {
      expect(block[0]).toMatch(/background:\s*var\(--color-accent-peach\)/);
    }
  });

  it('medium-match score badge uses lavender pastel', () => {
    const block = rankCardCss.match(/\.rank-card__score--medium\s*\{[^}]*\}/);
    expect(block).toBeTruthy();
    if (block) {
      expect(block[0]).toMatch(/background:\s*var\(--color-accent-lavender\)/);
    }
  });

  it('score badge has the multi-layered clay shadow', () => {
    expect(rankCardCss).toMatch(
      /\.rank-card__score\s*\{[^}]*box-shadow:\s*var\(--shadow-clay-outer\),\s*var\(--shadow-clay-inner-light\),\s*var\(--shadow-clay-inner-dark\)/,
    );
  });
});

describe('Phase F — Claymorphism CityDimensions', () => {
  it('dimension bars use a 12px clay groove with a 9999px radius (FR-27)', () => {
    expect(cityDimensionsCss).toMatch(/\.city-dims__bar\s*\{[^}]*height:\s*12px/);
    expect(cityDimensionsCss).toMatch(/\.city-dims__bar\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/);
    expect(cityDimensionsCss).toMatch(/\.city-dims__bar\s*\{[^}]*box-shadow:\s*var\(--shadow-clay-track\)/);
  });

  it('the dimension bar fill uses pastel accent backgrounds', () => {
    expect(cityDimensionsCss).toMatch(/\.city-dims__fill--high\s*\{[^}]*background:\s*var\(--color-accent-green\)/);
    expect(cityDimensionsCss).toMatch(/\.city-dims__fill--mid\s*\{[^}]*background:\s*var\(--color-accent-yellow\)/);
    expect(cityDimensionsCss).toMatch(/\.city-dims__fill--low\s*\{[^}]*background:\s*var\(--color-accent-peach\)/);
  });

  it('renders the dimensions grid', () => {
    render(<CityDimensions dimensions={baseDimensions} />);
    expect(screen.getByTestId('city-dims')).toBeInTheDocument();
  });
});

describe('Phase F — Claymorphism CityPage', () => {
  it('the flag wrapper uses a 12px border-radius (Visual-Guidelines §4.5)', () => {
    expect(cityPageCss).toMatch(
      /\.city-page__flag\s*\{[^}]*border-radius:\s*12px/,
    );
  });

  it('the landmark <figure> uses a 24-32px border-radius (FR-23)', () => {
    expect(cityPageCss).toMatch(
      /\.city-page__landmark\s*\{[^}]*border-radius:\s*var\(--radius-xl\)/,
    );
    expect(cityPageCss).toMatch(
      /\.city-page__landmark\s*\{[^}]*box-shadow:\s*var\(--shadow-clay-outer\)/,
    );
  });

  it('the CityPage header is a clay card with 24-32px radius and multi-layered shadow', () => {
    expect(cityPageCss).toMatch(
      /\.city-page__header\s*\{[^}]*border-radius:\s*var\(--radius-xl\)/,
    );
    expect(cityPageCss).toMatch(
      /\.city-page__header\s*\{[^}]*box-shadow:\s*var\(--shadow-clay-outer\)/,
    );
  });
});