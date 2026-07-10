// Parse boundary (T5): magic-byte / structural check before anything touches gltf-transform.
// Accepts self-contained .glb and embedded-data-URI .gltf; rejects .gltf/.glb that
// reference external .bin/images (the tool is client-side only — it cannot fetch them).
// Messages are user-facing: the island (T13) shows them verbatim on rejected drops.

export type ValidationResult = { ok: true; kind: 'glb' | 'gltf' } | { ok: false; message: string };

const GLB_MAGIC = 0x46546c67; // 'glTF', little-endian
const CHUNK_JSON = 0x4e4f534a; // 'JSON', little-endian

interface GltfJson {
  asset?: { version?: string };
  buffers?: Array<{ uri?: string }>;
  images?: Array<{ uri?: string }>;
}

export function validateModelInput(bytes: Uint8Array): ValidationResult {
  if (bytes.byteLength >= 4 && readU32(bytes, 0) === GLB_MAGIC) return validateGlb(bytes);
  return validateGltf(bytes);
}

function validateGlb(bytes: Uint8Array): ValidationResult {
  if (bytes.byteLength < 20) return { ok: false, message: 'Truncated .glb — the file is incomplete.' };
  const version = readU32(bytes, 4);
  if (version !== 2) {
    return { ok: false, message: `Unsupported .glb container version ${version} — only glTF 2.0 is supported.` };
  }
  if (readU32(bytes, 8) > bytes.byteLength) {
    return { ok: false, message: 'Truncated .glb — the file is shorter than its header declares.' };
  }
  // First chunk must be JSON (glTF 2.0 spec); parse it to confirm the file is self-contained.
  const chunkLength = readU32(bytes, 12);
  if (readU32(bytes, 16) !== CHUNK_JSON || 20 + chunkLength > bytes.byteLength) {
    return { ok: false, message: 'Malformed .glb — missing or corrupt JSON chunk.' };
  }
  const json = parseGltfJson(bytes.subarray(20, 20 + chunkLength));
  if (!json) return { ok: false, message: 'Malformed .glb — its JSON chunk is not valid glTF.' };
  return rejectExternalResources(json, '.glb') ?? { ok: true, kind: 'glb' };
}

function validateGltf(bytes: Uint8Array): ValidationResult {
  const json = parseGltfJson(bytes);
  if (!json) {
    return { ok: false, message: 'Not a glTF file — expected a .glb (binary) or .gltf (JSON) model.' };
  }
  return rejectExternalResources(json, '.gltf') ?? { ok: true, kind: 'gltf' };
}

function parseGltfJson(bytes: Uint8Array): GltfJson | null {
  try {
    const json = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (typeof json !== 'object' || json === null) return null;
    const version = (json as GltfJson).asset?.version;
    return typeof version === 'string' && version.startsWith('2') ? (json as GltfJson) : null;
  } catch {
    return null;
  }
}

/** Buffers/images with a non-data: URI live outside the file — unreachable client-side. */
function rejectExternalResources(json: GltfJson, kind: '.glb' | '.gltf'): ValidationResult | null {
  const external = [...(json.buffers ?? []), ...(json.images ?? [])]
    .map((resource) => resource.uri)
    .filter((uri): uri is string => typeof uri === 'string' && !uri.startsWith('data:'));
  if (external.length === 0) return null;
  return {
    ok: false,
    message:
      `This ${kind} references external files (${external.join(', ')}). ` +
      'Everything runs in your browser, so those files can’t be fetched — ' +
      're-export the model as a self-contained .glb (or embed all resources).',
  };
}

function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}
