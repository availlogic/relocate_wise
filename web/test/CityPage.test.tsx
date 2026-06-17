/**
 * Tests for CityPage. The page fetches `GET /api/cities/:slug` and
 * renders the seven dimension scores per FR-5. We mock the api module
 * so we can drive the loading / success / 404 / generic-error paths
 * deterministically.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
});
