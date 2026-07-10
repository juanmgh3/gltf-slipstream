import { test, expect } from '@playwright/test';

// T4: the brand kit is wired into the shell — `--ss-*` tokens apply and the
// three font families resolve (Clash Display via Fontshare CDN, Mona Sans via
// Google Fonts, Azeret Mono self-hosted from the kit).

test('--ss-* tokens apply to the shell', async ({ page }) => {
  await page.goto('/');
  const styles = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const root = getComputedStyle(document.documentElement);
    return {
      bg: body.backgroundColor,
      color: body.color,
      fontFamily: body.fontFamily,
      accent: root.getPropertyValue('--ss-accent').trim(),
    };
  });
  expect(styles.bg).toBe('rgb(39, 37, 34)'); // --ss-bg #272522 (warm charcoal)
  expect(styles.color).toBe('rgb(253, 253, 253)'); // --ss-text #FDFDFD
  expect(styles.fontFamily).toContain('Mona Sans');
  expect(styles.accent).toBe('#F5B84B');
});

test('the three font families load', async ({ page }) => {
  await page.goto('/');
  const loaded = await page.evaluate(async () => {
    // load() forces the fetch (check() alone only reports already-loaded faces).
    // Clash Display ships 600/700 only — probe a weight it actually has.
    await Promise.all([
      document.fonts.load('600 1rem "Clash Display"'),
      document.fonts.load('400 1rem "Mona Sans"'),
      document.fonts.load('400 1rem "Azeret Mono"'),
    ]);
    return {
      clash: document.fonts.check('600 1rem "Clash Display"'),
      mona: document.fonts.check('400 1rem "Mona Sans"'),
      azeret: document.fonts.check('400 1rem "Azeret Mono"'),
    };
  });
  expect(loaded).toEqual({ clash: true, mona: true, azeret: true });
});
