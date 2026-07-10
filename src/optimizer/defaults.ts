// Per-role WebP defaults and the DRACO quantization used by the pipeline (T11).
// Fidelity rule: color maps (baseColor/emissive, sRGB) tolerate lossy compression
// well; data maps (normal/metallicRoughness/occlusion, linear) don't — lossy WebP
// shifts encoded values and visibly corrupts normals, so they stay lossless unless
// the user explicitly picks "aggressive". Unknown ('other') textures get the
// conservative data-map treatment.

import type { DracoOptions } from '@gltf-transform/functions';
import type { QualityPreset, TextureOverride, TextureRole } from './types';

export interface WebPPlan {
  lossless: boolean;
  quality: number; // 0..100 (in lossless mode: compression effort)
  method: number; // 0..6 libwebp effort/speed trade-off
  maxResolution?: number; // cap longest side; undefined = keep original size
}

const COLOR_QUALITY: Record<QualityPreset, number> = {
  maximum: 95,
  balanced: 85,
  aggressive: 75,
};

// method 6 = best compression but slow on 4K; 4 is libwebp's default trade-off.
const METHOD: Record<QualityPreset, number> = {
  maximum: 6,
  balanced: 4,
  aggressive: 4,
};

const AGGRESSIVE_RESOLUTION_CAP = 2048;

export function roleDefaults(role: TextureRole, preset: QualityPreset): WebPPlan {
  const isColorMap = role === 'baseColor' || role === 'emissive';
  const plan: WebPPlan = isColorMap
    ? { lossless: false, quality: COLOR_QUALITY[preset], method: METHOD[preset] }
    : preset === 'aggressive'
      ? { lossless: false, quality: 90, method: METHOD[preset] }
      : { lossless: true, quality: 100, method: METHOD[preset] };
  if (preset === 'aggressive') plan.maxResolution = AGGRESSIVE_RESOLUTION_CAP;
  return plan;
}

/**
 * Effective plan for one texture: role defaults shifted by the preset, then by the
 * user's override. The single source both the pipeline (T11) and the TextureList
 * UI (T14) consume — display can't drift from what the optimizer actually does.
 * Multi-role: any data-map role wins — lossless beats lossy when in doubt.
 */
export function planForTexture(
  roles: TextureRole[],
  preset: QualityPreset,
  override?: Pick<TextureOverride, 'quality' | 'maxResolution'>,
): WebPPlan {
  const representative = roles.find((role) => role !== 'baseColor' && role !== 'emissive') ?? roles[0] ?? 'other';
  const plan = roleDefaults(representative, preset);
  if (override?.quality !== undefined) {
    plan.lossless = false;
    plan.quality = override.quality;
  }
  if (override?.maxResolution !== undefined) plan.maxResolution = override.maxResolution;
  return plan;
}

// Generic quality knobs proven in T1's spike — not model-specific. Normal (12) and
// texcoord (14) are raised above gltf-transform's defaults (10/12): normals feed
// lighting and UVs address up-to-4K texels, both show quantization artifacts first.
export const DRACO_OPTS: DracoOptions = {
  method: 'edgebreaker',
  quantizePosition: 14,
  quantizeNormal: 12,
  quantizeTexcoord: 14,
  quantizeColor: 8,
  quantizeGeneric: 12,
};
