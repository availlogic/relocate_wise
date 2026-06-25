/**
 * Tests for the floating ShortlistBar (Acceptance-Criteria Feature 4).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ShortlistBar } from '../src/components/ShortlistBar';
import { ShortlistProvider } from '../src/state/shortlist';
import { ToastProvider } from '../src/components/Toast';
import { makeMatchedCity } from './fixtures';

function make(slug: string, name: string) {
  return makeMatchedCity({
    city: { ...makeMatchedCity().city, slug, name },
    score: 80,
    why: `${name} fits.`,
  });
}

function renderBar(initial: ReturnType<typeof make>[] = []) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ShortlistProvider initial={initial}>
          <ShortlistBar />
        </ShortlistProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('<ShortlistBar />', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    window.sessionStorage.clear();
  });

  it('renders nothing when the shortlist is empty', () => {
    renderBar();
    expect(screen.queryByTestId('shortlist-bar')).not.toBeInTheDocument();
  });

  it('renders the count and chips for each shortlisted city', () => {
    renderBar([make('lisbon', 'Lisbon'), make('berlin', 'Berlin')]);
    const bar = screen.getByTestId('shortlist-bar');
    expect(within(bar).getByTestId('shortlist-bar-count').textContent).toBe('2 of 3 selected');
    expect(within(bar).getByTestId('shortlist-bar-chip-lisbon')).toBeInTheDocument();
    expect(within(bar).getByTestId('shortlist-bar-chip-berlin')).toBeInTheDocument();
  });

  it('Compare Now is disabled when count < 2', () => {
    renderBar([make('lisbon', 'Lisbon')]);
    const link = screen.getByTestId('shortlist-bar-compare');
    expect(link).toHaveAttribute('aria-disabled', 'true');
  });

  it('Compare Now is enabled when count >= 2', () => {
    renderBar([make('lisbon', 'Lisbon'), make('berlin', 'Berlin')]);
    const link = screen.getByTestId('shortlist-bar-compare');
    expect(link).toHaveAttribute('aria-disabled', 'false');
  });

  it('chip X removes a single city from the shortlist', async () => {
    const user = userEvent.setup();
    renderBar([make('lisbon', 'Lisbon'), make('berlin', 'Berlin')]);
    await user.click(screen.getByTestId('shortlist-bar-remove-lisbon'));
    expect(screen.queryByTestId('shortlist-bar-chip-lisbon')).not.toBeInTheDocument();
    expect(screen.getByTestId('shortlist-bar-chip-berlin')).toBeInTheDocument();
  });

  it('Clear all empties the shortlist', async () => {
    const user = userEvent.setup();
    renderBar([make('lisbon', 'Lisbon'), make('berlin', 'Berlin')]);
    await user.click(screen.getByTestId('shortlist-bar-clear'));
    expect(screen.queryByTestId('shortlist-bar')).not.toBeInTheDocument();
  });
});