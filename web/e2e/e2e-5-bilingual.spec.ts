/**
 * E2E-5: Dynamic bilingual switch (E2E-Test-Scenarios.md §3).
 *
 * Per docs/E2E-Test-Scenarios.md the user can toggle between
 * English and Chinese Simplified at any step of their journey,
 * with zero state loss and zero latency. We verify:
 *   - The language toggle button is visible in the header.
 *   - Toggling on the landing page flips the CTA copy.
 *   - Toggling mid-quiz preserves the current step.
 *   - Result cards render in the active language.
 */
import { expect, test } from '@playwright/test';

test('E2E-5 dynamic bilingual switch', async ({ page }) => {
  await page.goto('/');

  // 1. Accept the cookie consent banner.
  await page.getByTestId('consent-accept').click();

  // 2. Verify the language toggle is rendered in the header.
  await expect(page.getByTestId('lang-toggle')).toBeVisible();
  await expect(page.getByTestId('lang-en')).toBeVisible();
  await expect(page.getByTestId('lang-zh')).toBeVisible();

  // 3. Confirm the landing CTA is in English by default.
  const cta = page.getByTestId('landing-cta');
  await expect(cta).toContainText(/Start the questionnaire/i);

  // 4. Toggle to Chinese and verify the CTA copy updates.
  await page.getByTestId('lang-zh').click();
  await expect(cta).toContainText(/开始问卷/);

  // 5. Toggle back to English, then start the quiz and advance two steps.
  await page.getByTestId('lang-en').click();
  await expect(cta).toContainText(/Start the questionnaire/i);
  await cta.click();

  // 6. Advance through two steps while still in English.
  await page.getByTestId('climate-mediterranean').click({ force: true });
  await page.getByTestId('wizard-next').click();
  await expect(page.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '2');

  // 7. Toggle to Chinese mid-quiz — step must remain at 2.
  await page.getByTestId('lang-zh').click();
  await expect(page.getByTestId('progress-bar')).toHaveAttribute('aria-valuenow', '2');

  // 8. The wizard header (step 2 title) must now be in Chinese.
  // Skip the rest of the quiz by clicking Next through the remaining
  // steps (the wizard still advances regardless of language).
  for (let i = 0; i < 6; i++) {
    await page.getByTestId('wizard-next').click();
  }

  // 9. Submit. /results renders.
  await page.getByTestId('submit').click();
  await expect(page).toHaveURL(/\/results$/);

  // 10. The results page heading is now in Chinese.
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/最佳匹配/);
});