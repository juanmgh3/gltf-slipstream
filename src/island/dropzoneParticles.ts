// The idle dropzone's mark: the Slipstream icon as a depth-graded particle
// swarm — emerge-from-depth entrance, cursor repel, click ripples with echoes.
// Tuned in the throwaway lab (public/particles-lab.html) and frozen here as
// the hand-tuned config. All forces/spacings are absolute px so
// the tuned feel survives any mark size; colors are SAMPLED from the icon SVG
// itself, so the guard's "kit tokens only" rule holds with no literals here.

const CFG = {
  step: 5,
  size: 2.1,
  sizeVar: 0.35,
  depth: 0.8,
  float: 0.35,
  parallax: 1,
  radius: 65,
  force: 11,
  clickRadius: 230,
  clickForce: 6,
  waveSpeed: 340,
  stiffness: 0.065,
  damping: 0.72,
  stretch: 0.9,
  emergeMs: 900,
} as const;

interface Particle {
  hx: number;
  hy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  phase: number;
  delay: number;
  s: number;
  r: number;
  g: number;
  b: number;
}

interface Wave {
  x: number;
  y: number;
  t0: number;
  gain: number;
  ringR: number;
}

/**
 * Mounts the swarm. `canvas` covers the whole zone (so ripples have room);
 * `anchor` is the in-flow spacer whose box centers and sizes the mark.
 * Pointer listeners attach to `zone` — the canvas stays pointer-blind.
 * Returns a cleanup that stops the loop and detaches everything.
 */
export function mountDropzoneParticles(
  zone: HTMLElement,
  canvas: HTMLCanvasElement,
  anchor: HTMLElement,
  iconUrl: string,
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  let particles: Particle[] = [];
  let waves: Wave[] = [];
  const mouse = { x: -1e4, y: -1e4 };
  const par = { x: 0, y: 0 };
  let dpr = 1;
  let raf = 0;
  let buildAt = 0;
  let disposed = false;

  const img = new Image();

  function build() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = w * dpr;
    canvas.height = h * dpr;

    // Mark box = the anchor's square, measured in canvas space.
    const a = anchor.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const target = Math.floor(Math.min(a.width, a.height));
    const ox = a.left - c.left + (a.width - target) / 2;
    const oy = a.top - c.top + (a.height - target) / 2;

    const off = document.createElement('canvas');
    off.width = off.height = target;
    const octx = off.getContext('2d', { willReadFrequently: true });
    if (!octx) return;
    octx.drawImage(img, 0, 0, target, target);
    const data = octx.getImageData(0, 0, target, target).data;

    particles = [];
    for (let y = 0; y < target; y += CFG.step) {
      for (let x = 0; x < target; x += CFG.step) {
        const i = (y * target + x) * 4;
        if (data[i + 3] > 128) {
          const hx = ox + x;
          const hy = oy + y;
          particles.push({
            hx,
            hy,
            x: hx,
            y: hy,
            vx: 0,
            vy: 0,
            z: Math.random(),
            phase: Math.random() * Math.PI * 2,
            delay: Math.random() * 0.55,
            s: 1 - CFG.sizeVar / 2 + Math.random() * CFG.sizeVar,
            r: data[i],
            g: data[i + 1],
            b: data[i + 2],
          });
        }
      }
    }
    buildAt = performance.now();
  }

  function tick(now: number) {
    if (disposed) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, w, h);
    const t = now / 1000;

    const onStage = mouse.x > -1e3;
    const tx = onStage ? Math.max(-1, Math.min(1, (mouse.x - w / 2) / (w / 2))) : 0;
    const ty = onStage ? Math.max(-1, Math.min(1, (mouse.y - h / 2) / (h / 2))) : 0;
    par.x += (tx - par.x) * 0.05;
    par.y += (ty - par.y) * 0.05;

    const alive: Wave[] = [];
    for (const wv of waves) {
      wv.ringR = ((now - wv.t0) / 1000) * CFG.waveSpeed;
      if (wv.ringR < CFG.clickRadius + 80) alive.push(wv);
    }
    waves = alive;
    const band = Math.max(26, CFG.clickRadius * 0.16);

    for (const p of particles) {
      const zc = p.z - 0.5;
      const amp = CFG.float * (2.2 + p.z * 4.5);
      const gx = p.hx + Math.sin(t * 0.7 + p.phase) * amp + par.x * CFG.parallax * zc * 2;
      const gy = p.hy + Math.cos(t * 0.55 + p.phase * 1.7) * amp + par.y * CFG.parallax * zc * 2;

      const dxm = p.x - mouse.x;
      const dym = p.y - mouse.y;
      const d2 = dxm * dxm + dym * dym;
      if (d2 < CFG.radius * CFG.radius && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (1 - d / CFG.radius) * CFG.force * (0.55 + p.z * 0.9);
        p.vx += (dxm / d) * push;
        p.vy += (dym / d) * push;
      }
      for (const wv of waves) {
        const dx = p.x - wv.x;
        const dy = p.y - wv.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.01) continue;
        const fall = (d - wv.ringR) / band;
        const hit = Math.exp(-fall * fall) * (1 - wv.ringR / (CFG.clickRadius + 80));
        if (hit > 0.01) {
          const kick = hit * CFG.clickForce * wv.gain * (0.6 + p.z * 0.8) * 0.35;
          p.vx += (dx / d) * kick;
          p.vy += (dy / d) * kick;
        }
      }
      p.vx += (gx - p.x) * CFG.stiffness;
      p.vy += (gy - p.y) * CFG.stiffness;
      p.vx *= CFG.damping;
      p.vy *= CFG.damping;
      p.x += p.vx;
      p.y += p.vy;

      let emerge = 1;
      const raw = (now - buildAt) / CFG.emergeMs - p.delay;
      if (raw < 0.45) {
        const c = Math.max(0, Math.min(1, raw / 0.45));
        emerge = c * c * (3 - 2 * c);
        if (emerge < 0.02) continue;
      }
      const size = CFG.size * p.s * (1 + zc * CFG.depth * 1.1) * (0.35 + 0.65 * emerge);
      ctx!.globalAlpha = (1 - (1 - p.z) * CFG.depth * 0.62) * emerge;
      ctx!.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      const speed = Math.hypot(p.vx, p.vy);
      if (CFG.stretch > 0 && speed > 1.5) {
        ctx!.beginPath();
        ctx!.ellipse(
          p.x,
          p.y,
          size + Math.min(10, speed * CFG.stretch),
          size,
          Math.atan2(p.vy, p.vx),
          0,
          6.2832,
        );
        ctx!.fill();
      } else {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, size, 0, 6.2832);
        ctx!.fill();
      }
    }
    ctx!.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  }

  const toCanvas = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onMove = (e: PointerEvent) => {
    const p = toCanvas(e);
    mouse.x = p.x;
    mouse.y = p.y;
  };
  const onLeave = () => {
    mouse.x = -1e4;
    mouse.y = -1e4;
  };
  const onDown = (e: PointerEvent) => {
    const p = toCanvas(e);
    const t0 = performance.now();
    waves.push(
      { x: p.x, y: p.y, t0, gain: 1, ringR: 0 },
      { x: p.x, y: p.y, t0: t0 + 150, gain: 0.45, ringR: 0 },
      { x: p.x, y: p.y, t0: t0 + 320, gain: 0.2, ringR: 0 },
    );
  };

  zone.addEventListener('pointermove', onMove);
  zone.addEventListener('pointerleave', onLeave);
  zone.addEventListener('pointerdown', onDown);
  const ro = new ResizeObserver(() => {
    if (img.complete && img.naturalWidth > 0) build();
  });
  ro.observe(canvas);

  img.onload = () => {
    if (disposed) return;
    build();
    raf = requestAnimationFrame(tick);
  };
  img.src = iconUrl;

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    zone.removeEventListener('pointermove', onMove);
    zone.removeEventListener('pointerleave', onLeave);
    zone.removeEventListener('pointerdown', onDown);
  };
}
