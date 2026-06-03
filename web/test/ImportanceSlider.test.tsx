/**
 * Tests for ImportanceSlider. Covers: 0..3 scale, controlled value,
 * descriptive text, and keyboard/click behavior.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportanceSlider } from '../src/components/ImportanceSlider';

describe('<ImportanceSlider />', () => {
  it('renders the legend and four level buttons', () => {
    render(
      <ImportanceSlider name="cost" legend="Cost" value={0} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Cost')).toBeInTheDocument();
    for (const v of [0, 1, 2, 3]) {
      expect(screen.getByTestId(`cost-${v}`)).toBeInTheDocument();
    }
  });

  it('marks the current value as active', () => {
    render(
      <ImportanceSlider name="cost" legend="Cost" value={2} onChange={vi.fn()} />,
    );
    const active = screen.getByTestId('cost-2');
    expect(active.className).toMatch(/is-active/);
    const inactive = screen.getByTestId('cost-0');
    expect(inactive.className).not.toMatch(/is-active/);
  });

  it('fires onChange with the new importance value on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ImportanceSlider name="cost" legend="Cost" value={0} onChange={onChange} />,
    );
    await user.click(screen.getByTestId('cost-3'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('shows the description for the currently selected level', () => {
    render(
      <ImportanceSlider name="cost" legend="Cost" value={3} onChange={vi.fn()} />,
    );
    const desc = screen.getByTestId('cost-desc');
    expect(desc.textContent).toMatch(/Critical/);
    expect(desc.textContent).toMatch(/Deal-breaker/);
  });

  it('shows the help text when provided', () => {
    render(
      <ImportanceSlider
        name="cost"
        legend="Cost"
        value={0}
        onChange={vi.fn()}
        helpText="How much should the day-to-day cost matter?"
      />,
    );
    expect(
      screen.getByText('How much should the day-to-day cost matter?'),
    ).toBeInTheDocument();
  });
});
