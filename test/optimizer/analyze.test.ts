import { describe, it, expect } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { analyzeDocument, LARGE_INPUT_BYTES, LARGE_TEXTURE_DIMENSION } from '../../src/optimizer/analyze';
import { plainGlb, skinnedGlb, morphGlb, animOnlyGlb } from '../fixtures/generate';

// Analysis contract: stats + texture list + feature detection (animation / skinning /
// morph targets) + non-blocking warnings. Analysis must never throw on a valid model.

const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]);
const meta = { fileName: 'model.glb', byteLength: 1000 };

/** Header-only PNG (IHDR + IEND) declaring the given dimensions — enough for getSize(). */
function pngHeaderClaiming(width: number, height: number): Uint8Array {
  const out = new Uint8Array(8 + 25 + 12);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const dv = new DataView(out.buffer);
  dv.setUint32(8, 13); // IHDR length
  out.set([0x49, 0x48, 0x44, 0x52], 12); // 'IHDR'
  dv.setUint32(16, width);
  dv.setUint32(20, height);
  out.set([8, 2, 0, 0, 0], 24); // bit depth, RGB, defaults
  out.set([0x49, 0x45, 0x4e, 0x44], 37 + 4); // 'IEND'
  return out;
}

describe('analyzeDocument', () => {
  it('reports stats and the full texture list with roles on plain.glb', async () => {
    const report = analyzeDocument(await io.readBinary(await plainGlb()), meta);
    expect(report.fileName).toBe('model.glb');
    expect(report.byteLength).toBe(1000);
    expect(report.meshStats).toEqual({ vertexCount: 8, primitiveCount: 2, hasDraco: false });
    expect(report.textures).toHaveLength(4);
    const mr = report.textures.find((t) => t.name === 'mr');
    expect(mr?.roles.slice().sort()).toEqual(['metallicRoughness', 'occlusion']);
    expect(mr?.mimeType).toBe('image/png');
    expect(mr?.width).toBe(8);
    expect(mr?.height).toBe(8);
    expect(mr?.byteLength).toBeGreaterThan(0);
    expect(report.features).toEqual({ hasAnimation: false, hasSkinning: false, hasMorphTargets: false });
    expect(report.warnings).toEqual([]);
  });

  it('detects skinning and warns that geometry compression is skipped', async () => {
    const report = analyzeDocument(await io.readBinary(await skinnedGlb()), meta);
    expect(report.features.hasSkinning).toBe(true);
    expect(report.warnings.some((w) => /skinn/i.test(w))).toBe(true);
  });

  it('detects morph targets and warns that geometry compression is skipped', async () => {
    const report = analyzeDocument(await io.readBinary(await morphGlb()), meta);
    expect(report.features.hasMorphTargets).toBe(true);
    expect(report.warnings.some((w) => /morph/i.test(w))).toBe(true);
  });

  it('detects animation (without skin/morph) and warns it is preserved as-is', async () => {
    const report = analyzeDocument(await io.readBinary(await animOnlyGlb()), meta);
    expect(report.features).toEqual({ hasAnimation: true, hasSkinning: false, hasMorphTargets: false });
    expect(report.warnings.some((w) => /animation/i.test(w))).toBe(true);
    expect(report.warnings.some((w) => /skinn|morph/i.test(w))).toBe(false);
  });

  it('reports hasDraco when the input already uses KHR_draco_mesh_compression', async () => {
    const doc = await io.readBinary(await plainGlb());
    doc.createExtension(KHRDracoMeshCompression).setRequired(true);
    expect(analyzeDocument(doc, meta).meshStats.hasDraco).toBe(true);
  });

  it('warns (non-blocking) on 4K-class textures', async () => {
    const doc = await io.readBinary(await plainGlb());
    doc
      .createTexture('huge')
      .setMimeType('image/png')
      .setImage(pngHeaderClaiming(LARGE_TEXTURE_DIMENSION, LARGE_TEXTURE_DIMENSION));
    const report = analyzeDocument(doc, meta);
    expect(report.warnings.some((w) => w.includes('huge'))).toBe(true);
  });

  it('warns (non-blocking) on large input files', async () => {
    const doc = await io.readBinary(await plainGlb());
    const report = analyzeDocument(doc, { fileName: 'big.glb', byteLength: LARGE_INPUT_BYTES });
    expect(report.warnings.some((w) => /large/i.test(w))).toBe(true);
  });

  it('warns on unsupported embedded codecs (KTX2/Basis) and keeps analyzing', async () => {
    const doc = await io.readBinary(await plainGlb());
    doc.createTexture('compressed').setMimeType('image/ktx2').setImage(new Uint8Array(16));
    const report = analyzeDocument(doc, meta);
    expect(report.warnings.some((w) => w.includes('compressed'))).toBe(true);
    expect(report.textures.length).toBe(5);
  });
});
