import { describe, it, expect, beforeAll } from 'vitest';
import { NodeIO, type Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { optimizeDocument, shouldCompressGeometry } from '../../src/optimizer/optimize';
import type { OptimizeSettings, Progress } from '../../src/optimizer/types';
import { plainGlb, skinnedGlb, morphGlb, animOnlyGlb } from '../fixtures/generate';
import { initJsquashForNode } from '../helpers/jsquash-node';

// Pipeline contract at the document-graph level (the byte-level proof is E2E):
// textures re-encode per settings, the DRACO gate is a pure decision, and DRACO is
// only ever added when neither morph targets nor skinning are present.

beforeAll(initJsquashForNode);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const DEFAULTS: OptimizeSettings = { preset: 'balanced', overrides: {} };

const load = async (glb: Uint8Array): Promise<Document> => io.readBinary(glb);
const usedExtensions = (doc: Document) => doc.getRoot().listExtensionsUsed().map((e) => e.extensionName);

describe('shouldCompressGeometry (pure gate)', () => {
  const features = (hasSkinning: boolean, hasMorphTargets: boolean) => ({
    features: { hasAnimation: false, hasSkinning, hasMorphTargets },
  });

  it('is true only when neither skinning nor morph targets are present', () => {
    expect(shouldCompressGeometry(features(false, false))).toBe(true);
    expect(shouldCompressGeometry(features(true, false))).toBe(false);
    expect(shouldCompressGeometry(features(false, true))).toBe(false);
    expect(shouldCompressGeometry(features(true, true))).toBe(false);
  });
});

describe('optimizeDocument', () => {
  it('re-encodes all textures to WebP and adds DRACO on a plain model', async () => {
    const doc = await load(await plainGlb());
    const outcome = await optimizeDocument(doc, DEFAULTS);
    for (const texture of doc.getRoot().listTextures()) {
      expect(texture.getMimeType()).toBe('image/webp');
    }
    expect(usedExtensions(doc)).toContain('EXT_texture_webp');
    expect(usedExtensions(doc)).toContain('KHR_draco_mesh_compression');
    expect(outcome.geometryCompressed).toBe(true);
    expect(outcome.perTexture).toHaveLength(4);
    expect(outcome.perTexture.every((t) => t.action === 'webp')).toBe(true);
    expect(outcome.texturesBefore).toBeGreaterThan(0);
  });

  it('never adds DRACO to a morph-target model (textures untouched by the gate)', async () => {
    const doc = await load(await morphGlb());
    const outcome = await optimizeDocument(doc, DEFAULTS);
    expect(usedExtensions(doc)).not.toContain('KHR_draco_mesh_compression');
    expect(outcome.geometryCompressed).toBe(false);
  });

  it('never adds DRACO to a skinned model', async () => {
    const doc = await load(await skinnedGlb());
    const outcome = await optimizeDocument(doc, DEFAULTS);
    expect(usedExtensions(doc)).not.toContain('KHR_draco_mesh_compression');
    expect(outcome.geometryCompressed).toBe(false);
  });

  it('compresses animation-only models normally (channels target nodes, not vertices)', async () => {
    const doc = await load(await animOnlyGlb());
    const outcome = await optimizeDocument(doc, DEFAULTS);
    expect(usedExtensions(doc)).toContain('KHR_draco_mesh_compression');
    expect(outcome.geometryCompressed).toBe(true);
  });

  it('excluded textures keep their original bytes and mime', async () => {
    const doc = await load(await plainGlb());
    const original = doc.getRoot().listTextures()[0].getImage()?.slice();
    const outcome = await optimizeDocument(doc, { preset: 'balanced', overrides: { '0': { exclude: true } } });
    const texture = doc.getRoot().listTextures()[0];
    expect(texture.getMimeType()).toBe('image/png');
    expect(texture.getImage()).toEqual(original);
    expect(outcome.perTexture.find((t) => t.id === '0')?.action).toBe('excluded');
    expect(outcome.perTexture.filter((t) => t.action === 'webp')).toHaveLength(3);
  });

  it('applies a per-texture maxResolution override', async () => {
    const doc = await load(await plainGlb());
    await optimizeDocument(doc, { preset: 'balanced', overrides: { '0': { maxResolution: 4 } } });
    expect(doc.getRoot().listTextures()[0].getSize()).toEqual([4, 4]);
  });

  it('keeps unsupported embedded codecs as-is with action "kept"', async () => {
    const doc = await load(await plainGlb());
    const ktx2 = doc.createTexture('compressed').setMimeType('image/ktx2').setImage(new Uint8Array(16));
    doc.getRoot().listMaterials()[1].setOcclusionTexture(ktx2); // bound, so prune keeps it
    const outcome = await optimizeDocument(doc, DEFAULTS);
    const kept = outcome.perTexture.find((t) => t.action === 'kept');
    expect(kept).toBeDefined();
    expect(ktx2.getMimeType()).toBe('image/ktx2');
    expect(ktx2.getImage()?.byteLength).toBe(16);
  });

  it('emits monotonic progress through textures then geometry', async () => {
    const doc = await load(await plainGlb());
    const events: Progress[] = [];
    await optimizeDocument(doc, DEFAULTS, (p) => events.push(p));
    const phases = [...new Set(events.map((e) => e.phase))];
    expect(phases).toEqual(['textures', 'geometry']);
    const textureEvents = events.filter((e) => e.phase === 'textures');
    expect(textureEvents.at(-1)?.done).toBe(textureEvents.at(-1)?.total);
    for (let i = 1; i < textureEvents.length; i++) {
      expect(textureEvents[i].done).toBeGreaterThanOrEqual(textureEvents[i - 1].done);
    }
  });

  it('reports texture byte totals shrinking (8×8 PNGs → WebP)', async () => {
    const doc = await load(await plainGlb());
    const outcome = await optimizeDocument(doc, DEFAULTS);
    expect(outcome.texturesAfter).toBeGreaterThan(0);
    expect(outcome.texturesAfter).toBeLessThan(outcome.texturesBefore);
  });
});
