// Browser-produced optimized GLBs, captured for the T18 read-back vitest.
// Deliberately NOT under test-results/ — Playwright wipes that dir on every run,
// while these must survive until (and between) vitest runs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const ARTIFACTS_DIR = join(process.cwd(), '.artifacts');

export function captureArtifact(name: string, bytes: Uint8Array): void {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  writeFileSync(join(ARTIFACTS_DIR, name), bytes);
}
