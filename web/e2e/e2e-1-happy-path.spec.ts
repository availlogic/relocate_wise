/**
 * E2E-1: Landing → Questionnaire → Results → Profile → Shortlist → Compare.
 *
 * Per docs/E2E-Test-Scenarios.md §1, the "happy path" scenario. The
 * browser drives the actual built bundle + Fastify API in real time.
 */
import { expect, test } from '@playwright/test';

test('E2E-1 happy path: quiz → results → profile → shortlist → compare', async ({ page }) => {
  await page.goto('/');

  // 1. Accept the cookie consent banner.
  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('consent-banner')).toHaveCount(0);

  // 2. Start the questionnaire.
  await page.getByTestId('landing-cta').click();
  await expect(page).toHaveURL(/\/q$/);

  // 3. Walk all 8 steps with explicit choices. The radio inputs are
  // visually hidden (opacity 0, pointer-events none) so we click the
  // wrapping label via its testid. Playwright sometimes tries to
  // click the inner <strong> instead — use `force: true` to bypass
  // the actionability check.
  const clickOpt = async (testid: string) => {
    await page.getByTestId(testid).click({ force: true });
  };
  const next = async () => {
    await page.getByTestId('wizard-next').click();
  };

  // Step 1: climate = Mediterranean.
  await clickOpt('climate-mediterranean');
  await next();

  // Step 2: housing budget = 3.
  await clickOpt('budget-3');
  await next();

  // Step 3: career = tech.
  await clickOpt('career-tech');
  await next();

  // Step 4: healthcare = 3.
  await clickOpt('healthcare-3');
  await next();

  // Step 5: education = important.
  await clickOpt('education-important');
  await next();

  // Step 6: community = urban + coastal.
  await clickOpt('community-urban');
  await clickOpt('community-coastal');
  await next();

  // Step 7: density = urban.
  await clickOpt('density-urban');
  await next();

  // Step 8: military safety = 3. Submit.
  await clickOpt('military-safety-3');
  const step = await page.getByTestId('progress-bar').getAttribute('aria-valuenow');
  expect(step).toBe('8');
  await page.getByTestId('submit').click();

  // 4. /results: 10 cards. The top match's "why" must reference at
  // least one of the user's priorities. We use a flexible pattern
  // because the matching engine picks the top dimensions by
  // contribution; depending on the dataset, the climate match may
  // not be the leading contributor.
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByTestId('results-page')).toBeVisible();
  await expect(page.getByTestId('rank-card-1')).toBeVisible();
  await expect(page.getByTestId('rank-card-1-why')).toContainText(
    /climate|budget|cost|housing|tech|lifestyle|safety|military/i,
  );

  // 5. View profile, add to shortlist from the city page, then
  //    navigate back to /results via the in-page back link.
  await page.getByTestId('rank-card-1-link').click();
  await expect(page).toHaveURL(/\/city\//);
  await expect(page.getByTestId('city-page')).toBeVisible();
  await page.getByTestId('city-toggle-shortlist').click();
  await expect(page.getByTestId('shortlist-bar')).toBeVisible();

  // 6. Navigate to /results via the in-page back link. The session
  //    cache (rw:last-results) restores the rank list when the
  //    location.state is empty after the city-page detour.
  await page.getByTestId('city-page__back').click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByTestId('results-page')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid^="rank-card-"]').first()).toBeVisible();

  // 7. Add a 2nd city from the list.
  const checkboxes = page.locator('[data-testid$="-compare-checkbox"]');
  const total = await checkboxes.count();
  for (let i = 1; i < total; i++) {
    const cb = checkboxes.nth(i);
    if (!(await cb.isChecked())) {
      await cb.check();
      break;
    }
  }

  // 8. The shortlist bar's Compare now button is enabled at 2 cities.
  await expect(page.getByTestId('shortlist-bar')).toBeVisible();
  await page.getByTestId('shortlist-bar-compare').click();
  await expect(page).toHaveURL(/\/compare$/);

  // 9. /compare renders the 2-column grid + 8-row table (v0.3.0).
  await expect(page.getByTestId('compare-page')).toBeVisible();
  await expect(page.getByTestId('compare-table')).toBeVisible();
  const cardCount = await page.locator('[data-testid^="compare-card-"]').count();
  expect(cardCount).toBe(2);
  await expect(page.getByTestId('compare-row-military-safety')).toBeVisible();
});