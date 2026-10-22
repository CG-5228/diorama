/**
 * @internal Stroke-to-geometry: converts an open centerline into a closed ring with variable width and caps.
 */

import type { Point, RibbonWidth, LineCap } from '../types.js';
import { dist, polylineLength } from './points.js';

export function widthFunction(width: RibbonWidth): (t: number) => number {
  if (typeof width === 'number') return () => width;
  if (typeof width === 'function') return width;
  return t => width.start + (width.end - width.start) * t;
}

function unit(a: Point, b: Point): Point {
  const len = dist(a, b);
  return len > 1e-9 ? { x: (b.x - a.x) / len, y: (b.y - a.y) / len } : { x: 1, y: 0 };
}

/**
 * Returns a closed polygon outlining the stroked centerline.
 * `t` passed to the width function is the normalized arc length (0..1).
 */
export function strokeRing(points: readonly Point[], width: RibbonWidth, cap: LineCap = 'butt', arcSteps = 8): Point[] {
  const n = points.length;
  if (n < 2) return [];
  const widthAt = widthFunction(width);
  const total = polylineLength(points) || 1;

  const left: Point[] = [];
  const right: Point[] = [];
  let travelled = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) travelled += dist(points[i - 1], points[i]);
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(n - 1, i + 1)];
    const tangent = unit(prev, next);
    const half = Math.max(0, widthAt(travelled / total)) / 2;
    const nx = -tangent.y;
    const ny = tangent.x;
    left.push({ x: points[i].x + nx * half, y: points[i].y + ny * half });
    right.push({ x: points[i].x - nx * half, y: points[i].y - ny * half });
  }

  const startT = unit(points[0], points[1]);
  const endT = unit(points[n - 2], points[n - 1]);
  const startHalf = Math.max(0, widthAt(0)) / 2;
  const endHalf = Math.max(0, widthAt(1)) / 2;

  const endCap: Point[] = [];
  const startCap: Point[] = [];

  if (cap === 'square') {
    left[n - 1] = { x: left[n - 1].x + endT.x * endHalf, y: left[n - 1].y + endT.y * endHalf };
    right[n - 1] = { x: right[n - 1].x + endT.x * endHalf, y: right[n - 1].y + endT.y * endHalf };
    left[0] = { x: left[0].x - startT.x * startHalf, y: left[0].y - startT.y * startHalf };
    right[0] = { x: right[0].x - startT.x * startHalf, y: right[0].y - startT.y * startHalf };
  } else if (cap === 'round') {
    const c1 = points[n - 1];
    const nx1 = -endT.y;
    const ny1 = endT.x;
    for (let s = 1; s < arcSteps; s++) {
      const phi = (s / arcSteps) * Math.PI;
      endCap.push({
        x: c1.x + (nx1 * Math.cos(phi) + endT.x * Math.sin(phi)) * endHalf,
        y: c1.y + (ny1 * Math.cos(phi) + endT.y * Math.sin(phi)) * endHalf,
      });
    }
    const c0 = points[0];
    const nx0 = -startT.y;
    const ny0 = startT.x;
    for (let s = 1; s < arcSteps; s++) {
      const phi = (s / arcSteps) * Math.PI;
      startCap.push({
        x: c0.x - (nx0 * Math.cos(phi) + startT.x * Math.sin(phi)) * startHalf,
        y: c0.y - (ny0 * Math.cos(phi) + startT.y * Math.sin(phi)) * startHalf,
      });
    }
  }

  return [...left, ...endCap, ...right.reverse(), ...startCap];
}
