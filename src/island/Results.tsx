// Done state (T15): the numbers and the artifact. Sizes, savings, the
// geometry/texture breakdown, and the optimized GLB as a client-side blob
// download — bytes never leave the machine.

import { useEffect, useMemo } from 'preact/hooks';
import type { OptimizeResult } from '../optimizer/types';
import { CompareViewer } from './CompareViewer';
import { formatBytes } from './format';

interface ResultsProps {
  fileName: string;
  file: File;
  result: OptimizeResult;
  onReset: () => void;
}

export function Results({ fileName, file, result, onReset }: ResultsProps) {
  const savings = 1 - result.outputByteLength / result.inputByteLength;
  const downloadName = `${fileName.replace(/\.(glb|gltf)$/i, '')}.optimized.glb`;

  const url = useMemo(
    () => URL.createObjectURL(new Blob([result.glb], { type: 'model/gltf-binary' })),
    [result],
  );
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const { breakdown } = result;
  return (
    <section class="report results" role="region" aria-label="Results" data-testid="results">
      <header class="rp-head">
        <p class="rp-status">Optimized</p>
        <h2 class="rp-name">{fileName}</h2>
      </header>

      <div class="rs-sizes">
        <div class="rs-size">
          <p class="rs-label">Original</p>
          <p class="rs-value" data-testid="rs-input">{formatBytes(result.inputByteLength)}</p>
        </div>
        <div class="rs-size">
          <p class="rs-label">Optimized</p>
          <p class="rs-value" data-testid="rs-output">{formatBytes(result.outputByteLength)}</p>
        </div>
        <div class="rs-size">
          <p class="rs-label">Savings</p>
          <p class="rs-value rs-savings" data-testid="rs-savings">
            {savings >= 0 ? '−' : '+'}
            {Math.abs(savings * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      <dl class="rs-breakdown">
        <div class="rs-part">
          <dt>Geometry</dt>
          <dd>
            {formatBytes(breakdown.geometryBefore)} → {formatBytes(breakdown.geometryAfter)}
          </dd>
        </div>
        <div class="rs-part">
          <dt>Textures</dt>
          <dd>
            {formatBytes(breakdown.texturesBefore)} → {formatBytes(breakdown.texturesAfter)}
          </dd>
        </div>
      </dl>

      <CompareViewer original={file} optimizedGlb={result.glb} />

      <div class="rp-actions">
        <a class="btn-accent" href={url} download={downloadName}>
          Download {downloadName}
        </a>
        <button class="rp-reset" type="button" onClick={onReset}>
          Load another model
        </button>
      </div>
    </section>
  );
}
