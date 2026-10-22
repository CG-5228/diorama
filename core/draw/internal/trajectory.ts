/**
 * @core/draw - Trajectory Solver
 * 
 * Extracts trajectory deformation math (taper, wobble, caliper noise) from the rendering logic.
 * Outputs a rich node array containing normals and local widths that can be consumed
 * by the ribbon stroke renderer.
 */

import { createRng } from '../../random.js';
import type { Point, StrokeJoin } from '../types.js';

export interface TrajectoryOptions {
  width: number;
  closed: boolean;
  taperStart?: boolean;
  taperEnd?: boolean;
  caliperNoise?: number;
  jitter?: number;
  seed?: number;
  scale?: number;
  join?: StrokeJoin;
  miterLimit?: number;
}

export interface ResolvedNode {
  x: number;
  y: number;
  nx: number;
  ny: number;
  miterScale: number;
  width: number;
  distance: number;
}

function isPointsEqual(p1: Point, p2: Point): boolean {
  return Math.abs(p1.x - p2.x) < 0.001 && Math.abs(p1.y - p2.y) < 0.001;
}

export function resolveTrajectory(rawPoints: Point[], opts: TrajectoryOptions): ResolvedNode[] {
  const isClosed = opts.closed;
  const scale = opts.scale ?? 1.0;
  
  const cleanInput = [...rawPoints];
  if (isClosed && cleanInput.length > 2 && isPointsEqual(cleanInput[0], cleanInput[cleanInput.length - 1])) {
    cleanInput.pop();
  }
  const n = cleanInput.length;
  if (n < 2) return [];

  const seed = opts.seed ?? 1;
  const rng = createRng(seed);
  const jitter = opts.jitter ?? 0.25;

  // Jitter Pass
  const poly: Point[] = [];
  for (let i = 0; i < n; i++) {
    const p = cleanInput[i];
    if (i === 0 || (isClosed ? i === 0 : i === n - 1)) {
      poly.push({ x: p.x, y: p.y });
    } else {
      const jx = (rng.random() - 0.5) * jitter;
      const jy = (rng.random() - 0.5) * jitter;
      poly.push({ x: p.x + jx, y: p.y + jy });
    }
  }

  // Pre-calculate total arc length
  let totalLength = 0;
  for (let i = 1; i < n; i++) {
    totalLength += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
  }
  if (isClosed) {
    totalLength += Math.hypot(poly[0].x - poly[n - 1].x, poly[0].y - poly[n - 1].y);
  }

  const taperDistStart = isClosed ? 0 : Math.min(totalLength * 0.25, (7.0 + rng.random() * 4.0) * scale);
  const taperDistEnd   = isClosed ? 0 : Math.min(totalLength * 0.38, (14.0 + rng.random() * 8.0) * scale);

  const startScale = opts.taperStart ? 0.25 : (1.05 + rng.random() * 0.12);
  const noiseFreq1 = 2.5 + rng.random() * 2.0;
  const noiseFreq2 = 6.0 + rng.random() * 3.0;
  const noiseAmp = opts.caliperNoise ?? 0.16;
  const noisePhase = rng.random() * Math.PI * 2;
  const join = opts.join ?? 'miter';
  const miterLimit = opts.miterLimit ?? 6.0;

  let accumDist = 0;
  const nodes: ResolvedNode[] = [];

  for (let i = 0; i < n; i++) {
    if (i > 0) {
      accumDist += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
    }

    let nx = 0;
    let ny = 0;
    let miterScale = 1.0;

    if (isClosed) {
      const prev = poly[(i - 1 + n) % n];
      const next = poly[(i + 1) % n];

      const inDx = poly[i].x - prev.x;
      const inDy = poly[i].y - prev.y;
      const inLen = Math.hypot(inDx, inDy);

      const outDx = next.x - poly[i].x;
      const outDy = next.y - poly[i].y;
      const outLen = Math.hypot(outDx, outDy);

      if (inLen > 0.0001 && outLen > 0.0001) {
        const inNx = -inDy / inLen;
        const inNy = inDx / inLen;
        const outNx = -outDy / outLen;
        const outNy = outDx / outLen;

        const sumNx = inNx + outNx;
        const sumNy = inNy + outNy;
        const sumLen = Math.hypot(sumNx, sumNy);

        if (sumLen > 0.0001) {
          nx = sumNx / sumLen;
          ny = sumNy / sumLen;

          const dot = inNx * outNx + inNy * outNy;
          const miter = Math.sqrt(2 / Math.max(0.01, 1 + dot));
          miterScale = Math.min(miterLimit, miter);
        } else {
          nx = outNx;
          ny = outNy;
        }
      }
    } else {
      if (i === 0) {
        const tx = poly[1].x - poly[0].x;
        const ty = poly[1].y - poly[0].y;
        const tLen = Math.hypot(tx, ty);
        if (tLen > 0.0001) {
          nx = -ty / tLen;
          ny =  tx / tLen;
        }
      } else if (i === n - 1) {
        const tx = poly[i].x - poly[i - 1].x;
        const ty = poly[i].y - poly[i - 1].y;
        const tLen = Math.hypot(tx, ty);
        if (tLen > 0.0001) {
          nx = -ty / tLen;
          ny =  tx / tLen;
        }
      } else {
        const prev = poly[i - 1];
        const next = poly[i + 1];

        const inDx = poly[i].x - prev.x;
        const inDy = poly[i].y - prev.y;
        const inLen = Math.hypot(inDx, inDy);

        const outDx = next.x - poly[i].x;
        const outDy = next.y - poly[i].y;
        const outLen = Math.hypot(outDx, outDy);

        if (inLen > 0.0001 && outLen > 0.0001) {
          const inNx = -inDy / inLen;
          const inNy = inDx / inLen;
          const outNx = -outDy / outLen;
          const outNy = outDx / outLen;

          const sumNx = inNx + outNx;
          const sumNy = inNy + outNy;
          const sumLen = Math.hypot(sumNx, sumNy);

          if (sumLen > 0.0001) {
            nx = sumNx / sumLen;
            ny = sumNy / sumLen;

            const dot = inNx * outNx + inNy * outNy;
            if (join === 'bevel') {
              miterScale = 1.0;
            } else if (join === 'round') {
              const miter = Math.sqrt(2 / Math.max(0.01, 1 + dot));
              miterScale = Math.min(1.4, miter);
            } else {
              const miter = Math.sqrt(2 / Math.max(0.01, 1 + dot));
              miterScale = Math.min(miterLimit, miter);
            }
          } else {
            nx = outNx;
            ny = outNy;
          }
        }
      }
    }

    let startFactor = 1.0;
    if (!isClosed && accumDist < taperDistStart) {
      const u = accumDist / taperDistStart;
      const smoothU = u * u * (3 - 2 * u);
      if (opts.taperStart) {
        startFactor = 0.2 + 0.8 * Math.sin((u * Math.PI) / 2);
      } else {
        startFactor = startScale + (1.0 - startScale) * smoothU;
      }
    }

    let endFactor = 1.0;
    const distToEnd = totalLength - accumDist;
    if (!isClosed && distToEnd < taperDistEnd) {
      const v = distToEnd / taperDistEnd;
      const smoothV = Math.sin((v * Math.PI) / 2);
      if (opts.taperEnd) {
        endFactor = 0.20 + 0.80 * Math.pow(smoothV, 1.2);
      } else {
        endFactor = 0.70 + 0.30 * smoothV;
      }
    }

    const normPos = isClosed ? (i / n) * Math.PI * 2 : (accumDist / totalLength) * Math.PI;
    const organicWobble = 1.0
      + noiseAmp * Math.sin(normPos * noiseFreq1 + noisePhase)
      + (noiseAmp * 0.4) * Math.sin(normPos * noiseFreq2 + noisePhase * 1.5);

    const localWidth = Math.max(0.4 * scale, opts.width * startFactor * endFactor * organicWobble);

    nodes.push({
      x: poly[i].x,
      y: poly[i].y,
      nx,
      ny,
      miterScale,
      width: localWidth,
      distance: accumDist
    });
  }

  if (isClosed && nodes.length > 0) {
    const first = nodes[0];
    nodes.push({
      x: first.x,
      y: first.y,
      nx: first.nx,
      ny: first.ny,
      miterScale: first.miterScale,
      width: first.width,
      distance: totalLength
    });
  }

  return nodes;
}
