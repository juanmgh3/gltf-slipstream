// Model analysis: stats, texture inventory with roles, feature detection and
// non-blocking warnings. Pure over a parsed Document so it runs under NodeIO in
// tests and under WebIO in the worker; it must never throw on a valid model.

import type { Document } from '@gltf-transform/core';
import { detectTextureRoles } from './roles';
import type { ModelReport, TextureInfo } from './types';

// Threshold from measurement: ~214 ms to encode a 1024² texture in-browser. WebP
// encode scales with texel count, so a 4096² map costs ~16× (≈3.5 s per texture).
export const LARGE_TEXTURE_DIMENSION = 4096;
export const LARGE_INPUT_BYTES = 50 * 1024 * 1024;

const UNSUPPORTED_CODECS = ['image/ktx2', 'image/basis'];

export function analyzeDocument(doc: Document, meta: { fileName: string; byteLength: number }): ModelReport {
  const root = doc.getRoot();
  const warnings: string[] = [];

  const roles = detectTextureRoles(doc);
  const textures: TextureInfo[] = root.listTextures().map((texture, index) => {
    const size = texture.getSize();
    return {
      id: String(index),
      name: texture.getName(),
      roles: [...(roles.get(texture) ?? [])],
      mimeType: texture.getMimeType(),
      width: size?.[0] ?? 0,
      height: size?.[1] ?? 0,
      byteLength: texture.getImage()?.byteLength ?? 0,
    };
  });

  let vertexCount = 0;
  let primitiveCount = 0;
  let hasSkinning = false;
  let hasMorphTargets = false;
  for (const mesh of root.listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      primitiveCount += 1;
      vertexCount += primitive.getAttribute('POSITION')?.getCount() ?? 0;
      if (primitive.getAttribute('JOINTS_0')) hasSkinning = true;
      if (primitive.listTargets().length > 0) hasMorphTargets = true;
    }
  }
  hasSkinning ||= root.listSkins().length > 0;
  const hasAnimation = root.listAnimations().length > 0;
  const hasDraco = root
    .listExtensionsUsed()
    .some((extension) => extension.extensionName === 'KHR_draco_mesh_compression');

  if (hasSkinning) {
    warnings.push(
      'Skinned mesh detected — geometry compression is skipped to keep joints intact; textures are still optimized.',
    );
  }
  if (hasMorphTargets) {
    warnings.push(
      'Morph targets detected — geometry compression is skipped to keep them intact; textures are still optimized.',
    );
  }
  if (hasAnimation) {
    warnings.push('Animation detected — it is preserved as-is, not optimized.');
  }
  for (const info of textures) {
    if (UNSUPPORTED_CODECS.includes(info.mimeType)) {
      warnings.push(`Texture "${info.name}" uses an unsupported embedded codec (KTX2/Basis) and is kept as-is.`);
    } else if (Math.max(info.width, info.height) >= LARGE_TEXTURE_DIMENSION) {
      warnings.push(`Texture "${info.name}" is ${info.width}×${info.height} — 4K-class maps take a few seconds each to encode.`);
    }
  }
  if (meta.byteLength >= LARGE_INPUT_BYTES) {
    warnings.push('Large file — optimization may take a while. The page stays responsive while it runs.');
  }

  return {
    fileName: meta.fileName,
    byteLength: meta.byteLength,
    textures,
    meshStats: { vertexCount, primitiveCount, hasDraco },
    features: { hasAnimation, hasSkinning, hasMorphTargets },
    warnings,
  };
}
