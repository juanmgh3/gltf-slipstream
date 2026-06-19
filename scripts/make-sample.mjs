// Spike helper: generate a throwaway, license-free textured GLB to exercise the
// load-bearing path (real geometry for DRACO + a real PNG texture for WebP).
// NOT the curated demo (that's T17). Output: public/sample.glb
import { Document, NodeIO } from '@gltf-transform/core';
import { writeFileSync } from 'node:fs';
import zlib from 'node:zlib';

// --- minimal PNG encoder (RGB, no deps) ---
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set([...type].map((ch) => ch.charCodeAt(0)), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function encodePNG(w, h, rgb) {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, RGB
  const stride = w * 3;
  const raw = new Uint8Array(h * (stride + 1));
  for (let y = 0; y < h; y++) raw.set(rgb.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0; for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
function makeTextureRGB(size) {
  const rgb = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 3, u = x / size, v = y / size, check = ((x >> 5) + (y >> 5)) & 1;
    rgb[i] = (255 * u) | 0;
    rgb[i + 1] = (255 * v) | 0;
    rgb[i + 2] = check ? 200 : (60 + 80 * (0.5 + 0.5 * Math.sin(u * 20))) | 0;
  }
  return rgb;
}

// --- UV sphere (enough tris that DRACO yields a clear win) ---
function makeSphere(wSeg, hSeg) {
  const positions = [], normals = [], uvs = [], indices = [];
  for (let iy = 0; iy <= hSeg; iy++) {
    const v = iy / hSeg, theta = v * Math.PI;
    for (let ix = 0; ix <= wSeg; ix++) {
      const u = ix / wSeg, phi = u * Math.PI * 2;
      const x = -Math.cos(phi) * Math.sin(theta), y = Math.cos(theta), z = Math.sin(phi) * Math.sin(theta);
      positions.push(x, y, z); normals.push(x, y, z); uvs.push(u, 1 - v);
    }
  }
  const row = wSeg + 1;
  for (let iy = 0; iy < hSeg; iy++) for (let ix = 0; ix < wSeg; ix++) {
    const a = iy * row + ix, b = a + 1, c = a + row, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  return {
    positions: new Float32Array(positions), normals: new Float32Array(normals),
    uvs: new Float32Array(uvs), indices: new Uint16Array(indices),
  };
}

const s = makeSphere(128, 64); // 8385 verts < 65536 → uint16 indices ok
const png = encodePNG(1024, 1024, makeTextureRGB(1024));

const doc = new Document();
const buf = doc.createBuffer();
const pos = doc.createAccessor().setType('VEC3').setArray(s.positions).setBuffer(buf);
const nor = doc.createAccessor().setType('VEC3').setArray(s.normals).setBuffer(buf);
const uv = doc.createAccessor().setType('VEC2').setArray(s.uvs).setBuffer(buf);
const idx = doc.createAccessor().setType('SCALAR').setArray(s.indices).setBuffer(buf);
const tex = doc.createTexture('base').setImage(png).setMimeType('image/png');
const mat = doc.createMaterial('mat').setBaseColorTexture(tex).setMetallicFactor(0).setRoughnessFactor(0.85);
const prim = doc.createPrimitive()
  .setAttribute('POSITION', pos).setAttribute('NORMAL', nor).setAttribute('TEXCOORD_0', uv)
  .setIndices(idx).setMaterial(mat);
const node = doc.createNode('sphere').setMesh(doc.createMesh('sphere').addPrimitive(prim));
doc.createScene('scene').addChild(node);

const glb = await new NodeIO().writeBinary(doc);
writeFileSync('public/sample.glb', glb);
console.log(`wrote public/sample.glb: ${glb.byteLength} bytes (verts=${s.positions.length / 3}, tris=${s.indices.length / 3}, png=${png.length}B)`);
