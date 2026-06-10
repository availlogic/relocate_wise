/**
 * E2E-4: Browser tab close purges the shortlist.
 *
 * Per docs/E2E-Test-Scenarios.md §4. Verifies the session-scoped
 * shortlist is cleared when the browser context is closed.
 */
import { expect, test } from '@playwright/test';

test('E2E-4 closing the browser context purges the shortlist', async ({ browser }) => {
  // Run a full quiz and shortlist a city in a first context.
  const ctx1 = await browser.newContext();
  const page = await ctx1.newPage();
  await page.goto('/');
  await page.getByTestId('consent-accept').click();
  await page.getByTestId('landing-cta').click();
  await page.getByTestId('climate-mediterranean').click({ force: true });
  // 6 next-clicks walk steps 1..7.
  for (let i = 0; i < 6; i++) await page.getByTestId('wizard-next').click();
  await page.getByTestId('submit').click();
  await page.getByTestId('rank-card-1-compare-checkbox').check();
  await expect(page.getByTestId('shortlist-bar')).toBeVisible();

  // Close the entire context — sessionStorage is scoped to the
  // browsing context, so a new one must start clean.
  await ctx1.close();

  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.goto('/');
  await expect(page2.getByTestId('consent-banner')).toBeVisible(); // fresh context, no consent stored
  await page2.goto('/compare');
  await expect(page2).toHaveURL(/\/results$/);
  await ctx2.close();
});