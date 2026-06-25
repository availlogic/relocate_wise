/**
 * Claymorphism tests for the Compare MFE (PRD v3.4.0 FR-22…FR-27,
 * Acceptance-Criteria v1.3.0 AC-21…AC-24, Visual-Guidelines v1.4.0).
 *
 * Asserts (via parsing CSS source files and DOM smoke tests):
 *   - Each compare column is a 24-32px-radius clay card (FR-23).
 *   - The winner cell uses the lavender pastel + pressed inner-shadow
 *     (FR-24 / AC-23).
 *   - The score badge inside each card uses the lavender clay
 *     container (FR-23).
 */
import { describe, expect, it, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { ComparePage } from '../src/ComparePage';
import { ShortlistProvider } from '@relocatewise/web-container/state/shortlist';
import { ToastProvider } from '@relocatewise/web-container/components/Toast';
import type { MatchedCityFull } from '@relocatewise/web-container/api';
import { makeMatchedCity } from './fixtures';
import './setup';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../../');
let compareCss = '';

beforeAll(async () => {
  compareCss = await readFile(
    resolve(REPO_ROOT, 'web/compare-mfe/src/ComparePage.css'),
    'utf8',
  );
});

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

describe('Phase F — Claymorphism ComparePage CSS contract', () => {
  it('compare columns use a 24-32px radius clay card', () => {
    expect(compareCss).toMatch(
      /\.compare-card\s*\{[^}]*border-radius:\s*var\(--radius-xl\)/,
    );
  });

  it('compare cards carry the multi-layered clay shadow', () => {
    expect(compareCss).toMatch(
      /\.compare-card\s*\{[^}]*box-shadow:\s*var\(--shadow-clay-outer\)/,
    );
  });

  it('winner cells use the lavender pastel + pressed inner-shadow (FR-24 / AC-23)', () => {
    const block = compareCss.match(/\.compare-page__cell--best\s*\{[^}]*\}/);
    expect(block).toBeTruthy();
    if (block) {
      expect(block[0]).toMatch(/background:\s*var\(--color-accent-lavender\)/);
      expect(block[0]).toMatch(/box-shadow:\s*var\(--shadow-pressed\)/);
    }
  });

  it('score badge uses the lavender clay container', () => {
    const block = compareCss.match(/\.compare-card__score\s*\{[^}]*\}/);
    expect(block).toBeTruthy();
    if (block) {
      expect(block[0]).toMatch(/background:\s*var\(--color-accent-lavender\)/);
      expect(block[0]).toMatch(/box-shadow:\s*var\(--shadow-clay-outer\)/);
    }
  });
});

describe('Phase F — Claymorphism ComparePage runtime contract', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders two compare cards with the right testids', () => {
    render(
      <MemoryRouter initialEntries={['/compare']}>
        <ToastProvider>
          <ShortlistProvider
            initial={[
              makeCity('lisbon', 'Lisbon', 'PT'),
              makeCity('berlin', 'Berlin', 'DE'),
            ]}
          >
            <ComparePage />
          </ShortlistProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('compare-card-lisbon')).toBeInTheDocument();
    expect(screen.getByTestId('compare-card-berlin')).toBeInTheDocument();
  });

  it('the winner cell carries the compare-page__cell--best class', () => {
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
    render(
      <MemoryRouter initialEntries={['/compare']}>
        <ToastProvider>
          <ShortlistProvider initial={[lisbon, berlin]}>
            <ComparePage />
          </ShortlistProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    const bestCell = screen.getByTestId('compare-cell-healthcare-lisbon');
    expect(bestCell.className).toMatch(/--best/);
    expect(bestCell.textContent).toBe('5/5');
  });

  it('the score badge inside a card shows the match score', () => {
    render(
      <MemoryRouter initialEntries={['/compare']}>
        <ToastProvider>
          <ShortlistProvider
            initial={[
              makeCity('lisbon', 'Lisbon', 'PT', { score: 91 }),
              makeCity('berlin', 'Berlin', 'DE', { score: 67 }),
            ]}
          >
            <ComparePage />
          </ShortlistProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    const card = screen.getByTestId('compare-card-lisbon');
    const badge = within(card).getByText('91').closest('.compare-card__score')!;
    expect(badge).toBeInTheDocument();
  });
});