import { describe, it, expect } from 'vitest';
import { validateModelInput } from '../../src/optimizer/validate';
import { plainGlb, embeddedGltf, externalGltf, junkBytes } from '../fixtures/generate';

// T5 acceptance (plan resolved Q1): accept self-contained .glb + embedded-data-URI
// .gltf; reject external-resource .gltf and non-glTF bytes with a clear message.

/** Wrap a glTF JSON payload in a minimal single-chunk GLB container. */
function wrapAsGlb(json: Uint8Array): Uint8Array {
  const pad = (4 - (json.byteLength % 4)) % 4;
  const chunkLen = json.byteLength + pad;
  const out = new Uint8Array(12 + 8 + chunkLen);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true); // version
  dv.setUint32(8, out.byteLength, true); // total length
  dv.setUint32(12, chunkLen, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  out.set(json, 20);
  out.fill(0x20, 20 + json.byteLength); // space padding per spec
  return out;
}

describe('validateModelInput', () => {
  it('accepts a self-contained .glb', async () => {
    const result = validateModelInput(await plainGlb());
    expect(result).toEqual({ ok: true, kind: 'glb' });
  });

  it('accepts a .gltf with embedded data-URI resources', () => {
    const result = validateModelInput(embeddedGltf());
    expect(result).toEqual({ ok: true, kind: 'gltf' });
  });

  it('rejects non-glTF bytes (bad magic) with a clear message', () => {
    const result = validateModelInput(junkBytes());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/not a glTF/i);
  });

  it('rejects empty input', () => {
    const result = validateModelInput(new Uint8Array(0));
    expect(result.ok).toBe(false);
  });

  it('rejects a .gltf referencing external resources, naming them', () => {
    const result = validateModelInput(externalGltf());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/external/i);
      expect(result.message).toContain('external.bin');
      expect(result.message).toContain('external-texture.png');
    }
  });

  it('rejects a .glb whose JSON references external resources (not self-contained)', () => {
    const result = validateModelInput(wrapAsGlb(externalGltf()));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/external/i);
  });

  it('rejects a truncated .glb (declared length exceeds actual bytes)', async () => {
    const glb = await plainGlb();
    const result = validateModelInput(glb.subarray(0, 20));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/truncated|incomplete/i);
  });

  it('rejects a .glb with an unsupported container version', async () => {
    const glb = (await plainGlb()).slice();
    new DataView(glb.buffer, glb.byteOffset).setUint32(4, 1, true);
    const result = validateModelInput(glb);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/version/i);
  });
});
