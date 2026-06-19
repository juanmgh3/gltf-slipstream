import { test, expect } from '@playwright/test';

// Scaffold smoke: the blank Astro shell boots and serves index. Real acceptance
// E2E (load/optimize/compare) lands in T13+.
test('blank shell loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/slipstream/i);
});
