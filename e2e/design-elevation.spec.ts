// T8 acceptance: the wipe stage itself — divider drag moves the shared
// `--wipe` custom property and the slider's `aria-valuenow` together, a
// programmatic orbit on the OPTIMIZED master mirrors onto the ORIGINAL
// overlay within an epsilon (the rAF catch-up loop, not just `camera-change`),
// both model-viewers reach `.loaded`, and the stage honors the ≥50vh floor
// from the approved direction.
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

async function waitBothLoaded(page: Page) {
  await page.waitForFunction(
    () => {
      const viewers = [...document.querySelectorAll('model-viewer')] as Array<{ loaded?: boolean }>;
      return viewers.length === 2 && viewers.every((viewer) => viewer.loaded === true);
    },
    undefined,
    { timeout: 30_000 },
  );
}

test.describe('design-elevation: compare wipe stage', () => {
  test('both viewers load and the stage meets the 50vh floor', async ({ page }) => {
    await optimizeDense(page);
    await waitBothLoaded(page);

    const stage = page.getByTestId('compare');
    const stageBox = await stage.boundingBox();
    const viewportHeight = page.viewportSize()?.height ?? 0;
    expect(stageBox).not.toBeNull();
    expect(stageBox!.height).toBeGreaterThanOrEqual(viewportHeight * 0.5 - 1); // -1px rounding slack
  });

  test('dragging the divider moves --wipe and aria-valuenow together', async ({ page }) => {
    await optimizeDense(page);
    await waitBothLoaded(page);

    const stage = page.getByTestId('compare');
    const handle = page.getByTestId('cv-handle');

    const readWipe = () =>
      stage.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--wipe')));

    const initialWipe = await readWipe();
    const initialValueNow = await handle.getAttribute('aria-valuenow');
    expect(initialValueNow).toBe('50');
    expect(initialWipe).toBeCloseTo(50, 0);

    const stageBox = await stage.boundingBox();
    expect(stageBox).not.toBeNull();
    const targetX = stageBox!.x + stageBox!.width * 0.25; // drag to ~25%
    const midY = stageBox!.y + stageBox!.height / 2;

    const handleBox = await handle.boundingBox();
    await page.mouse.move(handleBox!.x + handleBox!.width / 2, midY);
    await page.mouse.down();
    await page.mouse.move(targetX, midY, { steps: 8 });
    await page.mouse.up();

    const draggedValueNow = Number(await handle.getAttribute('aria-valuenow'));
    const draggedWipe = await readWipe();
    expect(draggedValueNow).toBeLessThan(45); // moved left, away from the 50 default
    expect(draggedWipe).toBeCloseTo(draggedValueNow, 0); // the two stay in lockstep

    // Keyboard support: arrow keys nudge by STEP, clamped [5, 95].
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    const afterArrow = Number(await handle.getAttribute('aria-valuenow'));
    expect(afterArrow).toBe(draggedValueNow + 2);
  });

  test('a programmatic orbit on the OPTIMIZED master mirrors onto the ORIGINAL overlay', async ({ page }) => {
    await optimizeDense(page);
    await waitBothLoaded(page);

    // Push the master's camera past the default min-radius clamp, then let it
    // settle: the rAF copy loop (not just `camera-change`) is what catches the
    // eased zoom tail and keeps the mirror's *unclamped* limits from lagging.
    await page.evaluate(() => {
      const master = document.querySelector('[data-testid="cv-optimized"]') as HTMLElement & {
        cameraOrbit: string;
        jumpCameraToGoal: () => void;
        getCameraOrbit: () => { theta: number; phi: number; radius: number };
      };
      master.cameraOrbit = '1.2rad 1.1rad 0.6m';
      master.jumpCameraToGoal();
    });

    await page.waitForFunction(
      () => {
        const master = document.querySelector('[data-testid="cv-optimized"]') as unknown as {
          getCameraOrbit: () => { theta: number; phi: number; radius: number };
        };
        const mirror = document.querySelector('[data-testid="cv-original"]') as unknown as {
          getCameraOrbit: () => { theta: number; phi: number; radius: number };
        };
        const m = master.getCameraOrbit();
        const o = mirror.getCameraOrbit();
        const eps = 0.01;
        return (
          Math.abs(m.theta - o.theta) < eps &&
          Math.abs(m.phi - o.phi) < eps &&
          Math.abs(m.radius - o.radius) < eps
        );
      },
      undefined,
      { timeout: 5_000 },
    );
  });
});

// T9 acceptance: the texture list is a bounded timing table — 24 rows on the
// demo model never over-extend the report panel; the scroll region (not the
// panel, not the page) is what carries the overflow.
test.describe('design-elevation: texture timing table containment', () => {
  async function loadDemo(page: Page) {
    await page.goto('/');
    const demo = page.getByTestId('demo-button');
    await expect(demo).toBeEnabled();
    await demo.click();
    await expect(page.getByRole('region', { name: /model report/i })).toBeVisible({ timeout: 60_000 });
  }

  test('the demo model renders all 24 texture rows', async ({ page }) => {
    await loadDemo(page);
    await expect(page.getByTestId('texture-row')).toHaveCount(24);
  });

  test('the scroll region overflows internally while staying bounded', async ({ page }) => {
    await loadDemo(page);
    const scroll = page.getByTestId('texture-scroll');
    const { scrollHeight, clientHeight } = await scroll.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    // 24 dense rows overflow the region...
    expect(scrollHeight).toBeGreaterThan(clientHeight);
    // ...but the region itself stays bounded well under the viewport, not just
    // shy of it — this is what makes the overflow internal, not page-level.
    const viewportHeight = page.viewportSize()?.height ?? 0;
    expect(clientHeight).toBeLessThan(viewportHeight * 0.6);
  });

  test('the report panel fits within the viewport height', async ({ page }) => {
    await loadDemo(page);
    const report = page.getByRole('region', { name: /model report/i });
    const box = await report.boundingBox();
    const viewportHeight = page.viewportSize()?.height ?? 0;
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(viewportHeight);
  });
});

// T10 acceptance: phases read as sectors during a run — S1 TEXTURES · S2
// GEOMETRY · S3 WRITE — and the run region still reports done afterward.
// A slower-than-default dense fixture (more segments + a bigger texture)
// keeps the worker busy long enough that the optimizing state is reliably
// observable, not a one-frame flash the assertions could race past.
test.describe('design-elevation: optimizing sectors', () => {
  test('the three sector labels are visible during a run, then the run completes', async ({ page }) => {
    await page.goto('/');
    const input = page.getByTestId('file-input');
    await expect(input).toBeEnabled();
    await input.setInputFiles({
      name: 'dense.glb',
      mimeType: 'model/gltf-binary',
      buffer: Buffer.from(await denseGlb(150, 1024)),
    });
    await expect(page.getByRole('region', { name: /model report/i })).toBeVisible();
    await page.getByRole('button', { name: /optimize/i }).click();

    const sectorLabels = page.getByTestId('sector-label');
    await expect(sectorLabels).toHaveCount(3);
    await expect(sectorLabels.nth(0)).toContainText(/S1/);
    await expect(sectorLabels.nth(1)).toContainText(/S2/);
    await expect(sectorLabels.nth(2)).toContainText(/S3/);

    await expect(page.getByRole('region', { name: /results/i })).toBeVisible({ timeout: 30_000 });
  });
});

// T11 acceptance: the done state leads with the savings delta as hero, and
// the download CTA stays reachable by its accessible name.
test.describe('design-elevation: results hero delta', () => {
  test('the hero delta renders a signed percentage and the download CTA is present', async ({ page }) => {
    await optimizeDense(page);

    const results = page.getByRole('region', { name: /results/i });
    const delta = results.getByTestId('rs-savings');
    await expect(delta).toBeVisible();
    await expect(delta).toHaveText(/^[−+]\d+(\.\d+)?%$/);

    await expect(results.getByRole('link', { name: /download/i })).toBeVisible();
  });
});

// T12 acceptance: the page shell — permanent privacy kicker, below-fold
// sections, demo attribution visible in idle, and no horizontal overflow
// across the viewport range the direction commits to (375 through 2560).
test.describe('design-elevation: page shell', () => {
  test('the privacy kicker is visible on load', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('privacy-kicker')).toBeVisible();
    await expect(page.getByTestId('privacy-kicker')).toContainText(/100% local/i);
  });

  test('the three below-fold sections exist by heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /three sectors, one worker/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /nothing leaves your machine/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /honest machinery/i })).toBeVisible();
  });

  test('demo attribution is visible in the idle dropzone', async ({ page }) => {
    await page.goto('/');
    const attribution = page.getByTestId('demo-attribution');
    await expect(attribution).toBeVisible();
    await expect(attribution).toContainText(/NASA\/JPL-Caltech/i);
    await expect(attribution).toContainText(/CC0/i);
  });

  test('the header links to the GitHub repo', async ({ page }) => {
    await page.goto('/');
    const gh = page.getByRole('link', { name: 'View source on GitHub' });
    await expect(gh).toBeVisible();
    await expect(gh).toHaveAttribute('href', 'https://github.com/juanmgh3/gltf-slipstream');
  });

  for (const viewport of [
    { width: 2560, height: 1440 },
    { width: 1440, height: 900 },
    { width: 375, height: 812 },
  ]) {
    test(`no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
