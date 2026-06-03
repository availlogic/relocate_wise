/**
 * Tests for PrivacyPage. Locks the policy down to its real commitments:
 * no PII, no account, no tracking, no third-party sharing, no server-side
 * history. We also check the link back home so the user can return without
 * using browser history.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPage } from '../src/pages/PrivacyPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  );
}

describe('<PrivacyPage />', () => {
  it('renders a privacy heading', () => {
    renderPage();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent?.toLowerCase()).toMatch(/privacy/);
  });

  it('states that no personal information is collected', () => {
    renderPage();
    const root = screen.getByTestId('privacy');
    expect(root.textContent?.toLowerCase()).toMatch(
      /no personal information|no account|no email/,
    );
  });

  it('states that there is no third-party tracking', () => {
    renderPage();
    expect(screen.getByTestId('privacy').textContent?.toLowerCase()).toMatch(
      /no (third[- ]party )?tracking/,
    );
  });

  it('states that answers are not stored on the server', () => {
    renderPage();
    expect(screen.getByTestId('privacy').textContent?.toLowerCase()).toMatch(
      /not stored|not used to train|single request/,
    );
  });

  it('has a link back to the homepage', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /back|home/i });
    expect(link.getAttribute('href')).toBe('/');
  });

  it('does not contain any form or input (no signup wall)', () => {
    renderPage();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sign up|register|subscribe/i }))
      .not.toBeInTheDocument();
  });
});
