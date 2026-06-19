import { defineConfig } from 'vite';

// Spike Vite config — bakes in the known wasm/worker gotchas (plan Risk #5):
// jSquash codecs must be excluded from dep optimization, and workers built as ES modules.
export default defineConfig({
  optimizeDeps: {
    exclude: ['@jsquash/webp', '@jsquash/png', '@jsquash/jpeg', '@jsquash/resize'],
  },
  worker: { format: 'es' },
  server: { host: '127.0.0.1', port: 5179 },
});
