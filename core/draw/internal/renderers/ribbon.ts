/**
 * @core/draw - Ribbon Stroke Engine (Attribute-Driven)
 * 
 * Renders lines and paths with organic calligraphic dynamics:
 * - Differentiated ends (firm attack, graceful exit)
 * - Continuous organic caliper (pressure fluctuations driven by PRNG)
 * - Two renderers: 'clean' (uniform native vector stroke) and 'ribbon' (calligraphic, the default)
 * - Seamless support for closed loops (perimeter outlines with continuous miter join) and open paths
 */

import { createRng } from '../../../random.js';
import type { Point, StrokeOptions, StrokeJoin } from '../../types.js';
import { resolveTrajectory } from '../trajectory.js';

export function renderRibbonStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  attrs: StrokeOptions = {}
): void {
  if (!points || points.length < 2) return;

  const renderer = attrs.renderer ?? 'ribbon';
  const scale = attrs.scale ?? 1.0;
  const baseWidth = (attrs.width ?? 2.4) * scale;
  const color = attrs.color ?? '#1c1714';
  const seed = attrs.seed ?? 1;
  const closed = attrs.closed ?? false;
  const join: StrokeJoin = attrs.join ?? 'miter';

  // 1. CLEAN STYLE: Fast, crisp native vector stroke
  if (renderer === 'clean') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = baseWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = join === 'bevel' ? 'bevel' : (join === 'miter' ? 'miter' : 'round');
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    if (closed) {
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
    return;
  }

  const passes = attrs.passes ?? 1;
  const jitter = (attrs.jitter ?? 0.25) * scale;
  const caliperNoise = attrs.caliperNoise ?? 0.16;
  const miterLimit = attrs.miterLimit ?? 6.0;

  // 2. CLOSED POLYGONS / LOOPS:
  // Render via clean miter/bevel vector stroke with organic handdrawn micro-variation.
  // Avoids self-intersection loops, knots, and 'evenodd' holes on acute corners (stars, arrowheads).
  if (closed) {
    drawClosedRibbonStroke(ctx, points, {
      width: baseWidth,
      color,
      closed: true,
      taperStart: false,
      taperEnd: false,
      caliperNoise,
      jitter,
      seed,
      scale,
      join,
      miterLimit,
      passes,
    });
    return;
  }

  for (let pass = 0; pass < passes; pass++) {
    const passSeed = seed + pass * 73;
    drawRibbonPass(ctx, points, {
      width: baseWidth * (pass === 0 ? 1.0 : 0.75),
      color,
      closed,
      taperStart: attrs.taperStart ?? false,
      taperEnd: attrs.taperEnd ?? true,
      caliperNoise,
      jitter,
      seed: passSeed,
      scale,
      join,
      miterLimit,
    });
  }
}

interface RibbonPassOptions {
  width: number;
  color: string;
  closed: boolean;
  taperStart: boolean;
  taperEnd: boolean;
  caliperNoise: number;
  jitter: number;
  seed: number;
  scale: number;
  join: StrokeJoin;
  miterLimit: number;
}

function drawRibbonPass(
  ctx: CanvasRenderingContext2D,
  rawPoints: Point[],
  opts: RibbonPassOptions
): void {
  const isClosed = opts.closed;
  const nodes = resolveTrajectory(rawPoints, {
    width: opts.width,
    closed: isClosed,
    taperStart: opts.taperStart,
    taperEnd: opts.taperEnd,
    caliperNoise: opts.caliperNoise,
    jitter: opts.jitter,
    seed: opts.seed,
    scale: opts.scale,
    join: opts.join,
    miterLimit: opts.miterLimit
  });

  if (nodes.length < 2) return;

  const rng = createRng(opts.seed);
  const noisePhase = rng.random() * Math.PI * 2;
  const totalLength = nodes[nodes.length - 1].distance;

  const leftSide: Point[] = [];
  const rightSide: Point[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const normPos = isClosed ? (i / (nodes.length - (isClosed ? 1 : 0))) * Math.PI * 2 : (totalLength > 0 ? (node.distance / totalLength) * Math.PI : 0);
    const asymm = 1.0 + 0.04 * Math.sin(normPos * 3 + noisePhase);

    const halfW = (node.width * node.miterScale) / 2;

    leftSide.push({
      x: node.x + node.nx * halfW * asymm,
      y: node.y + node.ny * halfW * asymm,
    });
    rightSide.push({
      x: node.x - node.nx * halfW * (2 - asymm),
      y: node.y - node.ny * halfW * (2 - asymm),
    });
  }

  // Draw Ribbon Polygon
  ctx.save();
  ctx.fillStyle = opts.color;
  ctx.beginPath();

  ctx.moveTo(leftSide[0].x, leftSide[0].y);
  for (let i = 1; i < leftSide.length; i++) {
    ctx.lineTo(leftSide[i].x, leftSide[i].y);
  }

  const endP = nodes[nodes.length - 1];
  ctx.quadraticCurveTo(endP.x, endP.y, rightSide[rightSide.length - 1].x, rightSide[rightSide.length - 1].y);
  for (let i = rightSide.length - 2; i >= 0; i--) ctx.lineTo(rightSide[i].x, rightSide[i].y);
  const startP = nodes[0];
  ctx.quadraticCurveTo(startP.x, startP.y, leftSide[0].x, leftSide[0].y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function isPointsEqual(p1: Point, p2: Point): boolean {
  return Math.abs(p1.x - p2.x) < 0.001 && Math.abs(p1.y - p2.y) < 0.001;
}

interface ClosedStrokeOptions {
  width: number;
  color: string;
  closed: boolean;
  taperStart: boolean;
  taperEnd: boolean;
  caliperNoise: number;
  jitter: number;
  seed: number;
  scale: number;
  join: StrokeJoin;
  miterLimit: number;
  passes: number;
}

function drawClosedRibbonStroke(
  ctx: CanvasRenderingContext2D,
  rawPoints: Point[],
  opts: ClosedStrokeOptions
): void {
  const n = rawPoints.length;
  if (n < 2) return;

  const clean = [...rawPoints];
  if (clean.length > 2 && isPointsEqual(clean[0], clean[clean.length - 1])) {
    clean.pop();
  }
  const count = clean.length;
  if (count < 2) return;

  ctx.save();
  ctx.strokeStyle = opts.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = opts.join === 'bevel' ? 'bevel' : (opts.join === 'round' ? 'round' : 'miter');
  ctx.miterLimit = opts.miterLimit;

  for (let pass = 0; pass < opts.passes; pass++) {
    const rng = createRng(opts.seed + pass * 53);
    const passWidth = opts.width * (pass === 0 ? 1.0 : 0.75);
    ctx.lineWidth = passWidth;

    ctx.beginPath();
    if (pass === 0 || opts.jitter < 0.05) {
      // Primary pass: crisp continuous vector outline with clean miter corners
      ctx.moveTo(clean[0].x, clean[0].y);
      for (let i = 1; i < count; i++) {
        ctx.lineTo(clean[i].x, clean[i].y);
      }
    } else {
      // Secondary pass: subtle organic ink vibration along the perimeter
      const jx0 = (rng.random() - 0.5) * opts.jitter * 0.4;
      const jy0 = (rng.random() - 0.5) * opts.jitter * 0.4;
      ctx.moveTo(clean[0].x + jx0, clean[0].y + jy0);
      for (let i = 1; i < count; i++) {
        const jx = (rng.random() - 0.5) * opts.jitter * 0.4;
        const jy = (rng.random() - 0.5) * opts.jitter * 0.4;
        ctx.lineTo(clean[i].x + jx, clean[i].y + jy);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}
