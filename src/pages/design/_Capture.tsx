// Design-elevation fixture capture (throwaway, deleted at convergence). Runs the
// bundled demo through the PRODUCTION worker client — analyze, then a balanced
// optimize recording every Progress callback — and parks the serializable result
// on `window.__designFixture` for e2e/capture-fixture.spec.ts to write to disk.

import * as Comlink from 'comlink';
import { useEffect, useState } from 'preact/hooks';
import { createOptimizerClient } from '../../island/workerClient';
import type { ModelReport, OptimizeResult, Progress } from '../../optimizer/types';

export interface DesignFixture {
  report: ModelReport;
  progressLog: Progress[];
  result: Omit<OptimizeResult, 'glb'>;
  capturedAt: string;
}

interface CaptureHost {
  __designFixture?: DesignFixture;
  __designFixtureError?: string;
}

const DEMO_URL = '/demo/perseverance.glb';

async function capture(): Promise<DesignFixture> {
  const response = await fetch(DEMO_URL);
  if (!response.ok) throw new Error(`demo fetch failed: ${response.status}`);
  const blob = await response.blob();

  const client = createOptimizerClient();
  // Each call gets its own buffer: analyze transfers its copy away.
  const analyzeBuffer = await blob.arrayBuffer();
  const report = await client.analyze(Comlink.transfer(analyzeBuffer, [analyzeBuffer]), 'perseverance.glb');

  const progressLog: Progress[] = [];
  const optimizeBuffer = await blob.arrayBuffer();
  const result = await client.optimize(
    Comlink.transfer(optimizeBuffer, [optimizeBuffer]),
    { preset: 'balanced', overrides: {} },
    Comlink.proxy((progress: Progress) => {
      progressLog.push({ ...progress });
    }),
  );

  return {
    report,
    progressLog,
    result: {
      inputByteLength: result.inputByteLength,
      outputByteLength: result.outputByteLength,
      breakdown: result.breakdown,
      perTexture: result.perTexture,
    },
    capturedAt: new Date().toISOString(),
  };
}

export function Capture() {
  const [status, setStatus] = useState('capturing — analyze + balanced optimize on the demo…');

  useEffect(() => {
    const host = window as unknown as CaptureHost;
    capture()
      .then((fixture) => {
        host.__designFixture = fixture;
        setStatus(`done — ${fixture.progressLog.length} progress frames, ${fixture.report.textures.length} textures`);
      })
      .catch((error: unknown) => {
        host.__designFixtureError = String(error);
        setStatus(`failed: ${String(error)}`);
      });
  }, []);

  return <pre style={{ fontFamily: 'var(--ss-font-mono)', padding: 'var(--ss-space-5)' }}>{status}</pre>;
}
