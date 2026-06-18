/**
 * Tests for ConsentBanner — PRD FR-13 / AC-11 / AC-12.
 *
 * The banner is the only surface in the MVP that interacts with
 * `localStorage` (Architecture §11: no cookies, no tracking). It must:
 *   1. Render on first visit (no `rw:cookie_consent` key set)
 *   2. Provide a link to the Privacy page
 *   3. Hide on accept or decline, and remember the choice
 *   4. Stay hidden on subsequent visits once a choice is stored
 *   5. Not throw when `localStorage` is unavailable (e.g. SSR / tests)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConsentBanner } from '../src/components/ConsentBanner';

const STORAGE_KEY = 'rw:cookie_consent';

function clearStorage() {
  window.localStorage.clear();
}

beforeEach(() => {
  clearStorage();
});

afterEach(() => {
  clearStorage();
  vi.restoreAllMocks();
});

function mount() {
  return render(
    <MemoryRouter>
      <ConsentBanner />
    </MemoryRouter>,
  );
}

describe('ConsentBanner', () => {
  it('renders on the first visit (no localStorage entry)', async () => {
    mount();
    await waitFor(() => {
      expect(screen.getByTestId('consent-banner')).toBeInTheDocument();
    });
    expect(screen.getByTestId('consent-accept')).toBeInTheDocument();
    expect(screen.getByTestId('consent-decline')).toBeInTheDocument();
  });

  it('contains a link to the privacy page', async () => {
    mount();
    await waitFor(() => {
      expect(screen.getByTestId('consent-banner')).toBeInTheDocument();
    });
    const link = screen.getByRole('link', { name: /privacy notice/i });
    expect(link).toHaveAttribute('href', '/privacy');
  });

  it('hides after Accept and remembers the choice in localStorage as "true"', async () => {
    const user = userEvent.setup();
    mount();
    await waitFor(() => {
      expect(screen.getByTestId('consent-banner')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('consent-accept'));
    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument();
    // FTC-1: Accept stores the boolean string "true".
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('hides after Decline and remembers the choice in localStorage as "false"', async () => {
    const user = userEvent.setup();
    mount();
    await waitFor(() => {
      expect(screen.getByTestId('consent-banner')).toBeInTheDocument();
    });
    await user.click(screen.getByTestId('consent-decline'));
    expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument();
    // FTC-1: Decline stores the boolean string "false".
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('stays hidden on subsequent visits once a choice is stored', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'true');
    mount();
    // The initial render sets state to 'pending'; the effect then
    // reads localStorage and hides the banner. Give the effect a tick.
    await waitFor(() => {
      expect(screen.queryByTestId('consent-banner')).not.toBeInTheDocument();
    });
  });
});
