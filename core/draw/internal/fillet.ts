/**
 * @core/draw - Geometric Fillet & Corner Rounding Engine
 * 
 * Computes high-fidelity tangent circular arcs for polyline and polygon vertices.
 * Replaces crude 2-segment notches with proportional multi-step circular fillets.
 */

import type { Point } from '../types.js';

/**
 * Applies true circular arc filleting to a sequence of vertices.
 * 
 * @param vertices Array of input Points.
 * @param radius Uniform corner radius in pixels or per-vertex radius array.
 * @param closed Whether the vertex sequence represents a closed loop.
 * @param stepsPerCorner Number of arc subdivisions per rounded corner (default: 4).
 */
export function filletPoints(
  vertices: Point[],
  radius: number | number[],
  closed = true,
  stepsPerCorner = 4
): Point[] {
  const n = vertices.length;
  if (n < (closed ? 3 : 2)) {
    return vertices.map(p => ({ ...p }));
  }

  const result: Point[] = [];
  const count = closed ? n : n - 2;
  const startIndex = closed ? 0 : 1;

  if (!closed) {
    result.push({ ...vertices[0] });
  }

  for (let idx = 0; idx < count; idx++) {
    const i = closed ? idx : idx + 1;
    const prev = vertices[(i - 1 + n) % n];
    const curr = vertices[i];
    const next = vertices[(i + 1) % n];

    // Current vertex corner radius
    const r = Array.isArray(radius) ? (radius[i] ?? radius[0] ?? 0) : radius;
    if (r <= 0.001) {
      result.push({ ...curr });
      continue;
    }

    // Edge vectors pointing away from curr
    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const len1 = Math.hypot(v1x, v1y);

    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 0.001 || len2 < 0.001) {
      result.push({ ...curr });
      continue;
    }

    // Unit vectors
    const u1x = v1x / len1;
    const u1y = v1y / len1;
    const u2x = v2x / len2;
    const u2y = v2y / len2;

    // Dot product to find interior angle
    const dot = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y));

    // Collinear or reversal check
    if (dot > 0.9999 || dot < -0.9999) {
      result.push({ ...curr });
      continue;
    }

    const halfAngle = Math.acos(dot) / 2;
    const sinHalf = Math.sin(halfAngle);
    const tanHalf = Math.tan(halfAngle);

    if (Math.abs(tanHalf) < 0.0001 || Math.abs(sinHalf) < 0.0001) {
      result.push({ ...curr });
      continue;
    }

    // Maximum tangent distance is half of the shorter edge
    const maxTangent = Math.min(len1, len2) * 0.499;
    let tangentDist = r / tanHalf;
    let effRadius = r;

    if (tangentDist > maxTangent) {
      tangentDist = maxTangent;
      effRadius = tangentDist * tanHalf;
    }

    // Tangent contact points
    const pA = {
      x: curr.x + u1x * tangentDist,
      y: curr.y + u1y * tangentDist,
    };
    const pB = {
      x: curr.x + u2x * tangentDist,
      y: curr.y + u2y * tangentDist,
    };

    // Bisector vector
    const bx = u1x + u2x;
    const by = u1y + u2y;
    const bLen = Math.hypot(bx, by);

    if (bLen < 0.0001) {
      result.push({ ...curr });
      continue;
    }

    const uBx = bx / bLen;
    const uBy = by / bLen;

    const centerDist = effRadius / sinHalf;
    const cx = curr.x + uBx * centerDist;
    const cy = curr.y + uBy * centerDist;

    // Angles from circle center to contact points
    const angA = Math.atan2(pA.y - cy, pA.x - cx);
    const angB = Math.atan2(pB.y - cy, pB.x - cx);

    // Tangent arc between rays meeting at a corner is always the shortest interior arc (< PI)
    let sweep = angB - angA;
    while (sweep > Math.PI) sweep -= Math.PI * 2;
    while (sweep < -Math.PI) sweep += Math.PI * 2;

    // Generate interpolated arc vertices from pA to pB
    const steps = Math.max(2, stepsPerCorner);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const ang = angA + sweep * t;
      result.push({
        x: cx + Math.cos(ang) * effRadius,
        y: cy + Math.sin(ang) * effRadius,
      });
    }
  }

  if (!closed) {
    result.push({ ...vertices[n - 1] });
  }

  // Deduplicate consecutive identical vertices
  return deduplicatePoints(result);
}

function deduplicatePoints(pts: Point[]): Point[] {
  if (pts.length < 2) return pts;
  const deduped: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = deduped[deduped.length - 1];
    if (Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y) > 0.001) {
      deduped.push(pts[i]);
    }
  }
  return deduped;
}
