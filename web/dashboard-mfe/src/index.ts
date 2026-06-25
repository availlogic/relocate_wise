/**
 * Public entry point for `@relocatewise/web-dashboard-mfe`.
 *
 * The container loads this module via
 * `React.lazy(() => import('@relocatewise/web-dashboard-mfe'))` and reads
 * the named exports below.
 *
 * Architecture v1.4.0 §4.1: "Dashboard MFE: Displays individual city
 * profiles, metric scores, flag graphics, and landmark images." This
 * module owns BOTH `/results` and `/city/:slug`; they're bundled into
 * the same chunk because they share the `CityDimensions` and
 * `RankCard` building blocks.
 */
export { ResultsPage } from './components/ResultsPage.js';
export { CityPage } from './components/CityPage.js';