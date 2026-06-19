// Public contract for the framework-agnostic optimizer core. Transcribed from the
// plan (§Interfaces); the worker (T12) and island (T13+) consume these verbatim.

export type TextureRole =
  | 'baseColor'
  | 'normal'
  | 'metallicRoughness'
  | 'emissive'
  | 'occlusion'
  | 'other';

export interface TextureInfo {
  id: string; // stable key (gltf texture index)
  name: string;
  roles: TextureRole[]; // a texture may serve multiple slots
  mimeType: string; // image/png | image/jpeg | image/webp | ...
  width: number;
  height: number;
  byteLength: number; // original embedded size
}

export interface ModelReport {
  fileName: string;
  byteLength: number; // input GLB size
  textures: TextureInfo[];
  meshStats: { vertexCount: number; primitiveCount: number; hasDraco: boolean };
  features: { hasAnimation: boolean; hasSkinning: boolean; hasMorphTargets: boolean };
  warnings: string[]; // large-model, unsupported-embedded-codec,
  // animation / skinning / morph-target scope-out
}

export type QualityPreset = 'maximum' | 'balanced' | 'aggressive';

export interface TextureOverride {
  exclude?: boolean; // keep original bytes, skip re-encode
  quality?: number; // 0..100, overrides role default
  maxResolution?: number; // cap longest side (Lanczos3); undefined = no cap
}

export interface OptimizeSettings {
  preset: QualityPreset;
  overrides: Record<string, TextureOverride>; // keyed by TextureInfo.id
}

export interface OptimizeResult {
  glb: ArrayBuffer;
  inputByteLength: number;
  outputByteLength: number;
  breakdown: {
    geometryBefore: number;
    geometryAfter: number;
    texturesBefore: number;
    texturesAfter: number;
  };
  perTexture: Array<{
    id: string;
    before: number;
    after: number;
    action: 'webp' | 'kept' | 'excluded';
  }>;
}

export interface Progress {
  phase: 'textures' | 'geometry' | 'writing';
  done: number;
  total: number;
  label?: string;
}
