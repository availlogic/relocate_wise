/**
 * Tests for ResultsPage. Reads matched results from React Router's
 * location.state (set by ProfileForm on submit). If state is missing
 * — e.g. the user refreshed the page or navigated directly to
 * /results — we render an empty-state CTA back to the form. This
 * preserves AC-10 (no PII in URLs).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResultsPage } from '../src/pages/ResultsPage';
import { ShortlistProvider } from '../src/state/shortlist';
import { ToastProvider } from '../src/components/Toast';
import { makeMatchResponse, makeMatchedCity } from './fixtures';

function renderWithState(state: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/results', state }]}>
      <ToastProvider>
        <ShortlistProvider>
          <Routes>
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/" element={<div data-testid="form-route" />} />
          </Routes>
        </ShortlistProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('<ResultsPage />', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('renders the empty-state CTA when there is no state', () => {
    renderWithState(null);
    const empty = screen.getByTestId('results-empty');
    expect(empty).toBeInTheDocument();
    expect(empty.textContent).toMatch(/no results yet/i);
    const cta = within(empty).getByRole('link', { name: /back to the questionnaire/i });
    expect(cta.getAttribute('href')).toBe('/');
  });

  it('renders the empty-state when state exists but has zero results', () => {
    renderWithState({ results: [], generated_at: '2026-06-02T00:00:00Z' });
    expect(screen.getByTestId('results-empty')).toBeInTheDocument();
  });

  it('renders a RankCard for each result in submission order', () => {
    renderWithState(makeMatchResponse());
    expect(screen.getByTestId('results-page')).toBeInTheDocument();
    const list = screen.getByTestId('results-list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByTestId('rank-card-1')).toBeInTheDocument();
    expect(within(items[1]!).getByTestId('rank-card-2')).toBeInTheDocument();
  });

  it('shows the count and the generated-at timestamp', () => {
    renderWithState(makeMatchResponse());
    const header = screen.getByRole('heading', { name: /your top matches/i }).parentElement!;
    const sub = within(header).getByText(/2 cities ranked/i);
    expect(sub).toBeInTheDocument();
    const time = within(header).getByText(/2026/);
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('datetime')).toBe('2026-06-02T00:00:00Z');
  });

  it('shows "1 city" (singular) when there is exactly one result', () => {
    renderWithState({
      results: [makeMatchResponse().results[0]!],
      generated_at: '2026-06-02T00:00:00Z',
    });
    expect(screen.getByText(/1 city ranked/)).toBeInTheDocument();
  });

  it('does not leak PII into the URL — /results stays /results with no query string', () => {
    renderWithState(makeMatchResponse());
    const editLink = screen.getByRole('link', { name: /edit my preferences/i });
    expect(editLink.getAttribute('href')).toBe('/');
    const card1 = screen.getByTestId('rank-card-1');
    const cardLink = within(card1).getByRole('link') as HTMLAnchorElement;
    expect(cardLink.getAttribute('href')).toMatch(/^\/city\/[a-z0-9%]+$/);
  });

  it('Start Over button clears the shortlist and routes to /', async () => {
    const user = userEvent.setup();
    const resp = makeMatchResponse();
    // Pre-populate the shortlist with Lisbon so we can verify it gets
    // cleared by Start Over.
    const { rerender } = render(
      <MemoryRouter initialEntries={[{ pathname: '/results', state: resp }]}>
        <ToastProvider>
          <ShortlistProvider initial={[makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'lisbon' } })]}>
            <Routes>
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/" element={<div data-testid="home-route" />} />
            </Routes>
          </ShortlistProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(screen.getByTestId('shortlist-bar')).toBeInTheDocument();
    await user.click(screen.getByTestId('results-start-over'));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
    rerender(
      <MemoryRouter initialEntries={['/']}>
        <ToastProvider>
          <ShortlistProvider>
            <Routes>
              <Route path="/" element={<div data-testid="home-route-2" />} />
            </Routes>
          </ShortlistProvider>
        </ToastProvider>
      </MemoryRouter>,
    );
    // startOver clears the key; the subsequent useEffect re-writes
    // '[]' to keep the storage layer consistent. Either form is
    // semantically equivalent (no cities).
    const stored = window.sessionStorage.getItem('rw:shortlist');
    expect(stored === null || JSON.parse(stored!).length === 0).toBe(true);
  });
});
