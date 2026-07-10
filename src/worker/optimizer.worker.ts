// Comlink-exposed module worker: the only bridge between the UI island and the
// optimizer core. Thin by design — all behavior lives in src/optimizer/.
// The island obtains `onProgress` callbacks via Comlink.proxy and transfers the
// input ArrayBuffer here; the optimized GLB is transferred back, so model bytes
// are never copied across the thread boundary.

import * as Comlink from 'comlink';
import { analyzeDocument } from '../optimizer/analyze';
import { createWebIO } from '../optimizer/draco';
import { optimizeModel } from '../optimizer/optimize';
import { readModel } from '../optimizer/read';
import type { ModelReport, OptimizeResult, OptimizeSettings, Progress } from '../optimizer/types';

export interface OptimizerWorkerApi {
  analyze(glb: ArrayBuffer, fileName: string): Promise<ModelReport>;
  optimize(
    glb: ArrayBuffer,
    settings: OptimizeSettings,
    onProgress: (progress: Progress) => void,
  ): Promise<OptimizeResult>;
}

// One WebIO (and one DRACO wasm init) per worker lifetime, shared by analyze calls.
let ioPromise: ReturnType<typeof createWebIO> | undefined;
const getIO = () => (ioPromise ??= createWebIO());

const api: OptimizerWorkerApi = {
  async analyze(glb, fileName) {
    const io = await getIO();
    const doc = await readModel(io, new Uint8Array(glb));
    return analyzeDocument(doc, { fileName, byteLength: glb.byteLength });
  },

  async optimize(glb, settings, onProgress) {
    const result = await optimizeModel(glb, settings, onProgress);
    return Comlink.transfer(result, [result.glb]);
  },
};

Comlink.expose(api);
