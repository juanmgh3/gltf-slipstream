// design-elevation acceptance: "kit tokens only — no improvised colors". Every
// color in src/ must come through a var(--ss-*) token; a raw literal here means
// either drift from the kit or a color the kit needs to grow a token for. The
// brand kit itself (slipstream-brand-kit/, outside src/) is the one place
// literals belong.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCANNED = /\.(css|astro|tsx)$/;

// Hex colors plus functional color notations. The hex arm requires a non-word
// char before `#` and a boundary after, so anchor fragments like `#credits`
// (no hex shape) or hashes inside longer words don't trip it.
const COLOR_LITERAL = /(?:#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|color-mix)\()/g;

// Lines that legitimately carry a literal. Keep this list painful to grow:
// each entry is an exact file + substring match.
const ALLOWLIST: Array<{ file: string; snippet: string }> = [
  // The PWA/browser chrome color can't consume a CSS custom property.
  { file: join('src', 'layouts', 'Base.astro'), snippet: 'name="theme-color" content="#272522"' },
];

function isAllowed(file: string, line: string): boolean {
  return ALLOWLIST.some((entry) => file.endsWith(entry.file) && line.includes(entry.snippet));
}

describe('kit tokens only', () => {
  it('src/ contains no raw color literals outside var(--ss-*)', () => {
    const offenders: string[] = [];
    for (const entry of readdirSync('src', { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !SCANNED.test(entry.name)) continue;
      const file = join(entry.parentPath, entry.name);
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, index) => {
        const matches = line.match(COLOR_LITERAL);
        if (matches && !isAllowed(file, line)) {
          offenders.push(`${file}:${index + 1} → ${matches.join(', ')} in: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
