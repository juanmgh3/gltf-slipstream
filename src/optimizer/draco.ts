// Browser I/O factory: a WebIO with the draco3d encoder+decoder registered and the
// wasm served from our own origin (public/draco/, copied postinstall) — no CDN, so
// the privacy/offline promise holds. Browser-bound (Emscripten fetches the wasm);
// exercised by the worker and the E2E suite, not by Node unit tests.

import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { createDecoderModule, createEncoderModule } from 'draco3d';

const locateFile = (file: string): string => `/draco/${file}`;

export async function createWebIO(): Promise<WebIO> {
  const [decoder, encoder] = await Promise.all([
    createDecoderModule({ locateFile }),
    createEncoderModule({ locateFile }),
  ]);
  // ALL_EXTENSIONS: arbitrary user models may use extensions we don't optimize
  // (clearcoat, transmission, ...) — registering them keeps read→write lossless.
  return new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': decoder,
    'draco3d.encoder': encoder,
  });
}
