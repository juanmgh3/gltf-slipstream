// Per-texture rows (T14, rebuilt as a timing table in T9): identity + roles + the
// effective plan, with exactly the three overrides the spec fixed — exclude /
// quality / max-resolution. The shown plan comes from the same `planForTexture`
// the pipeline applies (T11), so the row always tells the truth about what an
// optimize run would do.

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
      {/* Bounded scroll region (T9): the table never grows past this, so 24 rows
          can't push the report panel past the viewport — thead stays pinned while
          rows scroll under it. */}
      <div class="tx-scroll" data-testid="texture-scroll">
        <table class="tx-table">
          <thead>
            <tr>
              <th scope="col" class="tx-col-texture">
                Texture
              </th>
              <th scope="col" class="tx-col-dims">
                Dims
              </th>
              <th scope="col" class="tx-col-weight">
                Weight
              </th>
              <th scope="col" class="tx-col-plan">
                Plan
              </th>
              <th scope="col" class="tx-col-overrides">
                Overrides
              </th>
            </tr>
          </thead>
          <tbody>
            {textures.map((texture) => {
              const override = overrides[texture.id];
              const excluded = override?.exclude === true;
              const isLive = !excluded && !!override && Object.keys(override).length > 0;
              return (
                <tr
                  key={texture.id}
                  class={excluded ? 'is-excluded' : undefined}
                  data-testid="texture-row"
                  data-texture-name={texture.name}
                >
                  <td class="tx-col-texture tx-name-cell">
                    <span class="tx-name">{texture.name || `texture ${texture.id}`}</span>
                    <span class="tx-roles">{texture.roles.join(' · ')}</span>
                  </td>
                  <td class="tx-col-dims">
                    {texture.width}×{texture.height}
                  </td>
                  <td class="tx-col-weight">{formatBytes(texture.byteLength)}</td>
                  <td class="tx-col-plan tx-plan-cell">
                    {isLive && (
                      <span class="tx-live-mark" aria-hidden="true">
                        ●
                      </span>
                    )}
                    <span class="tx-plan-tag">{planLabel(texture, preset, override)}</span>
                  </td>
                  <td class="tx-col-overrides tx-overrides-cell">
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
