/**
 * Tests for CeilingSlider. Covers: 1..5 scale, null state, click
 * toggles, and the optional per-level label override.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CeilingSlider } from '../src/components/CeilingSlider';

describe('<CeilingSlider />', () => {
  it('renders the legend and 5 levels', () => {
    render(
      <CeilingSlider name="ceiling" legend="Max cost" value={null} onChange={vi.fn()} />,
    );
    for (const v of [1, 2, 3, 4, 5]) {
      expect(screen.getByTestId(`ceiling-${v}`)).toBeInTheDocument();
    }
  });

  it('uses default level labels by default', () => {
    render(
      <CeilingSlider name="ceiling" legend="Max cost" value={3} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Average')).toBeInTheDocument();
    expect(screen.getByText('Very high')).toBeInTheDocument();
  });

  it('accepts a custom levelLabels array', () => {
    render(
      <CeilingSlider
        name="ceiling"
        legend="Max cost"
        value={null}
        onChange={vi.fn()}
        levelLabels={['a', 'b', 'c', 'd', 'e']}
      />,
    );
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('e')).toBeInTheDocument();
  });

  it('marks the active level', () => {
    render(
      <CeilingSlider name="ceiling" legend="Max cost" value={4} onChange={vi.fn()} />,
    );
    expect(screen.getByTestId('ceiling-4').className).toMatch(/is-active/);
    expect(screen.getByTestId('ceiling-2').className).not.toMatch(/is-active/);
  });

  it('fires onChange with the picked level on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CeilingSlider name="ceiling" legend="Max cost" value={null} onChange={onChange} />,
    );
    await user.click(screen.getByTestId('ceiling-3'));
    expect(onChange).toHaveBeenCalledWith(3);
  });
});
