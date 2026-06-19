// SPIKE worker (throwaway) — proves the load-bearing path in a real browser worker:
// WebIO with draco3d encoder+decoder + EXT_texture_webp + KHR_draco →
// readBinary → per-texture (decode → @jsquash webp encode → setImage + webp mime) →
// weld/dedup/prune → configure DRACO → writeBinary (DRACO encode happens here).
// Order: textures → write. Then a programmatic re-decode proves the output is valid.
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression, EXTTextureWebP } from '@gltf-transform/extensions';
import { weld, dedup, prune } from '@gltf-transform/functions';
import { createEncoderModule, createDecoderModule } from 'draco3d';
import { decode as decodePng } from '@jsquash/png';
import { decode as decodeJpeg } from '@jsquash/jpeg';
import { decode as decodeWebp, encode as encodeWebp } from '@jsquash/webp';

const DRACO_OPTS = {
  method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
  encodeSpeed: 5,
  decodeSpeed: 5,
  quantizationBits: { POSITION: 14, NORMAL: 12, TEX_COORD: 14, COLOR: 8, GENERIC: 12 },
};

async function makeIO() {
  const [decoder, encoder] = await Promise.all([
    createDecoderModule({ locateFile: (f) => `/draco/${f}` }),
    createEncoderModule({ locateFile: (f) => `/draco/${f}` }),
  ]);
  return new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': decoder,
    'draco3d.encoder': encoder,
  });
}

function glbExtensionsUsed(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(u8.subarray(20, 20 + jsonLen)));
  return json.extensionsUsed || [];
}

const toAB = (u8) => u8.slice().buffer; // exact-length ArrayBuffer copy for @jsquash

self.onmessage = async (e) => {
  const timings = [];
  const stamp = (label, t0) => timings.push({ label, ms: Math.round(performance.now() - t0) });
  try {
    const inputBuf = e.data;
    const inputSize = inputBuf.byteLength;

    let t = performance.now();
    const io = await makeIO();
    stamp('io+wasm', t);

    const doc = await io.readBinary(new Uint8Array(inputBuf));

    // --- textures → webp ---
    t = performance.now();
    let texCount = 0;
    for (const tex of doc.getRoot().listTextures()) {
      const mime = tex.getMimeType();
      const img = tex.getImage();
      if (!img) continue;
      let imageData;
      if (mime === 'image/png') imageData = await decodePng(toAB(img));
      else if (mime === 'image/jpeg') imageData = await decodeJpeg(toAB(img));
      else if (mime === 'image/webp') imageData = await decodeWebp(toAB(img));
      else continue; // KTX2/Basis etc. → out of scope, keep as-is
      const webp = await encodeWebp(imageData, { quality: 80 });
      tex.setImage(new Uint8Array(webp)).setMimeType('image/webp');
      texCount++;
    }
    if (texCount > 0) doc.createExtension(EXTTextureWebP).setRequired(true);
    stamp('textures→webp', t);

    // --- geometry cleanup (non-destructive) ---
    t = performance.now();
    await doc.transform(weld(), dedup(), prune());
    doc.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions(DRACO_OPTS);
    stamp('weld/dedup/prune', t);

    // --- single write performs the deferred DRACO encode ---
    t = performance.now();
    const out = await io.writeBinary(doc);
    stamp('writeBinary(draco encode)', t);

    const exts = glbExtensionsUsed(out);
    const hasDraco = exts.includes('KHR_draco_mesh_compression');
    const hasWebp = exts.includes('EXT_texture_webp');

    // --- programmatic re-decode proof (same self-hosted draco3d decoder) ---
    let redecodeOk = false, redecodeErr = null, vtx = 0;
    try {
      t = performance.now();
      const io2 = await makeIO();
      const doc2 = await io2.readBinary(out);
      const pos = doc2.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION');
      vtx = pos ? pos.getCount() : 0;
      redecodeOk = vtx > 0;
      stamp('re-decode', t);
    } catch (err) {
      redecodeErr = String((err && err.stack) || err);
    }

    const outBuf = out.slice().buffer;
    self.postMessage(
      { ok: true, inputSize, outputSize: out.byteLength, ratio: +(out.byteLength / inputSize).toFixed(3),
        texCount, exts, hasDraco, hasWebp, redecodeOk, redecodeErr, vtx, timings, out: outBuf },
      [outBuf],
    );
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.stack) || err), timings });
  }
};
