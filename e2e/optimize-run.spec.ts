// The optimize run. Full flow → Results (sizes, savings, geometry/texture
// breakdown) and a downloadable GLB that is smaller, carries DRACO + WebP, and
// re-decodes. Also proves the byte-level half of the overrides contract:
// an excluded texture's bytes survive the run untouched while the rest turn WebP.
import { readFileSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import { test, expect, type Page } from '@playwright/test';
import { denseGlb, morphGlb, plainGlb, skinnedGlb, solidPNG } from '../test/fixtures/generate';
import { glbJson } from '../test/helpers/glb';
import { captureArtifact } from './artifacts';

async function loadModel(page: Page, name: string, bytes: Uint8Array) {
  await page.goto('/');
  const input = page.getByTestId('file-input');
  await expect(input).toBeEnabled(); // hydration gate — setInputFiles ignores disabled
  await input.setInputFiles({ name, mimeType: 'model/gltf-binary', buffer: Buffer.from(bytes) });
  await expect(page.getByRole('region', { name: /model report/i })).toBeVisible();
}

async function runAndDownload(page: Page): Promise<Uint8Array> {
  await page.getByRole('button', { name: /optimize/i }).click();
  await expect(page.getByRole('region', { name: /results/i })).toBeVisible({ timeout: 30_000 });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: /download/i }).click();
  const download = await downloadPromise;
  return new Uint8Array(readFileSync(await download.path()));
}

async function readGlb(glb: Uint8Array) {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  return io.readBinary(glb);
}

test('the run produces a smaller GLB with DRACO + WebP that re-decodes', async ({ page }) => {
  // The dense grid, not the tiny quads: on a degenerate 8-vert model the DRACO +
  // extension overhead legitimately exceeds the savings.
  const input = await denseGlb();
  await loadModel(page, 'dense.glb', input);
  const output = await runAndDownload(page);
  captureArtifact('dense-optimized.glb', output); // read back in test/readback.test.ts

  expect(output.byteLength).toBeLessThan(input.byteLength);
  const extensions = glbJson(output).extensionsUsed ?? [];
  expect(extensions).toContain('KHR_draco_mesh_compression');
  expect(extensions).toContain('EXT_texture_webp');
  // Decodable: NodeIO + DRACO decoder read it back without throwing.
  const doc = await readGlb(output);
  expect(doc.getRoot().listMeshes().length).toBeGreaterThan(0);

  // The Results view tells the same story: sizes + savings + breakdown.
  const results = page.getByRole('region', { name: /results/i });
  await expect(results.getByTestId('rs-savings')).toContainText('%');
  await expect(results).toContainText(/geometry/i);
  await expect(results).toContainText(/textures/i);
});

test('an excluded texture keeps its exact bytes while the rest become WebP', async ({ page }) => {
  await loadModel(page, 'plain.glb', await plainGlb());
  await page
    .locator('[data-texture-name="base"]')
    .getByRole('checkbox', { name: /exclude/i })
    .check();
  const output = await runAndDownload(page);

  const doc = await readGlb(output);
  const textures = new Map(doc.getRoot().listTextures().map((t) => [t.getName(), t]));
  const base = textures.get('base')!;
  expect(base.getMimeType()).toBe('image/png');
  expect(Buffer.from(base.getImage()!)).toEqual(Buffer.from(solidPNG(8, 200, 80, 80)));
  for (const name of ['normal', 'mr', 'emissive']) {
    expect(textures.get(name)!.getMimeType()).toBe('image/webp');
  }
});

test('morph and skinned models survive the run without DRACO', async ({ page }) => {
  // Byte-level half of the animation/skinning gate: the written GLB — not just
  // the document graph — must carry no KHR_draco_mesh_compression for these.
  for (const [name, fixture] of [
    ['morph', morphGlb],
    ['skinned', skinnedGlb],
  ] as const) {
    await loadModel(page, `${name}.glb`, await fixture());
    const output = await runAndDownload(page);
    captureArtifact(`${name}-optimized.glb`, output); // read back in test/readback.test.ts
    expect(glbJson(output).extensionsUsed ?? []).not.toContain('KHR_draco_mesh_compression');
  }
});

test('a skinned model warns non-blocking and its textures are still optimized', async ({ page }) => {
  await loadModel(page, 'skinned.glb', await skinnedGlb(true));
  // The warning is surfaced, and it does NOT block the run.
  const report = page.getByRole('region', { name: /model report/i });
  await expect(report).toContainText(/skinned mesh detected/i);
  const output = await runAndDownload(page);

  const doc = await readGlb(output);
  const textures = doc.getRoot().listTextures();
  expect(textures.length).toBe(1);
  expect(textures[0]!.getMimeType()).toBe('image/webp');
  expect(glbJson(output).extensionsUsed ?? []).not.toContain('KHR_draco_mesh_compression');
});

test('quality and max-resolution overrides are reflected in the output', async ({ page }) => {
  // Small grid, oversized 1024² texture — room for the 512 cap to actually bite.
  await loadModel(page, 'bigtex.glb', await denseGlb(8, 1024));
  const row = page.locator('[data-texture-name="base"]');
  await row.getByRole('spinbutton', { name: /quality/i }).fill('50');
  await row.getByRole('combobox', { name: /max size/i }).selectOption('512');
  const output = await runAndDownload(page);

  const doc = await readGlb(output);
  const texture = doc.getRoot().listTextures()[0]!;
  expect(texture.getMimeType()).toBe('image/webp');
  expect(texture.getSize()).toEqual([512, 512]); // the cap was applied on the way out
});

test('the main thread keeps ticking during optimize (work stays in the worker)', async ({ page }) => {
  await loadModel(page, 'dense.glb', await denseGlb());
  await page.evaluate(() => {
    const w = window as unknown as { __ticks: number };
    w.__ticks = 0;
    const tick = () => {
      w.__ticks += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const output = await runAndDownload(page);
  expect(output.byteLength).toBeGreaterThan(0);
  const ticks = await page.evaluate(() => (window as unknown as { __ticks: number }).__ticks);
  expect(ticks).toBeGreaterThan(0);
});
