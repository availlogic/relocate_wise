/**
 * Session-scoped cache for the latest `/api/match` response.
 *
 * When the user submits the questionnaire the response is passed to
 * /results via React Router's `location.state`. But that state is
 * lost when the user navigates forward (e.g. /city/:slug) and then
 * comes back via a hard redirect (e.g. <Navigate replace /> from
 * /compare, or `page.goto('/results')` in an E2E test). To avoid
 * "No results yet" flashes we also persist the latest result to
 * `sessionStorage` and rehydrate on mount.
 *
 * The cache is single-entry — only the most recent quiz result is
 * kept. Submitting a new questionnaire overwrites it. "Start Over"
 * does NOT clear it (the user can re-rank without losing their
 * previous outcome as a fallback). Closing the tab clears it via
 * the standard sessionStorage semantics (AC-9).
 */
import type { MatchResponseFull } from '../api';

const STORAGE_KEY = 'rw:last-results';

export function readCachedResults(): MatchResponseFull | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'results' in parsed &&
      Array.isArray((parsed as MatchResponseFull).results)
    ) {
      return parsed as MatchResponseFull;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeCachedResults(response: MatchResponseFull): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(response));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearCachedResults(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}