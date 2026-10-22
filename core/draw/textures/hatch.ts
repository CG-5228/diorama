/**
 * @core/draw - Hatching Procedural Texture Engine
 * 
 * Provides natural parallel and cross-hatching textures:
 * - Line rendering delegates 100% to StrokeStyle (inheriting project theme presets)
 * - Complete, un-clipped strokes with natural pen attack and tapered exits (NO blunt guillotine cuts!)
 * - Mathematical ray-casting against shapes and elliptical spots for organic boundary feathering
 * - Multi-angle cross-hatching passes
 * - Optional hard clipping when explicitly requested via hardClip: true
 */

import { createRng } from '../../random.js';
import type { Point, StrokeOptions, Texture } from '../types.js';
import type { Shape } from '../shapes/shape.js';
import { StrokeStyle } from '../styles/stroke-style.js';

/** Rectangle bounds for a Hatch texture. */
export interface HatchBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Options for `Hatch`: spacing, angle, cross-hatching and jitter. */
export interface HatchOptions {
  /**
   * The StrokeStyle (or StrokeOptions) used to render the hatching lines.
   * Enables sharing the exact line style (width, tapering, handdrawn/sketchy, color) from project themes.
   */
  stroke?: StrokeStyle | StrokeOptions;
  /** Primary hatch angle in degrees (default: -42) */
  angle?: number;
  /** Distance between parallel strokes in pixels (default: 6.0) */
  spacing?: number;
  /** Whether to execute a second intersecting cross-hatch pass (default: false) */
  cross?: boolean;
  /** Cross-hatching angle in degrees (default: 48) */
  crossAngle?: number;
  /** Natural stroke end length variation factor (0 to 0.5, default: 0.3) */
  lengthVariation?: number;
  /** Micro-jitter on line coordinates (default: 0.8) */
  jitter?: number;
  /** Deterministic PRNG seed */
  seed?: number;
  /**
   * Whether to enforce a hard geometric ctx.clip() mask.
   * Default: false (strokes terminate naturally with complete tapered tips).
   */
  hardClip?: boolean;

  /** Direct line width shorthand (overrides stroke.width if provided) */
  width?: number;
  /** Direct line color shorthand (overrides stroke.color if provided) */
  color?: string;
}

interface LineSegment {
  p1: Point;
  p2: Point;
}

/** Hatching texture: parallel strokes clipped to a shape. Draw it with `render` or `spot`. */
export class Hatch implements Texture<HatchOptions> {
  public attrs: HatchOptions;
  public stroke: StrokeStyle;

  constructor(attrs: HatchOptions = {}) {
    this.attrs = { ...attrs };

    if (attrs.stroke instanceof StrokeStyle) {
      this.stroke = (attrs.color || attrs.width !== undefined)
        ? attrs.stroke.with({ color: attrs.color ?? attrs.stroke.color, width: attrs.width ?? attrs.stroke.width })
        : attrs.stroke;
    } else if (attrs.stroke) {
      this.stroke = new StrokeStyle({
        ...attrs.stroke,
        ...(attrs.color ? { color: attrs.color } : {}),
        ...(attrs.width !== undefined ? { width: attrs.width } : {}),
      });
    } else {
      this.stroke = new StrokeStyle({
        width: attrs.width ?? 1.0,
        color: attrs.color ?? '#1c1714',
        renderer: 'ribbon',
        taperStart: true,
        taperEnd: true,
      });
    }
  }

  /**
   * Renders the hatching texture inside a Shape or rectangular bounding box.
   * Strokes terminate NATURALLY with organic calligraphic tapered tips.
   */
  render(
    ctx: CanvasRenderingContext2D,
    target: Shape | HatchBounds,
    overrides: Partial<HatchOptions> = {}
  ): void {
    const effectiveAttrs = { ...this.attrs, ...overrides };

    if (effectiveAttrs.hardClip) {
      if (isShape(target)) {
        target.clip(ctx, () => {
          const bounds = target.bounds;
          this.renderInternalHardClipped(ctx, bounds, overrides);
        });
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(target.x, target.y, target.width, target.height);
        ctx.clip();
        this.renderInternalHardClipped(ctx, target, overrides);
        ctx.restore();
      }
      return;
    }

    // Natural mode: compute exact polygon scanline segments without guillotine clipping!
    const regions = isShape(target)
      ? target.regions
      : [{
          outer: [
            { x: target.x, y: target.y },
            { x: target.x + target.width, y: target.y },
            { x: target.x + target.width, y: target.y + target.height },
            { x: target.x, y: target.y + target.height },
          ],
          holes: [],
        }];

    this.renderNaturalRegions(ctx, regions, overrides);
  }

  /**
   * Renders a targeted / localized focal hatch cluster around a specific center point.
   * Strokes terminate NATURALLY with organic calligraphic tapered tips (NO dry geometric clipping!).
   */
  spot(
    ctx: CanvasRenderingContext2D,
    center: Point,
    radius: number | { rx: number; ry: number },
    overrides: Partial<HatchOptions> = {}
  ): void {
    const rx = typeof radius === 'number' ? radius : radius.rx;
    const ry = typeof radius === 'number' ? radius : radius.ry;
    const effectiveAttrs = { ...this.attrs, ...overrides };

    const baseStroke = overrides.stroke instanceof StrokeStyle
      ? overrides.stroke
      : overrides.stroke
      ? new StrokeStyle(overrides.stroke)
      : this.stroke;

    const lineStroke = baseStroke.with({
      taperStart: baseStroke.attrs.taperStart ?? true,
      taperEnd: baseStroke.attrs.taperEnd ?? true,
    });

    const angleDeg = effectiveAttrs.angle ?? -42;
    const spacing = Math.max(2, effectiveAttrs.spacing ?? 5.0);
    const lengthVar = effectiveAttrs.lengthVariation ?? 0.35;
    const jitter = effectiveAttrs.jitter ?? 0.6;
    const seed = effectiveAttrs.seed ?? 101;

    const drawPass = (deg: number, passSeed: number) => {
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const ux = cos;
      const uy = sin;
      const vx = -sin;
      const vy = cos;

      const count = Math.ceil((ry * 2) / spacing);
      const passRng = createRng(passSeed);

      for (let i = 0; i <= count; i++) {
        const d = -ry + i * spacing + (passRng.random() - 0.5) * 0.8;
        if (Math.abs(d) >= ry) continue;

        // Exact chord half-width of ellipse at offset d
        const normDist = d / ry;
        const chordHalf = rx * Math.sqrt(Math.max(0, 1 - normDist * normDist));
        if (chordHalf < 2) continue;

        // Organic pen feathering on both ends (strokes end naturally with their own tips!)
        const vStart = 1.0 + (passRng.random() - 0.5) * lengthVar * 1.2;
        const vEnd = 1.0 + (passRng.random() - 0.5) * lengthVar * 1.2;

        const h1 = chordHalf * vStart;
        const h2 = chordHalf * vEnd;

        const cx = center.x + vx * d;
        const cy = center.y + vy * d;

        const jx = (passRng.random() - 0.5) * jitter;
        const jy = (passRng.random() - 0.5) * jitter;

        const p1x = cx - ux * h1 + jx;
        const p1y = cy - uy * h1 + jy;
        const p2x = cx + ux * h2 + jx;
        const p2y = cy + uy * h2 + jy;

        // Render stroke completely from P1 to P2 with natural tapered tips!
        lineStroke.render(ctx, [
          { x: p1x, y: p1y },
          { x: p2x, y: p2y },
        ]);
      }
    };

    // Primary Pass (NO ctx.clip!)
    drawPass(angleDeg, seed);

    // Cross Pass (NO ctx.clip!)
    if (effectiveAttrs.cross) {
      const crossAng = effectiveAttrs.crossAngle ?? 48;
      drawPass(crossAng, seed + 999);
    }
  }

  private renderNaturalRegions(
    ctx: CanvasRenderingContext2D,
    regions: { outer: Point[]; holes: Point[][] }[],
    overrides: Partial<HatchOptions> = {}
  ): void {
    const effectiveAttrs = { ...this.attrs, ...overrides };

    const baseStroke = overrides.stroke instanceof StrokeStyle
      ? overrides.stroke
      : overrides.stroke
      ? new StrokeStyle(overrides.stroke)
      : this.stroke;

    const lineStroke = baseStroke.with({
      taperStart: baseStroke.attrs.taperStart ?? true,
      taperEnd: baseStroke.attrs.taperEnd ?? true,
    });

    const angleDeg = effectiveAttrs.angle ?? -42;
    const spacing = Math.max(2, effectiveAttrs.spacing ?? 5.5);
    const lengthVar = effectiveAttrs.lengthVariation ?? 0.3;
    const jitter = effectiveAttrs.jitter ?? 0.6;
    const seed = effectiveAttrs.seed ?? 101;

    // Primary Pass
    const rng1 = createRng(seed);
    const segments1 = computeRegionsHatchSegments(regions, angleDeg, spacing, lengthVar, jitter, rng1);
    for (const seg of segments1) {
      lineStroke.render(ctx, [seg.p1, seg.p2]);
    }

    // Cross Pass
    if (effectiveAttrs.cross) {
      const crossAng = effectiveAttrs.crossAngle ?? 48;
      const rng2 = createRng(seed + 999);
      const segments2 = computeRegionsHatchSegments(regions, crossAng, spacing, lengthVar, jitter, rng2);
      for (const seg of segments2) {
        lineStroke.render(ctx, [seg.p1, seg.p2]);
      }
    }
  }

  private renderInternalHardClipped(
    ctx: CanvasRenderingContext2D,
    bounds: HatchBounds,
    overrides: Partial<HatchOptions> = {}
  ): void {
    const effectiveAttrs = { ...this.attrs, ...overrides };
    const baseStroke = overrides.stroke instanceof StrokeStyle
      ? overrides.stroke
      : overrides.stroke
      ? new StrokeStyle(overrides.stroke)
      : this.stroke;

    const lineStroke = baseStroke.with({
      taperStart: baseStroke.attrs.taperStart ?? true,
      taperEnd: baseStroke.attrs.taperEnd ?? true,
    });

    const angleDeg = effectiveAttrs.angle ?? -42;
    const spacing = Math.max(2, effectiveAttrs.spacing ?? 6.0);
    const lengthVar = effectiveAttrs.lengthVariation ?? 0.3;
    const jitter = effectiveAttrs.jitter ?? 0.8;
    const seed = effectiveAttrs.seed ?? 101;

    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    const diag = Math.hypot(bounds.width, bounds.height);

    const drawPass = (deg: number, passSeed: number) => {
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      const count = Math.ceil(diag / spacing);
      const startD = -diag / 2;
      const passRng = createRng(passSeed);

      for (let i = 0; i <= count; i++) {
        const offset = startD + i * spacing + (passRng.random() - 0.5) * 1.2;
        const lineCx = cx - sin * offset;
        const lineCy = cy + cos * offset;

        const varFactor = 1.0 + (passRng.random() - 0.5) * 2 * lengthVar;
        const halfLen = (diag / 2) * varFactor;

        const p1x = lineCx - cos * halfLen + (passRng.random() - 0.5) * jitter;
        const p1y = lineCy - sin * halfLen + (passRng.random() - 0.5) * jitter;
        const p2x = lineCx + cos * halfLen + (passRng.random() - 0.5) * jitter;
        const p2y = lineCy + sin * halfLen + (passRng.random() - 0.5) * jitter;

        lineStroke.render(ctx, [
          { x: p1x, y: p1y },
          { x: p2x, y: p2y },
        ]);
      }
    };

    drawPass(angleDeg, seed);
    if (effectiveAttrs.cross) {
      drawPass(effectiveAttrs.crossAngle ?? 48, seed + 999);
    }
  }
}

/**
 * Computes exact scanline segments inside any arbitrary polygon or multi-region shape with holes.
 * Each stroke begins and ends naturally inside the polygon, tapering smoothly and skipping holes.
 */
function computeRegionsHatchSegments(
  regions: { outer: Point[]; holes: Point[][] }[],
  deg: number,
  spacing: number,
  lengthVar: number,
  jitter: number,
  passRng: { random: () => number }
): LineSegment[] {
  const allPoints = regions.flatMap(r => [r.outer, ...r.holes]).flat();
  if (allPoints.length < 3) return [];

  const bounds = getShapeBounds(allPoints);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const diag = Math.hypot(bounds.width, bounds.height);

  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const ux = cos;
  const uy = sin;
  const vx = -sin;
  const vy = cos;

  const count = Math.ceil(diag / spacing);
  const startD = -diag / 2;

  const segments: LineSegment[] = [];

  for (let i = 0; i <= count; i++) {
    const d = startD + i * spacing + (passRng.random() - 0.5) * 0.8;
    const originX = cx + vx * d;
    const originY = cy + vy * d;

    // Intersect scanline with all loops of each region
    for (const region of regions) {
      const sIntersections: number[] = [];
      const loops = [region.outer, ...region.holes];

      for (const loop of loops) {
        const n = loop.length;
        if (n < 3) continue;

        for (let j = 0; j < n; j++) {
          const pA = loop[j];
          const pB = loop[(j + 1) % n];

          const ex = pB.x - pA.x;
          const ey = pB.y - pA.y;

          const D = ux * ey - uy * ex;
          if (Math.abs(D) < 1e-6) continue;

          const wx = pA.x - originX;
          const wy = pA.y - originY;
          const s = (wx * ey - wy * ex) / D;
          const t = (uy * wx - ux * wy) / D;

          if (t >= 0 && t <= 1) {
            sIntersections.push(s);
          }
        }
      }

      if (sIntersections.length < 2) continue;

      sIntersections.sort((a, b) => a - b);

      const uniqueS: number[] = [];
      for (const val of sIntersections) {
        if (uniqueS.length === 0 || Math.abs(val - uniqueS[uniqueS.length - 1]) > 0.05) {
          uniqueS.push(val);
        }
      }
      if (uniqueS.length < 2) continue;

      // Pair intersections: [s0, s1], [s2, s3] (holes are naturally skipped between s1 and s2)
      for (let k = 0; k < uniqueS.length - 1; k += 2) {
        const sEnter = uniqueS[k];
        const sExit = uniqueS[k + 1];
        const len = sExit - sEnter;
        if (len < 3) continue;

        const pullbackStart = passRng.random() * lengthVar * 4 + 0.8;
        const pullbackEnd   = passRng.random() * lengthVar * 4 + 0.8;

        const actualStart = sEnter + pullbackStart;
        const actualEnd = sExit - pullbackEnd;

        if (actualEnd - actualStart < 2) continue;

        const jx1 = (passRng.random() - 0.5) * jitter;
        const jy1 = (passRng.random() - 0.5) * jitter;
        const jx2 = (passRng.random() - 0.5) * jitter;
        const jy2 = (passRng.random() - 0.5) * jitter;

        segments.push({
          p1: {
            x: originX + ux * actualStart + jx1,
            y: originY + uy * actualStart + jy1,
          },
          p2: {
            x: originX + ux * actualEnd + jx2,
            y: originY + uy * actualEnd + jy2,
          },
        });
      }
    }
  }

  return segments;
}

function computePolygonHatchSegments(
  points: Point[],
  deg: number,
  spacing: number,
  lengthVar: number,
  jitter: number,
  passRng: { random: () => number }
): LineSegment[] {
  return computeRegionsHatchSegments([{ outer: points, holes: [] }], deg, spacing, lengthVar, jitter, passRng);
}

function isShape(target: Shape | HatchBounds): target is Shape {
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
