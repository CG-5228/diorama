/**
 * @core/draw - Low-Level Geometry Algorithms
 * 
 * Direct mathematical routines on raw Point arrays (Point[]).
 * For normal asset generation, prefer object-oriented methods on Shape and Path:
 * - shape.offset(distance)
 * - shape.roundCorners(radius)
 * - path.roundCorners(radius)
 */

import type { Point, BoundingBox, AnchorRef, EdgeInfo } from '../types.js';
import { getPolygonSignedArea } from './offset.js';

/** Builds a full BoundingBox (including left/right/top/bottom aliases) from its extents. */
export function boundsFromExtents(minX: number, minY: number, maxX: number, maxY: number): BoundingBox {
  const width = maxX - minX;
  const height = maxY - minY;
  return {
    x: minX,
    y: minY,
    width,
    height,
    minX,
    minY,
    maxX,
    maxY,
    left: minX,
    right: maxX,
    top: minY,
    bottom: maxY,
    center: { x: minX + width / 2, y: minY + height / 2 },
  };
}

export function computeBoundingBox(points: Point[]): BoundingBox {
  if (points.length === 0) return boundsFromExtents(0, 0, 0, 0);
  let minX = points[0].x, maxX = points[0].x;
  let minY = points[0].y, maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return boundsFromExtents(minX, minY, maxX, maxY);
}
export function resolveAnchor(bounds: BoundingBox, name: AnchorRef): Point {
  switch (name) {
    case 'center':      return { x: bounds.center.x, y: bounds.center.y };
    case 'top':         return { x: bounds.center.x, y: bounds.minY };
    case 'bottom':      return { x: bounds.center.x, y: bounds.maxY };
    case 'left':        return { x: bounds.minX, y: bounds.center.y };
    case 'right':       return { x: bounds.maxX, y: bounds.center.y };
    case 'topLeft':     return { x: bounds.minX, y: bounds.minY };
    case 'topRight':    return { x: bounds.maxX, y: bounds.minY };
    case 'bottomLeft':  return { x: bounds.minX, y: bounds.maxY };
    case 'bottomRight': return { x: bounds.maxX, y: bounds.maxY };
    default:            return { x: bounds.center.x, y: bounds.center.y };
  }
}

export function computeEdgeInfo(points: Point[], index: number, isClosed = true): EdgeInfo {
  const n = points.length;
  if (n < 2) {
    return {
      index: 0,
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
      mid: { x: 0, y: 0 },
      normal: { x: 0, y: 1 },
      tangent: { x: 1, y: 0 },
      angle: 0,
      normalAngle: 90,
      length: 0,
    };
  }

  const i = ((index % n) + n) % n;
  const nextIdx = (i + 1) % n;
  const p1 = points[i];
  const p2 = points[nextIdx];

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  const tangent = len > 0.0001 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };

  const isCW = isClosed ? getPolygonSignedArea(points) > 0 : true;
  const nx = isCW ? tangent.y : -tangent.y;
  const ny = isCW ? -tangent.x : tangent.x;
  const normal = { x: nx, y: ny };

  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const normalAngle = (Math.atan2(ny, nx) * 180) / Math.PI;

  return {
    index: i,
    start: p1,
    end: p2,
    mid,
    normal,
    tangent,
    angle,
    normalAngle,
    length: len,
  };
}
