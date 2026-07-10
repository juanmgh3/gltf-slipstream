import { describe, it, expect, beforeAll } from 'vitest';
import { NodeIO, type Document, type Texture } from '@gltf-transform/core';
import { detectTextureRoles } from '../../src/optimizer/roles';
import { plainGlb } from '../fixtures/generate';

// T6 acceptance: roles derive from how materials bind each texture (not from names),
// and a texture bound in several slots keeps the full role set.

describe('detectTextureRoles', () => {
  let doc: Document;
  let roles: Map<Texture, Set<string>>;

  const byName = (name: string): Set<string> => {
    const texture = doc
      .getRoot()
      .listTextures()
      .find((t) => t.getName() === name);
    if (!texture) throw new Error(`fixture texture missing: ${name}`);
    const set = roles.get(texture);
    if (!set) throw new Error(`no roles detected for: ${name}`);
    return set;
  };

  beforeAll(async () => {
    doc = await new NodeIO().readBinary(await plainGlb());
    roles = detectTextureRoles(doc);
  });

  it('covers every texture in the document', () => {
    expect(roles.size).toBe(doc.getRoot().listTextures().length);
  });

  it('detects baseColor, normal and emissive from material bindings', () => {
    expect(byName('base')).toEqual(new Set(['baseColor']));
    expect(byName('normal')).toEqual(new Set(['normal']));
    expect(byName('emissive')).toEqual(new Set(['emissive']));
  });

  it('preserves the full set for a multi-role texture', () => {
    expect(byName('mr')).toEqual(new Set(['metallicRoughness', 'occlusion']));
  });

  it('classifies a texture with no known binding as "other"', () => {
    doc.createTexture('unbound').setMimeType('image/png');
    const rerun = detectTextureRoles(doc);
    const unbound = doc
      .getRoot()
      .listTextures()
      .find((t) => t.getName() === 'unbound');
    expect(unbound && rerun.get(unbound)).toEqual(new Set(['other']));
  });
});
