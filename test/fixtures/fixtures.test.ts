import { describe, it, expect } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { plainGlb, skinnedGlb, morphGlb, animOnlyGlb, externalGltf, junkBytes } from './generate';

// Sanity: each generated fixture is structurally real and loadable, and the two
// invalid inputs (external.gltf, junk.bin) are present for T5. Per-task tests
// (roles in T6, features in T8, pipeline in T11) build on these.
const io = new NodeIO();

describe('test fixtures', () => {
  it('plain.glb: loads with ≥2 meshes and ≥4 textures bound across roles', async () => {
    const doc = await io.readBinary(await plainGlb());
    expect(doc.getRoot().listMeshes().length).toBeGreaterThanOrEqual(2);
    expect(doc.getRoot().listTextures().length).toBeGreaterThanOrEqual(4);
  });

  it('skinned.glb: loads with a skin and real JOINTS_0/WEIGHTS_0', async () => {
    const doc = await io.readBinary(await skinnedGlb());
    expect(doc.getRoot().listSkins().length).toBe(1);
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    expect(prim.getAttribute('JOINTS_0')).toBeTruthy();
    expect(prim.getAttribute('WEIGHTS_0')).toBeTruthy();
  });

  it('morph.glb: loads with a primitive morph target', async () => {
    const doc = await io.readBinary(await morphGlb());
    const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
    expect(prim.listTargets().length).toBeGreaterThanOrEqual(1);
  });

  it('anim-only.glb: loads with animation but no skin or morph', async () => {
    const doc = await io.readBinary(await animOnlyGlb());
    expect(doc.getRoot().listAnimations().length).toBe(1);
    expect(doc.getRoot().listSkins().length).toBe(0);
    expect(doc.getRoot().listMeshes()[0].listPrimitives()[0].listTargets().length).toBe(0);
  });

  it('external.gltf: parses as glTF referencing external (non-embedded) resources', () => {
    const json = JSON.parse(new TextDecoder().decode(externalGltf())) as {
      buffers?: Array<{ uri?: string }>;
      images?: Array<{ uri?: string }>;
    };
    const uris = [...(json.buffers ?? []), ...(json.images ?? [])]
      .map((x) => x.uri)
      .filter((u): u is string => Boolean(u));
    expect(uris.length).toBeGreaterThan(0);
    expect(uris.every((u) => !u.startsWith('data:'))).toBe(true);
  });

  it('junk.bin: present and not a GLB (bad magic)', () => {
    const bytes = junkBytes();
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(new TextDecoder().decode(bytes.subarray(0, 4))).not.toBe('glTF');
  });
});
