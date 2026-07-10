// V1 · Broadcast — exploration variant (throwaway, deleted at convergence).
// The page as a world-feed timing screen: persistent broadcast bar, one
// hairline-tiled board that recuts per state, data as the only decoration.
// All figures come from the captured Perseverance fixture — nothing invented.

import { useEffect, useState } from 'preact/hooks';
import { formatBytes, int } from '../../island/format';
import { planForTexture } from '../../optimizer/defaults';
import type { Progress, TextureInfo } from '../../optimizer/types';
import { fixture, useStateRail, DESIGN_STATES, type DesignState } from './_shared';
import { Wipe } from './_Wipe';
import './_v1.css';

interface V1Props {
  iconSrc: string;
  letteringSrc: string;
}

const DEMO = '/demo/perseverance.glb';

// Restrained count-up: figures arrive, they don't dance. Killed by reduced-motion.
function useCountUp(target: number, ms = 600): number {
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

function planLabel(texture: TextureInfo): string {
  const plan = planForTexture(texture.roles, 'balanced', undefined);
  const encode = plan.lossless ? 'WebP lossless' : `WebP q${plan.quality}`;
  return plan.maxResolution ? `${encode} · ≤${plan.maxResolution}px` : encode;
}

const SESSION_LABEL: Record<DesignState, string> = {
  idle: 'Standby',
  loaded: 'Model loaded',
  run: 'Running',
  done: 'Complete',
};

export function V1({ iconSrc, letteringSrc }: V1Props) {
  const rail = useStateRail();
  const live = rail.state !== 'idle';

  return (
    <div class="v1">
      <header class="v1-bar">
        <div class="v1-lockup">
          <img src={iconSrc} alt="" width="24" height="24" />
          <img src={letteringSrc} alt="Slipstream" width="104" height="26" />
        </div>
        <p class={`v1-session${live ? ' is-live' : ''}`}>
          <span class="dot" /> {SESSION_LABEL[rail.state]}
        </p>
        <p class="v1-ticker">100% local · nothing leaves your machine</p>
      </header>

      {rail.state === 'idle' && <IdleBoard />}
      {rail.state === 'loaded' && <LoadedBoard />}
      {rail.state === 'run' && <RunBoard frame={rail.frame} onReplay={rail.replay} />}
      {rail.state === 'done' && <DoneBoard />}

      <Fold />

      <footer class="v1-foot">
        <p>Free &amp; open source · MIT</p>
        <p>DRACO + WebP · entirely in your browser</p>
      </footer>

      {/* exploration scaffolding, not part of the design under judgment */}
      <nav class="v1-railbar" aria-label="Exploration states">
        {DESIGN_STATES.map((s) => (
          <button key={s} class={s === rail.state ? 'is-active' : ''} onClick={() => rail.setState(s)}>
            {s}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ================= IDLE ================= */

function IdleBoard() {
  return (
    <main class="v1-board" data-state="idle">
      <section class="v1-cell v1-drop">
        <p class="v1-k">Awaiting model</p>
        <h1 class="v1-drop-title">Drop your model.</h1>
        <p class="v1-drop-hint">.glb / self-contained .gltf — drag it anywhere on this panel</p>
        <p class="v1-drop-demo">No model handy? Run NASA's Perseverance rover</p>
      </section>
      <section class="v1-cell">
        <p class="v1-k">Pipeline</p>
        <div class="v1-pipeline">
          <span class="v1-chip">DRACO geometry</span>
          <span class="v1-chip">WebP textures</span>
          <span class="v1-chip">Web Worker</span>
        </div>
        <p class="v1-sub">KHR_draco_mesh_compression · EXT_texture_webp</p>
      </section>
      <section class="v1-cell">
        <p class="v1-k">Privacy</p>
        <p class="v1-fig">
          0<small> uploads</small>
        </p>
        <p class="v1-sub">Processed on this machine, verified on every build</p>
      </section>
      <section class="v1-cell">
        <p class="v1-k">Typical delta</p>
        <p class="v1-fig">
          −55<small>%</small>
        </p>
        <p class="v1-sub">Perseverance demo · 11.7 MB → 5.2 MB</p>
      </section>
    </main>
  );
}

/* ================= LOADED ================= */

function LoadedBoard() {
  const { report } = fixture;
  const verts = useCountUp(report.meshStats.vertexCount);
  return (
    <main class="v1-board" data-state="loaded">
      <section class="v1-cell v1-id">
        <p class="v1-k is-live">Loaded</p>
        <h1 class="v1-id-name">{report.fileName}</h1>
        <p class="v1-id-size">{formatBytes(report.byteLength)}</p>
      </section>

      <section class="v1-cell">
        <p class="v1-k">Vertices</p>
        <p class="v1-fig">{int.format(Math.round(verts))}</p>
      </section>
      <section class="v1-cell">
        <p class="v1-k">Primitives</p>
        <p class="v1-fig">{int.format(report.meshStats.primitiveCount)}</p>
      </section>
      <section class="v1-cell">
        <p class="v1-k">Textures</p>
        <p class="v1-fig">{int.format(report.textures.length)}</p>
      </section>
      <section class="v1-cell">
        <p class="v1-k">Geometry</p>
        <p class="v1-fig">{report.meshStats.hasDraco ? 'DRACO' : 'RAW'}</p>
        <p class="v1-sub">{report.meshStats.hasDraco ? 'already compressed' : 'uncompressed source'}</p>
      </section>

      <section class="v1-cell v1-go">
        <p class="v1-k">Session control</p>
        <button class="v1-cta" type="button">
          Optimize
        </button>
        <div class="v1-flags">
          {fixture.report.warnings.length === 0 ? (
            <p>0 flags · clean scan</p>
          ) : (
            fixture.report.warnings.map((w) => <p class="v1-flag">{w}</p>)
          )}
        </div>
      </section>

      <section class="v1-cell v1-table-cell">
        <TimingTable textures={report.textures} />
      </section>

      <aside class="v1-cell v1-rail">
        <p class="v1-k">Quality preset</p>
        <div class="v1-preset">
          <button type="button">
            Maximum <span class="hint">lossless-leaning</span>
          </button>
          <button type="button" class="is-active">
            Balanced <span class="hint">the default</span>
          </button>
          <button type="button">
            Aggressive <span class="hint">smallest files</span>
          </button>
        </div>
        <p class="v1-sub">
          Per-texture overrides live in the table — exclude, quality, resolution cap.
        </p>
        <p class="v1-k">Features</p>
        <ul class="v1-features">
          <li>
            <span>Animation</span>
            <span>{fixture.report.features.hasAnimation ? 'detected' : '—'}</span>
          </li>
          <li>
            <span>Skinning</span>
            <span>{fixture.report.features.hasSkinning ? 'detected' : '—'}</span>
          </li>
          <li>
            <span>Morph targets</span>
            <span>{fixture.report.features.hasMorphTargets ? 'detected' : '—'}</span>
          </li>
          <li>
            <span>Source geometry</span>
            <span>{fixture.report.meshStats.hasDraco ? 'DRACO' : 'uncompressed'}</span>
          </li>
        </ul>
      </aside>
    </main>
  );
}

function TimingTable({ textures }: { textures: TextureInfo[] }) {
  return (
    <div class="v1-tt">
      <table>
        <thead>
          <tr>
            <th aria-label="Row" />
            <th>Texture</th>
            <th>Dims</th>
            <th>Weight</th>
            <th>Plan</th>
            <th>Overrides</th>
          </tr>
        </thead>
        <tbody>
          {textures.map((texture, index) => (
            <tr key={texture.id}>
              <td class="tt-n">{String(index + 1).padStart(2, '0')}</td>
              <td class="tt-name" title={texture.name}>
                {texture.name || `texture ${texture.id}`}{' '}
                <span class="tt-roles">{texture.roles.join('·')}</span>
              </td>
              <td>
                {texture.width}×{texture.height}
              </td>
              <td>{formatBytes(texture.byteLength)}</td>
              <td class="tt-plan">{planLabel(texture)}</td>
              <td>
                <span class="tt-ov">
                  <label>
                    <input type="checkbox" aria-label={`Exclude ${texture.name}`} /> excl
                  </label>
                  <input type="number" aria-label={`Quality for ${texture.name}`} placeholder="—" />
                  <select aria-label={`Max size for ${texture.name}`}>
                    <option>no cap</option>
                    <option>≤2048</option>
                    <option>≤1024</option>
                  </select>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================= RUN ================= */

const PHASES = ['textures', 'geometry', 'writing'] as const;
const SECTORS: Array<{ phase: Progress['phase']; name: string; detail: string }> = [
  { phase: 'textures', name: 'S1 · Textures', detail: 'WebP re-encode' },
  { phase: 'geometry', name: 'S2 · Geometry', detail: 'DRACO compression' },
  { phase: 'writing', name: 'S3 · Write', detail: 'GLB repack' },
];

function RunBoard({ frame, onReplay }: { frame: Progress | null; onReplay: () => void }) {
  const current = frame ? PHASES.indexOf(frame.phase) : -1;
  const index = frame ? fixture.progressLog.indexOf(frame) : -1;
  const feed = fixture.progressLog
    .slice(0, index + 1)
    .filter((f) => f.label)
    .slice(-10)
    .reverse();

  return (
    <main class="v1-board" data-state="run">
      {SECTORS.map((sector, i) => {
        const done = i < current || (i === current && frame !== null && frame.done === frame.total);
        const isLive = i === current && !done;
        const fraction = i < current ? 1 : i > current ? 0 : frame && frame.total > 0 ? frame.done / frame.total : 0;
        return (
          <section key={sector.phase} class={`v1-cell v1-sector${isLive ? ' is-live' : ''}${done ? ' is-done' : ''}`}>
            <p class={`v1-k${isLive ? ' is-live' : ''}`}>{sector.name}</p>
            <p class="count">
              {i === current && frame ? `${frame.done}/${frame.total}` : i < current || done ? 'done' : '—'}
            </p>
            <div class="bar" aria-hidden="true">
              <i style={{ width: `${fraction * 100}%` }} />
            </div>
            <p class="v1-sub">{sector.detail}</p>
          </section>
        );
      })}

      <section class="v1-cell v1-feed" role="status" aria-label="Optimizing">
        <p class="v1-k is-live">Live feed</p>
        <ul>
          {feed.map((f, i) => (
            <li key={`${f.label}-${i}`}>
              {f.phase === 'textures' ? 'S1' : f.phase === 'geometry' ? 'S2' : 'S3'} · {f.label} ·{' '}
              {f.done}/{f.total}
            </li>
          ))}
        </ul>
      </section>

      <section class="v1-cell v1-run-foot">
        <p class="v1-sub">perseverance.glb · balanced preset · 24 textures</p>
        <button class="v1-ghost" type="button" onClick={onReplay}>
          ↻ Replay
        </button>
      </section>
    </main>
  );
}

/* ================= DONE ================= */

function DoneBoard() {
  const { result, report } = fixture;
  const savings = (1 - result.outputByteLength / result.inputByteLength) * 100;
  const delta = useCountUp(savings, 800);
  const byId = new Map(report.textures.map((t) => [t.id, t]));
  const gains = [...result.perTexture]
    .sort((a, b) => b.before - b.after - (a.before - a.after))
    .slice(0, 5);

  return (
    <main class="v1-board" data-state="done">
      <section class="v1-cell v1-delta">
        <p class="v1-k is-live">Session result</p>
        <p class="v1-fig">−{delta.toFixed(1)}%</p>
        <p class="v1-sub">
          {formatBytes(result.inputByteLength)} → {formatBytes(result.outputByteLength)}
        </p>
      </section>

      <BreakdownCell label="Geometry" before={result.breakdown.geometryBefore} after={result.breakdown.geometryAfter} />
      <BreakdownCell label="Textures" before={result.breakdown.texturesBefore} after={result.breakdown.texturesAfter} />

      <section class="v1-cell">
        <p class="v1-k">Top gains</p>
        <ul class="v1-gains">
          {gains.map((g) => (
            <li key={g.id}>
              <span>{byId.get(g.id)?.name ?? g.id}</span>
              <span class="g">−{formatBytes(g.before - g.after)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section class="v1-cell">
        <p class="v1-k">Verdict</p>
        <p class="v1-fig">
          24<small>/24 webp</small>
        </p>
        <p class="v1-sub">geometry DRACO&apos;d · shape preserved</p>
      </section>

      <section class="v1-cell v1-stage">
        <Wipe originalSrc={DEMO} optimizedSrc={DEMO} />
      </section>

      <section class="v1-cell v1-done-foot">
        <button class="v1-cta" type="button">
          Download perseverance.optimized.glb · {formatBytes(result.outputByteLength)}
        </button>
        <button class="v1-ghost" type="button">
          Load another model
        </button>
      </section>
    </main>
  );
}

// Truthful bars: on this model textures GROW (lossless normal maps cost more as
// WebP) — the bar clamps at full and the figures tell the real story.
function BreakdownCell({ label, before, after }: { label: string; before: number; after: number }) {
  const grew = after > before;
  return (
    <section class="v1-cell v1-break">
      <p class="v1-k">{label}</p>
      <div class="bar" aria-hidden="true">
        <span class="after" style={{ width: `${Math.min(100, (after / before) * 100)}%` }} />
      </div>
      <p>
        {formatBytes(before)} → {formatBytes(after)}
        {grew ? ' · +' + formatBytes(after - before) : ' · −' + formatBytes(before - after)}
      </p>
    </section>
  );
}

/* ================= Below the fold ================= */

function Fold() {
  return (
    <section class="v1-fold">
      <div class="v1-fold-grid">
        <div class="v1-cell">
          <p class="v1-k">How it works</p>
          <h3>Three sectors, one worker.</h3>
          <p>
            Your model is decoded and analyzed in a Web Worker, textures are re-encoded to WebP,
            geometry is compressed with DRACO, and the result is repacked as a single GLB — the
            page never freezes, the pipeline never leaves the tab.
          </p>
          <p class="mono">S1 textures → S2 geometry → S3 write</p>
        </div>
        <div class="v1-cell">
          <p class="v1-k">Privacy</p>
          <h3>Nothing leaves your machine.</h3>
          <p>
            There is no upload path in this codebase — the file goes from your disk to an
            ArrayBuffer to a worker and back to a download. An automated end-to-end test asserts
            zero non-local requests during a full optimize run, on every build.
          </p>
          <p class="mono">file → arraybuffer → worker → blob</p>
        </div>
        <div class="v1-cell">
          <p class="v1-k">Credits</p>
          <h3>Honest machinery.</h3>
          <p>
            Demo model: Perseverance rover by NASA/JPL-Caltech, public domain (CC0). Code is MIT
            and open source. Built with gltf-transform, DRACO and jSquash — optimized in code,
            finished by hand where it shows.
          </p>
          <p class="mono">NASA/JPL-Caltech · CC0 demo · MIT code</p>
        </div>
      </div>
    </section>
  );
}
