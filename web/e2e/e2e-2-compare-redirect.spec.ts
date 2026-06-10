/**
 * E2E-2: Direct /compare access with empty shortlist → redirect to /results.
 *
 * Per docs/E2E-Test-Scenarios.md §2.
 */
import { expect, test } from '@playwright/test';

test('E2E-2 direct /compare access with empty shortlist redirects to /results', async ({ page }) => {
  // Start clean: clear sessionStorage before navigation.
  await page.goto('/');
  await page.evaluate(() => window.sessionStorage.clear());
  await page.goto('/compare');

  // The redirect to /results should happen automatically; the compare
  // page is not rendered.
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByTestId('compare-page')).toHaveCount(0);
});