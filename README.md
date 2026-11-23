# Color Shade Tinter

Generate tints and shades of any hex color as a full palette with export options. A practical color scale utility for designers and developers.

**Live:** [color-shade-tinter.itsjust.tools](https://color-shade-tinter.itsjust.tools)

## Features

- Accept hex (`#ff0000`, `f00`), rgb (`rgb(255, 0, 0)`, `255,0,0`) or HSL (`hsl(0, 100%, 50%)`) input
- 10 tints (lighter) and 10 shades (darker) with adjustable step count and linear/perceptual scale curve
- Swatches show hex, rgb and hsl values with click-to-copy and copy history
- Adjustable step count (1–20) and scale curve (linear / quadratic)
- Export the palette as CSS variables, JSON or a Tailwind config
- Random color generator button (`R`)
- WCAG contrast labels (AAA/AA/AA Large/Fail vs white and black) per swatch
- Keyboard shortcut `C` copies the base color hex
- Shareable state via URL, `.itsjust.json` import/export and image/PDF export
- 100% client-side — no data ever leaves your browser

## Keyboard shortcuts

| Key | Action            |
| --- | ----------------- |
| `R` | Random base color |
| `C` | Copy base hex     |

## Development

```bash
npm install
npm run build -w @itsjust/core   # build shared core first
npm run dev
npm test
```

## Deployment

```bash
docker build -t itsjust-color-shade-tinter .
docker run -p 3000:3000 itsjust-color-shade-tinter
```

## License

MIT
