/**
 * Templated "why this fits you" rendering (Architecture §6.5, PRD
 * v3.2.0 S11, Acceptance-Criteria Feature 6).
 *
 * The matching engine (`api/src/matching/why.ts`) emits a `why_key`
 * (one of the documented dimension codes) and a `why_vars` object
 * for every ranked city. The frontend resolves the key through
 * i18next with the supplied vars so the explanation is rendered in
 * the active language.
 *
 * Backwards-compatible: if the API hasn't been upgraded to emit
 * `why_key` / `why_vars` (older results in the sessionStorage cache),
 * the legacy English `why` string is returned verbatim so the UI
 * never goes blank.
 */
import type { TFunction } from 'i18next';

const KNOWN_WHY_KEYS = new Set([
  'climate',
  'cost',
  'housing',
  'career',
  'education',
  'healthcare',
  'community',
  'military_safety',
]);

/**
 * Render the "why this fits you" sentence in the active locale.
 *
 * @param t  i18next `t` function (typed as `TFunction` for testability).
 * @param why  legacy English fallback string (kept in the wire shape).
 * @param whyKey  dimension key, one of `KNOWN_WHY_KEYS`.
 * @param whyVars  variables for the template (e.g. `{ climate: 'mediterranean' }`).
 */
export function renderWhyTemplate(
  t: TFunction,
  why: string,
  whyKey?: string,
  whyVars?: Record<string, string>,
): string {
  if (whyKey && KNOWN_WHY_KEYS.has(whyKey)) {
    return t(`why.${whyKey}`, whyVars ?? {});
  }
  return why;
}