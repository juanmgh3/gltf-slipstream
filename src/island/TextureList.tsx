// Per-texture rows (T14): identity + roles + the effective plan, with exactly the
// three overrides the spec fixed — exclude / quality / max-resolution. The shown
// plan comes from the same `planForTexture` the pipeline applies (T11), so the row
// always tells the truth about what an optimize run would do.

import { planForTexture } from '../optimizer/defaults';
import type { QualityPreset, TextureInfo, TextureOverride } from '../optimizer/types';
import { formatBytes } from './format';

const MAX_SIZES = [4096, 2048, 1024, 512];

interface TextureListProps {
  textures: TextureInfo[];
  preset: QualityPreset;
  overrides: Record<string, TextureOverride>;
  onOverride: (id: string, patch: Partial<TextureOverride>) => void;
}

function planLabel(texture: TextureInfo, preset: QualityPreset, override?: TextureOverride): string {
  if (override?.exclude) return 'kept as-is';
  const plan = planForTexture(texture.roles, preset, override);
  const encode = plan.lossless ? 'WebP lossless' : `WebP q${plan.quality}`;
  return plan.maxResolution ? `${encode} · ≤${plan.maxResolution}px` : encode;
}

export function TextureList({ textures, preset, overrides, onOverride }: TextureListProps) {
  if (textures.length === 0) return null;
  return (
    <section class="textures" aria-label="Textures">
      <h3 class="tx-heading">Textures</h3>
      <ul class="tx-list">
        {textures.map((texture) => {
          const override = overrides[texture.id];
          const excluded = override?.exclude === true;
          return (
            <li
              key={texture.id}
              class={`tx-row${excluded ? ' is-excluded' : ''}`}
              data-testid="texture-row"
              data-texture-name={texture.name}
            >
              <div class="tx-id">
                <p class="tx-name">{texture.name || `texture ${texture.id}`}</p>
                <p class="tx-meta">
                  {texture.roles.join(' · ')} · {texture.width}×{texture.height} ·{' '}
                  {formatBytes(texture.byteLength)}
                </p>
              </div>
              <p class="tx-plan">{planLabel(texture, preset, override)}</p>
              <div class="tx-overrides">
                <label class="tx-exclude">
                  <input
                    type="checkbox"
                    aria-label={`Exclude ${texture.name}`}
                    checked={excluded}
                    onChange={(e) => onOverride(texture.id, { exclude: e.currentTarget.checked || undefined })}
                  />
                  exclude
                </label>
                <label class="tx-quality">
                  q
                  <input
                    type="number"
                    aria-label={`Quality for ${texture.name}`}
                    min={0}
                    max={100}
                    placeholder="auto"
                    disabled={excluded}
                    value={override?.quality ?? ''}
                    // onInput, not onChange: Preact's onChange is the native change
                    // event (fires on blur), so the plan would lag the typed value.
                    onInput={(e) => {
                      const raw = e.currentTarget.value;
                      const quality = raw === '' ? undefined : Math.min(100, Math.max(0, Number(raw)));
                      onOverride(texture.id, { quality });
                    }}
                  />
                </label>
                <label class="tx-maxsize">
                  <select
                    aria-label={`Max size for ${texture.name}`}
                    disabled={excluded}
                    value={override?.maxResolution ?? ''}
                    onChange={(e) => {
                      const raw = e.currentTarget.value;
                      onOverride(texture.id, { maxResolution: raw === '' ? undefined : Number(raw) });
                    }}
                  >
                    <option value="">no cap</option>
                    {MAX_SIZES.map((size) => (
                      <option key={size} value={String(size)}>
                        ≤{size}px
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
