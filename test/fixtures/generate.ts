// Synthetic, license-free test fixtures built with NodeIO. Structurally REAL (bound
// textures across roles, real JOINTS/WEIGHTS, a real morph target, node animation) so
// the role/feature/pipeline tests in T6/T8/T11 actually mean something — but tiny and
// deterministic (few-tri quads, 8x8 PNGs via a zlib encoder, zero new deps). Generated
// in-memory on demand; nothing is written to disk or committed.
import { Document, NodeIO, type Buffer as GBuffer, type Material } from '@gltf-transform/core';
import zlib from 'node:zlib';

// --- minimal PNG encoder (RGB, 8-bit) ---
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set([...type].map((ch) => ch.charCodeAt(0)), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
function solidPNG(size: number, r: number, g: number, b: number): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, size);
  dv.setUint32(4, size);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  const stride = size * 3;
  const raw = new Uint8Array(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (stride + 1) + 1;
    for (let x = 0; x < size; x++) {
      raw[row + x * 3] = r;
      raw[row + x * 3 + 1] = g;
      raw[row + x * 3 + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

// --- geometry helper: a unit quad (4 verts, 2 tris) ---
const QUAD = {
  position: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
  uv: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
  index: new Uint16Array([0, 1, 2, 0, 2, 3]),
};
function quadPrim(doc: Document, buf: GBuffer, mat?: Material) {
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(QUAD.position).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(QUAD.normal).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(QUAD.uv).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(QUAD.index).setBuffer(buf));
  if (mat) prim.setMaterial(mat);
  return prim;
}

/** ≥2 meshes; textures bound as baseColor + normal + metallicRoughness(+occlusion, multi-role) + emissive. */
export async function plainGlb(): Promise<Uint8Array> {
  const doc = new Document();
  const buf = doc.createBuffer();
  const texBase = doc.createTexture('base').setImage(solidPNG(8, 200, 80, 80)).setMimeType('image/png');
  const texNormal = doc.createTexture('normal').setImage(solidPNG(8, 128, 128, 255)).setMimeType('image/png');
  const texMR = doc.createTexture('mr').setImage(solidPNG(8, 0, 200, 40)).setMimeType('image/png');
  const texEmissive = doc.createTexture('emissive').setImage(solidPNG(8, 250, 250, 120)).setMimeType('image/png');

  const mat1 = doc
    .createMaterial('mat1')
    .setBaseColorTexture(texBase)
    .setNormalTexture(texNormal)
    .setMetallicRoughnessTexture(texMR)
    .setOcclusionTexture(texMR); // texMR is multi-role: metallicRoughness + occlusion
  const mat2 = doc.createMaterial('mat2').setBaseColorTexture(texBase).setEmissiveTexture(texEmissive);

  const node1 = doc.createNode('mesh1').setMesh(doc.createMesh('mesh1').addPrimitive(quadPrim(doc, buf, mat1)));
  const node2 = doc.createNode('mesh2').setMesh(doc.createMesh('mesh2').addPrimitive(quadPrim(doc, buf, mat2)));
  doc.createScene('scene').addChild(node1).addChild(node2);
  return new NodeIO().writeBinary(doc);
}

/** Skinned mesh with real JOINTS_0/WEIGHTS_0 + a 2-joint skin. */
export async function skinnedGlb(): Promise<Uint8Array> {
  const doc = new Document();
  const buf = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(QUAD.position).setBuffer(buf))
    .setAttribute(
      'JOINTS_0',
      doc.createAccessor().setType('VEC4').setArray(new Uint8Array([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0])).setBuffer(buf),
    )
    .setAttribute(
      'WEIGHTS_0',
      doc.createAccessor().setType('VEC4').setArray(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])).setBuffer(buf),
    )
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(QUAD.index).setBuffer(buf));
  const meshNode = doc.createNode('skinned').setMesh(doc.createMesh('skinned').addPrimitive(prim));
  const joint0 = doc.createNode('joint0');
  const joint1 = doc.createNode('joint1');
  // prettier-ignore
  const ibm = doc.createAccessor().setType('MAT4').setArray(new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ])).setBuffer(buf);
  const skin = doc.createSkin('skin').addJoint(joint0).addJoint(joint1).setInverseBindMatrices(ibm);
  meshNode.setSkin(skin);
  doc.createScene('scene').addChild(meshNode).addChild(joint0).addChild(joint1);
  return new NodeIO().writeBinary(doc);
}

/** Mesh with one real POSITION morph target. */
export async function morphGlb(): Promise<Uint8Array> {
  const doc = new Document();
  const buf = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(QUAD.position).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(QUAD.index).setBuffer(buf));
  const target = doc
    .createPrimitiveTarget('morph0')
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0.5, 0, 0, 0.5, 0, 0, 0.5, 0, 0, 0.5])).setBuffer(buf));
  prim.addTarget(target);
  const mesh = doc.createMesh('morph').addPrimitive(prim).setWeights([0]);
  doc.createScene('scene').addChild(doc.createNode('morph').setMesh(mesh));
  return new NodeIO().writeBinary(doc);
}

/** Node-targeted translation animation; no skin, no morph (compresses normally). */
export async function animOnlyGlb(): Promise<Uint8Array> {
  const doc = new Document();
  const buf = doc.createBuffer();
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(QUAD.position).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(QUAD.index).setBuffer(buf));
  const node = doc.createNode('animated').setMesh(doc.createMesh('m').addPrimitive(prim));
  const input = doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 1])).setBuffer(buf);
  const output = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 0, 0, 1, 0])).setBuffer(buf);
  const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR');
  const channel = doc.createAnimationChannel().setTargetNode(node).setTargetPath('translation').setSampler(sampler);
  doc.createAnimation('move').addSampler(sampler).addChannel(channel);
  doc.createScene('scene').addChild(node);
  return new NodeIO().writeBinary(doc);
}

/** glTF JSON referencing EXTERNAL .bin + image resources — the invalid input T5 must reject. */
export function externalGltf(): Uint8Array {
  const gltf = {
    asset: { version: '2.0' },
    buffers: [{ uri: 'external.bin', byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }],
    images: [{ uri: 'external-texture.png' }],
    textures: [{ source: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  return new TextEncoder().encode(JSON.stringify(gltf));
}

/** Deterministic non-glTF bytes (bad magic) — the crash-safety case for T5. */
export function junkBytes(): Uint8Array {
  const out = new Uint8Array(64);
  for (let i = 0; i < out.length; i++) out[i] = (i * 37 + 11) & 0xff;
  return out;
}
