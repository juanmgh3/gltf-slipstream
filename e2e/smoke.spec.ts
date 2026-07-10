import { test, expect } from '@playwright/test';

// Smoke: the Astro shell boots and serves index. The real flow coverage
// (load/optimize/compare) lives in the other specs.
test('blank shell loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/slipstream/i);
});
