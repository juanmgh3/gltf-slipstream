// Load surface: drag-and-drop AND file picker (T13). Visual design carried over
// from the T4 shell — the amber drag-over state marks the live moment (accent rule).

import { useEffect, useRef, useState } from 'preact/hooks';

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

  const take = (file: File | undefined) => {
    if (file && !busy) onFile(file);
  };

  return (
    <section
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
      <div class="dz-inner">
        <svg
          class="dz-glyph"
          viewBox="0 0 24 24"
          width="40"
          height="40"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M4 19h16" />
        </svg>
        <p class="dz-title">{busy ? 'Reading model…' : 'Drop your model'}</p>
        <p class="dz-hint">.glb or self-contained .gltf</p>
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
          no model handy? try NASA&rsquo;s Perseverance rover
        </button>
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
