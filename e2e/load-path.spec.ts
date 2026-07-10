// T13 acceptance: the load path. A model reaches `loaded` via BOTH drag-and-drop and
// the file picker; invalid input is rejected with a clear message without killing the
// app; and the network carries no model payload (privacy is architectural).
// Fixtures are generated in-memory by the Node side of Playwright — nothing on disk.
import { test, expect, type Page } from '@playwright/test';
import { embeddedGltf, junkBytes, plainGlb } from '../test/fixtures/generate';

const report = (page: Page) => page.getByRole('region', { name: /model report/i });

async function pickFile(page: Page, name: string, bytes: Uint8Array, mimeType: string) {
  const input = page.getByTestId('file-input');
  // The input is server-rendered disabled and enabled on hydration. setInputFiles
  // does NOT wait for enabled (verified), so gate explicitly — a file set before
  // the change handler exists is silently lost, exactly like a too-early real user.
  await expect(input).toBeEnabled();
  await input.setInputFiles({ name, mimeType, buffer: Buffer.from(bytes) });
}

/** Real `drop` event on the dropzone, carrying a File built inside the page. */
async function dropFile(page: Page, name: string, bytes: Uint8Array) {
  await expect(page.getByTestId('file-input')).toBeEnabled(); // hydration gate, as above
  const dataTransfer = await page.evaluateHandle(
    ({ data, fileName }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(data)], fileName));
      return dt;
    },
    { data: Array.from(bytes), fileName: name },
  );
  await page.getByTestId('dropzone').dispatchEvent('drop', { dataTransfer });
}

test('.glb reaches loaded via the file picker', async ({ page }) => {
  await page.goto('/');
  await pickFile(page, 'plain.glb', await plainGlb(), 'model/gltf-binary');
  await expect(report(page)).toBeVisible();
  await expect(report(page)).toContainText('plain.glb');
});

test('.glb reaches loaded via drag-and-drop', async ({ page }) => {
  await page.goto('/');
  await dropFile(page, 'plain.glb', await plainGlb());
  await expect(report(page)).toBeVisible();
  await expect(report(page)).toContainText('plain.glb');
});

test('embedded .gltf reaches loaded via the file picker', async ({ page }) => {
  await page.goto('/');
  await pickFile(page, 'embedded.gltf', embeddedGltf(), 'model/gltf+json');
  await expect(report(page)).toBeVisible();
  await expect(report(page)).toContainText('embedded.gltf');
});

test('junk is rejected with a clear error and the app stays alive', async ({ page }) => {
  await page.goto('/');
  await pickFile(page, 'junk.bin', junkBytes(), 'application/octet-stream');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(report(page)).not.toBeVisible();
  // Still alive: a valid model loads right after the rejection.
  await pickFile(page, 'plain.glb', await plainGlb(), 'model/gltf-binary');
  await expect(report(page)).toBeVisible();
  await expect(page.getByRole('alert')).not.toBeVisible();
});

test('privacy: loading a model sends no payload anywhere', async ({ page }) => {
  const FONT_HOSTS = /(^|\.)(fontshare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
  const offenders: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const sameOrigin = url.origin === 'http://localhost:4321';
    const isFontCdn = FONT_HOSTS.test(url.hostname);
    // Only same-origin static GETs (page, assets, wasm, worker) and the licensed
    // font CDNs may appear; nothing may carry a body.
    if (request.method() !== 'GET' || request.postData() !== null || (!sameOrigin && !isFontCdn)) {
      offenders.push(`${request.method()} ${request.url()}`);
    }
  });
  await page.goto('/');
  await pickFile(page, 'plain.glb', await plainGlb(), 'model/gltf-binary');
  await expect(report(page)).toBeVisible();
  expect(offenders).toEqual([]);
});
