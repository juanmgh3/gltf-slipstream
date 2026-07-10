import { defineConfig } from 'vitest/config';

// Unit tests run in Node over NodeIO-generated fixtures.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    passWithNoTests: true,
  },
});
