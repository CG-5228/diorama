/**
 * @internal Vertex deformation algorithms. Pure functions: input points are never mutated.
 * Public entry points are the `Shape` / `Path` methods (mapVertices, displace, bend, taper, ...).
 */

import { createNoise2D } from '../../noise.js';
import type { Point, BoundingBox, DisplaceOptions, BendOptions, TaperOptions, WarpOptions, TwistOptions, InflateOptions } from '../types.js';
import { computeBoundingBox } from './geometry.js';
import { clonePoints, subdividePoints, vertexNormals } from './points.js';

export function mapPoints(
  points: readonly Point[],
  fn: (p: Point, index: number, count: number) => Point | void,
): Point[] {
  const n = points.length;
  return points.map((p, i) => {
    const copy = { x: p.x, y: p.y };
    const result = fn(copy, i, n);
    return result ? { x: result.x, y: result.y } : copy;
  });
}

/** Moves every vertex along its normal by simplex noise sampled in space. */
export function displacePoints(points: readonly Point[], closed: boolean, options: DisplaceOptions = {}): Point[] {
  const amplitude = options.amplitude ?? 2;
  const frequency = options.frequency ?? 3;
  const seed = options.seed ?? 101;
  const densify = options.densify ?? 6;
  const mode = options.mode ?? 'normal';
  const noiseX = createNoise2D(seed);
  const noiseY = createNoise2D(seed + 7919);

  const base = densify > 0 ? subdividePoints(points, densify, closed) : clonePoints(points);
  const normals = mode === 'normal' ? vertexNormals(base, closed) : [];
  const k = frequency / 100;
  const lastIndex = base.length - 1;

  return base.map((p, i) => {
    // Open paths keep their end points anchored so joins stay clean.
    const pin = !closed && (i === 0 || i === lastIndex);
    if (pin) return { x: p.x, y: p.y };
    if (mode === 'xy') {
      return {
        x: p.x + noiseX(p.x * k, p.y * k) * amplitude,
        y: p.y + noiseY(p.x * k, p.y * k) * amplitude,
      };
    }
    const d = noiseX(p.x * k, p.y * k) * amplitude;
    return { x: p.x + normals[i].x * d, y: p.y + normals[i].y * d };
  });
}

/** Bends points around an axis-aligned pivot so the geometry curves by `angle` degrees. */
export function bendPoints(points: readonly Point[], options: BendOptions): Point[] {
  const axis = options.axis ?? 'x';
  const angle = (options.angle * Math.PI) / 180;
  if (Math.abs(angle) < 1e-6) return clonePoints(points);
  const b = computeBoundingBox(points as Point[]);
  const pivot = options.pivot ?? b.center;
  const extent = axis === 'x' ? b.width : b.height;
  if (extent < 1e-6) return clonePoints(points);
  const radius = extent / angle;

  return points.map(p => {
    const along = axis === 'x' ? p.x - pivot.x : p.y - pivot.y;
    const across = axis === 'x' ? p.y - pivot.y : p.x - pivot.x;
    const theta = along / radius;
    const r = radius - across;
    const a = r * Math.sin(theta);
    const c = radius - r * Math.cos(theta);
    return axis === 'x'
      ? { x: pivot.x + a, y: pivot.y + c }
      : { x: pivot.x + c, y: pivot.y + a };
  });
}

/** Scales the cross-section linearly along an axis (1 = unchanged). */
export function taperPoints(points: readonly Point[], options: TaperOptions = {}): Point[] {
  const axis = options.axis ?? 'y';
  const from = options.from ?? 1;
  const to = options.to ?? 0.5;
  const b = computeBoundingBox(points as Point[]);
  const lo = axis === 'y' ? b.minY : b.minX;
  const span = (axis === 'y' ? b.height : b.width) || 1;
  const center = options.pivot ?? b.center;

  return points.map(p => {
    const t = ((axis === 'y' ? p.y : p.x) - lo) / span;
    const s = from + (to - from) * t;
    return axis === 'y'
      ? { x: center.x + (p.x - center.x) * s, y: p.y }
      : { x: p.x, y: center.y + (p.y - center.y) * s };
  });
}

function densified(points: readonly Point[], closed: boolean, options: WarpOptions): Point[] {
  const densify = options.densify ?? 6;
  return densify > 0 ? subdividePoints(points, densify, closed) : clonePoints(points);
}

/**
 * Free-form warp. n receives a copy of each vertex plus its normalized position uv inside rame
 * (0..1 on both axes) and returns the new point (or mutates the copy).
 */
export function warpPoints(
  points: readonly Point[],
  closed: boolean,
  frame: BoundingBox,
  fn: (p: Point, uv: Point, index: number, count: number) => Point | void,
  options: WarpOptions = {},
): Point[] {
  const base = densified(points, closed, options);
  const w = frame.width || 1;
  const h = frame.height || 1;
  return mapPoints(base, (p, i, n) => fn(p, { x: (p.x - frame.minX) / w, y: (p.y - frame.minY) / h }, i, n));
}

/** Rotates each vertex around pivot by an angle that grows linearly along xis. */
export function twistPoints(points: readonly Point[], closed: boolean, frame: BoundingBox, options: TwistOptions): Point[] {
  const axis = options.axis ?? 'y';
  const pivot = options.pivot ?? frame.center;
  const lo = axis === 'y' ? frame.minY : frame.minX;
  const span = (axis === 'y' ? frame.height : frame.width) || 1;
  return densified(points, closed, options).map(p => {
    const t = ((axis === 'y' ? p.y : p.x) - lo) / span;
    const rad = (options.angle * t * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rx = p.x - pivot.x;
    const ry = p.y - pivot.y;
    return { x: pivot.x + rx * cos - ry * sin, y: pivot.y + rx * sin + ry * cos };
  });
}

/** Pushes vertices away from (or, with a negative amount, toward) a center with smooth radial falloff. */
export function inflatePoints(points: readonly Point[], closed: boolean, frame: BoundingBox, options: InflateOptions): Point[] {
  const center = options.center ?? frame.center;
  const radius = options.radius ?? Math.max(frame.width, frame.height) / 2;
  if (radius <= 0) return clonePoints(points);
  return densified(points, closed, options).map(p => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9 || d >= radius) return p;
    const s = 1 - d / radius;
    const w = s * s * (3 - 2 * s);
    const push = options.amount * w;
    return { x: p.x + (dx / d) * push, y: p.y + (dy / d) * push };
  });
}

/** Reflects points across a vertical (xis: 'x') or horizontal (xis: 'y') line located at t. Order is preserved. */
export function reflectPoints(points: readonly Point[], axis: 'x' | 'y', at: number): Point[] {
  return points.map(p => (axis === 'x' ? { x: 2 * at - p.x, y: p.y } : { x: p.x, y: 2 * at - p.y }));
}