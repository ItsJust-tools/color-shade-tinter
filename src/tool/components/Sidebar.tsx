'use client';

import React from 'react';
import { CURVES } from '../ui-shared';
import { normalizeHex, type ToolState } from '../types';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
  onCopyHistory?: (text: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state, onChange, onCopyHistory }) => {
  const hex = normalizeHex(state.colorInput);
  return (
    <div className="h-full space-y-6 overflow-y-auto p-4 text-sm" data-testid="sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Scale</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          {CURVES.map((curve) => (
            <li key={curve.value} className="flex justify-between gap-2">
              <span>{curve.label}</span>
              <span className="text-gray-500 dark:text-gray-400">{curve.hint}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Copied colors</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-history-count">
          {state.history.length} entr{state.history.length === 1 ? 'y' : 'ies'} in history
          {state.history.length > 0 ? ' (newest first)' : ''}
        </p>
        {state.history.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400" data-testid="history-empty">
            Click a swatch to copy its hex and build history.
          </p>
        ) : (
          <ul className="mt-2 space-y-1" data-testid="history-list">
            {state.history.map((entry, i) => (
              <li
                key={`${entry.createdAt}-${i}`}
                className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-gray-800"
              >
                <span
                  className="inline-block h-4 w-4 rounded border border-black/10 dark:border-white/10"
                  style={{ backgroundColor: entry.text }}
                />
                <span className="font-mono text-gray-700 dark:text-gray-300">{entry.text}</span>
                <button
                  type="button"
                  onClick={() => onCopyHistory?.(entry.text)}
                  aria-label={`Copy ${entry.text}`}
                  className="ml-auto rounded border border-gray-300 px-1.5 text-[10px] hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Copy
                </button>
              </li>
            ))}
          </ul>
        )}
        {state.history.length > 0 ? (
          <button
            type="button"
            onClick={() => onChange({ ...state, history: [] })}
            data-testid="sidebar-clear-history"
            className="mt-2 rounded-md border border-gray-300 px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Clear history
          </button>
        ) : null}
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Keyboard shortcuts</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <kbd>R</kbd> — random base color
          </li>
          <li>
            <kbd>C</kbd> — copy base hex{hex ? ` (${hex.toUpperCase()})` : ''}
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar share button to create a URL containing the current palette; open it to
          restore this state.
        </p>
      </div>
    </div>
  );
};
