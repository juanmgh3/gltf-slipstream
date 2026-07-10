// T14: `planForTexture` is the single source of the effective per-texture plan —
// the pipeline applies it (T11) and the TextureList displays it. Promoted out of
// optimize.ts so the UI can't drift from what the optimizer actually does.
import { describe, expect, it } from 'vitest';
import { planForTexture } from '../../src/optimizer/defaults';

describe('planForTexture', () => {
  it('color map on balanced → lossy at the preset quality', () => {
    const plan = planForTexture(['baseColor'], 'balanced');
    expect(plan.lossless).toBe(false);
    expect(plan.quality).toBe(85);
    expect(plan.maxResolution).toBeUndefined();
  });

  it('data map on balanced → lossless', () => {
    expect(planForTexture(['normal'], 'balanced').lossless).toBe(true);
  });

  it('multi-role: any data role wins over color (conservative)', () => {
    expect(planForTexture(['baseColor', 'occlusion'], 'balanced').lossless).toBe(true);
  });

  it('no roles → conservative data-map treatment', () => {
    expect(planForTexture([], 'balanced').lossless).toBe(true);
  });

  it('aggressive shifts the plan and caps resolution', () => {
    const plan = planForTexture(['normal'], 'aggressive');
    expect(plan.lossless).toBe(false);
    expect(plan.quality).toBe(90);
    expect(plan.maxResolution).toBe(2048);
  });

  it('a quality override opts the texture into lossy at that quality', () => {
    const plan = planForTexture(['normal'], 'maximum', { quality: 60 });
    expect(plan.lossless).toBe(false);
    expect(plan.quality).toBe(60);
  });

  it('a maxResolution override caps the longest side', () => {
    expect(planForTexture(['baseColor'], 'balanced', { maxResolution: 1024 }).maxResolution).toBe(1024);
  });
});
