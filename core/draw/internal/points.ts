/**
 * @internal Pure point-list algorithms shared by Shape, Path, the renderers and the ops modules.
 * Nothing here touches Canvas. Never import this file from outside `core/draw`.
 */

import type { Point, AnchorRef, BoundingBox } from '../types.js';
import { resolveAnchor } from './geometry.js';
import type { AnchorSet } from './anchors.js';

export function clonePoints(points: readonly Point[]): Point[] {
  return points.map(p => ({ x: p.x, y: p.y }));
}

export function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// ------------------------------------------------------------------
// In-place transform visitors (used by Shape and Path alike)
// ------------------------------------------------------------------

export type PointVisitor = (p: Point) => void;

export function translateVisitor(dx: number, dy: number): PointVisitor {
  return p => { p.x += dx; p.y += dy; };
}

export function rotateVisitor(angleDegrees: number, pivot: Point): PointVisitor {
  const rad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return p => {
    const rx = p.x - pivot.x;
    const ry = p.y - pivot.y;
    p.x = pivot.x + rx * cos - ry * sin;
    p.y = pivot.y + rx * sin + ry * cos;
  };
}

export function scaleVisitor(sx: number, sy: number, pivot: Point): PointVisitor {
  return p => {
    p.x = pivot.x + (p.x - pivot.x) * sx;
    p.y = pivot.y + (p.y - pivot.y) * sy;
  };
}

export function resolvePivot(
  pivot: Point | AnchorRef | undefined,
  bounds: BoundingBox,
  anchors?: AnchorSet,
): Point {
  if (pivot === undefined) return bounds.center;
  if (typeof pivot !== 'string') return pivot;
  return anchors?.get(pivot) ?? resolveAnchor(bounds, pivot);
}

// ------------------------------------------------------------------
// Polyline measurement
// ------------------------------------------------------------------

/** Returns the number of segments of a polyline (closed adds the wrap segment). */
function segmentCount(points: readonly Point[], closed: boolean): number {
  return closed ? points.length : Math.max(0, points.length - 1);
}

export function polylineLength(points: readonly Point[], closed = false): number {
  let total = 0;
  const n = segmentCount(points, closed);
  for (let i = 0; i < n; i++) total += dist(points[i], points[(i + 1) % points.length]);
  return total;
}

/** Cumulative arc length at each vertex (length = points.length, plus total for closed loops). */
function cumulative(points: readonly Point[], closed: boolean): number[] {
  const acc = [0];
  const n = segmentCount(points, closed);
  for (let i = 0; i < n; i++) {
    acc.push(acc[i] + dist(points[i], points[(i + 1) % points.length]));
  }
  return acc;
}

export interface PolylineSample {
  point: Point;
  /** Unit tangent. */
  tangent: Point;
  /** Segment index containing the sample. */
  segment: number;
}

/** Samples a polyline at distance `d` from its start (clamped for open, wrapped for closed). */
export function sampleAtDistance(points: readonly Point[], d: number, closed: boolean, acc?: number[]): PolylineSample {
  const n = points.length;
  if (n === 0) return { point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 }, segment: 0 };
  if (n === 1) return { point: { ...points[0] }, tangent: { x: 1, y: 0 }, segment: 0 };
  const cum = acc ?? cumulative(points, closed);
  const total = cum[cum.length - 1];
  let target = d;
  if (closed && total > 0) target = ((d % total) + total) % total;
  else target = Math.max(0, Math.min(total, d));

  const segs = segmentCount(points, closed);
  let lo = 0;
  let hi = segs - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid + 1] < target) lo = mid + 1; else hi = mid;
  }
  const a = points[lo];
  const b = points[(lo + 1) % n];
  const segLen = cum[lo + 1] - cum[lo];
  const t = segLen > 1e-9 ? (target - cum[lo]) / segLen : 0;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return {
    point: lerp(a, b, t),
    tangent: len > 1e-9 ? { x: (b.x - a.x) / len, y: (b.y - a.y) / len } : { x: 1, y: 0 },
    segment: lo,
  };
}

/** Resamples a polyline to `count` points equally spaced by arc length. */
export function resamplePolyline(points: readonly Point[], count: number, closed: boolean): Point[] {
  const n = Math.max(2, Math.floor(count));
  if (points.length < 2) return clonePoints(points);
  const cum = cumulative(points, closed);
  const total = cum[cum.length - 1];
  const out: Point[] = [];
  const divisor = closed ? n : n - 1;
  for (let i = 0; i < n; i++) {
    out.push(sampleAtDistance(points, (total * i) / divisor, closed, cum).point);
  }
  return out;
}

/** Extracts the portion between normalized parameters t0 and t1 (by arc length). */
export function slicePolyline(points: readonly Point[], t0: number, t1: number, closed: boolean): Point[] {
  if (points.length < 2) return clonePoints(points);
  const cum = cumulative(points, closed);
  const total = cum[cum.length - 1];
  const d0 = Math.max(0, Math.min(1, Math.min(t0, t1))) * total;
  const d1 = Math.max(0, Math.min(1, Math.max(t0, t1))) * total;
  const start = sampleAtDistance(points, d0, false, cum);
  const end = sampleAtDistance(points, d1, false, cum);
  const out: Point[] = [start.point];
  const segs = segmentCount(points, closed);
  for (let i = 0; i < segs; i++) {
    const vertexIndex = (i + 1) % points.length;
    if (cum[i + 1] > d0 + 1e-9 && cum[i + 1] < d1 - 1e-9) out.push({ ...points[vertexIndex] });
  }
  out.push(end.point);
  return out;
}

/** Inserts points so that no edge is longer than `maxEdge`. */
export function subdividePoints(points: readonly Point[], maxEdge: number, closed: boolean): Point[] {
  if (maxEdge <= 0 || points.length < 2) return clonePoints(points);
  const out: Point[] = [];
  const segs = segmentCount(points, closed);
  for (let i = 0; i < segs; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const parts = Math.max(1, Math.ceil(dist(a, b) / maxEdge));
    for (let s = 0; s < parts; s++) out.push(lerp(a, b, s / parts));
  }
  if (!closed) out.push({ ...points[points.length - 1] });
  return out;
}

/** Chaikin corner cutting. Open polylines keep their endpoints. */
export function chaikin(points: readonly Point[], iterations: number, closed: boolean, ratio = 0.25): Point[] {
  let pts = clonePoints(points);
  for (let it = 0; it < iterations && pts.length > 2; it++) {
    const next: Point[] = [];
    const segs = segmentCount(pts, closed);
    if (!closed) next.push({ ...pts[0] });
    for (let i = 0; i < segs; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      next.push(lerp(a, b, ratio), lerp(a, b, 1 - ratio));
    }
    if (!closed) next.push({ ...pts[pts.length - 1] });
    pts = next;
  }
  return pts;
}

/** Unit normals per vertex (left-hand side of the travel direction), averaged at joints. */
export function vertexNormals(points: readonly Point[], closed: boolean): Point[] {
  const n = points.length;
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const next = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty);
    out.push(len > 1e-9 ? { x: -ty / len, y: tx / len } : { x: 0, y: 1 });
  }
  return out;
}

/** Parallel open polyline at signed `distance` (positive = left of travel direction), with miter limiting. */
export function offsetPolyline(points: readonly Point[], distance: number, miterLimit = 2.5): Point[] {
  const n = points.length;
  if (n < 2) return clonePoints(points);
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    let nx: number;
    let ny: number;
    let scale = 1;
    if (i === 0 || i === n - 1) {
      const a = points[i === 0 ? 0 : n - 2];
      const b = points[i === 0 ? 1 : n - 1];
      const len = dist(a, b) || 1;
      nx = -(b.y - a.y) / len;
      ny = (b.x - a.x) / len;
    } else {
      const a = points[i - 1];
      const b = points[i];
      const c = points[i + 1];
      const l1 = dist(a, b) || 1;
      const l2 = dist(b, c) || 1;
      const n1x = -(b.y - a.y) / l1;
      const n1y = (b.x - a.x) / l1;
      const n2x = -(c.y - b.y) / l2;
      const n2y = (c.x - b.x) / l2;
      const sx = n1x + n2x;
      const sy = n1y + n2y;
      const sl = Math.hypot(sx, sy);
      if (sl < 1e-6) { nx = n1x; ny = n1y; } else {
        nx = sx / sl;
        ny = sy / sl;
        const cosHalf = Math.max(0.2, nx * n1x + ny * n1y);
        scale = Math.min(miterLimit, 1 / cosHalf);
      }
    }
    out.push({ x: points[i].x + nx * distance * scale, y: points[i].y + ny * distance * scale });
  }
  return out;
}

/** Shoelace area (absolute value). */
export function polygonArea(points: readonly Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}
