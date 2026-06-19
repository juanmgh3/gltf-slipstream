import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Flat config (ESLint 10). Covers TS/JS source + config files. The throwaway spike
// and the standalone Vite config are ignored (deleted at T12). `.astro` linting is
// deferred to the island phase (T13+), where there is component code to lint.
export default tseslint.config(
  { ignores: ['dist/', '.astro/', 'node_modules/', 'public/', 'spike/', 'vite.config.js', 'scripts/make-sample.mjs'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['**/*.{js,mjs,cjs}', '**/*.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
);
