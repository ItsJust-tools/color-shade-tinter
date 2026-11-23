'use client';

import React from 'react';
import { CURVES, EXPORT_TABS, type ExportTab } from '../ui-shared';
import {
  buildScale,
  formatHsl,
  formatRgb,
  MAX_STEPS,
  MIN_STEPS,
  normalizeHex,
  parseColor,
  stepsOr,
  type ScaleCurve,
  type Swatch,
  type ToolState,
} from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onCopySwatch?: (text: string) => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

/** Build the export text for one tab. */
export function buildExportText(swatches: Swatch[], tab: ExportTab): string {
  switch (tab) {
    case 'css': {
      const lines = [':root {'];
      for (const swatch of swatches) {
        const prefix = swatch.kind === 'base' ? 'color' : `${swatch.kind}-${swatch.step}`;
        lines.push(`  --${prefix}: #${swatch.hex};`);
      }
      lines.push('}');
      return lines.join('\n');
    }
    case 'json': {
      const obj: Record<string, string> = {};
      for (const swatch of swatches) {
        const key = swatch.kind === 'base' ? 'base' : `${swatch.kind}-${swatch.step}`;
        obj[key] = `#${swatch.hex}`;
      }
      return JSON.stringify(obj, null, 2);
    }
    case 'tailwind': {
      const tints = swatches.filter((s) => s.kind === 'tint').reverse();
      const base = swatches.find((s) => s.kind === 'base');
      const shades = swatches.filter((s) => s.kind === 'shade');
      const lines = ['module.exports = {', '  theme: {', '    extend: {', '      colors: {'];
      lines.push('        primary: {');
      tints.forEach((s, i) => {
        lines.push(`          ${tints.length - i}: '#${s.hex}',`);
      });
      if (base) lines.push(`          DEFAULT: '#${base.hex}',`);
      shades.forEach((s) => {
        lines.push(`          ${s.step}: '#${s.hex}',`);
      });
      lines.push('        },');
      lines.push('      },');
      lines.push('    },');
      lines.push('  },');
      lines.push('};');
      return lines.join('\n');
    }
  }
}

function SwatchCard({ swatch, onCopy }: { swatch: Swatch; onCopy?: (text: string) => void }) {
  const [copied, setCopied] = React.useState(false);
  const bg = `#${swatch.hex}`;
  const handleClick = () => {
    onCopy?.(bg.toUpperCase());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  const textIsLight = swatch.contrastWhite >= 4.5;
  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid={`swatch-${swatch.kind}-${swatch.step}`}
      title={`#${swatch.hex} — ${swatch.contrastLabel}`}
      className="flex h-28 flex-col justify-between rounded-lg border border-black/10 p-2 text-left transition-transform hover:scale-[1.02] dark:border-white/10"
      style={{ backgroundColor: bg, color: textIsLight ? '#ffffff' : '#111827' }}
    >
      <span className="font-mono text-xs font-semibold">{bg.toUpperCase()}</span>
      <span className="font-mono text-[10px] leading-tight opacity-90">
        {formatRgb(swatch.rgb)}
        <br />
        {formatHsl(swatch.hsl)}
      </span>
      <span className="flex items-center justify-between gap-1">
        <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[9px] font-medium text-white">
          {swatch.contrastLabel}
        </span>
        <span className="text-[9px] uppercase tracking-wide opacity-80">
          {copied ? 'Copied!' : swatch.kind === 'base' ? 'Base' : `${swatch.kind} ${swatch.step}`}
        </span>
      </span>
    </button>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange, onCopySwatch }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const parsed = parseColor(state.colorInput);
  const hex = normalizeHex(state.colorInput);
  const scale = parsed
    ? buildScale(parsed, { tints: state.tintCount, shades: state.shadeCount, curve: state.curve })
    : [];
  const [exportTab, setExportTab] = React.useState<ExportTab>('css');
  const exportText = scale.length > 0 ? buildExportText(scale, exportTab) : '';

  return (
    <div className="h-full space-y-6 overflow-y-auto p-4" data-testid="canvas">
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-xs font-medium text-gray-700 sm:col-span-3 dark:text-gray-300">
            Color (hex, rgb or hsl)
            <input
              type="text"
              value={state.colorInput}
              onChange={(e) => update({ colorInput: e.target.value })}
              data-testid="input-color"
              placeholder="#3b82f6, rgb(59, 130, 246), hsl(217, 91%, 60%)"
              className={inputClass}
              aria-invalid={parsed === null}
            />
          </label>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Tint steps ({MIN_STEPS}–{MAX_STEPS})
            <input
              type="number"
              min={MIN_STEPS}
              max={MAX_STEPS}
              value={state.tintCount}
              onChange={(e) => update({ tintCount: stepsOr(e.target.value, state.tintCount) })}
              data-testid="input-tint-count"
              className={inputClass}
            />
          </label>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Shade steps ({MIN_STEPS}–{MAX_STEPS})
            <input
              type="number"
              min={MIN_STEPS}
              max={MAX_STEPS}
              value={state.shadeCount}
              onChange={(e) => update({ shadeCount: stepsOr(e.target.value, state.shadeCount) })}
              data-testid="input-shade-count"
              className={inputClass}
            />
          </label>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Scale curve
            <select
              value={state.curve}
              onChange={(e) => update({ curve: e.target.value as ScaleCurve })}
              data-testid="select-curve"
              className={inputClass}
            >
              {CURVES.map((curve) => (
                <option key={curve.value} value={curve.value}>
                  {curve.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {parsed === null ? (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400" data-testid="color-error">
            Enter a valid hex, rgb or hsl color.
          </p>
        ) : (
          <p
            className="mt-2 font-mono text-xs text-gray-500 dark:text-gray-400"
            data-testid="color-normalized"
          >
            Base: {hex?.toUpperCase()} · {state.tintCount} tints · {state.shadeCount} shades
          </p>
        )}
      </div>

      {scale.length > 0 ? (
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
          data-testid="swatch-grid"
        >
          {scale.map((swatch) => (
            <SwatchCard
              key={`${swatch.kind}-${swatch.step}`}
              swatch={swatch}
              onCopy={onCopySwatch}
            />
          ))}
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div
          className="mb-2 flex flex-wrap items-center gap-2"
          role="tablist"
          aria-label="Export format"
        >
          {EXPORT_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={exportTab === tab}
              data-testid={`export-tab-${tab}`}
              onClick={() => setExportTab(tab)}
              className={`rounded-md border px-3 py-1.5 font-mono text-xs font-medium ${
                exportTab === tab
                  ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-900/40 dark:text-violet-100'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'
              }`}
            >
              {tab === 'tailwind' ? 'tailwind.config' : tab}
            </button>
          ))}
        </div>
        <pre
          className="max-h-72 overflow-auto rounded-md bg-gray-950 p-3 font-mono text-xs leading-relaxed text-gray-100"
          data-testid="export-output"
        >
          {exportText || '// Enter a valid color to see the palette export'}
        </pre>
      </div>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        Click a swatch to copy its hex. Everything runs locally in your browser; nothing is
        uploaded.
      </p>
    </div>
  );
};
