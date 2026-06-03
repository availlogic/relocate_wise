/**
 * Tests for the session-scoped shortlist (PRD S7 / FR-9).
 *
 * The shortlist is a React Context with a hard cap of 3 cities. These
 * tests drive the API directly with a TestRig that mounts the provider
 * and exposes the current value via a render prop — this is the same
 * pattern used by react-router's MemoryRouter tests, and it keeps the
 * tests focused on the contract (no DOM noise).
 */
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  SHORTLIST_MAX,
  ShortlistProvider,
  useShortlist,
  type ShortlistApi,
} from '../src/state/shortlist';
import { makeMatchedCity } from './fixtures';

function TestRig({
  onValue,
}: {
  onValue: (api: ShortlistApi) => void;
}) {
  const api = useShortlist();
  onValue(api);
  return (
    <>
      <button onClick={() => api.add(makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'a' } }))}>
        add-a
      </button>
    </>
  );
}

function renderRig() {
  let api!: ShortlistApi;
  const result = render(
    <ShortlistProvider>
      <TestRig onValue={(a) => { api = a; }} />
    </ShortlistProvider>,
  );
  return { ...result, getApi: () => api };
}

describe('ShortlistProvider / useShortlist', () => {
  it('starts empty', () => {
    const { getApi } = renderRig();
    expect(getApi().items).toEqual([]);
    expect(getApi().count).toBe(0);
    expect(getApi().isFull).toBe(false);
  });

  it('adds a city and reflects it in count/has', () => {
    const { getApi } = renderRig();
    act(() => getApi().add(makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'lisbon' } })));
    expect(getApi().count).toBe(1);
    expect(getApi().has('lisbon')).toBe(true);
    expect(getApi().has('berlin')).toBe(false);
    expect(getApi().items[0]!.city.slug).toBe('lisbon');
  });

  it('is a no-op when adding a duplicate slug', () => {
    const { getApi } = renderRig();
    const lisbon = makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'lisbon' } });
    act(() => getApi().add(lisbon));
    act(() => getApi().add(lisbon));
    act(() => getApi().add(lisbon));
    expect(getApi().count).toBe(1);
  });

  it('enforces a hard cap of 3 (SHORTLIST_MAX)', () => {
    const { getApi } = renderRig();
    for (const slug of ['a', 'b', 'c', 'd']) {
      act(() =>
        getApi().add(
          makeMatchedCity({ city: { ...makeMatchedCity().city, slug } }),
        ),
      );
    }
    expect(getApi().count).toBe(SHORTLIST_MAX);
    expect(getApi().isFull).toBe(true);
  });

  it('removes a city by slug', () => {
    const { getApi } = renderRig();
    act(() => getApi().add(makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'a' } })));
    act(() => getApi().add(makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'b' } })));
    act(() => getApi().remove('a'));
    expect(getApi().items.map((c) => c.city.slug)).toEqual(['b']);
  });

  it('remove() is a no-op for an unknown slug', () => {
    const { getApi } = renderRig();
    act(() => getApi().add(makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'a' } })));
    act(() => getApi().remove('zzz'));
    expect(getApi().count).toBe(1);
  });

  it('toggle() adds when missing and returns true', () => {
    const { getApi } = renderRig();
    let result = false;
    act(() => {
      result = getApi().toggle(
        makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'a' } }),
      );
    });
    expect(result).toBe(true);
    expect(getApi().has('a')).toBe(true);
  });

  it('toggle() removes when present and returns false', () => {
    const { getApi } = renderRig();
    const a = makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'a' } });
    act(() => getApi().add(a));
    let result = true;
    act(() => { result = getApi().toggle(a); });
    expect(result).toBe(false);
    expect(getApi().has('a')).toBe(false);
  });

  it('toggle() is a no-op (and returns false) when adding past the cap', () => {
    const { getApi } = renderRig();
    for (const slug of ['a', 'b', 'c']) {
      act(() => getApi().add(makeMatchedCity({ city: { ...makeMatchedCity().city, slug } })));
    }
    let result = true;
    act(() => {
      result = getApi().toggle(
        makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'd' } }),
      );
    });
    // Cap not crossed; toggle did not add; the function returns false
    // because the requested state ("now in shortlist") was not achieved.
    expect(result).toBe(false);
    expect(getApi().count).toBe(SHORTLIST_MAX);
    expect(getApi().has('d')).toBe(false);
  });

  it('clear() empties the shortlist', () => {
    const { getApi } = renderRig();
    act(() => getApi().add(makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'a' } })));
    act(() => getApi().add(makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'b' } })));
    act(() => getApi().clear());
    expect(getApi().count).toBe(0);
    expect(getApi().items).toEqual([]);
  });

  it('useShortlist() throws when used outside a ShortlistProvider', () => {
    // Avoid console noise from React's error boundary log.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Naked() {
      useShortlist();
      return null;
    }
    expect(() => render(<Naked />)).toThrow(/ShortlistProvider/);
    spy.mockRestore();
  });

  it('respects an `initial` seed (test escape hatch)', () => {
    const initial = [
      makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'a' } }),
      makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'b' } }),
    ];
    function Probe() {
      const api = useShortlist();
      return <span data-testid="count">{api.count}</span>;
    }
    render(
      <ShortlistProvider initial={initial}>
        <Probe />
      </ShortlistProvider>,
    );
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('user can still drive the API through a real click flow', async () => {
    const user = userEvent.setup();
    function Counter() {
      const api = useShortlist();
      return (
        <>
          <span data-testid="count">{api.count}</span>
          <button
            onClick={() => api.add(makeMatchedCity({ city: { ...makeMatchedCity().city, slug: 'x' } }))}
          >
            add
          </button>
          <button onClick={() => api.clear()}>clear</button>
        </>
      );
    }
    render(
      <ShortlistProvider>
        <Counter />
      </ShortlistProvider>,
    );
    expect(screen.getByTestId('count').textContent).toBe('0');
    await user.click(screen.getByText('add'));
    expect(screen.getByTestId('count').textContent).toBe('1');
    await user.click(screen.getByText('clear'));
    expect(screen.getByTestId('count').textContent).toBe('0');
  });
});
