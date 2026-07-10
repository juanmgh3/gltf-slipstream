// Load surface: drag-and-drop AND file picker (T13). The idle hero mass (T12):
// oversized target, the icon as an interactive particle swarm (verdict
// correction round), amber solid border on drag-over — the live moment.

import { useEffect, useRef, useState } from 'preact/hooks';
import iconDark from '../../slipstream-brand-kit/assets/logo/slipstream-icon-dark.svg?url';
import iconLight from '../../slipstream-brand-kit/assets/logo/slipstream-icon-light.svg?url';
import { mountDropzoneParticles } from './dropzoneParticles';

interface DropzoneProps {
  onFile: (file: File) => void;
  /** Click-to-try: load the bundled demo model through the same path as a drop. */
  onDemo: () => void;
  /** True while a file is being read/analyzed — input is ignored meanwhile. */
  busy: boolean;
  error?: string;
}

export function Dropzone({ onFile, onDemo, busy, error }: DropzoneProps) {
  const [isOver, setOver] = useState(false);
  // The input is server-rendered disabled and only enabled once this effect runs
  // after hydration — a file picked before the change handler exists would be lost.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  // dragenter/dragleave fire for every child the cursor crosses; a depth counter
  // keeps the highlight stable until the pointer truly leaves the zone.
  const depth = useRef(0);
  const zoneRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // SSR and reduced-motion render the static icon; the canvas swarm is a
  // hydration upgrade. Icon variant follows the active theme (sampled colors:
  // the dark icon's near-white dots would vanish on the light surface).
  const [fx, setFx] = useState(false);
  useEffect(() => {
    setFx(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  useEffect(() => {
    if (!fx || !zoneRef.current || !canvasRef.current) return;
    const light = document.documentElement.dataset.theme === 'light';
    return mountDropzoneParticles(zoneRef.current, canvasRef.current, light ? iconLight : iconDark);
  }, [fx]);

  const take = (file: File | undefined) => {
    if (file && !busy) onFile(file);
  };

  return (
    <section
      ref={zoneRef}
      class={`dropzone${isOver ? ' is-over' : ''}`}
      data-testid="dropzone"
      aria-label="Load a model"
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        take(e.dataTransfer?.files[0]);
      }}
    >
      {/* The mark as a background element: full-bleed pointer-blind canvas,
          swarm at real scale under translucency, copy legible on top. */}
      {fx && <canvas ref={canvasRef} class="dz-canvas" aria-hidden="true" />}
      {!fx && <img class="dz-mark-static" src={iconDark} alt="" aria-hidden="true" />}
      <div class="dz-inner">
        <p class="dz-title">{busy ? 'Reading model…' : 'Drop a .glb or .gltf'}</p>
        <p class="dz-hint">or browse — self-contained .gltf works too</p>
        <input
          class="dz-input"
          type="file"
          id="file-input"
          data-testid="file-input"
          accept=".glb,.gltf"
          disabled={busy || !ready}
          onChange={(e) => {
            const input = e.currentTarget;
            take(input.files?.[0]);
            input.value = ''; // re-picking the same file must fire change again
          }}
        />
        <label class="dz-browse" for="file-input">
          Browse files
        </label>
        {/* Same hydration gate as the input: a pre-hydration click has no handler. */}
        <button
          class="dz-demo"
          type="button"
          data-testid="demo-button"
          disabled={busy || !ready}
          onClick={onDemo}
        >
          No model handy? Try the Perseverance rover
        </button>
        <p class="dz-attribution" data-testid="demo-attribution">
          NASA/JPL-Caltech · public domain (CC0)
        </p>
        {error && (
          <p class="dz-error" role="alert">
            {error}
          </p>
        )}
        <p class="dz-privacy">Processed locally — nothing is uploaded.</p>
      </div>
    </section>
  );
}
