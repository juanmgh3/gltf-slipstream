// Format branch for the two containers validate.ts admits: binary .glb and
// fully-embedded .gltf JSON. PlatformIO decodes data: URIs internally, so the
// embedded path needs no resource map — external URIs never reach this point
// (rejected at the validate boundary).

import type { Document, PlatformIO } from '@gltf-transform/core';
import type { GLTF } from '@gltf-transform/core';

const GLB_MAGIC = 0x46546c67; // 'glTF', little-endian

export async function readModel(io: PlatformIO, bytes: Uint8Array): Promise<Document> {
  if (bytes.byteLength >= 4 && new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true) === GLB_MAGIC) {
    return io.readBinary(bytes);
  }
  const json = JSON.parse(new TextDecoder().decode(bytes)) as GLTF.IGLTF;
  return io.readJSON({ json, resources: {} });
}
