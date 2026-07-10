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
