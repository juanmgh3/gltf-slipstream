// The optimizer island: state machine over the load path (T13). Validation happens
// at this boundary (T5) before any bytes cross to the worker; the worker only ever
// sees input the validator admitted. `optimizing` and `done` join the union in T15
// when the run path lands.

import * as Comlink from 'comlink';
import { useRef, useState } from 'preact/hooks';
import type {
  ModelReport,
  OptimizeResult,
  OptimizeSettings,
  Progress,
  QualityPreset,
  TextureOverride,
} from '../optimizer/types';
import { validateModelInput } from '../optimizer/validate';
import { Controls } from './Controls';
import { Dropzone } from './Dropzone';
import { formatBytes, int } from './format';
import { useCountUp } from './hooks';
import { Results } from './Results';
import { TextureList } from './TextureList';
import { createOptimizerClient, type OptimizerClient } from './workerClient';
import './optimizer.css';

type OptimizerState =
  | { phase: 'idle'; busy: boolean; error?: string }
  | { phase: 'loaded'; report: ModelReport; file: File; runError?: string }
  | { phase: 'optimizing'; report: ModelReport; file: File; progress: Progress | null }
  | { phase: 'done'; report: ModelReport; file: File; result: OptimizeResult };

const IDLE: OptimizerState = { phase: 'idle', busy: false };

// Bundled demo (CC0, NASA/JPL-Caltech — see public/demo/ATTRIBUTION.md). Click-to-try
// fetches it and pushes it through the exact same path as a dropped file.
const DEMO_URL = '/demo/perseverance.glb';
const DEMO_FILE_NAME = 'perseverance.glb';

export function Optimizer() {
  const [state, setState] = useState<OptimizerState>(IDLE);
  // Lazy: `Worker` only exists in the browser, and client:load SSRs this
  // component too. First file → first (and only) worker.
  const clientRef = useRef<OptimizerClient>();
  const getClient = () => (clientRef.current ??= createOptimizerClient());
  const loadSeq = useRef(0);

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
      loadSeq.current += 1;
      setState({ phase: 'loaded', report, file });
    } catch {
      setState({
        phase: 'idle',
        busy: false,
        error: 'Could not read this model — the file may be corrupt or use an unsupported layout.',
      });
    }
  }

  async function handleDemo() {
    setState({ phase: 'idle', busy: true });
    try {
      const response = await fetch(DEMO_URL);
      if (!response.ok) throw new Error(`demo fetch failed: ${response.status}`);
      const file = new File([await response.blob()], DEMO_FILE_NAME, { type: 'model/gltf-binary' });
      await handleFile(file);
    } catch {
      setState({ phase: 'idle', busy: false, error: 'Could not load the demo model — please retry.' });
    }
  }

  async function handleOptimize(report: ModelReport, file: File, settings: OptimizeSettings) {
    setState({ phase: 'optimizing', report, file, progress: null });
    try {
      // Re-read from the File handle: the analyze buffer was transferred away.
      const buffer = await file.arrayBuffer();
      const result = await getClient().optimize(
        Comlink.transfer(buffer, [buffer]),
        settings,
        Comlink.proxy((progress: Progress) => {
          setState((current) => (current.phase === 'optimizing' ? { ...current, progress } : current));
        }),
      );
      setState({ phase: 'done', report, file, result });
    } catch {
      setState({
        phase: 'loaded',
        report,
        file,
        runError: 'Optimization failed — the model loaded, but this run hit an unexpected error.',
      });
    }
  }

  if (state.phase === 'loaded') {
    const { report, file, runError } = state;
    return (
      <LoadedView
        // Keyed per load: a fresh model must start from fresh settings.
        key={loadSeq.current}
        report={report}
        runError={runError}
        onOptimize={(settings) => handleOptimize(report, file, settings)}
        onReset={() => setState(IDLE)}
      />
    );
  }
  if (state.phase === 'optimizing') {
    return <OptimizingView progress={state.progress} />;
  }
  if (state.phase === 'done') {
    return (
      <Results
        fileName={state.report.fileName}
        file={state.file}
        result={state.result}
        onReset={() => setState(IDLE)}
      />
    );
  }
  return <Dropzone onFile={handleFile} onDemo={handleDemo} busy={state.busy} error={state.error} />;
}

const PHASE_LABEL: Record<Progress['phase'], string> = {
  textures: 'Re-encoding textures',
  geometry: 'Compressing geometry',
  writing: 'Writing GLB',
};

// The three sectors (spec: "phases read as sectors"). Order fixes the
// completed/live/pending derivation below — a phase never appears out of order.
const SECTORS: Array<{ phase: Progress['phase']; label: string }> = [
  { phase: 'textures', label: 'S1 TEXTURES' },
  { phase: 'geometry', label: 'S2 GEOMETRY' },
  { phase: 'writing', label: 'S3 WRITE' },
];
const SECTOR_ORDER = SECTORS.map((sector) => sector.phase);

function OptimizingView({ progress }: { progress: Progress | null }) {
  const currentIndex = progress ? SECTOR_ORDER.indexOf(progress.phase) : -1;
  const ticker = progress
    ? `${PHASE_LABEL[progress.phase]}${progress.label ? ` — ${progress.label}` : ''} (${progress.done}/${progress.total})`
    : 'Starting worker';

  return (
    <section class="report optimizing" role="status" aria-label="Optimizing">
      <p class="rp-status">Optimizing</p>
      <div class="op-sectors">
        {SECTORS.map((sector, i) => {
          const isDone =
            i < currentIndex ||
            (i === currentIndex && progress !== null && progress.total > 0 && progress.done === progress.total);
          const isLive = i === currentIndex && !isDone;
          const fraction =
            i < currentIndex ? 1 : i > currentIndex ? 0 : progress && progress.total > 0 ? progress.done / progress.total : 0;
          return (
            <div
              key={sector.phase}
              class={`op-sector${isLive ? ' is-live' : ''}${isDone ? ' is-done' : ''}`}
            >
              <p class="op-sector-label" data-testid="sector-label">
                {sector.label}
              </p>
              <div class="op-sector-track" aria-hidden="true">
                <div class="op-sector-fill" style={{ width: `${Math.round(fraction * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p class="op-ticker">{ticker}</p>
    </section>
  );
}

interface LoadedViewProps {
  report: ModelReport;
  runError?: string;
  onOptimize: (settings: OptimizeSettings) => void;
  onReset: () => void;
}

function LoadedView({ report, runError, onOptimize, onReset }: LoadedViewProps) {
  const { meshStats, textures, features, warnings } = report;
  const [preset, setPreset] = useState<QualityPreset>('balanced');
  const [overrides, setOverrides] = useState<OptimizeSettings['overrides']>({});

  // The instrument row (T10): four figures count up once, on entry into this
  // state — see useCountUp's mount-keyed effect above.
  const vertsUp = useCountUp(meshStats.vertexCount);
  const primsUp = useCountUp(meshStats.primitiveCount);
  const texturesUp = useCountUp(textures.length);
  const sizeUp = useCountUp(report.byteLength);

  // Merge a patch into one texture's override; drop cleared fields and empty
  // overrides so the composed settings only carry real user decisions.
  function patchOverride(id: string, patch: Partial<TextureOverride>) {
    setOverrides((previous) => {
      const merged: TextureOverride = { ...previous[id], ...patch };
      for (const key of Object.keys(merged) as (keyof TextureOverride)[]) {
        if (merged[key] === undefined) delete merged[key];
      }
      const next = { ...previous };
      if (Object.keys(merged).length === 0) delete next[id];
      else next[id] = merged;
      return next;
    });
  }
  return (
    <section class="report" role="region" aria-label="Model report" data-testid="model-report">
      <header class="rp-head">
        <p class="rp-status">Loaded</p>
        <h2 class="rp-name">{report.fileName}</h2>
        <p class="rp-meta">
          {meshStats.hasDraco ? 'Geometry already DRACO-compressed' : 'Geometry uncompressed source'}
          {features.hasAnimation || features.hasSkinning || features.hasMorphTargets
            ? ` · Detected: ${[
                features.hasAnimation && 'animation',
                features.hasSkinning && 'skinning',
                features.hasMorphTargets && 'morph targets',
              ]
                .filter(Boolean)
                .join(' · ')}`
            : ''}
        </p>
      </header>

      <div class="rp-instruments">
        <Instrument label="vertices" value={int.format(Math.round(vertsUp))} />
        <Instrument label="primitives" value={int.format(Math.round(primsUp))} />
        <Instrument label="textures" value={int.format(Math.round(texturesUp))} />
        <Instrument label="on disk" value={formatBytes(Math.round(sizeUp))} />
      </div>

      {warnings.length > 0 && (
        <div class="rp-warnings" role="list" aria-label="Warnings">
          {warnings.map((warning) => (
            <p class="rp-flag" role="listitem" key={warning}>
              {warning}
            </p>
          ))}
        </div>
      )}

      <Controls preset={preset} onPreset={setPreset} />
      <TextureList textures={textures} preset={preset} overrides={overrides} onOverride={patchOverride} />

      {runError && (
        <p class="rp-error" role="alert">
          {runError}
        </p>
      )}

      <div class="rp-actions">
        <button class="btn-accent" type="button" onClick={() => onOptimize({ preset, overrides })}>
          Optimize
        </button>
        <button class="rp-reset" type="button" onClick={onReset}>
          Load another model
        </button>
      </div>
    </section>
  );
}

function Instrument({ label, value }: { label: string; value: string }) {
  return (
    <div class="rp-instrument">
      <p class="rp-instrument-fig">{value}</p>
      <p class="rp-instrument-label">{label}</p>
    </div>
  );
}
