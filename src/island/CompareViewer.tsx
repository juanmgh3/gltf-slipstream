// Before/after 3D compare: a slider-wipe over one stage. One model-viewer pair:
// the base (OPTIMIZED) is the only interaction target; the overlay (ORIGINAL)
// is clipped to the left of the divider, ignores pointers, and mirrors the
// master camera one-directionally. Re-rendering the optimized GLB in
// model-viewer IS the correctness check. model-viewer is imported dynamically —
// it registers a custom element and pulls its own three.js, none of which the
// load path should pay for. Its DRACO decoder is self-hosted under /mv-draco/
// (postinstall) — never Google's CDN.

import type { ModelViewerElement } from '@google/model-viewer';
import { useEffect, useRef, useState } from 'preact/hooks';

interface CompareViewerProps {
  original: File;
  optimizedGlb: ArrayBuffer;
}

const MIN = 5;
const MAX = 95;
const STEP = 2;
const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

export function CompareViewer({ original, optimizedGlb }: CompareViewerProps) {
  const [ready, setReady] = useState(false);
  const [urls, setUrls] = useState<{ before: string; after: string } | null>(null);
  const [wipe, setWipe] = useState(50);
  const stageRef = useRef<HTMLDivElement>(null);
  const masterRef = useRef<HTMLElement>(null);
  const mirrorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string[] = [];
    (async () => {
      // model-viewer's element constructor reads `self.ModelViewerElement` — the
      // global config object, NOT the imported class — and resets the decoder
      // location from it with a gstatic fallback (lib/features/loading.js), so a
      // static set on the class is silently overwritten. Configure the global.
      const configHost = self as { ModelViewerElement?: { dracoDecoderLocation?: string } };
      configHost.ModelViewerElement = {
        ...configHost.ModelViewerElement,
        dracoDecoderLocation: new URL('/mv-draco/', location.origin).href,
      };
      await import('@google/model-viewer');
      const before = URL.createObjectURL(new Blob([await original.arrayBuffer()], { type: 'model/gltf-binary' }));
      const after = URL.createObjectURL(new Blob([optimizedGlb], { type: 'model/gltf-binary' }));
      created = [before, after];
      if (cancelled) {
        created.forEach((url) => URL.revokeObjectURL(url));
      } else {
        setUrls({ before, after });
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [original, optimizedGlb]);

  // One-directional camera mirroring: master (OPTIMIZED) → overlay (ORIGINAL).
  // No feedback-loop guard is needed because the overlay never emits back.
  // camera-change alone is NOT enough: wheel zoom stops emitting before the
  // master's eased interpolation settles, leaving the mirror ~1m of radius
  // behind (measured). So each event kicks a rAF loop that keeps copying until
  // the master has been still for a few frames — moving-camera cost only.
  useEffect(() => {
    if (!ready) return;
    const master = masterRef.current as ModelViewerElement | null;
    const mirror = mirrorRef.current as ModelViewerElement | null;
    if (!master || !mirror) return;
    let raf = 0;
    let last = '';
    let still = 0;
    const copy = () => {
      const orbit = master.getCameraOrbit();
      const target = master.getCameraTarget();
      mirror.cameraOrbit = `${orbit.theta}rad ${orbit.phi}rad ${orbit.radius}m`;
      mirror.cameraTarget = `${target.x}m ${target.y}m ${target.z}m`;
      mirror.fieldOfView = `${master.getFieldOfView()}deg`;
      mirror.jumpCameraToGoal();
      return `${orbit.theta},${orbit.phi},${orbit.radius},${target.x},${target.y},${target.z},${master.getFieldOfView()}`;
    };
    const loop = () => {
      const key = copy();
      still = key === last ? still + 1 : 0;
      last = key;
      raf = still < 12 ? requestAnimationFrame(loop) : 0;
    };
    const sync = () => {
      still = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    master.addEventListener('camera-change', sync);
    master.addEventListener('load', sync); // align initial auto-framing
    return () => {
      cancelAnimationFrame(raf);
      master.removeEventListener('camera-change', sync);
      master.removeEventListener('load', sync);
    };
  }, [ready]);

  const dragTo = (clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect) setWipe(clamp(((clientX - rect.left) / rect.width) * 100));
  };

  // `--wipe` drives both the overlay's clip-path and the handle position from
  // CSS (optimizer.css), rather than duplicating the percentage into two
  // inline styles — one write, both consumers stay in sync. `ready` is in the
  // deps too: the stage (and its ref) doesn't exist until the "Preparing…"
  // early return clears, so the mount-time run of this effect (stage not yet
  // rendered) must be followed by another once the ref is actually live.
  useEffect(() => {
    stageRef.current?.style.setProperty('--wipe', `${wipe}%`);
  }, [wipe, ready]);

  if (!ready || !urls) return <p class="cv-loading">Preparing 3D compare…</p>;

  return (
    <div ref={stageRef} class="cv-stage" data-testid="compare">
      {/* Base layer: OPTIMIZED, full size, the single interaction master. */}
      <model-viewer
        ref={masterRef}
        class="cv-viewer"
        data-testid="cv-optimized"
        src={urls.after}
        alt="Optimized model"
        camera-controls
      />
      {/* Overlay: ORIGINAL, clipped to the left of the divider, pointer-blind.
          Opaque background — otherwise the master renders through and any
          transient camera lag reads as a ghost duplicate on this side.
          Orbit limits are released: interactive zoom on the master goes past
          the default min-radius clamp, and a clamped mirror sticks there
          (measured: master 5.08m vs mirror clamped at 6.81m). The master's own
          limits are the only ones that matter — the mirror just obeys. */}
      <model-viewer
        ref={mirrorRef}
        class="cv-viewer cv-viewer-mirror"
        data-testid="cv-original"
        src={urls.before}
        alt="Original model"
        min-camera-orbit="-Infinity 0deg 0m"
        max-camera-orbit="Infinity 180deg 10000%"
      />

      <span class="cv-kicker cv-kicker-original">Original</span>
      <span class="cv-kicker cv-kicker-optimized">Optimized</span>

      {/* Divider: amber line + grab strip. role=slider for keyboard/AT. */}
      <div
        class="cv-handle"
        data-testid="cv-handle"
        role="slider"
        aria-label="Compare divider"
        aria-orientation="vertical"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={Math.round(wipe)}
        tabIndex={0}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          dragTo(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) dragTo(e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setWipe((w) => clamp(w - STEP));
          else if (e.key === 'ArrowRight') setWipe((w) => clamp(w + STEP));
          else if (e.key === 'Home') setWipe(MIN);
          else if (e.key === 'End') setWipe(MAX);
          else return;
          e.preventDefault();
        }}
      >
        <div class="cv-handle-line" />
        <div class="cv-handle-knob" aria-hidden="true">
          ↔
        </div>
      </div>
    </div>
  );
}
