// T18 — shape-preservation read-back over BROWSER-produced artifacts. The E2E
// suite captures each optimized GLB into .artifacts/ (see e2e/artifacts.ts); this
// spec reads them back through NodeIO + the DRACO decoder and asserts the
// fidelity invariants:
//   - triangle/index count preserved (no decimation),
//   - populated material texture slots preserved (no dropped maps),
//   - morph targets / skins survive, and DRACO is present for plain models,
//     absent for morph/skinned ones.
// Deliberately NOT asserted: vertexCount (weld() merges coincident vertices —
// shape-preserving, count-changing), bit-exact positions (DRACO pos-14
// quantization moves them), and DEGENERATE triangles: the DRACO encoder drops
// zero-area faces with repeated indices (the demo model ships with 2), so counts
// compare non-degenerate triangles only — degenerates render nothing.
//
// On a tree that has never run Playwright the artifacts don't exist yet; those
// tests skip. Run `npx playwright test` once to produce them.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO, type Document, type Material, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3d';
import { describe, expect, test } from 'vitest';
import { ARTIFACTS_DIR } from '../e2e/artifacts';
import { denseGlb, morphGlb, skinnedGlb } from './fixtures/generate';
import { glbJson } from './helpers/glb';

const artifactPath = (name: string) => join(ARTIFACTS_DIR, `${name}-optimized.glb`);
const hasArtifact = (name: string) => existsSync(artifactPath(name));

async function readGlb(glb: Uint8Array): Promise<Document> {
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
  return io.readBinary(glb);
}

/** Visit each RENDERED primitive, via scene traversal per node reference. Stable
 * across dedup() (merges identical meshes/materials) and prune() (may drop nodes
 * outside any scene) — neither changes what is drawn. */
function eachRenderedPrim(doc: Document, visit: (prim: Primitive) => void): void {
  for (const scene of doc.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (mesh) for (const prim of mesh.listPrimitives()) visit(prim);
    });
  }
}

/** Non-degenerate triangles only — see the header note on DRACO and degenerates. */
function triangleCount(doc: Document): number {
  let triangles = 0;
  eachRenderedPrim(doc, (prim) => {
    const indices = prim.getIndices()?.getArray();
    if (!indices) {
      triangles += (prim.getAttribute('POSITION')?.getCount() ?? 0) / 3;
      return;
    }
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [indices[i]!, indices[i + 1]!, indices[i + 2]!];
      if (a !== b && b !== c && a !== c) triangles += 1;
    }
  });
  return triangles;
}

const SLOT_GETTERS = {
  baseColor: (m: Material) => m.getBaseColorTexture(),
  normal: (m: Material) => m.getNormalTexture(),
  metallicRoughness: (m: Material) => m.getMetallicRoughnessTexture(),
  occlusion: (m: Material) => m.getOcclusionTexture(),
  emissive: (m: Material) => m.getEmissiveTexture(),
};

/** One "which texture slots are populated" signature per rendered primitive,
 * as a sorted multiset — material identity may change (dedup), the maps may not. */
function slotSignatures(doc: Document): string[] {
  const signatures: string[] = [];
  eachRenderedPrim(doc, (prim) => {
    const material = prim.getMaterial();
    signatures.push(
      material
        ? Object.entries(SLOT_GETTERS)
            .filter(([, get]) => get(material) !== null)
            .map(([slot]) => slot)
            .join('+')
        : '(no material)',
    );
  });
  return signatures.sort();
}

async function readPair(name: string, original: Uint8Array) {
  const optimizedBytes = new Uint8Array(readFileSync(artifactPath(name)));
  return {
    original: await readGlb(original),
    optimized: await readGlb(optimizedBytes),
    optimizedExtensions: glbJson(optimizedBytes).extensionsUsed ?? [],
  };
}

describe('T18 read-back: browser-optimized artifacts preserve shape', () => {
  test.skipIf(!hasArtifact('dense'))('dense: triangles + slots preserved, DRACO present', async () => {
    const { original, optimized, optimizedExtensions } = await readPair('dense', await denseGlb());
    expect(triangleCount(optimized)).toBe(triangleCount(original));
    expect(slotSignatures(optimized)).toEqual(slotSignatures(original));
    expect(optimizedExtensions).toContain('KHR_draco_mesh_compression');
  });

  test.skipIf(!hasArtifact('perseverance'))('demo model: triangles + slots preserved, DRACO present', async () => {
    const source = new Uint8Array(readFileSync(join(process.cwd(), 'public', 'demo', 'perseverance.glb')));
    const { original, optimized, optimizedExtensions } = await readPair('perseverance', source);
    expect(triangleCount(original)).toBeGreaterThan(100_000); // guard: the real model, not a stub
    expect(triangleCount(optimized)).toBe(triangleCount(original));
    expect(slotSignatures(optimized)).toEqual(slotSignatures(original));
    expect(optimizedExtensions).toContain('KHR_draco_mesh_compression');
  });

  test.skipIf(!hasArtifact('morph'))('morph: targets survive, no DRACO', async () => {
    const { original, optimized, optimizedExtensions } = await readPair('morph', await morphGlb());
    expect(triangleCount(optimized)).toBe(triangleCount(original));
    const targets = optimized
      .getRoot()
      .listMeshes()
      .flatMap((mesh) => mesh.listPrimitives())
      .flatMap((prim) => prim.listTargets());
    expect(targets.length).toBe(1);
    expect(targets[0]!.getAttribute('POSITION')).not.toBeNull();
    expect(optimizedExtensions).not.toContain('KHR_draco_mesh_compression');
  });

  test.skipIf(!hasArtifact('skinned'))('skinned: skin + joint attributes survive, no DRACO', async () => {
    const { original, optimized, optimizedExtensions } = await readPair('skinned', await skinnedGlb());
    expect(triangleCount(optimized)).toBe(triangleCount(original));
    expect(optimized.getRoot().listSkins().length).toBe(1);
    const prim = optimized.getRoot().listMeshes()[0]!.listPrimitives()[0]!;
    expect(prim.getAttribute('JOINTS_0')).not.toBeNull();
    expect(prim.getAttribute('WEIGHTS_0')).not.toBeNull();
    expect(optimizedExtensions).not.toContain('KHR_draco_mesh_compression');
  });
});
