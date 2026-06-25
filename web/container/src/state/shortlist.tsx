/**
 * Session-scoped shortlist for side-by-side comparison.
 *
 * Implements PRD §3.1 S7, FR-9, and Acceptance-Criteria AC-7 + AC-9:
 *   - User can add any city to a session shortlist and remove it.
 *   - Maximum of 3 cities can be shortlisted at once.
 *   - The shortlist is cleared when the user starts a new quiz or
 *     closes the browser tab.
 *
 * Storage: `sessionStorage` key `rw:shortlist`. The browser clears
 * sessionStorage when the tab is closed (AC-9). We persist on every
 * mutation; on mount we hydrate from storage if present.
 *
 * The store keeps the full `MatchedCityFull` objects (not just slugs)
 * so the Compare page can render without re-hitting the API.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { MatchedCityFull } from '../api';

/** Hard cap from PRD S7. */
export const SHORTLIST_MAX = 3;

/** sessionStorage key. Versioned by suffix to allow future migrations. */
const STORAGE_KEY = 'rw:shortlist';

function readStorage(): MatchedCityFull[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as MatchedCityFull[];
  } catch {
    return [];
  }
}

function writeStorage(items: MatchedCityFull[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* sessionStorage may be unavailable (private mode, quota); ignore. */
  }
}

function clearStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

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
  /**
   * Reset for a new questionnaire — clears the shortlist (Acceptance
   * Criteria Feature 3 "Start Over" + E2E-3).
   */
  startOver: () => void;
}

const ShortlistContext = createContext<ShortlistApi | null>(null);

export interface ShortlistProviderProps {
  children: ReactNode;
  /**
   * Test-only seed. When supplied, takes precedence over the persisted
   * sessionStorage value (so tests don't leak state between runs).
   */
  initial?: MatchedCityFull[];
}

export function ShortlistProvider({
  children,
  initial,
}: ShortlistProviderProps) {
  const [items, setItems] = useState<MatchedCityFull[]>(() => initial ?? readStorage());
  const hydrated = useRef(initial !== undefined);

  // Persist on every change. Skip the very first render if we hydrated
  // from storage (no need to round-trip the same value).
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true;
      // Still write once so the value is normalised in storage.
    }
    writeStorage(items);
  }, [items]);

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

  const clear = useCallback(() => {
    setItems([]);
    clearStorage();
  }, []);

  const startOver = useCallback(() => {
    setItems([]);
    clearStorage();
  }, []);

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
      startOver,
    }),
    [items, add, remove, toggle, has, clear, startOver],
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