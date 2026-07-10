// Settings → overrides. The texture list shows each texture's effective plan;
// changing the global preset shifts the shown defaults; the three per-texture
// overrides (exclude / quality / max-resolution) are reflected in the row's
// plan. The byte-level half (excluded texture unchanged & not WebP in the
// output GLB) needs the optimize run and lives in optimize-run.spec.ts.
import { test, expect, type Page } from '@playwright/test';
import { plainGlb } from '../test/fixtures/generate';

async function loadPlain(page: Page) {
  await page.goto('/');
  const input = page.getByTestId('file-input');
  await expect(input).toBeEnabled(); // hydration gate — setInputFiles ignores disabled
  await input.setInputFiles({ name: 'plain.glb', mimeType: 'model/gltf-binary', buffer: Buffer.from(await plainGlb()) });
  await expect(page.getByRole('region', { name: /model report/i })).toBeVisible();
}

const row = (page: Page, name: string) => page.locator(`[data-texture-name="${name}"]`);

test('texture list shows every texture with its roles', async ({ page }) => {
  await loadPlain(page);
  await expect(page.getByTestId('texture-row')).toHaveCount(4);
  await expect(row(page, 'base')).toContainText('baseColor');
  await expect(row(page, 'normal')).toContainText('normal');
  await expect(row(page, 'mr')).toContainText('metallicRoughness');
  await expect(row(page, 'mr')).toContainText('occlusion');
  await expect(row(page, 'emissive')).toContainText('emissive');
});

test('changing the preset shifts the shown per-texture defaults', async ({ page }) => {
  await loadPlain(page);
  // balanced (default): color maps lossy q85, data maps lossless, no cap.
  await expect(row(page, 'base')).toContainText('WebP q85');
  await expect(row(page, 'normal')).toContainText('WebP lossless');

  await page.getByRole('radio', { name: 'aggressive' }).check();
  await expect(row(page, 'base')).toContainText('WebP q75');
  await expect(row(page, 'base')).toContainText('≤2048px');
  await expect(row(page, 'normal')).toContainText('WebP q90');

  await page.getByRole('radio', { name: 'maximum' }).check();
  await expect(row(page, 'base')).toContainText('WebP q95');
  await expect(row(page, 'normal')).toContainText('WebP lossless');
});

test('excluding a texture is reflected in its row only', async ({ page }) => {
  await loadPlain(page);
  await row(page, 'base').getByRole('checkbox', { name: /exclude/i }).check();
  await expect(row(page, 'base')).toContainText('kept as-is');
  await expect(row(page, 'normal')).toContainText('WebP lossless');
  // And back: unchecking restores the plan.
  await row(page, 'base').getByRole('checkbox', { name: /exclude/i }).uncheck();
  await expect(row(page, 'base')).toContainText('WebP q85');
});

test('a per-texture quality override opts that texture into lossy', async ({ page }) => {
  await loadPlain(page);
  await row(page, 'normal').getByRole('spinbutton', { name: /quality/i }).fill('60');
  await expect(row(page, 'normal')).toContainText('WebP q60');
  // Clearing the override returns to the preset default.
  await row(page, 'normal').getByRole('spinbutton', { name: /quality/i }).clear();
  await expect(row(page, 'normal')).toContainText('WebP lossless');
});

test('a per-texture max-resolution override caps the plan', async ({ page }) => {
  await loadPlain(page);
  await row(page, 'base').getByRole('combobox', { name: /max size/i }).selectOption('1024');
  await expect(row(page, 'base')).toContainText('≤1024px');
});
