import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MAX_HISTORY,
  MAX_STEPS,
  MIN_STEPS,
  clamp,
  detectFormat,
  normalizeHex,
  type HistoryEntry,
  type InputFormat,
  type ScaleCurve,
  type ToolState,
} from './types';

const VALID_FORMATS: InputFormat[] = ['hex', 'rgb', 'hsl'];
const VALID_CURVES: ScaleCurve[] = ['linear', 'quadratic'];

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    colorInput: state.colorInput,
    inputFormat: state.inputFormat,
    tintCount: state.tintCount,
    shadeCount: state.shadeCount,
    curve: state.curve,
    history: state.history,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function stepsOr(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < MIN_STEPS) return fallback;
  return clamp(Math.round(n), MIN_STEPS, MAX_STEPS);
}

function validHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is HistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as HistoryEntry).text === 'string' &&
        typeof (entry as HistoryEntry).createdAt === 'string'
    )
    .slice(0, MAX_HISTORY);
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected color shade tinter state object',
    };
  }
  const v = data as Record<string, unknown>;
  const inputFormat: InputFormat = VALID_FORMATS.includes(v.inputFormat as InputFormat)
    ? (v.inputFormat as InputFormat)
    : detectFormat(stringOr(v.colorInput, DEFAULT_STATE.colorInput));
  const curve: ScaleCurve = VALID_CURVES.includes(v.curve as ScaleCurve)
    ? (v.curve as ScaleCurve)
    : DEFAULT_STATE.curve;
  const state: ToolState = {
    colorInput: stringOr(v.colorInput, DEFAULT_STATE.colorInput),
    inputFormat,
    tintCount: stepsOr(v.tintCount, DEFAULT_STATE.tintCount),
    shadeCount: stepsOr(v.shadeCount, DEFAULT_STATE.shadeCount),
    curve,
    history: validHistory(v.history),
  };
  return { success: true, data: state };
}

/** Append a history entry to state, capped at MAX_HISTORY, newest first, deduplicated. */
export function withHistory(state: ToolState, text: string, now = new Date()): ToolState {
  if (state.history[0]?.text === text) return state;
  const entry: HistoryEntry = { text, createdAt: now.toISOString() };
  return {
    ...state,
    history: [entry, ...state.history.filter((h) => h.text !== text)].slice(0, MAX_HISTORY),
  };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

const numberOrNull = (value: string): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Build a shareable summary of the current palette, or null for invalid colors. */
export function paletteSummary(state: ToolState): string | null {
  return normalizeHex(state.colorInput);
}

export const colorShadeTinterTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

export { numberOrNull };
