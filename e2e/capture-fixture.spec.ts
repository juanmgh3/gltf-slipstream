// Design-elevation fixture capture — a TOOL, not a test of the product. Gated on
// CAPTURE_FIXTURE so the normal gate skips it; run once (and on re-captures) with:
//   CAPTURE_FIXTURE=1 npx playwright test e2e/capture-fixture.spec.ts
// Drives /design/capture (production worker client over the bundled demo) and
// writes the serializable run data to src/pages/design/_fixture.json.
import { writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import type { DesignFixture } from '../src/pages/design/_Capture';

const FIXTURE_PATH = 'src/pages/design/_fixture.json';

interface CaptureHost {
  __designFixture?: DesignFixture;
  __designFixtureError?: string;
}

test.skip(!process.env.CAPTURE_FIXTURE, 'fixture-capture tool — run with CAPTURE_FIXTURE=1');

test('capture the Perseverance design fixture', async ({ page }) => {
  // 213k verts + 24 textures through a full balanced run takes real time.
  test.setTimeout(240_000);
  await page.goto('/design/capture');

  await page.waitForFunction(
    () => {
      const host = window as unknown as { __designFixture?: unknown; __designFixtureError?: string };
      if (host.__designFixtureError) throw new Error(host.__designFixtureError);
      return host.__designFixture !== undefined;
    },
    undefined,
    { timeout: 180_000 },
  );
  const fixture = await page.evaluate(() => (window as unknown as CaptureHost).__designFixture!);

  // Sanity before committing bytes to the repo: real 24-texture report, a real
  // shrink, and a progress log worth replaying (T2's acceptance lives here too).
  expect(fixture.report.textures.length).toBe(24);
  expect(fixture.result.inputByteLength).toBeGreaterThan(0);
  expect(fixture.result.outputByteLength).toBeGreaterThan(0);
  expect(fixture.result.outputByteLength).toBeLessThan(fixture.result.inputByteLength);
  expect(fixture.progressLog.length).toBeGreaterThan(0);

  writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
});
