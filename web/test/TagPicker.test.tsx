/**
 * Tests for TagPicker. Covers: empty state, toggling, max selection
 * enforcement, and the "no tags selected" copy.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagPicker } from '../src/components/TagPicker';

const OPTIONS = [
  { value: 'urban', label: 'Urban' },
  { value: 'coastal', label: 'Coastal' },
  { value: 'mountain', label: 'Mountain' },
];

describe('<TagPicker />', () => {
  it('renders one chip per option', () => {
    render(
      <TagPicker
        name="lifestyle"
        legend="Lifestyle"
        options={OPTIONS}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    for (const o of OPTIONS) {
      expect(screen.getByTestId(`lifestyle-${o.value}`)).toBeInTheDocument();
    }
  });

  it('marks selected chips with aria-pressed=true', () => {
    render(
      <TagPicker
        name="lifestyle"
        legend="Lifestyle"
        options={OPTIONS}
        selected={['urban']}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('lifestyle-urban').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('lifestyle-coastal').getAttribute('aria-pressed')).toBe('false');
  });

  it('adds a tag when an unselected chip is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagPicker
        name="lifestyle"
        legend="Lifestyle"
        options={OPTIONS}
        selected={['urban']}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId('lifestyle-coastal'));
    expect(onChange).toHaveBeenCalledWith(['urban', 'coastal']);
  });

  it('removes a tag when a selected chip is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagPicker
        name="lifestyle"
        legend="Lifestyle"
        options={OPTIONS}
        selected={['urban', 'coastal']}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByTestId('lifestyle-urban'));
    expect(onChange).toHaveBeenCalledWith(['coastal']);
  });

  it('does not add past maxSelections', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagPicker
        name="lifestyle"
        legend="Lifestyle"
        options={OPTIONS}
        selected={['urban', 'coastal']}
        onChange={onChange}
        maxSelections={2}
      />,
    );
    await user.click(screen.getByTestId('lifestyle-mountain'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the "no tags selected" copy when empty', () => {
    render(
      <TagPicker
        name="lifestyle"
        legend="Lifestyle"
        options={OPTIONS}
        selected={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/no preference/i)).toBeInTheDocument();
  });

  it('shows the selected count when non-empty', () => {
    render(
      <TagPicker
        name="lifestyle"
        legend="Lifestyle"
        options={OPTIONS}
        selected={['urban', 'coastal']}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('2 selected.')).toBeInTheDocument();
  });
});
