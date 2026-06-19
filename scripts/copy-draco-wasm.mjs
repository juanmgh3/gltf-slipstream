// Spike helper: self-host the wasm both decode paths need, so nothing is fetched
// from a CDN (privacy + offline-friendly).
//   public/draco/    → draco3d encoder+decoder wasm  (the WebIO worker path)
//   public/mv-draco/ → three.js draco decoder         (model-viewer consumer path)
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

mkdirSync('public/draco', { recursive: true });
for (const f of ['draco_encoder.wasm', 'draco_decoder.wasm']) {
  copyFileSync(join('node_modules/draco3d', f), join('public/draco', f));
  console.log('copied', f, '→ public/draco/');
}

mkdirSync('public/mv-draco', { recursive: true });
const mvSrc = 'node_modules/three/examples/jsm/libs/draco';
for (const f of ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']) {
  copyFileSync(join(mvSrc, f), join('public/mv-draco', f));
  console.log('copied', f, '→ public/mv-draco/');
}
