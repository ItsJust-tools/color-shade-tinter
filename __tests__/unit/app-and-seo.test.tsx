import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import manifest from '@/app/manifest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import ErrorPage from '@/app/error';
import NotFound from '@/app/not-found';
import { JsonLd } from '@/app/json-ld';
import ToolPage from '@/app/page';
import { cn } from '@/lib/utils';
import { generateJsonLd, generateToolMetadata } from '@/lib/seo';
import toolConfig from '@/tool/tool.config';
import { getPublicSiteUrl, templateMetadata } from '@/tool/template-metadata';
import { colorShadeTinterTool } from '@/tool/tool-definition';
import { Canvas } from '@/tool/components/Canvas';
import { Sidebar } from '@/tool/components/Sidebar';
import { Toolbar } from '@/tool/components/Toolbar';
import { DEFAULT_STATE as BASE_DEFAULT_STATE, buildScale } from '@/tool/types';
import type { ExporterLoader } from '@itsjust/core';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/tool-client-wrapper', () => ({
  default: () => <div data-testid="tool-client-wrapper">tool-client-wrapper</div>,
}));

describe('app and seo', () => {
  const getOgImageUrl = (
    images: NonNullable<NonNullable<ReturnType<typeof generateToolMetadata>['openGraph']>['images']>
  ): string | undefined => {
    const list = Array.isArray(images) ? images : [images];
    const first = list[0];
    if (!first) return undefined;
    if (typeof first === 'string') return first;
    if (first instanceof URL) return first.toString();
    return String(first.url);
  };

  it('builds metadata and json-ld values', () => {
    const metadata = generateToolMetadata(toolConfig);
    const jsonLd = generateJsonLd(toolConfig);

    expect(metadata.creator).toBe(toolConfig.name);
    expect(metadata.metadataBase?.toString()).toBe('http://localhost:3000/');
    const ogUrl = metadata.openGraph?.images ? getOgImageUrl(metadata.openGraph.images) : undefined;
    expect(ogUrl).toContain('/og.svg');
    expect(jsonLd.url).toBe('http://localhost:3000');
    expect(jsonLd.featureList.length).toBeGreaterThan(0);
  });

  it('returns site manifest, robots and sitemap', () => {
    const man = manifest();
    const rob = robots();
    const sm = sitemap();

    expect(man.name).toBe(templateMetadata.appName);
    expect(rob.sitemap).toBe('http://localhost:3000/sitemap.xml');
    expect(sm[0]?.url).toBe('http://localhost:3000');
  });

  it('renders json-ld script safely', () => {
    render(<JsonLd config={{ ...toolConfig, name: '</script>' }} />);
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script?.innerHTML).toContain('\\u003c/script>');
  });

  it('renders error page and invokes reset', () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error('boom')} reset={reset} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders not-found page', () => {
    render(<NotFound />);
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  });

  it('renders top-level tool page', () => {
    render(<ToolPage />);
    expect(screen.getByTestId('tool-client-wrapper')).toBeInTheDocument();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeInTheDocument();
  });

  it('covers tool definition and helper exports', async () => {
    expect(cn('a', undefined, 'b', false, null, 'c')).toBe('a b c');
    expect(getPublicSiteUrl()).toBe('http://localhost:3000');
    expect(colorShadeTinterTool.name).toBe(toolConfig.name);
    expect(
      colorShadeTinterTool.deserialize({
        colorInput: 'hsl(0, 100%, 50%)',
        inputFormat: 'hsl',
        tintCount: 3,
        shadeCount: 3,
        history: [{ text: '#FF0000', createdAt: '2026-11-23T10:00:00.000Z' }],
      })
    ).toEqual({
      success: true,
      data: {
        colorInput: 'hsl(0, 100%, 50%)',
        inputFormat: 'hsl',
        tintCount: 3,
        shadeCount: 3,
        curve: BASE_DEFAULT_STATE.curve,
        history: [{ text: '#FF0000', createdAt: '2026-11-23T10:00:00.000Z' }],
      },
    });
    const repaired = colorShadeTinterTool.deserialize({ nope: true });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.colorInput).toBe(BASE_DEFAULT_STATE.colorInput);
      expect(repaired.data.history).toEqual([]);
    }
    expect(
      colorShadeTinterTool.serialize({ ...BASE_DEFAULT_STATE, colorInput: '#ff0000' })
    ).toContain('"colorInput":"#ff0000"');
    const exporters =
      (colorShadeTinterTool as { exporters?: Array<{ loader: ExporterLoader }> }).exporters ?? [];
    expect(exporters).toHaveLength(4);
    const first = exporters[0];
    expect(first).toBeDefined();
    if (!first) throw new Error('missing exporter');
    const png = await (first.loader as ExporterLoader)();
    const resolved = 'default' in png ? png.default : png.exporter;
    expect(resolved.format).toBe('png');
  });

  it('renders tool components', () => {
    render(
      <>
        <Toolbar
          state={{ ...BASE_DEFAULT_STATE }}
          onChange={() => {}}
          onClear={() => {}}
          onCopy={() => {}}
        />
        <Sidebar state={{ ...BASE_DEFAULT_STATE }} onChange={() => {}} />
        <Canvas
          state={{ ...BASE_DEFAULT_STATE, colorInput: 'rgb(59, 130, 246)' }}
          onChange={() => {}}
        />
      </>
    );

    expect(screen.getByTestId('input-color')).toBeInTheDocument();
    expect(screen.getByTestId('swatch-grid')).toBeInTheDocument();
    expect(screen.getByTestId('color-normalized')).toHaveTextContent('#3B82F6');
    expect(screen.getByTestId('export-output')).toBeInTheDocument();
    // 10 tints + base + 10 shades
    expect(screen.getAllByTestId(/^swatch-(tint|base|shade)/)).toHaveLength(21);
  });

  it('builds export text for css, json and tailwind', async () => {
    const { buildExportText } = await import('@/tool/components/Canvas');
    const scale = buildScale({ r: 59, g: 130, b: 246 }, { tints: 2, shades: 1, curve: 'linear' });
    const css = buildExportText(scale, 'css');
    expect(css).toContain('--tint-2:');
    expect(css).toContain('--color: #3b82f6;');
    expect(css).toContain('--shade-1:');
    expect(css.trim().endsWith('}')).toBe(true);
    const json = JSON.parse(buildExportText(scale, 'json'));
    expect(json.base).toBe('#3b82f6');
    expect(json['tint-2']).toBeDefined();
    const tw = buildExportText(scale, 'tailwind');
    expect(tw).toContain('colors: {');
    expect(tw).toContain("DEFAULT: '#3b82f6',");
    expect(tw.trim().endsWith('};')).toBe(true);
  });
});
