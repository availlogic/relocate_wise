/**
 * Public entry point for `@relocatewise/web-compare-mfe`.
 *
 * The container loads this module via
 * `React.lazy(() => import('@relocatewise/web-compare-mfe'))` and reads
 * the named exports below.
 *
 * Architecture v1.4.0 §4.1: "Compare MFE: Manages the comparison
 * dashboard, aligning the 8 dimensions. Highlight logic is executed
 * here."
 */
export { ComparePage } from './ComparePage.js';