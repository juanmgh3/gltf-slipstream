import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { init as initPngDecode } from '@jsquash/png/decode.js';
import { init as initWebpEncode } from '@jsquash/webp/encode.js';
import decodeWebp, { init as initWebpDecode } from '@jsquash/webp/decode.js';
import { initResize } from '@jsquash/resize';
import { reencodeToWebP } from '../../src/optimizer/textures';
import { solidPNG } from '../fixtures/generate';

// T10 acceptance: decode (png/jpeg/webp) → optional Lanczos3 downscale → WebP encode
// honoring the T7 plan. In the browser @jsquash fetches its wasm; under Node the
// codecs need explicit init from node_modules — test-only setup, not production code.

const wasm = async (relative: string) =>
  WebAssembly.compile(await readFile(fileURLToPath(new URL(`../../node_modules/${relative}`, import.meta.url))));

beforeAll(async () => {
  await Promise.all([
    initPngDecode(await wasm('@jsquash/png/codec/pkg/squoosh_png_bg.wasm')),
    initWebpEncode((await wasm('@jsquash/webp/codec/enc/webp_enc.wasm')) as never),
    initWebpDecode((await wasm('@jsquash/webp/codec/dec/webp_dec.wasm')) as never),
    initResize(await wasm('@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm')),
  ]);
});

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
