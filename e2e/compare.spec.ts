// T16 acceptance: before/after compare. Both model-viewer instances render; the
// optimized GLB — DRACO + WebP — loads WITHOUT error (re-rendering IS the
// correctness check); the DRACO decoder comes from our own host, never a CDN.
import { test, expect, type Page } from '@playwright/test';
import { denseGlb } from '../test/fixtures/generate';

async function optimizeDense(page: Page) {
  await page.goto('/');
  const input = page.getByTestId('file-input');
  await expect(input).toBeEnabled(); // hydration gate — setInputFiles ignores disabled
  await input.setInputFiles({
    name: 'dense.glb',
    mimeType: 'model/gltf-binary',
    buffer: Buffer.from(await denseGlb()),
  });
  await expect(page.getByRole('region', { name: /model report/i })).toBeVisible();
  await page.getByRole('button', { name: /optimize/i }).click();
  await expect(page.getByRole('region', { name: /results/i })).toBeVisible({ timeout: 30_000 });
}

test('before/after viewers render and the optimized GLB re-decodes', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  const decoderHosts = new Set<string>();
  page.on('request', (request) => {
    if (/draco/i.test(request.url())) decoderHosts.add(new URL(request.url()).hostname);
  });

  await optimizeDense(page);
  await expect(page.locator('model-viewer')).toHaveCount(2);
  // model-viewer sets `.loaded` once the scene is presentable; an error event
  // (bad GLB, failed decode) would leave it false.
  await page.waitForFunction(
    () => {
      const viewers = [...document.querySelectorAll('model-viewer')] as Array<{ loaded?: boolean }>;
      return viewers.length === 2 && viewers.every((viewer) => viewer.loaded === true);
    },
    undefined,
    { timeout: 30_000 },
  );

  expect(pageErrors).toEqual([]);
  // Privacy/offline: every DRACO decoder fetch was same-origin, none from a CDN.
  expect([...decoderHosts]).toEqual(['localhost']);
});
