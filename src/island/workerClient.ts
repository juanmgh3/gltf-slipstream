// Comlink handle over the optimizer worker — the island's only entry to the core.
// The `new URL(..., import.meta.url)` form is Vite's worker-bundling contract
// (astro.config pins `worker.format: 'es'`); the type-only import keeps the worker
// module out of the main bundle.

import * as Comlink from 'comlink';
import type { OptimizerWorkerApi } from '../worker/optimizer.worker';

export type OptimizerClient = Comlink.Remote<OptimizerWorkerApi>;

export function createOptimizerClient(): OptimizerClient {
  const worker = new Worker(new URL('../worker/optimizer.worker.ts', import.meta.url), {
    type: 'module',
  });
  return Comlink.wrap<OptimizerWorkerApi>(worker);
}
