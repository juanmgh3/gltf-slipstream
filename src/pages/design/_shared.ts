// Shared plumbing for the design-elevation exploration pages (throwaway, deleted
// at convergence). Deliberately minimal — fixture + state rail hook only. All
// variant markup and CSS stay divergent per page; nothing visual lives here.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { Progress } from '../../optimizer/types';
import type { DesignFixture } from './_Capture';
import fixtureJson from './_fixture.json';

export type { DesignFixture };

// The JSON import widens union fields (Progress.phase → string); the capture
// spec asserted the real shape before this file was ever committed.
export const fixture = fixtureJson as unknown as DesignFixture;

export type DesignState = 'idle' | 'loaded' | 'run' | 'done';
export const DESIGN_STATES: DesignState[] = ['idle', 'loaded', 'run', 'done'];

// ~28 captured frames over a ~6s real run; 180ms/frame replays at real-ish pace.
const FRAME_MS = 180;

export interface StateRail {
  state: DesignState;
  setState(state: DesignState): void;
  /** Current RUN frame — null before the first replay tick. */
  frame: Progress | null;
  /** Restart the RUN replay from frame 0 (entering RUN auto-replays). */
  replay(): void;
}

export function useStateRail(initial: DesignState = 'idle'): StateRail {
  const [state, setState] = useState<DesignState>(initial);
  const [frameIndex, setFrameIndex] = useState(-1);
  const timer = useRef<number>();

  const stop = () => {
    if (timer.current !== undefined) {
      clearInterval(timer.current);
      timer.current = undefined;
    }
  };

  const replay = () => {
    stop();
    setFrameIndex(0);
    timer.current = window.setInterval(() => {
      setFrameIndex((index) => {
        if (index >= fixture.progressLog.length - 1) {
          stop();
          return index;
        }
        return index + 1;
      });
    }, FRAME_MS);
  };

  // Entering RUN starts the choreography; judging it live is the point.
  const enter = (next: DesignState) => {
    setState(next);
    if (next === 'run') replay();
    else stop();
  };

  useEffect(() => stop, []);

  return {
    state,
    setState: enter,
    frame: fixture.progressLog[frameIndex] ?? null,
    replay,
  };
}
