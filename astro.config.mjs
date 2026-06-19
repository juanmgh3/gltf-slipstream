import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// The `vite` block is EXACTLY the config the T1 spike proved (plan Risk #5):
// jSquash codecs excluded from dep optimization, workers built as ES modules.
// DRACO/decoder wasm are self-hosted under public/ and fetched via locateFile,
// so no extra wasm-import plugin is needed.
export default defineConfig({
  integrations: [preact()],
  vite: {
    optimizeDeps: {
      exclude: ['@jsquash/webp', '@jsquash/png', '@jsquash/jpeg', '@jsquash/resize'],
    },
    worker: { format: 'es' },
  },
});
