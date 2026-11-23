import { describe, it, expect } from 'vitest';
import {
  buildScale,
  clamp,
  contrastLabel,
  contrastRatio,
  detectFormat,
  formatHsl,
  formatRgb,
  historyText,
  hslToRgb,
  mix,
  normalizeHex,
  parseColor,
  parseHex,
  parseHsl,
  parseRgb,
  rgbToHex,
  rgbToHsl,
  relativeLuminance,
  randomHex,
  stepsOr,
  summaryText,
  MAX_STEPS,
  MAX_HISTORY,
  DEFAULT_STATE,
  type ToolState,
} from '@/tool/types';
import {
  colorShadeTinterTool,
  deserializeState,
  paletteSummary,
  roundTrips,
  serializeState,
  withHistory,
} from '@/tool/tool-definition';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('hex parsing', () => {
  it('parses 6-digit and 3-digit hex with or without #', () => {
    expect(parseHex('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('0af')).toEqual({ r: 0, g: 170, b: 255 });
  });

  it('normalizes to lowercase 6-digit hex without #', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('ff0000');
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('000000');
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('ffffff');
  });

  it('rejects invalid hex', () => {
    expect(parseHex('')).toBeNull();
    expect(parseHex('#ff')).toBeNull();
    expect(parseHex('ffff00f')).toBeNull();
    expect(parseHex('#gg0000')).toBeNull();
    expect(parseHex('#ff00')).toBeNull();
  });
});

describe('rgb parsing', () => {
  it('parses rgb() and rgba() wrappers', () => {
    expect(parseRgb('rgb(12, 34, 56)')).toEqual({ r: 12, g: 34, b: 56 });
    expect(parseRgb('rgba(12, 34, 56, 0.5)')).toEqual({ r: 12, g: 34, b: 56 });
  });

  it('parses bare comma-separated channels', () => {
    expect(parseRgb('255,0,0')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('clamps channels into 0–255', () => {
    expect(parseRgb('300, -20, 12.7')).toEqual({ r: 255, g: 0, b: 13 });
  });

  it('rejects invalid rgb input', () => {
    expect(parseRgb('rgb(1, 2)')).toBeNull();
    expect(parseRgb('rgb(a, b, c)')).toBeNull();
    expect(parseRgb('')).toBeNull();
  });
});

describe('hsl parsing', () => {
  it('parses hsl() wrapper and bare values', () => {
    expect(parseHsl('hsl(0, 100%, 50%)')).toEqual({ h: 0, s: 100, l: 50 });
    expect(parseHsl('120, 50%, 50%')).toEqual({ h: 120, s: 50, l: 50 });
  });

  it('parses hsl without percent signs', () => {
    expect(parseHsl('hsl(210, 80, 40)')).toEqual({ h: 210, s: 80, l: 40 });
  });

  it('rejects invalid hsl input', () => {
    expect(parseHsl('hsl(0, 50%)')).toBeNull();
    expect(parseHsl('hsl(x, y, z)')).toBeNull();
  });

  it('round-trips through rgb', () => {
    const rgb = hslToRgb({ h: 0, s: 100, l: 50 });
    expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
    expect(rgbToHsl(rgb)).toEqual({ h: 0, s: 100, l: 50 });
  });

  it('handles gray (s=0)', () => {
    expect(hslToRgb({ h: 0, s: 0, l: 50 })).toEqual({ r: 128, g: 128, b: 128 });
  });
});

describe('parseColor and detectFormat', () => {
  it('detects format from prefix', () => {
    expect(detectFormat('#ff0000')).toBe('hex');
    expect(detectFormat('rgb(1,2,3)')).toBe('rgb');
    expect(detectFormat('hsl(1,2%,3%)')).toBe('hsl');
  });

  it('parses all three formats to the same rgb', () => {
    expect(parseColor('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('returns null for empty and malformed input', () => {
    expect(parseColor('')).toBeNull();
    expect(parseColor('   ')).toBeNull();
    expect(parseColor('not-a-color')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
  });

  it('normalizes any valid input to #rrggbb', () => {
    expect(normalizeHex('#F00')).toBe('#ff0000');
    expect(normalizeHex('rgb(59, 130, 246)')).toBe('#3b82f6');
  });
});

describe('tint/shade interpolation', () => {
  it('places the base in the middle with kind base', () => {
    const scale = buildScale({ r: 59, g: 130, b: 246 }, { tints: 2, shades: 2, curve: 'linear' });
    const base = scale.find((s) => s.kind === 'base');
    expect(base?.hex).toBe('3b82f6');
    expect(base?.step).toBe(0);
    expect(scale.filter((s) => s.kind === 'tint')).toHaveLength(2);
    expect(scale.filter((s) => s.kind === 'shade')).toHaveLength(2);
    expect(scale).toHaveLength(5);
  });

  it('produces expected linear hex values for a 50% white mix', () => {
    // tints:2 means the lightest tint is 2/3 toward white = 170
    const scale = buildScale({ r: 0, g: 0, b: 0 }, { tints: 2, shades: 0, curve: 'linear' });
    expect(scale[0]?.hex).toBe('aaaaaa');
    expect(scale[1]?.hex).toBe('555555');
  });

  it('produces expected linear shade hex values', () => {
    const scale = buildScale({ r: 255, g: 255, b: 255 }, { tints: 0, shades: 2, curve: 'linear' });
    expect(scale[0]?.hex).toBe('ffffff');
    expect(scale[1]?.hex).toBe('aaaaaa');
    expect(scale[2]?.hex).toBe('555555');
  });

  it('orders tints lightest-first, shades darkest-last... by proximity to base', () => {
    const scale = buildScale({ r: 128, g: 128, b: 128 }, { tints: 3, shades: 3, curve: 'linear' });
    const [t3, t2, t1] = scale
      .filter((s) => s.kind === 'tint')
      .map((s) => ({ step: s.step, hex: s.hex }));
    if (!t3 || !t2 || !t1) throw new Error('missing tints');
    expect(t3.step).toBe(3);
    expect(t2.step).toBe(2);
    expect(t1.step).toBe(1);
    // darkest tint is closest to base
    expect(parseInt(t3.hex.slice(0, 2), 16)).toBeGreaterThan(parseInt(t1.hex.slice(0, 2), 16));
    const [s1, s2, s3] = scale
      .filter((s) => s.kind === 'shade')
      .map((s) => ({ step: s.step, hex: s.hex }));
    if (!s1 || !s2 || !s3) throw new Error('missing shades');
    expect(s1.step).toBe(1);
    expect(parseInt(s3.hex.slice(0, 2), 16)).toBeLessThan(parseInt(s1.hex.slice(0, 2), 16));
  });

  it('quadratic curve differs from linear for mid steps', () => {
    const linear = buildScale({ r: 0, g: 0, b: 0 }, { tints: 5, shades: 0, curve: 'linear' });
    const quad = buildScale({ r: 0, g: 0, b: 0 }, { tints: 5, shades: 0, curve: 'quadratic' });
    // mid tint of linear: 3/6 = 0.5 → 128; quadratic: 0.25 → 64
    expect(linear[2]?.hex).toBe('808080');
    expect(quad[2]?.hex).toBe('404040');
  });

  it('mixes colors correctly', () => {
    expect(mix({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, 0.5)).toEqual({
      r: 128,
      g: 128,
      b: 128,
    });
    expect(mix({ r: 0, g: 0, b: 0 }, { r: 100, g: 200, b: 300 }, 0)).toEqual({
      r: 0,
      g: 0,
      b: 0,
    });
  });

  it('clamps invalid step counts', () => {
    const scale = buildScale({ r: 0, g: 0, b: 0 }, { tints: 999, shades: -5, curve: 'linear' });
    expect(scale.filter((s) => s.kind === 'tint')).toHaveLength(MAX_STEPS);
    expect(scale.filter((s) => s.kind === 'shade')).toHaveLength(0);
  });

  it('handles zero-step scales returning just the base', () => {
    const scale = buildScale({ r: 1, g: 2, b: 3 }, { tints: 0, shades: 0, curve: 'linear' });
    expect(scale).toHaveLength(1);
    expect(scale[0]?.kind).toBe('base');
    expect(scale[0]?.hex).toBe('010203');
  });
});

describe('WCAG contrast', () => {
  it('relative luminance of white is 1 and black is 0', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0);
  });

  it('contrast ratio white vs black is 21', () => {
    expect(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })).toBeCloseTo(21);
  });

  it('labels thresholds', () => {
    expect(contrastLabel({ r: 255, g: 255, b: 255 })).toBe('Fail');
    expect(contrastLabel({ r: 0, g: 0, b: 0 })).toBe('AAA');
    // gray 128 gives ~4.7:1 vs white → AA... actually ~4.95 borderline; verify stable split
    const mid = contrastLabel({ r: 118, g: 118, b: 118 });
    expect(['AA', 'AA Large']).toContain(mid);
  });

  it('every swatch in a scale carries contrast metadata', () => {
    const scale = buildScale({ r: 59, g: 130, b: 246 }, { tints: 3, shades: 3, curve: 'linear' });
    for (const swatch of scale) {
      expect(swatch.contrastWhite).toBeGreaterThan(0);
      expect(swatch.contrastWhite).toBeLessThanOrEqual(21);
      expect(swatch.contrastBlack).toBeGreaterThan(0);
      expect(swatch.contrastBlack).toBeLessThanOrEqual(21);
      expect(['AAA', 'AA', 'AA Large', 'Fail']).toContain(swatch.contrastLabel);
    }
  });
});

describe('formatting helpers', () => {
  it('formats rgb and hsl strings', () => {
    expect(formatRgb({ r: 59, g: 130, b: 246 })).toBe('rgb(59, 130, 246)');
    expect(formatHsl({ h: 217, s: 91, l: 60 })).toBe('hsl(217, 91%, 60%)');
  });

  it('formats negative hue modulo 360', () => {
    expect(formatHsl({ h: -30, s: 50, l: 50 })).toBe('hsl(330, 50%, 50%)');
  });

  it('stepsOr clamps and falls back', () => {
    expect(stepsOr('5', 10)).toBe(5);
    expect(stepsOr('0', 10)).toBe(10);
    expect(stepsOr('abc', 10)).toBe(10);
    expect(stepsOr('999', 10)).toBe(MAX_STEPS);
    expect(stepsOr('3.6', 10)).toBe(4);
  });

  it('clamp keeps values in range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('randomHex is a valid hex color', () => {
    for (let i = 0; i < 20; i++) {
      expect(randomHex()).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('serialization', () => {
  it('serializes all state fields', () => {
    const s = state({ tintCount: 5, shadeCount: 7, curve: 'quadratic' });
    const parsed = JSON.parse(serializeState(s));
    expect(parsed).toEqual({
      colorInput: '#3b82f6',
      inputFormat: 'hex',
      tintCount: 5,
      shadeCount: 7,
      curve: 'quadratic',
      history: [],
    });
  });

  it('round-trips a full state', () => {
    const s = state({
      colorInput: 'rgb(10, 20, 30)',
      inputFormat: 'rgb',
      tintCount: 5,
      shadeCount: 5,
      curve: 'quadratic',
      history: [{ text: '#0A141E', createdAt: '2026-11-23T08:00:00.000Z' }],
    });
    expect(roundTrips(s)).toBe(true);
  });

  it('restores defaults from garbage input', () => {
    const result = deserializeState({ nope: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.colorInput).toBe(DEFAULT_STATE.colorInput);
      expect(result.data.curve).toBe('linear');
      expect(result.data.history).toEqual([]);
    }
  });

  it('rejects non-object payloads', () => {
    expect(deserializeState('nope').success).toBe(false);
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([1, 2]).success).toBe(false);
    expect(deserializeState(undefined).success).toBe(false);
  });

  it('clamps step counts on deserialize', () => {
    const result = deserializeState({ tintCount: 500, shadeCount: -3 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tintCount).toBe(MAX_STEPS);
      expect(result.data.shadeCount).toBe(DEFAULT_STATE.shadeCount);
    }
  });

  it('drops invalid history entries and caps at MAX_HISTORY', () => {
    const garbage = Array.from({ length: MAX_HISTORY + 5 }, (_, i) => ({
      text: `#${i}`,
      createdAt: '2026-11-23T08:00:00.000Z',
      junk: i,
    }));
    const result = deserializeState({ history: [...garbage, 'bad', 42, null] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.history).toHaveLength(MAX_HISTORY);
    }
  });

  it('falls back to detected format for unknown inputFormat', () => {
    const result = deserializeState({ colorInput: 'rgb(1,2,3)', inputFormat: 'hsx' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inputFormat).toBe('rgb');
    }
  });

  it('tool definition exposes id, name, version and exporters', async () => {
    expect(colorShadeTinterTool.id).toBe('color-shade-tinter');
    expect(colorShadeTinterTool.name).toBe('Color Shade Tinter');
    expect(colorShadeTinterTool.version).toBe('1.0.0');
    expect(colorShadeTinterTool.exporters).toHaveLength(4);
    const exporters = colorShadeTinterTool.exporters ?? [];
    expect(exporters).toHaveLength(4);
    const first = exporters[0];
    if (!first) throw new Error('missing exporter');
    const png = await first.loader();
    const resolved = 'default' in png ? png.default : png.exporter;
    expect(resolved.format).toBe('png');
  });
});

describe('history behavior', () => {
  it('withHistory prepends and dedupes', () => {
    const s = state({ history: [{ text: '#AAAAAA', createdAt: '2026-11-23T08:00:00.000Z' }] });
    const next = withHistory(s, '#BBBBBB', new Date('2026-11-23T09:00:00Z'));
    expect(next.history.map((h) => h.text)).toEqual(['#BBBBBB', '#AAAAAA']);
    const dedup = withHistory(next, '#BBBBBB');
    expect(dedup.history).toHaveLength(2);
  });

  it('withHistory removes older duplicates', () => {
    const s = state({
      history: [
        { text: '#AAAAAA', createdAt: '2026-11-23T08:00:00.000Z' },
        { text: '#BBBBBB', createdAt: '2026-11-23T07:00:00.000Z' },
      ],
    });
    const next = withHistory(s, '#AAAAAA', new Date('2026-11-23T09:00:00Z'));
    expect(next.history.map((h) => h.text)).toEqual(['#AAAAAA', '#BBBBBB']);
  });

  it('caps history at MAX_HISTORY', () => {
    let s = state();
    for (let i = 0; i < MAX_HISTORY + 3; i++) {
      s = withHistory(s, `#${i.toString(16).padStart(2, '0')}0000`);
    }
    expect(s.history).toHaveLength(MAX_HISTORY);
    expect(s.history[0]?.text).not.toBe('#000000');
  });

  it('summary and palette summary', () => {
    expect(summaryText(state())).toBe('#3B82F6 — hex');
    expect(summaryText(state({ colorInput: 'rgb(1,2,3)', inputFormat: 'rgb' }))).toBe(
      '#010203 — rgb'
    );
    expect(summaryText(state({ colorInput: 'garbage' }))).toBe('Enter a valid color');
    expect(paletteSummary(state())).toBe('#3b82f6');
    expect(paletteSummary(state({ colorInput: 'zzzzzz' }))).toBeNull();
  });

  it('historyText uppercases', () => {
    expect(historyText('aabbcc')).toBe('AABBCC');
    expect(historyText('#aabbcc')).toBe('#AABBCC');
  });
});
