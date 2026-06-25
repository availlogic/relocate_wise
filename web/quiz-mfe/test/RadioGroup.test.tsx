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

  it('applies the is-active class to the selected option label so the user sees their pick', () => {
    render(
      <RadioGroup
        name="climate"
        legend="Climate"
        options={OPTIONS}
        value={'a' as 'a' | 'b'}
        onChange={vi.fn()}
      />,
    );
    // The visible label that wraps the (hidden) radio input must carry
    // the is-active class so it stands out from the unselected siblings.
    const aLabel = screen.getByTestId('climate-a').closest('label')!;
    const bLabel = screen.getByTestId('climate-b').closest('label')!;
    expect(aLabel.className).toMatch(/\bis-active\b/);
    expect(bLabel.className).not.toMatch(/\bis-active\b/);
  });

  it('moves the is-active class when the controlled value changes', () => {
    const { rerender } = render(
      <RadioGroup
        name="climate"
        legend="Climate"
        options={OPTIONS}
        value={'a' as 'a' | 'b'}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId('climate-a').closest('label')!.className,
    ).toMatch(/\bis-active\b/);
    expect(
      screen.getByTestId('climate-b').closest('label')!.className,
    ).not.toMatch(/\bis-active\b/);

    rerender(
      <RadioGroup
        name="climate"
        legend="Climate"
        options={OPTIONS}
        value={'b' as 'a' | 'b'}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByTestId('climate-a').closest('label')!.className,
    ).not.toMatch(/\bis-active\b/);
    expect(
      screen.getByTestId('climate-b').closest('label')!.className,
    ).toMatch(/\bis-active\b/);
  });

  it('marks the "No preference" option as is-active when value is null and nullable', () => {
    render(
      <RadioGroup
        name="climate"
        legend="Climate"
        options={OPTIONS}
        value={null}
        onChange={vi.fn()}
        nullable
      />,
    );
    const nullLabel = screen.getByTestId('climate-null').closest('label')!;
    const aLabel = screen.getByTestId('climate-a').closest('label')!;
    expect(nullLabel.className).toMatch(/\bis-active\b/);
    expect(aLabel.className).not.toMatch(/\bis-active\b/);
  });

  it('moves is-active off "No preference" when a concrete option is selected', () => {
    const { rerender } = render(
      <RadioGroup
        name="climate"
        legend="Climate"
        options={OPTIONS}
        value={null}
        onChange={vi.fn()}
        nullable
      />,
    );
    expect(
      screen.getByTestId('climate-null').closest('label')!.className,
    ).toMatch(/\bis-active\b/);

    rerender(
      <RadioGroup
        name="climate"
        legend="Climate"
        options={OPTIONS}
        value={'b' as 'a' | 'b'}
        onChange={vi.fn()}
        nullable
      />,
    );
    expect(
      screen.getByTestId('climate-null').closest('label')!.className,
    ).not.toMatch(/\bis-active\b/);
    expect(
      screen.getByTestId('climate-b').closest('label')!.className,
    ).toMatch(/\bis-active\b/);
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
