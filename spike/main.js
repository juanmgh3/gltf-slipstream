// SPIKE page (throwaway) — drives the worker, prints the gate evidence, and loads
// the optimized GLB into model-viewer (the real-consumer re-decode proof). The
// model-viewer DRACO decoder is self-hosted (no gstatic CDN).
import { ModelViewerElement } from '@google/model-viewer';
ModelViewerElement.dracoDecoderLocation = '/mv-draco/';

const logEl = document.getElementById('log');
const mv = document.getElementById('mv');
function log(msg, cls) {
  console.log('[spike]', msg);
  const div = document.createElement('div');
  if (cls) div.className = cls;
  div.textContent = msg;
  logEl.appendChild(div);
}

async function run() {
  log('fetching /sample.glb …');
  const inputBuf = await (await fetch('/sample.glb')).arrayBuffer();
  log(`input: ${inputBuf.byteLength} bytes`);

  const worker = new Worker(new URL('./optimizer.worker.js', import.meta.url), { type: 'module' });
  worker.onerror = (err) => log('WORKER ERROR: ' + (err.message || err.filename || err), 'bad');
  const done = new Promise((resolve) => (worker.onmessage = (e) => resolve(e.data)));

  const ab = inputBuf.slice(0); // transfer a copy, keep original
  worker.postMessage(ab, [ab]);

  const r = await done;
  window.__spike = r;
  if (!r.ok) { log('PIPELINE FAILED: ' + r.error, 'bad'); return; }

  const smaller = r.outputSize < r.inputSize;
  log(`output: ${r.outputSize} bytes  (ratio ${r.ratio} → ${smaller ? 'SMALLER' : 'NOT smaller'})`, smaller ? 'ok' : 'bad');
  log(`extensionsUsed: ${JSON.stringify(r.exts)}`);
  log(`encoder ran (KHR_draco): ${r.hasDraco}   EXT_texture_webp: ${r.hasWebp}   textures→webp: ${r.texCount}`, r.hasDraco ? 'ok' : 'bad');
  log(`programmatic re-decode: ${r.redecodeOk ? 'OK (' + r.vtx + ' verts)' : 'FAILED — ' + r.redecodeErr}`, r.redecodeOk ? 'ok' : 'bad');
  log('timings: ' + r.timings.map((t) => `${t.label}=${t.ms}ms`).join('  '));

  // model-viewer: the real-consumer decode proof
  const url = URL.createObjectURL(new Blob([r.out], { type: 'model/gltf-binary' }));
  let settled = false;
  mv.addEventListener('load', () => {
    if (settled) return; settled = true;
    log('model-viewer: LOAD ✓ (re-decoded DRACO + WebP in a real consumer)', 'ok');
    window.__spike = { ...r, modelViewer: 'load' };
    window.__spikeDone = true;
  });
  mv.addEventListener('error', (ev) => {
    if (settled) return; settled = true;
    log('model-viewer: ERROR ✗ ' + JSON.stringify(ev.detail || {}), 'bad');
    window.__spike = { ...r, modelViewer: 'error', mvError: ev.detail || null };
    window.__spikeDone = true;
  });
  mv.src = url;
}

run().catch((e) => { log('FATAL: ' + (e.stack || e), 'bad'); window.__spikeDone = true; });
