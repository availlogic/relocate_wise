/**
 * E2E-3: Re-quiz clears the shortlist.
 *
 * Per docs/E2E-Test-Scenarios.md §3, after a "Start Over" the user's
 * session state is wiped.
 */
import { expect, test } from '@playwright/test';

test('E2E-3 Start Over clears the shortlist and routes to landing', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.sessionStorage.clear());
  await page.goto('/');
  await page.getByTestId('consent-accept').click();

  // Run a quick quiz end-to-end so we land on /results.
  await page.getByTestId('landing-cta').click();
  await page.getByTestId('climate-mediterranean').click({ force: true });
  // 6 next-clicks walk steps 1..7 (the climate click keeps us on
  // step 1; each next advances by one).
  for (let i = 0; i < 6; i++) await page.getByTestId('wizard-next').click();
  await page.getByTestId('submit').click();
  await expect(page).toHaveURL(/\/results$/);

  // Shortlist one city.
  await page.getByTestId('rank-card-1-compare-checkbox').check();
  await expect(page.getByTestId('shortlist-bar')).toBeVisible();

  // Start over.
  await page.getByTestId('results-start-over').click();
  await expect(page).toHaveURL(/\/$/);

  // Re-navigate to /compare — should redirect because shortlist is empty.
  await page.goto('/compare');
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByTestId('compare-page')).toHaveCount(0);

  // The shortlist-bar must be absent on /results.
  await expect(page.getByTestId('shortlist-bar')).toHaveCount(0);
});