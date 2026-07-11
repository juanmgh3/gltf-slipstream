# Slipstream — Brand Kit (raw basics)

Just the essentials: tokens, fonts and logos. No components, no frontend.

## Structure
```
styles.css              → entry point, @imports the 4 token files
tokens/
  fonts.css             → @font-face + @import for the remote fonts
  colors.css            → color tokens (dark-first + light)
  typography.css        → families, weights, fluid scale, tracking
  spacing.css           → 8px spacing, radii, layout
assets/
  fonts/                → Azeret Mono (variable woff2, self-hosted)
  logo/                 → icon + lettering (dark / light, SVG)
```

## Fonts
- **Clash Display** (display) — ITF FFL, closed-source, NOT redistributable.
  Loaded ONLY via the Fontshare CDN (the `@import` in `tokens/fonts.css`).
  There is deliberately no woff2 for it in the kit.
- **Mona Sans** (body/UI) — loaded via Google Fonts (`@import` in `tokens/fonts.css`).
- **Azeret Mono** (mono) — OFL, self-hosted in `assets/fonts/`.

## Usage
Link `styles.css` and consume the `--ss-*` variables. Nothing else.
