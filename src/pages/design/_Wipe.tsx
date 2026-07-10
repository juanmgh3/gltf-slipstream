// Slider-wipe compare prototype — the camera-sync spike (plan, Act 1). One stage,
// two overlaid model-viewers: the base (OPTIMIZED) is the only interaction target;
// the overlay (ORIGINAL) is clipped to the left of the divider, ignores pointers,
// and mirrors the master camera one-directionally on every camera-change, with
// jumpCameraToGoal() killing the eased chase so the mirror tracks frame-tight.
// Ported into src/island/CompareViewer.tsx at convergence (T8), then deleted.

import type { ModelViewerElement } from '@google/model-viewer';
import { useEffect, useRef, useState } from 'preact/hooks';

interface WipeProps {
  originalSrc: string;
  optimizedSrc: string;
}

const MIN = 5;
const MAX = 95;
const STEP = 2;
const clamp = (value: number) => Math.min(MAX, Math.max(MIN, value));

const kicker = {
  position: 'absolute',
  top: 'var(--ss-space-3)',
  zIndex: 2,
  fontFamily: 'var(--ss-font-mono)',
  fontSize: 'var(--ss-fs-kicker)',
  fontWeight: 'var(--ss-w-semibold)',
  letterSpacing: 'var(--ss-tracking-kicker)',
  textTransform: 'uppercase',
  pointerEvents: 'none',
} as const;

export function Wipe({ originalSrc, optimizedSrc }: WipeProps) {
  const [ready, setReady] = useState(false);
  const [wipe, setWipe] = useState(50);
  const stageRef = useRef<HTMLDivElement>(null);
  const masterRef = useRef<HTMLElement>(null);
  const mirrorRef = useRef<HTMLElement>(null);

  useEffect(() => {
    (async () => {
      // Same decoder rule as CompareViewer: model-viewer reads the GLOBAL config
      // object and resets the decoder location from it with a gstatic fallback —
      // configure the global before the import, never Google's CDN.
      const configHost = self as { ModelViewerElement?: { dracoDecoderLocation?: string } };
      configHost.ModelViewerElement = {
        ...configHost.ModelViewerElement,
        dracoDecoderLocation: new URL('/mv-draco/', location.origin).href,
      };
      await import('@google/model-viewer');
      setReady(true);
    })();
  }, []);

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

  if (!ready) {
    return (
      <p style={{ fontFamily: 'var(--ss-font-mono)', fontSize: 'var(--ss-fs-small)', color: 'var(--ss-text-faint)' }}>
        Preparing 3D stage…
      </p>
    );
  }

  return (
    <div
      ref={stageRef}
      data-testid="wipe-stage"
      style={{
        position: 'relative',
        width: '100%',
        height: '55vh',
        minHeight: '420px',
        overflow: 'hidden',
        background: 'var(--ss-cell-bg)',
        border: 'var(--ss-hairline-w) solid var(--ss-border)',
      }}
    >
      {/* Base layer: OPTIMIZED, full size, the single interaction master. */}
      <model-viewer
        ref={masterRef}
        data-testid="wipe-optimized"
        src={optimizedSrc}
        alt="Optimized model"
        camera-controls
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
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
        data-testid="wipe-original"
        src={originalSrc}
        alt="Original model"
        min-camera-orbit="-Infinity 0deg 0m"
        max-camera-orbit="Infinity 180deg 10000%"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          background: 'var(--ss-cell-bg)',
          clipPath: `inset(0 ${100 - wipe}% 0 0)`,
        }}
      />

      <span style={{ ...kicker, left: 'var(--ss-space-4)', color: 'var(--ss-text-label)' }}>Original</span>
      <span style={{ ...kicker, right: 'var(--ss-space-4)', color: 'var(--ss-accent-text)' }}>Optimized</span>

      {/* Divider: amber line + 16px grab strip. role=slider for keyboard/AT. */}
      <div
        data-testid="wipe-handle"
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
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${wipe}%`,
          width: '16px',
          translate: '-50% 0',
          cursor: 'col-resize',
          touchAction: 'none',
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* the visible amber line */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '2px', translate: '-50% 0', background: 'var(--ss-accent)' }} />
        {/* the knob */}
        <div
          aria-hidden="true"
          style={{
            position: 'relative',
            zIndex: 1,
            width: '20px',
            height: '20px',
            background: 'var(--ss-accent)',
            color: 'var(--ss-accent-ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--ss-font-mono)',
            fontSize: '10px',
            fontWeight: 'var(--ss-w-bold)',
            userSelect: 'none',
          }}
        >
          ↔
        </div>
      </div>
    </div>
  );
}
