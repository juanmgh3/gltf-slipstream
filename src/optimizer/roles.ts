// Texture roles are derived from how materials bind each texture — never from
// texture names, which arbitrary user models don't follow any convention for.

import type { Document, Material, Texture } from '@gltf-transform/core';
import type { TextureRole } from './types';

const SLOTS: ReadonlyArray<[TextureRole, (material: Material) => Texture | null]> = [
  ['baseColor', (m) => m.getBaseColorTexture()],
  ['normal', (m) => m.getNormalTexture()],
  ['metallicRoughness', (m) => m.getMetallicRoughnessTexture()],
  ['emissive', (m) => m.getEmissiveTexture()],
  ['occlusion', (m) => m.getOcclusionTexture()],
];

/**
 * Map every texture in the document to the set of material slots binding it.
 * A texture may serve several slots at once; one bound to no core PBR slot
 * (extension-only or orphaned) falls back to 'other'.
 */
export function detectTextureRoles(doc: Document): Map<Texture, Set<TextureRole>> {
  const roles = new Map<Texture, Set<TextureRole>>();
  for (const texture of doc.getRoot().listTextures()) {
    roles.set(texture, new Set());
  }
  for (const material of doc.getRoot().listMaterials()) {
    for (const [role, getTexture] of SLOTS) {
      const texture = getTexture(material);
      if (texture) roles.get(texture)?.add(role);
    }
  }
  for (const set of roles.values()) {
    if (set.size === 0) set.add('other');
  }
  return roles;
}
