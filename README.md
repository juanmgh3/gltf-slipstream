<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="slipstream-brand-kit/assets/logo/slipstream-lettering-dark.svg">
    <img src="slipstream-brand-kit/assets/logo/slipstream-lettering-light.svg" alt="Slipstream" width="260">
  </picture>
</p>

<p align="center"><strong>Lighter models. Same shape.</strong><br>
An in-browser glTF/GLB optimizer — DRACO geometry compression and WebP textures,
processed entirely on your machine.</p>

---

Drop a `.glb` (or fully-embedded `.gltf`) into the page and Slipstream analyzes it,
re-encodes every texture to WebP, compresses the geometry with DRACO, and hands you
back a smaller GLB — all inside a Web Worker in your browser tab. There is no
server, no upload, no account.

## Privacy is architectural

Your model never leaves your machine: file → `ArrayBuffer` → Web Worker → download
blob. This codebase has no upload path, and the end-to-end suite asserts **zero
non-local network requests during a full optimize run** on every build. All wasm
(DRACO encoder/decoder, image codecs) is served from the app's own origin.

## What it does

- **Analysis report** — vertex/primitive/texture counts, per-texture roles derived
  from how materials actually bind them (baseColor, normal, metallic-roughness,
  occlusion, emissive), and feature detection: animation, skinning, morph targets.
- **Textures → WebP** — real libwebp (via [jSquash](https://github.com/jamsinclair/jSquash)),
  with per-role fidelity defaults: color maps (sRGB) go lossy at high quality; data
  maps (normals, metallic-roughness, occlusion — linear) stay **lossless** unless you
  explicitly opt into the aggressive preset, because lossy WebP visibly corrupts
  normal data. Downscaling is Lanczos3 and never upscales.
- **Geometry → DRACO** — `KHR_draco_mesh_compression` with tuned quantization.
  Automatically **skipped** when the model has skinning or morph targets: DRACO
  doesn't cover morph deltas and its re-indexing risks joint corruption, so those
  models keep their geometry and still get the texture savings.
- **Presets + per-texture overrides** — maximum / balanced / aggressive globally;
  exclude, quality, and max-resolution per texture. The plan shown in the texture
  table is the exact plan the pipeline executes.
- **Before/after compare** — a slider-wipe stage over two synchronized
  `<model-viewer>` cameras, rendering the actual optimized bytes.
- **Honest numbers** — the results breakdown shows growth as well as savings; a
  category that got bigger says so in red, it is never hidden.

Try it with the bundled demo model: NASA/JPL-Caltech's Perseverance rover
(CC0, 213k vertices, 24 textures — see [`public/demo/ATTRIBUTION.md`](public/demo/ATTRIBUTION.md)).

## What it deliberately doesn't do

- No mesh decimation — vertex positions survive (within DRACO quantization);
  triangle counts are preserved. "Same shape" is the contract, and a read-back
  test suite holds the optimizer to it.
- KTX2/Basis textures are kept as-is, not re-encoded.
- Files referencing external `.bin`/image resources are rejected with a clear
  message — a client-side tool can't fetch them, and guessing would be worse.

## Stack

[Astro](https://astro.build) shell with a single [Preact](https://preactjs.com)
island; the optimizer core is framework-agnostic TypeScript on
[glTF Transform](https://gltf-transform.dev), running in a Web Worker via
[Comlink](https://github.com/GoogleChromeLabs/comlink); [draco3d](https://github.com/google/draco)
and [jSquash](https://github.com/jamsinclair/jSquash) wasm, self-hosted;
[`<model-viewer>`](https://modelviewer.dev) for the compare stage.

## Development

```sh
npm install          # postinstall self-hosts the DRACO wasm into public/
npm run dev          # dev server on :4321
npm run typecheck && npm run lint && npm test    # strict TS · ESLint · vitest
npx playwright test  # e2e: full optimize runs in a real browser
npm run build
```

## License

Code is [MIT](LICENSE). The demo model is CC0 (NASA/JPL-Caltech). Fonts: Azeret Mono
(OFL) is self-hosted; Clash Display (ITF FFL) and Mona Sans load from their own CDNs
and are not redistributed in this repo.
