// Optimization pipeline (T11). Document-level core: per-texture WebP re-encode
// honoring settings/overrides, then non-destructive geometry cleanup, then DRACO —
// gated OFF whenever morph targets or skinning are present, because
// KHR_draco_mesh_compression doesn't cover morph targets and its re-indexing
// desyncs morph deltas / risks joint-index corruption. The browser entry
// (optimizeModel) wraps this with WebIO read/write, where the deferred DRACO
// encode actually runs.

import type { Document } from '@gltf-transform/core';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import { dedup, draco, prune, weld } from '@gltf-transform/functions';
import { createWebIO } from './draco';
import { DRACO_OPTS, planForTexture } from './defaults';
import { detectTextureRoles } from './roles';
import { reencodeToWebP } from './textures';
import type { ModelReport, OptimizeResult, OptimizeSettings, Progress } from './types';

const DECODABLE = ['image/png', 'image/jpeg', 'image/webp'];

export function shouldCompressGeometry(report: Pick<ModelReport, 'features'>): boolean {
  return !report.features.hasMorphTargets && !report.features.hasSkinning;
}

export interface DocumentOptimizeOutcome {
  perTexture: OptimizeResult['perTexture'];
  texturesBefore: number;
  texturesAfter: number;
  geometryCompressed: boolean;
}

export async function optimizeDocument(
  doc: Document,
  settings: OptimizeSettings,
  onProgress?: (progress: Progress) => void,
): Promise<DocumentOptimizeOutcome> {
  const root = doc.getRoot();
  const roles = detectTextureRoles(doc);
  const textures = root.listTextures();
  const perTexture: OptimizeResult['perTexture'] = [];
  let texturesBefore = 0;
  let texturesAfter = 0;
  let converted = 0;

  // Sequential on purpose: each 4K decode holds w·h·4 bytes of raw RGBA.
  for (const [index, texture] of textures.entries()) {
    const id = String(index); // matches TextureInfo.id from analyze
    const name = texture.getName();
    const before = texture.getImage()?.byteLength ?? 0;
    texturesBefore += before;

    const override = settings.overrides[id];
    const mimeType = texture.getMimeType();
    let action: 'webp' | 'kept' | 'excluded';
    if (override?.exclude) {
      action = 'excluded';
    } else if (!DECODABLE.includes(mimeType)) {
      action = 'kept';
    } else {
      const textureRoles = [...(roles.get(texture) ?? [])];
      const plan = planForTexture(textureRoles, settings.preset, override);
      try {
        const image = texture.getImage();
        const webp = image ? await reencodeToWebP(image, mimeType, plan) : null;
        if (webp) {
          texture.setImage(webp).setMimeType('image/webp');
          converted += 1;
          action = 'webp';
        } else {
          action = 'kept';
        }
      } catch {
        action = 'kept'; // corrupt embedded image: keep original bytes, never fail the run
      }
    }

    texturesAfter += texture.getImage()?.byteLength ?? 0;
    perTexture.push({ id, before, after: texture.getImage()?.byteLength ?? 0, action });
    onProgress?.({ phase: 'textures', done: index + 1, total: textures.length, label: name });
  }
  if (converted > 0) doc.createExtension(EXTTextureWebP).setRequired(true);

  onProgress?.({ phase: 'geometry', done: 0, total: 1 });
  // prune v4 defaults are destructive for our contract: keepSolidTextures:false
  // replaces solid-color textures with material factors (drops maps the user was
  // shown), keepAttributes/keepIndices:false rewrite vertex data. Conservative mode:
  // only truly unreferenced properties may go.
  await doc.transform(weld(), dedup(), prune({ keepSolidTextures: true, keepAttributes: true, keepIndices: true }));

  const geometryCompressed = shouldCompressGeometry({ features: detectFeatures(doc) });
  if (geometryCompressed) await doc.transform(draco(DRACO_OPTS));
  onProgress?.({ phase: 'geometry', done: 1, total: 1 });

  return { perTexture, texturesBefore, texturesAfter, geometryCompressed };
}

/** Browser entry: WebIO read → document pipeline → write (deferred DRACO encode). */
export async function optimizeModel(
  glb: ArrayBuffer,
  settings: OptimizeSettings,
  onProgress: (progress: Progress) => void,
): Promise<OptimizeResult> {
  const io = await createWebIO();
  const doc = await io.readBinary(new Uint8Array(glb));
  const outcome = await optimizeDocument(doc, settings, onProgress);

  onProgress({ phase: 'writing', done: 0, total: 1 });
  const output = await io.writeBinary(doc);
  onProgress({ phase: 'writing', done: 1, total: 1 });

  const inputByteLength = glb.byteLength;
  const outputByteLength = output.byteLength;
  return {
    glb: toArrayBuffer(output),
    inputByteLength,
    outputByteLength,
    breakdown: {
      // "geometry" here = everything that isn't embedded texture bytes (incl. JSON).
      geometryBefore: inputByteLength - outcome.texturesBefore,
      geometryAfter: outputByteLength - outcome.texturesAfter,
      texturesBefore: outcome.texturesBefore,
      texturesAfter: outcome.texturesAfter,
    },
    perTexture: outcome.perTexture,
  };
}

function detectFeatures(doc: Document): ModelReport['features'] {
  const root = doc.getRoot();
  let hasSkinning = root.listSkins().length > 0;
  let hasMorphTargets = false;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      if (primitive.getAttribute('JOINTS_0')) hasSkinning = true;
      if (primitive.listTargets().length > 0) hasMorphTargets = true;
    }
  }
  return { hasAnimation: root.listAnimations().length > 0, hasSkinning, hasMorphTargets };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? (bytes.buffer as ArrayBuffer)
    : bytes.slice().buffer;
}
