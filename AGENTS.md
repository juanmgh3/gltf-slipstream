# AGENTS.md

Guidance for coding agents (and a fast orientation for humans) working on this repo.

## What this is

`gltf-slipstream` — a fully client-side, in-browser glTF/GLB optimizer (DRACO geometry
compression + WebP textures). Static Astro site, one Preact island, one Web Worker.
No server, no backend, no upload path — ever.

## Commands

```sh
npm install            # postinstall copies DRACO wasm into public/{draco,mv-draco}
npm run dev            # Astro dev server on http://localhost:4321
npm run typecheck      # tsc --noEmit (strict)
npm run lint           # eslint .
npm test               # vitest (unit, runs in Node)
npx playwright test    # e2e (chromium; starts the dev server itself)
npm run build          # astro build
```

The full gate before calling anything done: **typecheck + lint + vitest + playwright + build**.
Playwright e2e captures optimized GLBs into `.artifacts/`; `test/readback.test.ts` then
re-reads those browser-produced bytes under Node — run e2e before vitest if you need
the read-back cases to be non-skipped.

## Layout

```
src/optimizer/    framework-agnostic core (pure TS over gltf-transform Documents)
  validate.ts       parse boundary — magic bytes/structure, user-facing messages
  analyze.ts        model report: stats, texture roles, features, warnings
  roles.ts          texture roles derived from material slot bindings
  defaults.ts       per-role WebP plans, presets, DRACO options, planForTexture()
  textures.ts       decode → Lanczos3 downscale → WebP encode (jSquash)
  optimize.ts       pipeline: textures → weld/dedup/prune (conservative) → gated DRACO
src/worker/       Comlink worker exposing analyze/optimize; owns WebIO + wasm init
src/island/       Preact island (state machine, dropzone, report, run, results, compare)
src/pages/        the single Astro page; layout in src/layouts/
slipstream-brand-kit/  design tokens + fonts + logos (source of truth for all styling)
test/             vitest: unit tests + in-memory NodeIO fixtures (no committed binaries)
e2e/              Playwright: full flows in a real browser, network privacy assertions
```

## Hard rules

1. **Privacy is architectural.** Never add a code path that sends a user's model off
   their machine. `e2e/load-path.spec.ts` and `e2e/demo.spec.ts` assert zero non-local
   requests during runs — keep those assertions honest.
2. **Fidelity contract.** No decimation, no dropped maps, no silent vertex-data
   rewrites. `prune()` stays on its conservative options; DRACO stays gated off for
   skinned/morphed models. `test/readback.test.ts` enforces this over real artifacts.
3. **Design tokens only.** Every color in `src/` goes through a `var(--ss-*)` token
   from `slipstream-brand-kit/` — `test/design/no-raw-colors.test.ts` fails on literals.
   Amber (`--ss-accent`) marks live/active things only, never large fills; fills pair
   with `--ss-accent-ink`.
4. **Licensed fonts.** Clash Display (ITF FFL) is not redistributable: Fontshare CDN
   only, never bundle a woff2. Azeret Mono (OFL) is the only self-hosted font.
5. **Demo assets** must be CC0 or CC-BY with attribution recorded in
   `public/demo/ATTRIBUTION.md`.

## Conventions

- Strict TypeScript; Preact via `@astrojs/preact` (`jsxImportSource: preact`).
- Conventional commits (`feat(scope): …`), English, sole authorship, no trailers.
- Comments state constraints and rationale ("why"), not narration of changes.
- Validate at boundaries only (file input, parse) — no defensive code for states the
  state machine can't reach.
- Unit tests run under Node with structurally-real in-memory fixtures
  (`test/fixtures/generate.ts`); nothing binary is committed. Byte-level truths are
  proven in e2e against a real browser build.
