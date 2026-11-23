export type InputFormat = 'hex' | 'rgb' | 'hsl';

export type ScaleCurve = 'linear' | 'quadratic';

export interface HistoryEntry {
  /** Short human readable description of the copied color. */
  text: string;
  /** ISO timestamp when the entry was saved. */
  createdAt: string;
}

export interface ToolState {
  /** Input color string as typed by the user. */
  colorInput: string;
  /** Detected/last-parsed input format. */
  inputFormat: InputFormat;
  /** Number of tints (lighter steps). */
  tintCount: number;
  /** Number of shades (darker steps). */
  shadeCount: number;
  /** Distribution curve of the scale. */
  curve: ScaleCurve;
  /** Recently copied colors, newest first. */
  history: HistoryEntry[];
}

export const DEFAULT_STATE: ToolState = {
  colorInput: '#3b82f6',
  inputFormat: 'hex',
  tintCount: 10,
  shadeCount: 10,
  curve: 'linear',
  history: [],
};

export const MAX_HISTORY = 20;

export const MIN_STEPS = 1;
export const MAX_STEPS = 20;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface Swatch {
  /** Normalized 6-digit hex, lowercase, no leading '#'. */
  hex: string;
  rgb: Rgb;
  hsl: Hsl;
  /** Kind of swatch: base color, tint (lighter) or shade (darker). */
  kind: 'base' | 'tint' | 'shade';
  /** Steps away from the base color (0 for base). */
  step: number;
  /** WCAG contrast ratio against white (1–21). */
  contrastWhite: number;
  /** WCAG contrast ratio against black (1–21). */
  contrastBlack: number;
  /** Best label for text contrast on this swatch. */
  contrastLabel: 'AAA' | 'AA' | 'AA Large' | 'Fail';
}

/** Clamp a number into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Round to integer and clamp into 0–255. */
function channel8(value: number): number {
  return Math.round(clamp(value, 0, 255));
}

function twoDigit(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

/** Convert RGB (0–255 channels) to a lowercase 6-digit hex string without '#'. */
export function rgbToHex({ r, g, b }: Rgb): string {
  return `${twoDigit(r)}${twoDigit(g)}${twoDigit(b)}`;
}

/** sRGB channel (0–255) to linear light value. */
function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.x. */
export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);
}

/** WCAG contrast ratio between two colors (1–21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };

/** Label WCAG text contrast on a swatch (evaluated against white text). */
export function contrastLabel(rgb: Rgb): 'AAA' | 'AA' | 'AA Large' | 'Fail' {
  const ratio = contrastRatio(rgb, WHITE);
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
}

/** RGB (0–255) to HSL (h 0–360, s 0–100, l 0–100). */
export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      default:
        h = ((rn - gn) / d + 4) * 60;
    }
  }
  return { h: Math.round(h) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** HSL (h 0–360, s/l 0–100) to RGB (0–255 channels). */
export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  if (sn === 0) {
    const v = channel8(ln * 255);
    return { r: v, g: v, b: v };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hue = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: channel8(hue(hn + 1 / 3) * 255),
    g: channel8(hue(hn) * 255),
    b: channel8(hue(hn - 1 / 3) * 255),
  };
}

/** Parse a hex color string (#rgb, #rrggbb, 3/6 hex digits) into RGB; null when invalid. */
export function parseHex(input: string): Rgb | null {
  const t = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(t)) {
    const [r, g, b] = t.split('').map((c) => parseInt(c + c, 16));
    if (r === undefined || g === undefined || b === undefined) return null;
    return { r, g, b };
  }
  if (/^[0-9a-fA-F]{6}$/.test(t)) {
    const r = parseInt(t.slice(0, 2), 16);
    const g = parseInt(t.slice(2, 4), 16);
    const b = parseInt(t.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
    return { r, g, b };
  }
  return null;
}

/** Parse `rgb(...)` / `rgba(...)` / bare comma-separated channels; null when invalid. */
export function parseRgb(input: string): Rgb | null {
  const t = input
    .trim()
    .toLowerCase()
    .replace(/^rgba?\(\s*/, '')
    .replace(/\)$/, '');
  const parts = t.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const channels: number[] = [];
  for (let i = 0; i < 3; i++) {
    const part = parts[i];
    if (part === undefined) return null;
    const n = Number(part);
    if (!Number.isFinite(n)) return null;
    channels.push(n);
  }
  const [rc, gc, bc] = channels;
  if (rc === undefined || gc === undefined || bc === undefined) return null;
  return {
    r: channel8(rc),
    g: channel8(gc),
    b: channel8(bc),
  };
}

/** Parse `hsl(...)` / `hsla(...)` / bare comma-separated h s% l%; null when invalid. */
export function parseHsl(input: string): Hsl | null {
  const t = input
    .trim()
    .toLowerCase()
    .replace(/^hsla?\(\s*/, '')
    .replace(/\)$/, '');
  const parts = t.split(/[\s,]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const nums: number[] = [];
  for (let i = 0; i < 3; i++) {
    const part = parts[i];
    if (part === undefined) return null;
    const n = Number(part.replace(/%$/, ''));
    if (!Number.isFinite(n)) return null;
    nums.push(n);
  }
  const [hue, sat, light] = nums;
  if (hue === undefined || sat === undefined || light === undefined) return null;
  return { h: hue, s: clamp(sat, 0, 100), l: clamp(light, 0, 100) };
}

/** Detect which color syntax an input most likely uses. */
export function detectFormat(input: string): InputFormat {
  const t = input.trim().toLowerCase();
  if (t.startsWith('hsl')) return 'hsl';
  if (t.startsWith('rgb')) return 'rgb';
  return 'hex';
}

/**
 * Parse any supported color input (hex, rgb, hsl) into RGB, or null when invalid.
 * Also accepts a bare comma-separated rgb triple without the `rgb()` wrapper.
 */
export function parseColor(input: string): Rgb | null {
  const t = input.trim();
  if (!t) return null;
  const format = detectFormat(t);
  if (format === 'hsl') {
    const hsl = parseHsl(t);
    return hsl ? hslToRgb(hsl) : null;
  }
  if (format === 'rgb') {
    return parseRgb(t);
  }
  return parseHex(t);
}

/** Normalize any valid color input to a `#rrggbb` string; null when invalid. */
export function normalizeHex(input: string): string | null {
  const rgb = parseColor(input);
  return rgb ? `#${rgbToHex(rgb)}` : null;
}

/** Mix two colors in RGB space by `amount` (0 = a, 1 = b). */
export function mix(a: Rgb, b: Rgb, amount: number): Rgb {
  const t = clamp(amount, 0, 1);
  return {
    r: channel8(a.r + (b.r - a.r) * t),
    g: channel8(a.g + (b.g - a.g) * t),
    b: channel8(a.b + (b.b - a.b) * t),
  };
}

export interface ScaleOptions {
  tints: number;
  shades: number;
  curve: ScaleCurve;
}

/**
 * Build the full scale: tints toward white (descending steps), base, then shades toward black.
 * `curve` shapes the interpolation exponent — quadratic pushes steps toward the extremes.
 */
export function buildScale(base: Rgb, options: ScaleOptions): Swatch[] {
  const tints = clamp(Math.round(options.tints), 0, MAX_STEPS);
  const shades = clamp(Math.round(options.shades), 0, MAX_STEPS);
  const exponent = options.curve === 'quadratic' ? 2 : 1;
  const swatches: Swatch[] = [];

  const makeSwatch = (rgb: Rgb, kind: Swatch['kind'], step: number): Swatch => {
    const cw = contrastRatio(rgb, WHITE);
    return {
      hex: rgbToHex(rgb),
      rgb,
      hsl: rgbToHsl(rgb),
      kind,
      step,
      contrastWhite: Math.round(cw * 100) / 100,
      contrastBlack: Math.round(contrastRatio(rgb, BLACK) * 100) / 100,
      contrastLabel: contrastLabel(rgb),
    };
  };

  for (let i = tints; i >= 1; i--) {
    const amount = Math.pow(i / (tints + 1), exponent);
    swatches.push(makeSwatch(mix(base, WHITE, amount), 'tint', i));
  }
  swatches.push(makeSwatch(base, 'base', 0));
  for (let i = 1; i <= shades; i++) {
    const amount = Math.pow(i / (shades + 1), exponent);
    swatches.push(makeSwatch(mix(base, BLACK, amount), 'shade', i));
  }
  return swatches;
}

/** Format RGB as `rgb(r, g, b)`. */
export function formatRgb({ r, g, b }: Rgb): string {
  return `rgb(${channel8(r)}, ${channel8(g)}, ${channel8(b)})`;
}

/** Format HSL as `hsl(h, s%, l%)`. */
export function formatHsl({ h, s, l }: Hsl): string {
  return `hsl(${Math.round(((h % 360) + 360) % 360)}, ${Math.round(clamp(s, 0, 100))}%, ${Math.round(clamp(l, 0, 100))}%)`;
}

/** Clamp steps input to the allowed range; null when not a positive number. */
export function stepsOr(input: string, fallback: number, min = MIN_STEPS, max = MAX_STEPS): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n < min) return fallback;
  return clamp(Math.round(n), min, max);
}

/** Random pleasant color: full hue, 60–90% sat, 35–65% lightness, as hex. */
export function randomHex(): string {
  const h = Math.floor(Math.random() * 360);
  const s = 60 + Math.floor(Math.random() * 31);
  const l = 35 + Math.floor(Math.random() * 31);
  return `#${rgbToHex(hslToRgb({ h, s, l }))}`;
}

/** Compact summary used by the status bar and copy actions. */
export function summaryText(state: ToolState): string {
  const hex = normalizeHex(state.colorInput);
  return hex === null
    ? 'Enter a valid color'
    : `${hex.toUpperCase()} — ${detectFormat(state.colorInput)}`;
}

/** Build a history entry text for a copied color. */
export function historyText(hex: string): string {
  return hex.toUpperCase();
}

export function isState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return typeof v.colorInput === 'string' && typeof v.tintCount === 'number';
}
