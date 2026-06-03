/**
 * Session-scoped shortlist for side-by-side comparison.
 *
 * Implements PRD §3.1 S7 and FR-9:
 *   - User can add any city to a session shortlist and remove it.
 *   - Maximum of 3 cities can be shortlisted at once.
 *
 * The shortlist is held entirely in React state (one per browser tab).
 * Refreshing the page clears it, which is intentional per AC-10 — no PII
 * is ever persisted, including no server-side or localStorage history.
 *
 * The store keeps the full `MatchedCityFull` objects (not just slugs) so
 * the Compare page can render without re-hitting the API.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { MatchedCityFull } from '../api';

/** Hard cap from PRD S7. */
export const SHORTLIST_MAX = 3;

export interface ShortlistApi {
  /** Ordered list of currently-shortlisted cities. */
  items: MatchedCityFull[];
  /** Number of items currently in the shortlist. */
  count: number;
  /** True when the shortlist has reached its cap. */
  isFull: boolean;
  /** Add a city. No-op if the city is already in the shortlist. */
  add: (city: MatchedCityFull) => void;
  /** Remove a city by slug. */
  remove: (slug: string) => void;
  /** Toggle a city's presence; returns the new selection state. */
  toggle: (city: MatchedCityFull) => boolean;
  /** True if the given slug is currently shortlisted. */
  has: (slug: string) => boolean;
  /** Empty the shortlist. */
  clear: () => void;
}

const ShortlistContext = createContext<ShortlistApi | null>(null);

export interface ShortlistProviderProps {
  children: ReactNode;
  /** Test-only seed so stories/tests can start with a known state. */
  initial?: MatchedCityFull[];
}

export function ShortlistProvider({
  children,
  initial = [],
}: ShortlistProviderProps) {
  const [items, setItems] = useState<MatchedCityFull[]>(initial);

  const has = useCallback(
    (slug: string) => items.some((c) => c.city.slug === slug),
    [items],
  );

  const add = useCallback((city: MatchedCityFull) => {
    setItems((prev) => {
      if (prev.some((c) => c.city.slug === city.city.slug)) return prev;
      if (prev.length >= SHORTLIST_MAX) return prev;
      return [...prev, city];
    });
  }, []);

  const remove = useCallback((slug: string) => {
    setItems((prev) => prev.filter((c) => c.city.slug !== slug));
  }, []);

  const toggle = useCallback(
    (city: MatchedCityFull): boolean => {
      let nextHas = false;
      setItems((prev) => {
        const present = prev.some((c) => c.city.slug === city.city.slug);
        nextHas = !present;
        if (present) return prev.filter((c) => c.city.slug !== city.city.slug);
        if (prev.length >= SHORTLIST_MAX) return prev; // cap, treat as no-op
        return [...prev, city];
      });
      return nextHas;
    },
    [],
  );

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<ShortlistApi>(
    () => ({
      items,
      count: items.length,
      isFull: items.length >= SHORTLIST_MAX,
      add,
      remove,
      toggle,
      has,
      clear,
    }),
    [items, add, remove, toggle, has, clear],
  );

  return (
    <ShortlistContext.Provider value={value}>
      {children}
    </ShortlistContext.Provider>
  );
}

/**
 * Hook for accessing the shortlist. Throws when used outside a provider
 * — the contract is "every page that needs the shortlist is wrapped by
 * <ShortlistProvider>" and the app is wired that way in App.tsx.
 */
export function useShortlist(): ShortlistApi {
  const ctx = useContext(ShortlistContext);
  if (!ctx) {
    throw new Error('useShortlist must be used inside a <ShortlistProvider>');
  }
  return ctx;
}
