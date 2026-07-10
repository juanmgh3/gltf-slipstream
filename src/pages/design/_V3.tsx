// V3 · Console — exploration variant (throwaway, deleted at convergence).
// The page as a mission-control rack: a lateral phase rail, one central
// console column of hairline-stacked modules, and a sticky telemetry sidebar
// that never leaves the screen. Mono is the voice; Clash speaks only for the
// figures that earn it. All figures come from the captured Perseverance
// fixture — nothing invented.

import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { formatBytes, int } from '../../island/format';
import { planForTexture } from '../../optimizer/defaults';
import type { Progress, TextureInfo } from '../../optimizer/types';
import { fixture, useStateRail, DESIGN_STATES, type DesignState } from './_shared';
import { Wipe } from './_Wipe';
import './_v3.css';

interface V3Props {
  iconSrc: string;
  letteringSrc: string;
}

const DEMO = '/demo/perseverance.glb';

// Figures arrive, they don't dance — one ease-out, killed by reduced-motion.
function useCountUp(target: number, ms = 650): number {
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

// The design's own phase rail — display, not controls (the fixed railbar is
// the exploration's state switcher; this rail is the direction under judgment).
const PHASE_RAIL: Array<{ state: DesignState; label: string }> = [
  { state: 'idle', label: 'Intake' },
  { state: 'loaded', label: 'Garage' },
  { state: 'run', label: 'Session' },
  { state: 'done', label: 'Result' },
];

export function V3({ iconSrc, letteringSrc }: V3Props) {
  const rail = useStateRail();
  const phaseIndex = PHASE_RAIL.findIndex((p) => p.state === rail.state);

  return (
    <div class="v3">
      <header class="v3-top">
        <div class="v3-lockup">
          <img src={iconSrc} alt="" width="30" height="30" />
          <img src={letteringSrc} alt="Slipstream" width="130" height="33" />
        </div>
        <p class="v3-sess">
          sess <span class={rail.state !== 'idle' ? 'is-live' : ''}>{rail.state}</span>
        </p>
        <p class="v3-priv">100% local · nothing leaves your machine</p>
      </header>

      <div class="v3-rack">
        <nav class="v3-phase-rail" aria-label="Session phases">
          {PHASE_RAIL.map((phase, i) => (
            <div
              key={phase.state}
              class={`v3-phase${i === phaseIndex ? ' is-live' : ''}${i < phaseIndex ? ' is-past' : ''}`}
            >
              <span class="n">{String(i + 1).padStart(2, '0')}</span>
              <span class="l">{phase.label}</span>
            </div>
          ))}
        </nav>

        <main class="v3-console">
          {rail.state === 'idle' && <IdleConsole />}
          {rail.state === 'loaded' && <LoadedConsole />}
          {rail.state === 'run' && <RunConsole frame={rail.frame} onReplay={rail.replay} />}
          {rail.state === 'done' && <DoneConsole />}
          <Fold />
        </main>

        <Sidebar state={rail.state} frame={rail.frame} />
      </div>

      <footer class="v3-foot">
        <p>Free &amp; open source · MIT</p>
        <p>DRACO + WebP · entirely in your browser</p>
      </footer>

      {/* exploration scaffolding, not part of the design under judgment */}
      <nav class="v3-railbar" aria-label="Exploration states">
        {DESIGN_STATES.map((s) => (
          <button key={s} class={s === rail.state ? 'is-active' : ''} onClick={() => rail.setState(s)}>
            {s}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---- console module chrome ---- */

function Module({
  cmd,
  live = false,
  children,
  flush = false,
}: {
  cmd: string;
  live?: boolean;
  children: ComponentChildren;
  flush?: boolean;
}) {
  return (
    <section class={`v3-mod${flush ? ' is-flush' : ''}`}>
      <p class={`v3-cmd${live ? ' is-live' : ''}`}>&gt; {cmd}</p>
      {children}
    </section>
  );
}

/* ================= Sticky telemetry sidebar ================= */

function Sidebar({ state, frame }: { state: DesignState; frame: Progress | null }) {
  const { report, result } = fixture;
  return (
    <aside class="v3-side">
      <div class="v3-side-in">
        <p class="v3-side-h">Telemetry</p>

        {state === 'idle' ? (
          <dl class="v3-kv">
            <div>
              <dt>geometry</dt>
              <dd>DRACO</dd>
            </div>
            <div>
              <dt>textures</dt>
              <dd>WebP</dd>
            </div>
            <div>
              <dt>pipeline</dt>
              <dd>web worker</dd>
            </div>
            <div>
              <dt>uploads</dt>
              <dd>0 · asserted</dd>
            </div>
            <div>
              <dt>typical delta</dt>
              <dd>−55%</dd>
            </div>
          </dl>
        ) : (
          <dl class="v3-kv">
            <div>
              <dt>model</dt>
              <dd>{report.fileName}</dd>
            </div>
            <div>
              <dt>size</dt>
              <dd>{formatBytes(report.byteLength)}</dd>
            </div>
            <div>
              <dt>vertices</dt>
              <dd>{int.format(report.meshStats.vertexCount)}</dd>
            </div>
            <div>
              <dt>primitives</dt>
              <dd>{int.format(report.meshStats.primitiveCount)}</dd>
            </div>
            <div>
              <dt>textures</dt>
              <dd>{report.textures.length}</dd>
            </div>
            <div>
              <dt>geometry</dt>
              <dd>{report.meshStats.hasDraco ? 'DRACO' : 'uncompressed'}</dd>
            </div>
            <div>
              <dt>animation</dt>
              <dd>{report.features.hasAnimation ? 'yes' : '—'}</dd>
            </div>
            <div>
              <dt>flags</dt>
              <dd>{report.warnings.length === 0 ? 'none' : report.warnings.length}</dd>
            </div>
          </dl>
        )}

        {state === 'run' && (
          <>
            <p class="v3-side-h is-live">In flight</p>
            <dl class="v3-kv">
              <div>
                <dt>preset</dt>
                <dd>balanced</dd>
              </div>
              <div>
                <dt>phase</dt>
                <dd>{frame?.phase ?? '—'}</dd>
              </div>
              <div>
                <dt>step</dt>
                <dd>{frame ? `${frame.done}/${frame.total}` : '—'}</dd>
              </div>
            </dl>
          </>
        )}

        {state === 'done' && (
          <>
            <p class="v3-side-h is-live">Result</p>
            <dl class="v3-kv">
              <div>
                <dt>out</dt>
                <dd>{formatBytes(result.outputByteLength)}</dd>
              </div>
              <div>
                <dt>delta</dt>
                <dd>−{((1 - result.outputByteLength / result.inputByteLength) * 100).toFixed(1)}%</dd>
              </div>
              <div>
                <dt>webp</dt>
                <dd>24/24</dd>
              </div>
            </dl>
          </>
        )}
      </div>
    </aside>
  );
}

/* ================= IDLE — intake ================= */

function IdleConsole() {
  return (
    <>
      <Module cmd="slipstream — glTF/GLB optimizer for the web">
        <h1 class="v3-title">Heavy model in. Web-ready model out.</h1>
        <p class="v3-body">
          Textures re-encoded to WebP, geometry compressed with DRACO, repacked as one GLB — in a
          worker, in this tab, never uploaded.
        </p>
      </Module>

      <Module cmd="awaiting model" live>
        <div class="v3-drop">
          <p class="big">Drop your .glb here</p>
          <p class="small">or a self-contained .gltf · anywhere on this column</p>
        </div>
        <p class="v3-demo">
          No model handy? <span class="u">run demo — NASA&apos;s Perseverance rover</span>
        </p>
      </Module>

      <Module cmd="pipeline">
        <ol class="v3-steps">
          <li>
            <span class="n">01</span> analyze — report every mesh and texture
          </li>
          <li>
            <span class="n">02</span> optimize — WebP + DRACO, per-texture overrides
          </li>
          <li>
            <span class="n">03</span> download — one optimized GLB back to disk
          </li>
        </ol>
      </Module>
    </>
  );
}

/* ================= LOADED — garage ================= */

function LoadedConsole() {
  const { report } = fixture;
  const verts = useCountUp(report.meshStats.vertexCount);

  return (
    <>
      <Module cmd={`analyze ${report.fileName}`} live>
        <div class="v3-instruments">
          <div>
            <p class="fig">{int.format(Math.round(verts))}</p>
            <p class="lab">vertices</p>
          </div>
          <div>
            <p class="fig">{int.format(report.meshStats.primitiveCount)}</p>
            <p class="lab">primitives</p>
          </div>
          <div>
            <p class="fig">{int.format(report.textures.length)}</p>
            <p class="lab">textures</p>
          </div>
          <div>
            <p class="fig">{formatBytes(report.byteLength)}</p>
            <p class="lab">on disk</p>
          </div>
        </div>
        {report.warnings.length === 0 ? (
          <p class="v3-scan">scan clean · 0 flags</p>
        ) : (
          report.warnings.map((w) => (
            <p key={w} class="v3-flag">
              {w}
            </p>
          ))
        )}
      </Module>

      <Module cmd="preset">
        <div class="v3-preset" role="group" aria-label="Quality preset">
          <button type="button">
            maximum<span>lossless-leaning</span>
          </button>
          <button type="button" class="is-active">
            balanced<span>the default</span>
          </button>
          <button type="button">
            aggressive<span>smallest files</span>
          </button>
        </div>
      </Module>

      <Module cmd="textures — balanced plan · overrides inline" flush>
        <ConsoleSheet textures={report.textures} />
      </Module>

      <Module cmd="ready">
        <button class="v3-cta" type="button">
          Optimize
        </button>
      </Module>
    </>
  );
}

function ConsoleSheet({ textures }: { textures: TextureInfo[] }) {
  return (
    <div class="v3-tt">
      <table>
        <thead>
          <tr>
            <th aria-label="Row" />
            <th>texture</th>
            <th>dims</th>
            <th>weight</th>
            <th>plan</th>
            <th>overrides</th>
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

/* ================= RUN — session ================= */

const PHASES = ['textures', 'geometry', 'writing'] as const;
const SECTORS: Array<{ phase: Progress['phase']; name: string; detail: string }> = [
  { phase: 'textures', name: 'S1 textures', detail: 'WebP re-encode' },
  { phase: 'geometry', name: 'S2 geometry', detail: 'DRACO compression' },
  { phase: 'writing', name: 'S3 write', detail: 'GLB repack' },
];

function RunConsole({ frame, onReplay }: { frame: Progress | null; onReplay: () => void }) {
  const current = frame ? PHASES.indexOf(frame.phase) : -1;
  const index = frame ? fixture.progressLog.indexOf(frame) : -1;
  const feed = fixture.progressLog
    .slice(0, index + 1)
    .filter((f) => f.label)
    .slice(-8)
    .reverse();

  return (
    <>
      <Module cmd="optimize perseverance.glb --preset balanced" live>
        <div class="v3-jobs" role="status" aria-label="Optimizing">
          {SECTORS.map((sector, i) => {
            const done = i < current || (i === current && frame !== null && frame.done === frame.total);
            const isLive = i === current && !done;
            const fraction =
              i < current ? 1 : i > current ? 0 : frame && frame.total > 0 ? frame.done / frame.total : 0;
            return (
              <div key={sector.phase} class={`v3-job${isLive ? ' is-live' : ''}${done ? ' is-done' : ''}`}>
                <span class="name">{sector.name}</span>
                <span class="bar" aria-hidden="true">
                  <i style={{ width: `${fraction * 100}%` }} />
                </span>
                <span class="count">
                  {i === current && frame ? `${frame.done}/${frame.total}` : i < current || done ? 'done' : 'queued'}
                </span>
                <span class="detail">{sector.detail}</span>
              </div>
            );
          })}
        </div>
      </Module>

      <Module cmd="stdout" live>
        <ul class="v3-log">
          {feed.map((f, i) => (
            <li key={`${f.label}-${i}`}>
              &gt; {f.phase === 'textures' ? 'S1' : f.phase === 'geometry' ? 'S2' : 'S3'} {f.label} ·{' '}
              {f.done}/{f.total}
            </li>
          ))}
        </ul>
      </Module>

      <Module cmd="controls">
        <button class="v3-ghost" type="button" onClick={onReplay}>
          ↻ replay run
        </button>
      </Module>
    </>
  );
}

/* ================= DONE — result ================= */

function DoneConsole() {
  const { result, report } = fixture;
  const savings = (1 - result.outputByteLength / result.inputByteLength) * 100;
  const delta = useCountUp(savings, 800);
  const byId = new Map(report.textures.map((t) => [t.id, t]));
  const gains = [...result.perTexture]
    .sort((a, b) => b.before - b.after - (a.before - a.after))
    .slice(0, 5);

  return (
    <>
      <Module cmd="result" live>
        <p class="v3-delta">−{delta.toFixed(1)}%</p>
        <p class="v3-sizes">
          {formatBytes(result.inputByteLength)} → {formatBytes(result.outputByteLength)} · geometry
          DRACO&apos;d · 24/24 textures WebP · shape preserved
        </p>
      </Module>

      <Module cmd="breakdown">
        <BreakdownRow label="geometry" before={result.breakdown.geometryBefore} after={result.breakdown.geometryAfter} />
        <BreakdownRow label="textures" before={result.breakdown.texturesBefore} after={result.breakdown.texturesAfter} />
        <ul class="v3-gains">
          {gains.map((g) => (
            <li key={g.id}>
              <span>{byId.get(g.id)?.name ?? g.id}</span>
              <span class="g">−{formatBytes(g.before - g.after)}</span>
            </li>
          ))}
        </ul>
      </Module>

      <Module cmd="compare — drag the divider" flush>
        <Wipe originalSrc={DEMO} optimizedSrc={DEMO} />
      </Module>

      <Module cmd="download">
        <div class="v3-actions">
          <button class="v3-cta" type="button">
            Download perseverance.optimized.glb · {formatBytes(result.outputByteLength)}
          </button>
          <button class="v3-ghost" type="button">
            load another model
          </button>
        </div>
      </Module>
    </>
  );
}

// Truthful bars: on this model textures GROW (lossless normal maps cost more
// as WebP) — the bar clamps at full and the figures tell the real story.
function BreakdownRow({ label, before, after }: { label: string; before: number; after: number }) {
  const grew = after > before;
  return (
    <div class="v3-break">
      <span class="lab">{label}</span>
      <span class="bar" aria-hidden="true">
        <i style={{ width: `${Math.min(100, (after / before) * 100)}%` }} />
      </span>
      <span class="fig">
        {formatBytes(before)} → {formatBytes(after)}
        <span class={grew ? 'worse' : 'better'}>
          {grew ? ` +${formatBytes(after - before)}` : ` −${formatBytes(before - after)}`}
        </span>
      </span>
    </div>
  );
}

/* ================= Below the fold ================= */

function Fold() {
  return (
    <>
      <Module cmd="man how-it-works">
        <h3 class="v3-h3">Three sectors, one worker.</h3>
        <p class="v3-body">
          Your model is decoded and analyzed in a Web Worker, textures are re-encoded to WebP,
          geometry is compressed with DRACO, and the result is repacked as a single GLB. The page
          never freezes; the pipeline never leaves the tab.
        </p>
        <p class="v3-fine">S1 textures → S2 geometry → S3 write</p>
      </Module>

      <Module cmd="man privacy">
        <h3 class="v3-h3">Nothing leaves your machine.</h3>
        <p class="v3-body">
          There is no upload path in this codebase — the file goes from your disk to an ArrayBuffer
          to a worker and back to a download. An automated end-to-end test asserts zero non-local
          requests during a full optimize run, on every build.
        </p>
        <p class="v3-fine">file → arraybuffer → worker → blob</p>
      </Module>

      <Module cmd="man credits">
        <h3 class="v3-h3">Honest machinery.</h3>
        <p class="v3-body">
          Demo model: Perseverance rover by NASA/JPL-Caltech, public domain (CC0). Code is MIT and
          open source. Built with gltf-transform, DRACO and jSquash — optimized in code, finished by
          hand where it shows.
        </p>
        <p class="v3-fine">NASA/JPL-Caltech · CC0 demo · MIT code</p>
      </Module>
    </>
  );
}
