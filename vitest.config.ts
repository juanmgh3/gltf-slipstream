import { defineConfig } from 'vitest/config';

// Unit tests run in Node (NodeIO fixtures per the plan's verification table).
// `passWithNoTests` keeps the gate green until the first core module lands (T4+).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    passWithNoTests: true,
  },
});
