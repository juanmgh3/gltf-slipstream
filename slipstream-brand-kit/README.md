# Slipstream — Brand Kit (raw basics)

Solo lo esencial: tokens, fuentes y logos. Sin componentes, sin frontend.

## Estructura
```
styles.css              → entrada, hace @import de los 4 tokens
tokens/
  fonts.css             → @font-face + @import de las fuentes remotas
  colors.css            → color tokens (dark-first + light)
  typography.css        → familias, pesos, escala fluida, tracking
  spacing.css           → espaciado 8px, radios, layout
assets/
  fonts/                → Azeret Mono (woff2 variable, self-hosted)
  logo/                 → icono + lettering (dark / light, SVG)
```

## Fuentes
- **Clash Display** (display) — ITF FFL, closed-source, NO redistribuible.
  Se carga SOLO por CDN de Fontshare (ya está el `@import` en `tokens/fonts.css`).
  No hay woff2 en el kit a propósito.
- **Mona Sans** (body/UI) — se carga por Google Fonts (`@import` en `tokens/fonts.css`).
- **Azeret Mono** (mono) — OFL, self-hosted en `assets/fonts/`.

## Uso
Enlaza `styles.css` y consume las variables `--ss-*`. Nada más.
