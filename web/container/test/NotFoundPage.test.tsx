/**
 * Tests for NotFoundPage. Renders a 404 message and a link back to the
 * home questionnaire at "/".
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from '../src/pages/NotFoundPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <NotFoundPage />
    </MemoryRouter>,
  );
}

describe('<NotFoundPage />', () => {
  it('renders a 404 message with the testid hook', () => {
    renderPage();
    const root = screen.getByTestId('not-found');
    expect(root).toBeInTheDocument();
    expect(root.textContent).toMatch(/page not found/i);
  });

  it('provides a link back to the questionnaire', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /back to the questionnaire/i });
    expect(link.getAttribute('href')).toBe('/');
  });
});
