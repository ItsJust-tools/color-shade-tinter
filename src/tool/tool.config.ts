import type { ExportFormat } from '@itsjust/core';

const toolConfig = {
  id: 'color-shade-tinter',
  name: 'Color Shade Tinter',
  category: 'Design',
  description: 'Generate tints and shades of any hex color as a full palette with export options.',
  version: '1.0.0',
  exportFormats: ['png', 'jpeg', 'webp', 'pdf', 'json'] satisfies ExportFormat[],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#8b5cf6',
    accentHover: '#7c3aed',
    accentSubtle: 'rgba(139, 92, 246, 0.15)',
    brand: 'Color Shade Tinter',
    icon: '🎨',
  },
  shortcuts: [
    {
      title: 'Palette',
      shortcuts: [
        { keys: 'R', label: 'Random color', description: 'generate a random base color' },
        { keys: 'C', label: 'Copy hex', description: 'copy the base color hex to the clipboard' },
      ],
    },
  ],
};

export default toolConfig;
