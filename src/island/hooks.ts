// Shared island hooks. `useCountUp` started life inside Optimizer.tsx (T10)
// and Results.tsx's hero delta (T11) needs the exact same contract, so it
// lives here instead of being copy-pasted.

import { useEffect, useState } from 'preact/hooks';

// Count-up on STATE ENTRY only: the effect keys off `target`, which callers
// must keep fixed for the lifetime of the mounted card they're animating
// (e.g. LoadedView is remounted via `key={loadSeq.current}`, Results via the
// `done` phase's fresh `result` object) — re-renders caused by unrelated
// state never restart the animation. prefers-reduced-motion snaps straight
// to the final value.
export function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setValue(target * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
