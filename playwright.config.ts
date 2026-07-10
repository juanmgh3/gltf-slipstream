import { defineConfig, devices } from '@playwright/test';

// E2E for the in-browser flow (acceptance criteria land in T13+). The dev server is
// started automatically; reuse a running one locally.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    // Astro dev binds to `localhost` by default (resolves to ::1 on Windows);
    // probe and navigate the same host to avoid an IPv4/IPv6 mismatch.
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Astro 7 auto-daemonizes `astro dev` depending on how it was launched
    // which makes Playwright see the webServer process "exit early".
    // ASTRO_DEV_BACKGROUND is Astro's own foreground marker — setting it keeps the
    // dev server attached to this process regardless of who launched it.
    env: { ASTRO_DEV_BACKGROUND: '1' },
  },
});
