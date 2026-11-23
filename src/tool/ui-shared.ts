import type { ScaleCurve } from './types';

export const CURVES: { value: ScaleCurve; label: string; hint: string }[] = [
  { value: 'linear', label: 'Linear', hint: 'evenly spaced steps' },
  { value: 'quadratic', label: 'Quadratic', hint: 'steps pushed toward the extremes' },
];

export const EXPORT_TABS = ['css', 'json', 'tailwind'] as const;
export type ExportTab = (typeof EXPORT_TABS)[number];

export function isState(value: unknown): boolean {
  return typeof value === 'object' && value !== null;
}
