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
 * @param whyVars  variables to interpolate into the template
 *                (e.g. `{ climate: 'mediterranean' }`). For tied
 *                reasons, this also carries `secondary_key` and
 *                `secondary_vars` (v0.4.x — Bug 4).
 */
export function renderWhyTemplate(
  t: TFunction,
  why: string,
  whyKey?: string,
  // Variables are typed as `unknown` because `secondary_vars` is a
  // nested record (the tied-reason case in v0.4.x — Bug 4) and
  // i18next interpolates them with its own semantics. The shape is
  // validated at runtime by the matching engine / API tests.
  whyVars?: Record<string, unknown>,
): string {
  if (whyKey && KNOWN_WHY_KEYS.has(whyKey)) {
    // The bound `t` is a function with no enumerable properties, so
    // we can't read the active language off it directly. Use the
    // shared i18n singleton's `language` field, which i18next updates
    // synchronously when `setLanguage()` resolves (v0.4.x — Bug 4).
    const lang = (currentI18n.language ?? 'en').toLowerCase();
    // i18next's TFunction expects a `$Dictionary` (string-indexed
    // record). Cast here since we accept a wider `Record<string,
    // unknown>` for the secondary_vars nesting case.
    const primary = t(
      `why.${whyKey}`,
      whyVars as Record<string, string>,
    );
    const secondaryKey = whyVars?.secondary_key as string | undefined;
    if (secondaryKey && KNOWN_WHY_KEYS.has(secondaryKey)) {
      const secondary = t(
        `why.${secondaryKey}`,
        ((whyVars?.secondary_vars ?? {}) as Record<string, string>),
      );
      const joiner = lang.startsWith('zh') ? ' 且 ' : ' and ';
      return `${primary}${joiner}${secondary}`;
    }
    return primary;
  }
  return why;
}

// Import the i18n singleton at module scope. `i18n/index.ts` does not
// import from `./why.ts`, so there is no circular dependency. The
// `language` field is read-only here; mutations go through `setLanguage`.
import { default as currentI18n } from './index.js';