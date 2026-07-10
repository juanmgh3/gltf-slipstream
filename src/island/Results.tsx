// Done state: the numbers and the artifact. The savings
// delta leads as the hero figure, sizes and the geometry/texture breakdown
// tell the truthful story beneath it, and the optimized GLB downloads as a
// client-side blob — bytes never leave the machine.

import { useEffect, useMemo } from 'preact/hooks';
import type { OptimizeResult } from '../optimizer/types';
import { CompareViewer } from './CompareViewer';
import { formatBytes } from './format';
import { useCountUp } from './hooks';

interface ResultsProps {
  fileName: string;
  file: File;
  result: OptimizeResult;
  onReset: () => void;
}

export function Results({ fileName, file, result, onReset }: ResultsProps) {
  // Positive = shrank (the common case, shown as "−"); negative = grew (shown
  // truthfully as "+" — the breakdown below can do this per-category even
  // when the overall run still saved bytes, e.g. lossless normal maps).
  const savings = (1 - result.outputByteLength / result.inputByteLength) * 100;
  const downloadName = `${fileName.replace(/\.(glb|gltf)$/i, '')}.optimized.glb`;

  const url = useMemo(
    () => URL.createObjectURL(new Blob([result.glb], { type: 'model/gltf-binary' })),
    [result],
  );
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  // Count-up on STATE ENTRY only (see hooks.ts) — `savings` is derived from
  // `result`, which is fixed for the lifetime of this mounted `done` state.
  const deltaUp = useCountUp(savings, 800);

  const { breakdown } = result;
  return (
    <section class="report results" role="region" aria-label="Results" data-testid="results">
      <header class="rp-head">
        <p class="rp-status">Optimized</p>
        <h2 class="rp-name">{fileName}</h2>
      </header>

      <div class="rs-hero">
        {/* The glow sits on this wrapper: clip-path clips the clipped element's
            own outer box-shadow, so the notch and the glow need separate boxes. */}
        <div class="rs-hero-glow">
          <div class="rs-hero-card">
            <p class="rs-hero-label">Savings</p>
            <p class="rs-hero-delta" data-testid="rs-savings">
              {savings >= 0 ? '−' : '+'}
              {Math.abs(deltaUp).toFixed(1)}%
            </p>
          </div>
        </div>
        <div class="rs-hero-sizes">
          <div class="rs-size">
            <p class="rs-label">Original</p>
            <p class="rs-value" data-testid="rs-input">
              {formatBytes(result.inputByteLength)}
            </p>
          </div>
          <p class="rs-arrow" aria-hidden="true">
            →
          </p>
          <div class="rs-size">
            <p class="rs-label">Optimized</p>
            <p class="rs-value" data-testid="rs-output">
              {formatBytes(result.outputByteLength)}
            </p>
          </div>
        </div>
      </div>

      <div class="rs-breakdown">
        <BreakdownBar label="Geometry" before={breakdown.geometryBefore} after={breakdown.geometryAfter} />
        <BreakdownBar label="Textures" before={breakdown.texturesBefore} after={breakdown.texturesAfter} />
      </div>

      <CompareViewer original={file} optimizedGlb={result.glb} />

      <div class="rp-actions">
        <a class="btn-accent rs-cta" href={url} download={downloadName}>
          Download {downloadName}
        </a>
        <button class="rp-reset" type="button" onClick={onReset}>
          Load another model
        </button>
      </div>
    </section>
  );
}

// Truthful before→after bar: the fill shows
// AFTER as a proportion of BEFORE, clamped at 100% so a grown category can't
// blow the track out — but the figure text never clamps or hides the growth.
// Saved reads --ss-positive; grown reads --ss-danger and says "+N". No amber
// here — amber marks live/active things, not a settled result.
function BreakdownBar({ label, before, after }: { label: string; before: number; after: number }) {
  const grew = after > before;
  const pct = before > 0 ? Math.min(100, (after / before) * 100) : 0;
  const diff = Math.abs(after - before);
  return (
    <div class="rs-bar-row">
      <p class="rs-bar-label">{label}</p>
      <div class="rs-bar-track" aria-hidden="true">
        <div class={`rs-bar-fill${grew ? ' is-grew' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <p class="rs-bar-figures">
        {formatBytes(before)} → {formatBytes(after)}
        <span class={grew ? 'rs-grew' : 'rs-saved'}>
          {grew ? ` +${formatBytes(diff)}` : ` −${formatBytes(diff)}`}
        </span>
      </p>
    </div>
  );
}
