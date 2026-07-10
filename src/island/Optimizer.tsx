// The optimizer island: state machine over the load path (T13). Validation happens
// at this boundary (T5) before any bytes cross to the worker; the worker only ever
// sees input the validator admitted. `optimizing` and `done` join the union in T15
// when the run path lands.

import * as Comlink from 'comlink';
import { useRef, useState } from 'preact/hooks';
import type { ModelReport } from '../optimizer/types';
import { validateModelInput } from '../optimizer/validate';
import { Dropzone } from './Dropzone';
import { createOptimizerClient, type OptimizerClient } from './workerClient';
import './optimizer.css';

type OptimizerState =
  | { phase: 'idle'; busy: boolean; error?: string }
  | { phase: 'loaded'; report: ModelReport; file: File };

const IDLE: OptimizerState = { phase: 'idle', busy: false };

export function Optimizer() {
  const [state, setState] = useState<OptimizerState>(IDLE);
  // Lazy: `Worker` only exists in the browser, and client:load SSRs this
  // component too. First file → first (and only) worker.
  const clientRef = useRef<OptimizerClient>();
  const getClient = () => (clientRef.current ??= createOptimizerClient());

  async function handleFile(file: File) {
    setState({ phase: 'idle', busy: true });
    try {
      const buffer = await file.arrayBuffer();
      const verdict = validateModelInput(new Uint8Array(buffer));
      if (!verdict.ok) {
        setState({ phase: 'idle', busy: false, error: verdict.message });
        return;
      }
      // The buffer is transferred (not copied) to the worker; the File handle stays
      // here so later phases (optimize run, before-viewer) can re-read the bytes.
      const report = await getClient().analyze(Comlink.transfer(buffer, [buffer]), file.name);
      setState({ phase: 'loaded', report, file });
    } catch {
      setState({
        phase: 'idle',
        busy: false,
        error: 'Could not read this model — the file may be corrupt or use an unsupported layout.',
      });
    }
  }

  if (state.phase === 'loaded') {
    return <ReportView report={state.report} onReset={() => setState(IDLE)} />;
  }
  return <Dropzone onFile={handleFile} busy={state.busy} error={state.error} />;
}

const int = new Intl.NumberFormat('en-US');

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function ReportView({ report, onReset }: { report: ModelReport; onReset: () => void }) {
  const { meshStats, textures, features, warnings } = report;
  return (
    <section class="report" role="region" aria-label="Model report" data-testid="model-report">
      <header class="rp-head">
        <p class="rp-status">Loaded</p>
        <h2 class="rp-name">{report.fileName}</h2>
        <p class="rp-size">{formatBytes(report.byteLength)}</p>
      </header>

      <dl class="rp-stats">
        <div class="rp-stat">
          <dt>Vertices</dt>
          <dd>{int.format(meshStats.vertexCount)}</dd>
        </div>
        <div class="rp-stat">
          <dt>Primitives</dt>
          <dd>{int.format(meshStats.primitiveCount)}</dd>
        </div>
        <div class="rp-stat">
          <dt>Textures</dt>
          <dd>{int.format(textures.length)}</dd>
        </div>
        <div class="rp-stat">
          <dt>Geometry</dt>
          <dd>{meshStats.hasDraco ? 'DRACO' : 'uncompressed'}</dd>
        </div>
      </dl>

      {(features.hasAnimation || features.hasSkinning || features.hasMorphTargets) && (
        <p class="rp-features">
          Detected:{' '}
          {[
            features.hasAnimation && 'animation',
            features.hasSkinning && 'skinning',
            features.hasMorphTargets && 'morph targets',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}

      {warnings.length > 0 && (
        <ul class="rp-warnings">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <button class="rp-reset" type="button" onClick={onReset}>
        Load another model
      </button>
    </section>
  );
}
