/**
 * E2E-7 — Micro-Frontend Decoupled Lazy Loading.
 *
 * Verifies the documented contract from docs/E2E-Test-Scenarios.md
 * §4: when the user navigates between routes, each MFE's chunk is
 * fetched on demand. The container shell + i18n bundle load on the
 * first paint; the MFE chunks only load when their route is visited.
 *
 * Architecture v1.4.0 §3 (Phase D, v1.0.0 GA): the Vite container
 * build emits three named chunks — `quiz-mfe`, `dashboard-mfe`,
 * `compare-mfe` — via `manualChunks`. The browser fetches them via
 * `import('@relocatewise/web-quiz-mfe')` etc. when React.lazy
 * resolves the route.
 */
import { expect, test } from '@playwright/test';

test('E2E-7: Micro-Frontend chunks load on demand per route', async ({
  page,
}) => {
  // Land on the homepage; the container shell + i18n bundle should
  // load. None of the MFE chunks should be fetched yet.
  const mfeRequests: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (
      url.includes('quiz-mfe') ||
      url.includes('dashboard-mfe') ||
      url.includes('compare-mfe')
    ) {
      mfeRequests.push(url);
    }
  });

  await page.goto('/');
  await expect(page.getByTestId('landing')).toBeVisible();
  // Give the network a moment to settle.
  await page.waitForTimeout(200);
  expect(mfeRequests, 'no MFE chunks on the landing page').toHaveLength(0);

  // Navigate to /q — the quiz-mfe chunk should fetch.
  await page.getByTestId('landing-cta').click();
  await expect(page).toHaveURL(/\/q$/);
  await expect(page.getByTestId('profile-form')).toBeVisible();
  expect(
    mfeRequests.some((u) => u.includes('quiz-mfe')),
    'quiz-mfe chunk should have loaded on /q',
  ).toBe(true);

  // Wipe the log and navigate to /compare (we'll need to shortlist a
  // city first via /results). For now, just confirm the chunk load
  // works on direct nav: the container renders a Navigate-to-results
  // hint when the shortlist has <2 cities.
  const beforeCompare = mfeRequests.length;
  await page.goto('/compare');
  await expect(page.getByTestId('compare-page')).toBeVisible();
  expect(mfeRequests.length).toBeGreaterThan(beforeCompare);
  expect(
    mfeRequests.some((u) => u.includes('compare-mfe')),
    'compare-mfe chunk should have loaded on /compare',
  ).toBe(true);

  // Navigate to a city profile — the dashboard-mfe chunk should fetch.
  const beforeCity = mfeRequests.length;
  await page.goto('/city/lisbon-pt');
  await expect(page.getByTestId('city-page')).toBeVisible();
  expect(mfeRequests.length).toBeGreaterThan(beforeCity);
  expect(
    mfeRequests.some((u) => u.includes('dashboard-mfe')),
    'dashboard-mfe chunk should have loaded on /city/:slug',
  ).toBe(true);
});