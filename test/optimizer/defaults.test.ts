import { describe, it, expect } from 'vitest';
import { roleDefaults, DRACO_OPTS } from '../../src/optimizer/defaults';
import type { QualityPreset, TextureRole } from '../../src/optimizer/types';

// Defaults contract: the global preset shifts per-role defaults, and defaults honor
// fidelity — color maps (sRGB) go lossy high-quality, data maps (linear) stay
// lossless unless the user explicitly opts into "aggressive".

const PRESETS: QualityPreset[] = ['maximum', 'balanced', 'aggressive'];
const COLOR_ROLES: TextureRole[] = ['baseColor', 'emissive'];
const DATA_ROLES: TextureRole[] = ['normal', 'metallicRoughness', 'occlusion', 'other'];

describe('roleDefaults', () => {
  it('returns a valid WebP plan for every role × preset combination', () => {
    for (const preset of PRESETS) {
      for (const role of [...COLOR_ROLES, ...DATA_ROLES]) {
        const plan = roleDefaults(role, preset);
        expect(plan.quality).toBeGreaterThanOrEqual(0);
        expect(plan.quality).toBeLessThanOrEqual(100);
        expect(plan.method).toBeGreaterThanOrEqual(0);
        expect(plan.method).toBeLessThanOrEqual(6);
      }
    }
  });

  it('color maps are lossy high-quality on every preset', () => {
    for (const preset of PRESETS) {
      for (const role of COLOR_ROLES) {
        const plan = roleDefaults(role, preset);
        expect(plan.lossless).toBe(false);
        expect(plan.quality).toBeGreaterThanOrEqual(70);
      }
    }
  });

  it('data maps stay lossless on maximum and balanced', () => {
    for (const preset of ['maximum', 'balanced'] as const) {
      for (const role of DATA_ROLES) {
        expect(roleDefaults(role, preset).lossless).toBe(true);
      }
    }
  });

  it('aggressive shifts data maps to near-lossless quality, never below 90', () => {
    for (const role of DATA_ROLES) {
      const plan = roleDefaults(role, 'aggressive');
      expect(plan.lossless).toBe(false);
      expect(plan.quality).toBeGreaterThanOrEqual(90);
    }
  });

  it('color quality strictly decreases from maximum to aggressive', () => {
    for (const role of COLOR_ROLES) {
      const max = roleDefaults(role, 'maximum').quality;
      const balanced = roleDefaults(role, 'balanced').quality;
      const aggressive = roleDefaults(role, 'aggressive').quality;
      expect(max).toBeGreaterThan(balanced);
      expect(balanced).toBeGreaterThan(aggressive);
    }
  });

  it('only aggressive caps resolution', () => {
    for (const role of [...COLOR_ROLES, ...DATA_ROLES]) {
      expect(roleDefaults(role, 'maximum').maxResolution).toBeUndefined();
      expect(roleDefaults(role, 'balanced').maxResolution).toBeUndefined();
      const cap = roleDefaults(role, 'aggressive').maxResolution;
      expect(cap).toBeDefined();
      expect(cap).toBeGreaterThanOrEqual(1024);
    }
  });
});

describe('DRACO_OPTS', () => {
  it('matches the planned quantization (edgebreaker, pos 14 / norm 12 / uv 14 / color 8 / generic 12)', () => {
    expect(DRACO_OPTS).toMatchObject({
      method: 'edgebreaker',
      quantizePosition: 14,
      quantizeNormal: 12,
      quantizeTexcoord: 14,
      quantizeColor: 8,
      quantizeGeneric: 12,
    });
  });
});
