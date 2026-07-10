// T17 acceptance: the bundled demo runs the full flow. Click-to-try loads
// public/demo/perseverance.glb (CC0, NASA/JPL-Caltech) through the exact same
// path as a dropped file, the run produces a smaller GLB, and both compare
// viewers render it. This is the one E2E against a real heavyweight model.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { captureArtifact } from './artifacts';

// 213k verts + 24 textures: the run takes real time, unlike the synthetic fixtures.
const RUN_TIMEOUT = 120_000;

test('click-to-try → optimize → compare, end to end on the demo model', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  // Same rule as the T13 privacy test: same-origin static GETs and the licensed
  // font CDNs only; nothing may carry a body.
  const FONT_HOSTS = /(^|\.)(fontshare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
  const offenders: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const sameOrigin = url.origin === 'http://localhost:4321';
    if (request.method() !== 'GET' || request.postData() !== null || (!sameOrigin && !FONT_HOSTS.test(url.hostname))) {
      offenders.push(`${request.method()} ${request.url()}`);
    }
  });

  await page.goto('/');
  const demo = page.getByTestId('demo-button');
  await expect(demo).toBeEnabled(); // hydration gate, same as the file input
  await demo.click();

  // Loaded through the drop path: the report carries the demo file's identity.
  const report = page.getByRole('region', { name: /model report/i });
  await expect(report).toBeVisible({ timeout: 60_000 });
  await expect(report).toContainText('perseverance.glb');

  await page.getByRole('button', { name: /optimize/i }).click();
  const results = page.getByRole('region', { name: /results/i });
  await expect(results).toBeVisible({ timeout: RUN_TIMEOUT });
  await expect(results.getByTestId('rs-savings')).toContainText('%');

  // On a real heavyweight model the output must actually shrink; the artifact
  // feeds the T18 shape-preservation read-back.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: /download/i }).click();
  const output = new Uint8Array(readFileSync(await (await downloadPromise).path()));
  captureArtifact('perseverance-optimized.glb', output);
  expect(output.byteLength).toBeLessThan(readFileSync('public/demo/perseverance.glb').byteLength);

  // Both compare viewers present the model — re-rendering IS the decode check.
  await expect(page.locator('model-viewer')).toHaveCount(2);
  await page.waitForFunction(
    () => {
      const viewers = [...document.querySelectorAll('model-viewer')] as Array<{ loaded?: boolean }>;
      return viewers.length === 2 && viewers.every((viewer) => viewer.loaded === true);
    },
    undefined,
    { timeout: RUN_TIMEOUT },
  );

  expect(pageErrors).toEqual([]);
  expect(offenders).toEqual([]);
});
