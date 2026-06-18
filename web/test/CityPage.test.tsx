/**
 * Tests for CityPage. The page fetches `GET /api/cities/:slug` and
 * renders the seven dimension scores per FR-5. We mock the api module
 * so we can drive the loading / success / 404 / generic-error paths
 * deterministically.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CityPage } from '../src/pages/CityPage';
import { ShortlistProvider } from '../src/state/shortlist';
import { ToastProvider } from '../src/components/Toast';
import { ApiError } from '../src/api';
import { makeCity } from './fixtures';
import type { City } from '@relocatewise/shared';

// Mock the api module so we can drive getCity() however we like.
const { getCityMock } = vi.hoisted(() => ({ getCityMock: vi.fn() }));
vi.mock('../src/api', async () => {
  const actual = await vi.importActual<typeof import('../src/api')>('../src/api');
  return { ...actual, getCity: getCityMock };
});

function renderCityPage(slug: string) {
  // Capture the URL on the back-button so we can assert that the page
  // navigates back. The Test page is just there to observe the URL.
  function TestPage() {
    const loc = useLocation();
    return <div data-testid="test-path">{loc.pathname}</div>;
  }
  return render(
    <MemoryRouter initialEntries={[`/city/${slug}`]}>
      <ToastProvider>
        <ShortlistProvider>
          <Routes>
            <Route path="/city/:slug" element={<CityPage />} />
            <Route path="/results" element={<TestPage />} />
            <Route path="*" element={<TestPage />} />
          </Routes>
        </ShortlistProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('<CityPage />', () => {
  beforeEach(() => {
    getCityMock.mockReset();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
    vi.useRealTimers();
  });

  it('shows a loading indicator before the request resolves', () => {
    // Return a promise that never resolves within the test window.
    getCityMock.mockReturnValueOnce(new Promise(() => {}));
    renderCityPage('lisbon');
    expect(screen.getByTestId('city-loading')).toBeInTheDocument();
  });

  it('renders the city, all 8 dimension rows, and a back link to /results on success (v0.3.0)', async () => {
    const lisbon: City = makeCity({
      slug: 'lisbon',
      name: 'Lisbon',
      country: 'Portugal',
      country_code: 'PT',
      region: 'Europe',
    });
    getCityMock.mockResolvedValueOnce(lisbon);
    renderCityPage('lisbon');

    await waitFor(() => {
      expect(screen.getByTestId('city-page')).toBeInTheDocument();
    });
    expect(getCityMock).toHaveBeenCalledWith('lisbon');

    // Header content
    const header = screen.getByRole('heading', { name: /lisbon/i }).parentElement!;
    expect(within(header).getByText('Lisbon')).toBeInTheDocument();
    expect(within(header).getByText(', Portugal')).toBeInTheDocument();
    expect(within(header).getByText('Europe')).toBeInTheDocument();
    expect(within(header).getByText(/sunny atlantic coast/i)).toBeInTheDocument();

    // Back link is a real react-router Link pointing to /results.
    const back = within(header.parentElement!).getByRole('link', {
      name: /back to results/i,
    });
    expect(back.getAttribute('href')).toBe('/results');

    // 7 dimension scores: 5 in Overall + 5 in Career + 7 in Community.
    // FR-5 calls for the seven core dimensions; community and career
    // are sub-scores that surface in the visualization.
    const dims = screen.getByTestId('city-dims');
    // The 'Healthcare' label appears both in Overall and in Career, so
    // we scope the Overall-Healthcare lookup to its heading group.
    const overallGroup = within(dims).getByRole('heading', { name: 'Overall' }).parentElement!;
    expect(within(dims).getByTestId('dim-climate')).toBeInTheDocument();
    expect(within(dims).getByTestId('dim-cost-of-living')).toBeInTheDocument();
    expect(within(dims).getByTestId('dim-housing')).toBeInTheDocument();
    expect(within(dims).getByTestId('dim-education')).toBeInTheDocument();
    expect(within(overallGroup).getByTestId('dim-healthcare')).toBeInTheDocument();
    expect(within(dims).getByTestId('dim-military-safety')).toBeInTheDocument();
    expect(within(dims).getByTestId('dim-tech')).toBeInTheDocument();
    expect(within(dims).getByTestId('dim-urban')).toBeInTheDocument();

    // Climate label is rendered as a sub-value.
    expect(within(dims).getByText('Mediterranean')).toBeInTheDocument();
  });

  it('renders a 404-specific error state when the API returns 404', async () => {
    getCityMock.mockRejectedValueOnce(
      new ApiError(404, { error: 'not_found', message: 'City not found.' }),
    );
    renderCityPage('atlantis');
    const err = await screen.findByTestId('city-error');
    expect(err).toBeInTheDocument();
    expect(err.textContent).toMatch(/couldn’t load this city/i);
    expect(err.textContent).toMatch(/city not found/i);
  });

  it('renders the error state for a generic (non-ApiError) failure', async () => {
    getCityMock.mockRejectedValueOnce(new Error('network down'));
    renderCityPage('lisbon');
    const err = await screen.findByTestId('city-error');
    expect(err.textContent).toMatch(/network down/i);
  });

  it('falls back to a generic message for non-Error throws', async () => {
    getCityMock.mockRejectedValueOnce('weird string');
    renderCityPage('lisbon');
    const err = await screen.findByTestId('city-error');
    expect(err.textContent).toMatch(/could not load the city/i);
  });

  it('renders the meta block (coordinates + last updated) for the loaded city', async () => {
    getCityMock.mockResolvedValueOnce(makeCity({ last_updated: '2026-05-15' }));
    renderCityPage('lisbon');
    await screen.findByTestId('city-page');
    expect(screen.getByText(/38\.72°/)).toBeInTheDocument();
    // Two places now show the date: the meta block and the new "Data
    // last updated" footer (Screen-Specs §4 v0.3.0). The meta <time>
    // sits inside the header <dl>.
    const meta = screen.getByTestId('city-page__meta');
    const time = within(meta).getByText('2026-05-15');
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('datetime')).toBe('2026-05-15');
  });

  it('renders a labelled "Data last updated" footer (Screen-Specs §4, v0.3.0)', async () => {
    getCityMock.mockResolvedValueOnce(makeCity({ last_updated: '2026-05-15' }));
    renderCityPage('lisbon');
    await screen.findByTestId('city-page');
    const footer = screen.getByTestId('city-page-updated');
    expect(footer).toBeInTheDocument();
    expect(footer.textContent).toMatch(/Data last updated:\s*2026-05-15/);
  });

  it('toggles the city in the shortlist via the "Add to Comparison" button', async () => {
    const user = userEvent.setup();
    getCityMock.mockResolvedValueOnce(makeCity({ slug: 'lisbon' }));
    renderCityPage('lisbon');
    await screen.findByTestId('city-page');
    const btn = screen.getByTestId('city-toggle-shortlist');
    expect(btn.textContent).toMatch(/add to comparison/i);
    await user.click(btn);
    expect(btn.textContent).toMatch(/remove from comparison/i);
    // sessionStorage was updated.
    const stored = window.sessionStorage.getItem('rw:shortlist');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].city.slug).toBe('lisbon');
  });

  it('renders the country flag SVG next to the country name (FTC-16, v0.4.0)', async () => {
    getCityMock.mockResolvedValueOnce(
      makeCity({
        slug: 'lisbon',
        country: 'Portugal',
        country_code: 'PT',
        flag_image_url: '/flags/pt.svg',
      }),
    );
    renderCityPage('lisbon');
    await screen.findByTestId('city-page');
    const flag = screen.getByTestId('city-page-flag') as HTMLImageElement;
    expect(flag.tagName).toBe('IMG');
    expect(flag.src).toContain('/flags/pt.svg');
    expect(flag.alt).toMatch(/flag of portugal/i);
    // Visual-Guidelines §4.5: 24px wide, 3:2 aspect.
    expect(flag.getAttribute('width')).toBe('24');
    expect(flag.getAttribute('height')).toBe('16');
  });

  it('renders a lazy-loaded landmark photo in a 16:9 container (FTC-16, v0.4.0)', async () => {
    getCityMock.mockResolvedValueOnce(
      makeCity({
        slug: 'lisbon',
        landmark_image_url:
          'https://commons.wikimedia.org/wiki/Special:FilePath/Lisbon.jpg',
      }),
    );
    renderCityPage('lisbon');
    await screen.findByTestId('city-page');
    const figure = screen.getByTestId('city-page-landmark');
    expect(figure).toBeInTheDocument();
    // The container must enforce 16:9 aspect-ratio per Visual-Guidelines §4.6.
    expect(figure.className).toMatch(/city-page__landmark/);
    const img = figure.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('alt')).toMatch(/lisbon skyline/i);
  });

  it('renders the corrected Vancouver landmark URL (Bug 6 / v0.4.x)', async () => {
    const vancouver = makeCity({
      slug: 'vancouver-ca',
      name: 'Vancouver',
      landmark_image_url:
        'https://commons.wikimedia.org/wiki/Special:FilePath/Vancouver-Skyline-Night_(44931772).jpg',
    });
    getCityMock.mockImplementation(() => Promise.resolve(vancouver));
    renderCityPage('vancouver-ca');
    await screen.findByTestId('city-page');
    const figure = screen.getByTestId('city-page-landmark');
    const img = figure.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/Vancouver-Skyline-Night_(44931772).jpg',
    );
    expect(img.getAttribute('alt')).toMatch(/vancouver skyline/i);
  });

  it('renders the corrected Tel Aviv landmark URL (Bug 6 / v0.4.x)', async () => {
    const telAviv = makeCity({
      slug: 'tel-aviv-il',
      name: 'Tel Aviv',
      landmark_image_url:
        'https://commons.wikimedia.org/wiki/Special:FilePath/Tel%20Aviv%20Skyline%2001.jpg',
    });
    getCityMock.mockImplementation(() => Promise.resolve(telAviv));
    renderCityPage('tel-aviv-il');
    await screen.findByTestId('city-page');
    const figure = screen.getByTestId('city-page-landmark');
    const img = figure.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/Tel%20Aviv%20Skyline%2001.jpg',
    );
    expect(img.getAttribute('alt')).toMatch(/tel aviv skyline/i);
  });
});
