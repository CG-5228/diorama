/**
 * @core/draw - Stipple Procedural Texture Engine
 * 
 * Provides stochastic pointillism / stippling textures:
 * - Gradient probability distribution (concentrates stippling toward light or shadow)
 * - Variable dot radii for natural ink bleed
 * - Supports clipping directly to a Shape or rendering within a bounding box
 */

import { createRng } from '../../random.js';
import type { Point, Texture, Bounds, ShapeLike } from '../types.js';
import type { Shape } from '../shapes/shape.js';
import type { HatchBounds } from './hatch.js';

/** Direction of the stipple density gradient. */
export type StippleGradient =
  | 'none'
  | 'left-to-right'
  | 'right-to-left'
  | 'top-to-bottom'
  | 'bottom-to-top'
  | 'radial-in'
  | 'radial-out';

/** Options for `Stipple`: dot count, radius and gradient. */
export interface StippleOptions {
  /** Approximate dot count (default: 80) */
  count?: number;
  /** Density multiplier for dot distribution (convenience shorthand) */
  density?: number;
  /** Minimum dot radius in pixels (default: 0.5) */
  minRadius?: number;
  /** Maximum dot radius in pixels (default: 1.2) */
  maxRadius?: number;
  /** Uniform dot radius shorthand */
  radius?: number;
  /** Dot color (default: '#1c1714') */
  color?: string;
  /** Directional concentration gradient (default: 'none') */
  gradient?: StippleGradient;
  /** Deterministic PRNG seed */
  seed?: number;
}

/** Stippling texture: random dots with an optional density gradient. Draw it with `render` or `spot`. */
export class Stipple implements Texture<StippleOptions> {
  public attrs: StippleOptions;

  constructor(attrs: StippleOptions = {}) {
    this.attrs = { ...attrs };
  }

  /**
   * Renders the stipple texture inside a Shape or rectangular bounding box.
   */
  render(
    ctx: CanvasRenderingContext2D,
    target: Shape | Bounds,
    overrides: Partial<StippleOptions> = {}
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
   * Renders a targeted / localized stipple cluster around a specific center point.
   */
  spot(
    ctx: CanvasRenderingContext2D,
    center: Point,
    radius: number | { rx: number; ry: number },
    overrides: Partial<StippleOptions> = {}
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
    bounds: Bounds,
    overrides: Partial<StippleOptions> = {}
  ): void {
    const effective = { ...this.attrs, ...overrides };
    const count = effective.count ?? (effective.density != null ? Math.round(effective.density * 350) : 80);
    const minR = effective.minRadius ?? (effective.radius != null ? effective.radius * 0.5 : 0.5);
    const maxR = effective.maxRadius ?? (effective.radius != null ? effective.radius : 1.2);
    const color = effective.color ?? '#1c1714';
    const grad = effective.gradient ?? 'none';
    const rng = createRng(effective.seed ?? 202);

    ctx.save();
    ctx.fillStyle = color;

    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 6;

    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const u = rng.random();
      const v = rng.random();

      // Check probability based on gradient mode
      let keepProb = 1.0;
      switch (grad) {
        case 'left-to-right':
          keepProb = u;
          break;
        case 'right-to-left':
          keepProb = 1 - u;
          break;
        case 'top-to-bottom':
          keepProb = v;
          break;
        case 'bottom-to-top':
          keepProb = 1 - v;
          break;
        case 'radial-out': {
          const dx = u - 0.5;
          const dy = v - 0.5;
          keepProb = Math.min(1, Math.hypot(dx, dy) * 2);
          break;
        }
        case 'radial-in': {
          const dx = u - 0.5;
          const dy = v - 0.5;
          keepProb = Math.max(0, 1 - Math.hypot(dx, dy) * 2);
          break;
        }
        default:
          keepProb = 1.0;
      }

      if (rng.random() > keepProb) continue;

      const px = bounds.x + u * bounds.width;
      const py = bounds.y + v * bounds.height;
      const radius = minR + rng.random() * (maxR - minR);

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
      placed++;
    }

    ctx.restore();
  }
}

function isShape(target: Shape | Bounds): target is Shape {
  return 'toPoints' in target && typeof target.toPoints === 'function';
}

function getShapeBounds(points: Point[]): Bounds {
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
