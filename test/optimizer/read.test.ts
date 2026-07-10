// The worker must accept both container formats the validator admits — binary
// .glb and fully-embedded .gltf JSON. `readModel` is the format branch, unit-tested
// here over NodeIO (PlatformIO superclass — same code path WebIO takes in the worker).
import { NodeIO } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { readModel } from '../../src/optimizer/read';
import { embeddedGltf, plainGlb } from '../fixtures/generate';

const io = new NodeIO();

describe('readModel', () => {
  it('reads a binary .glb container', async () => {
    const doc = await readModel(io, await plainGlb());
    expect(doc.getRoot().listTextures()).toHaveLength(4);
    expect(doc.getRoot().listMeshes()).toHaveLength(2);
  });

  it('reads an embedded .gltf, decoding its data URIs', async () => {
    const doc = await readModel(io, embeddedGltf());
    const textures = doc.getRoot().listTextures();
    expect(textures).toHaveLength(1);
    // The data-URI image must be materialized as real bytes (PNG signature),
    // not left as an unresolved reference.
    const image = textures[0].getImage();
    expect(image).not.toBeNull();
    expect(Array.from(image!.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('rejects bytes that are neither', async () => {
    await expect(readModel(io, new Uint8Array([1, 2, 3, 4]))).rejects.toThrow();
  });
});
