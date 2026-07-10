// Texture re-encode (T10): decode → optional Lanczos3 downscale → WebP encode.
// @jsquash gives real libwebp control (lossless/quality/method); the browser Canvas
// fallback gltf-transform would use silently ignores those knobs, which defeats the
// tool's purpose. KTX2/Basis never reach this module — the pipeline keeps them as-is.

import { decode as decodePng } from '@jsquash/png';
import { decode as decodeJpeg } from '@jsquash/jpeg';
import { decode as decodeWebp, encode as encodeWebp } from '@jsquash/webp';
import resize from '@jsquash/resize';
import type { WebPPlan } from './defaults';

export async function reencodeToWebP(bytes: Uint8Array, mimeType: string, plan: WebPPlan): Promise<Uint8Array> {
  let image = await decodeImage(bytes, mimeType);

  if (plan.maxResolution !== undefined) {
    const longest = Math.max(image.width, image.height);
    if (longest > plan.maxResolution) {
      const scale = plan.maxResolution / longest;
      image = await resize(image, {
        width: Math.max(1, Math.round(image.width * scale)),
        height: Math.max(1, Math.round(image.height * scale)),
        method: 'lanczos3',
      });
    }
  }

  const encoded = plan.lossless
    ? await encodeWebp(image, { lossless: 1 })
    : await encodeWebp(image, { quality: plan.quality, method: plan.method });
  return new Uint8Array(encoded);
}

async function decodeImage(bytes: Uint8Array, mimeType: string): Promise<ImageData> {
  // @jsquash codecs want an exact-length ArrayBuffer, not a view into a larger one.
  const buffer = bytes.slice().buffer;
  switch (mimeType) {
    case 'image/png':
      return decodePng(buffer);
    case 'image/jpeg':
      return decodeJpeg(buffer);
    case 'image/webp':
      return decodeWebp(buffer);
    default:
      throw new Error(`Cannot decode texture of type ${mimeType}`);
  }
}
