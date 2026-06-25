/**
 * Tests for LandingPage. We assert on the contract — the headline
 * promise, the CTA target, the value-props grid, and the privacy link
 * — without locking in the exact wording of the marketing sentence.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '../src/pages/LandingPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('<LandingPage />', () => {
  it('renders the headline promise', () => {
    renderPage();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent?.toLowerCase()).toMatch(/home|data|city/);
  });

  it('renders a single primary CTA that routes to /q', () => {
    renderPage();
    const cta = screen.getByTestId('landing-cta');
    expect(cta).toBeInTheDocument();
    expect(cta.getAttribute('href')).toBe('/q');
    expect(cta.textContent).toMatch(/questionnaire|start/i);
  });

  it('renders a link to the privacy page', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /privacy|data|handled/i });
    expect(link.getAttribute('href')).toBe('/privacy');
  });

  it('does not require any user input to render', () => {
    // No forms, no required text fields, no email capture.
    renderPage();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /email/i })).not.toBeInTheDocument();
  });

  it('uses the landing testid on its root', () => {
    renderPage();
    expect(screen.getByTestId('landing')).toBeInTheDocument();
  });

  it('renders the three-card value-props grid (Screen-Specs §1, v0.3.0)', () => {
    renderPage();
    expect(screen.getByTestId('landing-values')).toBeInTheDocument();
    expect(screen.getByTestId('value-objective')).toBeInTheDocument();
    expect(screen.getByTestId('value-comparisons')).toBeInTheDocument();
    expect(screen.getByTestId('value-privacy')).toBeInTheDocument();
  });
});
