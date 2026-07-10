// V2 · Paddock editorial — exploration variant (throwaway, deleted at
// convergence). The page as a paddock magazine: a centred measure with real
// margins, dense data panels floating in editorial air, big Clash statements
// in words, asymmetric spreads, kickers hung in the margin column. All figures
// come from the captured Perseverance fixture — nothing invented.

import { useEffect, useState } from 'preact/hooks';
import { formatBytes, int } from '../../island/format';
import { planForTexture } from '../../optimizer/defaults';
import type { Progress, TextureInfo } from '../../optimizer/types';
import { fixture, useStateRail, DESIGN_STATES, type DesignState } from './_shared';
import { Wipe } from './_Wipe';
import './_v2.css';

interface V2Props {
  iconSrc: string;
  letteringSrc: string;
}

const DEMO = '/demo/perseverance.glb';

// Figures arrive, they don't dance — one ease-out, killed by reduced-motion.
function useCountUp(target: number, ms = 700): number {
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

const FOLIO: Record<DesignState, string> = {
  idle: 'Pre-session',
  loaded: 'Scrutineering',
  run: 'Live',
  done: 'Classification',
};

export function V2({ iconSrc, letteringSrc }: V2Props) {
  const rail = useStateRail();

  return (
    <div class="v2">
      <header class="v2-masthead">
        <div class="v2-masthead-in">
          <div class="v2-lockup">
            <img src={iconSrc} alt="" width="24" height="24" />
            <img src={letteringSrc} alt="Slipstream" width="104" height="26" />
          </div>
          <p class="v2-folio">
            Paddock edition · <span class={rail.state !== 'idle' ? 'is-live' : ''}>{FOLIO[rail.state]}</span>
          </p>
          <p class="v2-privacy">100% local · nothing leaves your machine</p>
        </div>
      </header>

      <main class="v2-wrap">
        {rail.state === 'idle' && <IdleSpread />}
        {rail.state === 'loaded' && <LoadedSpread />}
        {rail.state === 'run' && <RunSpread frame={rail.frame} onReplay={rail.replay} />}
        {rail.state === 'done' && <DoneSpread />}

        <Fold />
      </main>

      <footer class="v2-colophon">
        <div class="v2-colophon-in">
          <p>Free &amp; open source · MIT</p>
          <p>DRACO + WebP · entirely in your browser</p>
        </div>
      </footer>

      {/* exploration scaffolding, not part of the design under judgment */}
      <nav class="v2-railbar" aria-label="Exploration states">
        {DESIGN_STATES.map((s) => (
          <button key={s} class={s === rail.state ? 'is-active' : ''} onClick={() => rail.setState(s)}>
            {s}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---- shared editorial fragments (markup helpers, V2-only) ---- */

function Kicker({ children, live = false }: { children: string; live?: boolean }) {
  return <p class={`v2-k${live ? ' is-live' : ''}`}>{children}</p>;
}

/* ================= IDLE — the cover ================= */

function IdleSpread() {
  return (
    <section class="v2-spread v2-cover">
      <div class="v2-cover-lead">
        <Kicker>Scrutineering open</Kicker>
        <h1 class="v2-headline">
          Race weight,
          <br />
          for the web.
        </h1>
        <p class="v2-deck">
          Drop a <code>.glb</code> or self-contained <code>.gltf</code>. Slipstream re-encodes its
          textures to WebP, compresses the geometry with DRACO and hands the file back — all of it
          in this tab, none of it uploaded.
        </p>
        <p class="v2-demo-line">
          No model handy? <span class="u">Run NASA&apos;s Perseverance rover</span>
        </p>
      </div>

      <aside class="v2-cover-sheet">
        <div class="v2-panel v2-sheet">
          <p class="v2-sheet-title">Spec sheet</p>
          <dl>
            <div>
              <dt>Geometry</dt>
              <dd>DRACO compression</dd>
            </div>
            <div>
              <dt>Textures</dt>
              <dd>WebP re-encode</dd>
            </div>
            <div>
              <dt>Pipeline</dt>
              <dd>Web Worker, off-thread</dd>
            </div>
            <div>
              <dt>Uploads</dt>
              <dd>0 — verified on every build</dd>
            </div>
            <div>
              <dt>Typical delta</dt>
              <dd>−55% · 11.1 MB → 5.0 MB</dd>
            </div>
            <div>
              <dt>Licence</dt>
              <dd>MIT · demo CC0</dd>
            </div>
          </dl>
        </div>
        <p class="v2-margin-note">KHR_draco_mesh_compression · EXT_texture_webp</p>
      </aside>

      <div class="v2-dropstrip">
        <p class="v2-dropstrip-k">Drop zone</p>
        <p>Anywhere on this page · your file never leaves it</p>
      </div>
    </section>
  );
}

/* ================= LOADED — the garage feature ================= */

function LoadedSpread() {
  const { report } = fixture;
  const verts = useCountUp(report.meshStats.vertexCount);

  return (
    <section class="v2-spread v2-garage">
      <header class="v2-garage-head">
        <Kicker live>On the stand</Kicker>
        <h1 class="v2-headline v2-headline--file">{report.fileName}</h1>
        <p class="v2-deck">
          {formatBytes(report.byteLength)} as delivered ·{' '}
          {report.meshStats.hasDraco ? 'geometry already DRACO-compressed' : 'geometry uncompressed'} ·{' '}
          {report.warnings.length === 0 ? 'clean scan, no flags' : `${report.warnings.length} flags raised`}
        </p>
      </header>

      <div class="v2-panel v2-instruments">
        <div class="v2-instrument">
          <p class="v2-num">{int.format(Math.round(verts))}</p>
          <p class="v2-num-label">Vertices</p>
        </div>
        <div class="v2-instrument">
          <p class="v2-num">{int.format(report.meshStats.primitiveCount)}</p>
          <p class="v2-num-label">Primitives</p>
        </div>
        <div class="v2-instrument">
          <p class="v2-num">{int.format(report.textures.length)}</p>
          <p class="v2-num-label">Textures</p>
        </div>
        <div class="v2-instrument">
          <p class="v2-num">{formatBytes(report.byteLength)}</p>
          <p class="v2-num-label">On disk</p>
        </div>
      </div>

      <div class="v2-garage-body">
        <aside class="v2-garage-rail">
          <div class="v2-panel v2-modes">
            <p class="v2-panel-k">Quality preset</p>
            <button type="button">
              <span>Maximum</span> <span class="hint">lossless-leaning</span>
            </button>
            <button type="button" class="is-active">
              <span>Balanced</span> <span class="hint">the default</span>
            </button>
            <button type="button">
              <span>Aggressive</span> <span class="hint">smallest files</span>
            </button>
          </div>

          <div class="v2-panel v2-features">
            <p class="v2-panel-k">Setup notes</p>
            <ul>
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
            {fixture.report.warnings.map((w) => (
              <p key={w} class="v2-flag">
                {w}
              </p>
            ))}
          </div>

          <button class="v2-cta" type="button">
            Optimize
          </button>
          <p class="v2-margin-note">Per-texture overrides live in the sheet — exclude, quality, cap.</p>
        </aside>

        <div class="v2-panel v2-sheet-panel">
          <p class="v2-panel-k">Texture sheet · balanced plan</p>
          <TimingSheet textures={report.textures} />
        </div>
      </div>
    </section>
  );
}

function TimingSheet({ textures }: { textures: TextureInfo[] }) {
  return (
    <div class="v2-tt">
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
                {texture.name || `texture ${texture.id}`}
                <span class="tt-roles">{texture.roles.join(' · ')}</span>
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

/* ================= RUN — the live dispatch ================= */

const PHASES = ['textures', 'geometry', 'writing'] as const;
const SECTORS: Array<{ phase: Progress['phase']; name: string; detail: string }> = [
  { phase: 'textures', name: 'S1 · Textures', detail: 'WebP re-encode' },
  { phase: 'geometry', name: 'S2 · Geometry', detail: 'DRACO compression' },
  { phase: 'writing', name: 'S3 · Write', detail: 'GLB repack' },
];

function RunSpread({ frame, onReplay }: { frame: Progress | null; onReplay: () => void }) {
  const current = frame ? PHASES.indexOf(frame.phase) : -1;
  const index = frame ? fixture.progressLog.indexOf(frame) : -1;
  const feed = fixture.progressLog
    .slice(0, index + 1)
    .filter((f) => f.label)
    .slice(-9)
    .reverse();

  return (
    <section class="v2-spread v2-live">
      <header class="v2-live-head">
        <Kicker live>Session running</Kicker>
        <h1 class="v2-headline">
          Three sectors,
          <br />
          flat out.
        </h1>
      </header>

      <div class="v2-sectors">
        {SECTORS.map((sector, i) => {
          const done = i < current || (i === current && frame !== null && frame.done === frame.total);
          const isLive = i === current && !done;
          const fraction = i < current ? 1 : i > current ? 0 : frame && frame.total > 0 ? frame.done / frame.total : 0;
          return (
            <div key={sector.phase} class={`v2-panel v2-sector${isLive ? ' is-live' : ''}${done ? ' is-done' : ''}`}>
              <p class="v2-panel-k">{sector.name}</p>
              <p class="v2-num">
                {i === current && frame ? `${frame.done}/${frame.total}` : i < current || done ? 'done' : '—'}
              </p>
              <div class="bar" aria-hidden="true">
                <i style={{ width: `${fraction * 100}%` }} />
              </div>
              <p class="v2-num-label">{sector.detail}</p>
            </div>
          );
        })}
      </div>

      <div class="v2-live-body">
        <div class="v2-panel v2-dispatch" role="status" aria-label="Optimizing">
          <p class="v2-panel-k is-live">Dispatch</p>
          <ul>
            {feed.map((f, i) => (
              <li key={`${f.label}-${i}`}>
                <span class="s">{f.phase === 'textures' ? 'S1' : f.phase === 'geometry' ? 'S2' : 'S3'}</span>
                {f.label} · {f.done}/{f.total}
              </li>
            ))}
          </ul>
        </div>
        <aside class="v2-live-meta">
          <p class="v2-margin-note">perseverance.glb · balanced preset · 24 textures</p>
          <button class="v2-ghost" type="button" onClick={onReplay}>
            ↻ Replay
          </button>
        </aside>
      </div>
    </section>
  );
}

/* ================= DONE — the classification ================= */

function DoneSpread() {
  const { result, report } = fixture;
  const savings = (1 - result.outputByteLength / result.inputByteLength) * 100;
  const delta = useCountUp(savings, 800);
  const byId = new Map(report.textures.map((t) => [t.id, t]));
  const gains = [...result.perTexture]
    .sort((a, b) => b.before - b.after - (a.before - a.after))
    .slice(0, 5);

  return (
    <section class="v2-spread v2-result">
      <div class="v2-result-lead">
        <Kicker live>Session result</Kicker>
        <p class="v2-delta">−{delta.toFixed(1)}%</p>
        <h1 class="v2-headline v2-headline--sub">Lighter where it counts.</h1>
        <p class="v2-deck">
          {formatBytes(result.inputByteLength)} in, {formatBytes(result.outputByteLength)} out — geometry
          DRACO&apos;d, all 24 textures re-encoded to WebP, shape preserved.
        </p>
      </div>

      <aside class="v2-result-figures">
        <BreakdownPanel
          label="Geometry"
          before={result.breakdown.geometryBefore}
          after={result.breakdown.geometryAfter}
        />
        <BreakdownPanel
          label="Textures"
          before={result.breakdown.texturesBefore}
          after={result.breakdown.texturesAfter}
        />
        <div class="v2-panel v2-gains">
          <p class="v2-panel-k">Top gains</p>
          <ul>
            {gains.map((g) => (
              <li key={g.id}>
                <span>{byId.get(g.id)?.name ?? g.id}</span>
                <span class="g">−{formatBytes(g.before - g.after)}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div class="v2-stage">
        <Wipe originalSrc={DEMO} optimizedSrc={DEMO} />
      </div>

      <div class="v2-result-actions">
        <button class="v2-cta" type="button">
          Download perseverance.optimized.glb · {formatBytes(result.outputByteLength)}
        </button>
        <button class="v2-ghost" type="button">
          Load another model
        </button>
      </div>
    </section>
  );
}

// Truthful bars: on this model textures GROW (lossless normal maps cost more
// as WebP) — the bar clamps at full and the figures tell the real story.
function BreakdownPanel({ label, before, after }: { label: string; before: number; after: number }) {
  const grew = after > before;
  return (
    <div class="v2-panel v2-break">
      <p class="v2-panel-k">{label}</p>
      <div class="bar" aria-hidden="true">
        <i style={{ width: `${Math.min(100, (after / before) * 100)}%` }} />
      </div>
      <p class="v2-break-fig">
        {formatBytes(before)} → {formatBytes(after)}
        <span class={grew ? 'worse' : 'better'}>
          {grew ? ` +${formatBytes(after - before)}` : ` −${formatBytes(before - after)}`}
        </span>
      </p>
    </div>
  );
}

/* ================= Below the fold — paddock notes ================= */

function Fold() {
  return (
    <section class="v2-fold">
      <article class="v2-note">
        <div class="v2-note-margin">
          <Kicker>How it works</Kicker>
        </div>
        <div class="v2-note-body">
          <h3>Three sectors, one worker.</h3>
          <p>
            Your model is decoded and analyzed in a Web Worker, textures are re-encoded to WebP,
            geometry is compressed with DRACO, and the result is repacked as a single GLB. The page
            never freezes; the pipeline never leaves the tab.
          </p>
          <p class="mono">S1 textures → S2 geometry → S3 write</p>
        </div>
      </article>

      <article class="v2-note">
        <div class="v2-note-margin">
          <Kicker>Privacy</Kicker>
        </div>
        <div class="v2-note-body">
          <h3>Nothing leaves your machine.</h3>
          <p>
            There is no upload path in this codebase — the file goes from your disk to an
            ArrayBuffer to a worker and back to a download. An automated end-to-end test asserts
            zero non-local requests during a full optimize run, on every build.
          </p>
          <p class="mono">file → arraybuffer → worker → blob</p>
        </div>
      </article>

      <article class="v2-note">
        <div class="v2-note-margin">
          <Kicker>Credits</Kicker>
        </div>
        <div class="v2-note-body">
          <h3>Honest machinery.</h3>
          <p>
            Demo model: Perseverance rover by NASA/JPL-Caltech, public domain (CC0). Code is MIT and
            open source. Built with gltf-transform, DRACO and jSquash — optimized in code, finished
            by hand where it shows.
          </p>
          <p class="mono">NASA/JPL-Caltech · CC0 demo · MIT code</p>
        </div>
      </article>
    </section>
  );
}
