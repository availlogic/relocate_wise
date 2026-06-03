/**
 * Tests for RadioGroup. Covers: rendering, controlled selection, the
 * optional "no preference" choice, accessibility wiring, and the help
 * text association.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup } from '../src/components/RadioGroup';

const OPTIONS = [
  { value: 'a', label: 'Option A' },
  { value: 'b', label: 'Option B', description: 'desc' },
];

describe('<RadioGroup />', () => {
  it('renders the legend and all options', () => {
    render(
      <RadioGroup
        name="climate"
        legend="Climate"
        options={OPTIONS}
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Climate')).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('— desc')).toBeInTheDocument();
  });

  it('marks the selected option as checked', () => {
    render(
      <RadioGroup
        name="climate"
        legend="Climate"
        options={OPTIONS}
        value={'a' as 'a' | 'b'}
        onChange={vi.fn()}
      />,
    );
    const a = screen.getByTestId('climate-a') as HTMLInputElement;
    const b = screen.getByTestId('climate-b') as HTMLInputElement;
    expect(a.checked).toBe(true);
    expect(b.checked).toBe(false);
  });

  it('fires onChange with the chosen value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup
        name="climate"
        legend="Climate"
        options={OPTIONS}
        value={null}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId('climate-b'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('renders a "No preference" choice when nullable=true and clears value on click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <RadioGroup
        name="climate"
        legend="Climate"
        options={OPTIONS}
        value={'a' as 'a' | 'b'}
        onChange={onChange}
        nullable
      />,
    );
    const noPref = screen.getByTestId('climate-null') as HTMLInputElement;
    expect(noPref).toBeInTheDocument();
    expect(noPref.checked).toBe(false);
    await user.click(noPref);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('associates help text with the fieldset via aria-describedby', () => {
    render(
      <RadioGroup
        name="climate"
        legend="Climate"
        options={OPTIONS}
        value={null}
        onChange={vi.fn()}
        helpText="Pick one that matches your day"
      />,
    );
    const group = screen.getByTestId('radio-group-climate');
    expect(group).toHaveAttribute('aria-describedby', 'climate-help');
    expect(screen.getByText('Pick one that matches your day')).toHaveAttribute(
      'id',
      'climate-help',
    );
  });

  it('appends a "*" to the legend when required', () => {
    render(
      <RadioGroup
        name="climate"
        legend="Climate"
        options={OPTIONS}
        value={null}
        onChange={vi.fn()}
        required
      />,
    );
    const legend = screen.getByText((_, el) =>
      el?.tagName === 'LEGEND' && el.textContent?.trim().startsWith('Climate') === true,
    );
    expect(legend.textContent).toMatch(/Climate\s*\*/);
  });
});
