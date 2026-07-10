// Node-only codec bootstrap: in the browser @jsquash fetches its wasm; under
// vitest each codec is initialized from node_modules instead. Test infra only.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { init as initPngDecode } from '@jsquash/png/decode.js';
import { init as initJpegDecode } from '@jsquash/jpeg/decode.js';
import { init as initWebpEncode } from '@jsquash/webp/encode.js';
import { init as initWebpDecode } from '@jsquash/webp/decode.js';
import { initResize } from '@jsquash/resize';

const wasm = async (relative: string) =>
  WebAssembly.compile(await readFile(fileURLToPath(new URL(`../../node_modules/${relative}`, import.meta.url))));

export async function initJsquashForNode(): Promise<void> {
  await Promise.all([
    initPngDecode(await wasm('@jsquash/png/codec/pkg/squoosh_png_bg.wasm')),
    initJpegDecode((await wasm('@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm')) as never),
    initWebpEncode((await wasm('@jsquash/webp/codec/enc/webp_enc.wasm')) as never),
    initWebpDecode((await wasm('@jsquash/webp/codec/dec/webp_dec.wasm')) as never),
    initResize(await wasm('@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm')),
  ]);
}
