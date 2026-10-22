/**
 * @internal The stroke renderers a `StrokeStyle` can name in `renderer`:
 * - 'ribbon' (the default): calligraphic width with a light caliper wobble and a tapered end;
 * - 'clean': a uniform native canvas stroke (volume edges, outlines and floor lines use it).
 * Both are drawn by `renderRibbonStroke`; each starts from its own defaults and the stroke's options win.
 */

import type { BrushName, Point, StrokeOptions } from '../../types.js';
import { renderRibbonStroke } from './ribbon.js';

interface StrokeRenderer {
  /** Values a stroke gets for the options it leaves unset. */
  defaults: StrokeOptions;
  draw(ctx: CanvasRenderingContext2D, points: Point[], params: StrokeOptions): void;
}

const RENDERERS: Record<BrushName, StrokeRenderer> = {
  ribbon: { defaults: { width: 2, color: '#1c1714', caliperNoise: 0.16, taperEnd: true }, draw: renderRibbonStroke },
  clean: { defaults: { width: 2, color: '#1c1714' }, draw: renderRibbonStroke },
};

/** Draws a polyline with the named renderer: its defaults, then every option of `attrs` that is not undefined. */
export function renderStroke(name: string, ctx: CanvasRenderingContext2D, points: Point[], closed: boolean, attrs: StrokeOptions): void {
  const renderer = Object.hasOwn(RENDERERS, name) ? RENDERERS[name as BrushName] : undefined;
  if (!renderer) {
    throw new Error(`Unknown stroke renderer "${name}". Use ${Object.keys(RENDERERS).map(n => `'${n}'`).join(' or ')}.`);
  }
  const params: Record<string, unknown> = { ...renderer.defaults };
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) params[key] = value;
  }
  renderer.draw(ctx, points, { ...params, closed, renderer: name } as StrokeOptions);
}
