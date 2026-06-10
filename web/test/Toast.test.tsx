/**
 * Tests for the Toast component.
 *
 * Covers: push renders a message, dismiss removes a toast, the close
 * button works, and the no-op fallback (when used outside a provider)
 * does not throw.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../src/components/Toast';

function Consumer({ onReady }: { onReady: (push: (m: string) => void) => void }) {
  const toast = useToast();
  onReady(toast.push);
  return null;
}

function renderWithProvider() {
  let pushFn!: (m: string) => void;
  render(
    <ToastProvider>
      <Consumer onReady={(p) => { pushFn = p; }} />
    </ToastProvider>,
  );
  return { push: (m: string) => pushFn(m) };
}

describe('<Toast />', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a pushed message inside the stack', () => {
    const { push } = renderWithProvider();
    act(() => {
      push('You can compare up to 3 cities. Please remove one first.');
    });
    expect(screen.getByTestId('toast-stack')).toBeInTheDocument();
    expect(screen.getByText(/compare up to 3 cities/i)).toBeInTheDocument();
  });

  it('renders multiple stacked toasts', () => {
    const { push } = renderWithProvider();
    act(() => {
      push('First');
      push('Second');
    });
    const stack = screen.getByTestId('toast-stack');
    expect(within(stack).getByText('First')).toBeInTheDocument();
    expect(within(stack).getByText('Second')).toBeInTheDocument();
  });

  it('close button dismisses the toast', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { push } = renderWithProvider();
    act(() => {
      push('Dismissable');
    });
    const closeBtn = screen.getByLabelText('Dismiss notification');
    await user.click(closeBtn);
    expect(screen.queryByText('Dismissable')).not.toBeInTheDocument();
  });

  it('useToast returns a no-op API outside a provider (test fallback)', () => {
    function Naked() {
      const t = useToast();
      expect(t.entries).toEqual([]);
      // Should not throw.
      t.push('hi');
      t.dismiss(0);
      return null;
    }
    expect(() => render(<Naked />)).not.toThrow();
  });
});