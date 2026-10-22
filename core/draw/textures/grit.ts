/**
 * @core/draw - Grit Procedural Texture Engine
 * 
 * Provides hard micro-grit flecks, dry brush dirt, and battle wear scratches.
 */

import { createRng } from '../../random.js';
import type { Bounds, Point, Texture } from '../types.js';
import type { Shape } from '../shapes/shape.js';
import type { HatchBounds } from './hatch.js';

/** Options for `Grit`: count, scratches, size and color. */
export interface GritOptions {
  /** Quantity of grit flecks (default: 20) */
  count?: number;
  /** Quantity of linear scratches (default: 3) */
  scratches?: number;
  /** Alias for scratches */
  scratchCount?: number;
  /** Base particle size in pixels (default: 1.4) */
  size?: number;
  /** Ink or dirt color (default: '#1c1714') */
  color?: string;
  /** Deterministic PRNG seed */
  seed?: number;
}

/** Grit texture: specks and scratches for wear. Draw it with `render` or `spot`. */
export class Grit implements Texture<GritOptions> {
  public attrs: GritOptions;

  constructor(attrs: GritOptions = {}) {
    this.attrs = { ...attrs };
  }

  /**
   * Renders grit flecks and scratches inside a Shape or rectangular bounding box.
   */
  render(
    ctx: CanvasRenderingContext2D,
    target: Shape | Bounds,
    overrides: Partial<GritOptions> = {}
  ): void {
    if (isShape(target)) {
      target.clip(ctx, () => {
        const bounds = target.bounds;
        this.renderInternal(ctx, bounds, overrides);
      });
    } else {
      this.renderInternal(ctx, target, overrides);
    }
  }

  /**
   * Renders a targeted / localized grit cluster around a specific center point.
   */
  spot(
    ctx: CanvasRenderingContext2D,
    center: Point,
    radius: number | { rx: number; ry: number },
    overrides: Partial<GritOptions> = {}
  ): void {
    const rx = typeof radius === 'number' ? radius : radius.rx;
    const ry = typeof radius === 'number' ? radius : radius.ry;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();

    this.renderInternal(
      ctx,
      {
        x: center.x - rx,
        y: center.y - ry,
        width: rx * 2,
        height: ry * 2,
      },
      overrides
    );

    ctx.restore();
  }

  private renderInternal(
    ctx: CanvasRenderingContext2D,
    bounds: HatchBounds,
    overrides: Partial<GritOptions> = {}
  ): void {
    const effective = { ...this.attrs, ...overrides };
    const count = effective.count ?? 20;
    const scratches = effective.scratches ?? effective.scratchCount ?? 3;
    const size = effective.size ?? 1.4;
    const color = effective.color ?? '#1c1714';
    const rng = createRng(effective.seed ?? 303);

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    // Angular grit flecks
    for (let i = 0; i < count; i++) {
      const px = bounds.x + rng.random() * bounds.width;
      const py = bounds.y + rng.random() * bounds.height;
      const s = size * (0.7 + rng.random() * 0.8);

      if (rng.random() > 0.4) {
        ctx.fillRect(px, py, s, s);
      } else {
        ctx.fillRect(px, py, s * 1.6, s * 0.7);
      }
    }

    // Scratches
    ctx.lineWidth = Math.max(0.8, size * 0.75);
    for (let i = 0; i < scratches; i++) {
      const sx = bounds.x + rng.random() * bounds.width;
      const sy = bounds.y + rng.random() * bounds.height;
      const len = (4 + rng.random() * 8) * (size / 1.4);
      const ang = (rng.random() - 0.5) * Math.PI;

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function isShape(target: Shape | Bounds): target is Shape {
  return 'toPoints' in target && typeof target.toPoints === 'function';
}

function getShapeBounds(points: Point[]): HatchBounds {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = points[0].x, maxX = points[0].x;
  let minY = points[0].y, maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
