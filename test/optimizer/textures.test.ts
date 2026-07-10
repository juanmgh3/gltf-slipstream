import { describe, it, expect, beforeAll } from 'vitest';
import decodeWebp from '@jsquash/webp/decode.js';
import { reencodeToWebP } from '../../src/optimizer/textures';
import { solidPNG } from '../fixtures/generate';
import { initJsquashForNode } from '../helpers/jsquash-node';

// T10 acceptance: decode (png/jpeg/webp) → optional Lanczos3 downscale → WebP encode
// honoring the T7 plan.

beforeAll(initJsquashForNode);

const isWebP = (bytes: Uint8Array) =>
  new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' &&
  new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP';

describe('reencodeToWebP', () => {
  it('re-encodes a PNG to lossy WebP preserving dimensions', async () => {
    const out = await reencodeToWebP(solidPNG(8, 200, 80, 80), 'image/png', {
      lossless: false,
      quality: 75,
      method: 4,
    });
    expect(isWebP(out)).toBe(true);
    const image = await decodeWebp(out.slice().buffer);
    expect([image.width, image.height]).toEqual([8, 8]);
  });

  it('lossless plan reproduces pixels exactly', async () => {
    const out = await reencodeToWebP(solidPNG(8, 10, 200, 50), 'image/png', {
      lossless: true,
      quality: 100,
      method: 4,
    });
    const image = await decodeWebp(out.slice().buffer);
    for (let i = 0; i < image.data.length; i += 4) {
      expect([image.data[i], image.data[i + 1], image.data[i + 2], image.data[i + 3]]).toEqual([10, 200, 50, 255]);
    }
  });

  it('caps the longest side preserving aspect ratio (Lanczos3)', async () => {
    const out = await reencodeToWebP(solidPNG(8, 60, 60, 60, 4), 'image/png', {
      lossless: true,
      quality: 100,
      method: 4,
      maxResolution: 4,
    });
    const image = await decodeWebp(out.slice().buffer);
    expect([image.width, image.height]).toEqual([4, 2]);
  });

  it('never upscales: a cap above the image size leaves dimensions untouched', async () => {
    const out = await reencodeToWebP(solidPNG(8, 60, 60, 60, 4), 'image/png', {
      lossless: true,
      quality: 100,
      method: 4,
      maxResolution: 1024,
    });
    const image = await decodeWebp(out.slice().buffer);
    expect([image.width, image.height]).toEqual([8, 4]);
  });

  it('accepts WebP input (re-encode path for models already embedding WebP)', async () => {
    const first = await reencodeToWebP(solidPNG(8, 10, 200, 50), 'image/png', {
      lossless: true,
      quality: 100,
      method: 4,
    });
    const again = await reencodeToWebP(first, 'image/webp', { lossless: true, quality: 100, method: 4 });
    const image = await decodeWebp(again.slice().buffer);
    expect([image.width, image.height]).toEqual([8, 8]);
  });

  it('rejects mime types it cannot decode', async () => {
    await expect(reencodeToWebP(new Uint8Array(16), 'image/ktx2', { lossless: true, quality: 100, method: 4 })).rejects.toThrow(
      /image\/ktx2/,
    );
  });
});
