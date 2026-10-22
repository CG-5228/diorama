/**
 * @core/draw - Path (lines, arcs, curves, waves) and PathBuilder
 *
 * A Path is an open or closed polyline. It is stroked with a StrokeStyle, measured, sliced, resampled,
 * deformed, or converted to filled geometry with `toShape()`.
 *
 * Mutation contract: translate / rotate / scale / moveTo mutate in place and return `this`;
 * everything else returns a new Path or Shape. `points` returns a copy.
 */

import { createNoise2D } from '../../noise.js';
import type {
  Point,
  LineShapeOptions,
  ArcOptions,
  CurveOptions,
  WaveShapeOptions,
  SplineOptions,
  BezierOptions,
  WobbleOptions,
  StrokeOptions,
  AnchorRef,
  BoundingBox,
  EdgeInfo,
  DisplaceOptions,
  BendOptions,
  TaperOptions,
  WarpOptions,
  TwistOptions,
  InflateOptions,
  ToShapeOptions,
  LineToShapeInput,
  RibbonWidth,
  ShapeStyleOptions,
} from '../types.js';
import type { Transformable } from '../types.js';
import { StrokeStyle } from '../styles/stroke-style.js';
import { ShapeStyle } from '../styles/shape-style.js';
import { CompoundShape, Shape } from './shape.js';
import { filletPoints } from '../internal/fillet.js';
import { offsetPolygon } from '../internal/offset.js';
import { computeBoundingBox, resolveAnchor, computeEdgeInfo } from '../internal/geometry.js';
import { registerPathConstructor } from '../internal/registry.js';
import { AnchorSet } from '../internal/anchors.js';
import {
  clonePoints,
  translateVisitor,
  rotateVisitor,
  scaleVisitor,
  resolvePivot,
  polylineLength,
  sampleAtDistance,
  resamplePolyline,
  slicePolyline,
  subdividePoints,
  chaikin,
  offsetPolyline,
  type PointVisitor,
} from '../internal/points.js';
import { mapPoints, displacePoints, bendPoints, taperPoints, warpPoints, twistPoints, inflatePoints, reflectPoints } from '../internal/deform.js';
import { strokeRing } from '../internal/stroker.js';

/** An open or closed line. Stroke it with `stroke`, or convert it into a fillable shape with `toShape`. */
export class Path implements Transformable {
  private readonly _points: Point[];

  /** Whether the last point connects back to the first. */
  readonly closed: boolean;

  /** Prefer the static factories (`Path.line`, `Path.curve`, ...). Points are copied. */
  constructor(points: Point[], closed = false) {
    this._points = clonePoints(points);
    this.closed = closed;
  }

  /** Copy of the vertices. */
  get points(): Point[] {
    return clonePoints(this._points);
  }

  // ==========================================
  // INTROSPECTION & ANCHORS
  // ==========================================

  get bounds(): BoundingBox {
    return computeBoundingBox(this._points);
  }

  get center(): Point {
    return this.bounds.center;
  }

  private _anchors?: AnchorSet;

  /** Built-in bounding-box anchor ('center', 'top', 'bottomLeft', ...) or a custom anchor set with setAnchor. */
  anchor(name: AnchorRef): Point {
    return this._anchors?.get(name) ?? resolveAnchor(this.bounds, name);
  }

  /**
   * Registers a custom named anchor. `at` is an absolute Point, or a number (0..1) meaning
   * "that fraction of the arc length along this path" (path.setAnchor('mid', 0.5)).
   * Custom anchors follow translate/rotate/scale/moveTo and clone()/flip(), and are dropped by operations
   * that build new geometry. Built-in names cannot be redefined.
   */
  setAnchor(name: string, at: Point | number): this {
    (this._anchors ??= new AnchorSet()).set(name, typeof at === 'number' ? this.pointAt(at) : at);
    return this;
  }

  /** Names of the custom anchors set with setAnchor. */
  get anchorNames(): string[] {
    return this._anchors?.names() ?? [];
  }

  private adoptAnchors(source: Path, map?: (p: Point) => Point): this {
    if (source._anchors) (this._anchors ??= new AnchorSet()).adopt(source._anchors, map);
    return this;
  }

  vertex(index: number): Point {
    const n = this._points.length;
    if (n === 0) return { x: 0, y: 0 };
    return { ...this._points[((index % n) + n) % n] };
  }

  edge(index: number): EdgeInfo {
    return computeEdgeInfo(this._points, index, this.closed);
  }

  // ==========================================
  // MEASURING ALONG THE PATH (t is normalized arc length, 0..1)
  // ==========================================

  /** Total length in pixels (includes the closing segment for closed paths). */
  get length(): number {
    return polylineLength(this._points, this.closed);
  }

  /** Point at normalized distance t. Use as a dynamic anchor: `shape.moveTo(path.pointAt(0.5))`. */
  pointAt(t: number): Point {
    return sampleAtDistance(this._points, this.length * t, this.closed).point;
  }

  /** Unit direction of travel at t. */
  tangentAt(t: number): Point {
    return sampleAtDistance(this._points, this.length * t, this.closed).tangent;
  }

  /** Unit normal at t: the tangent rotated +90 degrees, `(-dy, dx)`. On screen (y grows downward) this points to the right-hand side of the direction of travel. */
  normalAt(t: number): Point {
    const tan = this.tangentAt(t);
    return { x: -tan.y === 0 ? 0 : -tan.y, y: tan.x === 0 ? 0 : tan.x };
  }

  // ==========================================
  // IN-PLACE TRANSFORMS (return this)
  // ==========================================

  private visit(visitor: PointVisitor): this {
    this._points.forEach(visitor);
    this._anchors?.visit(visitor);
    return this;
  }

  translate(dx: number, dy: number): this {
    return this.visit(translateVisitor(dx, dy));
  }

  rotate(angleDegrees: number, pivot?: Point | AnchorRef): this {
    return this.visit(rotateVisitor(angleDegrees, resolvePivot(pivot, this.bounds, this._anchors)));
  }

  scale(sx: number, sy = sx, pivot?: Point | AnchorRef): this {
    return this.visit(scaleVisitor(sx, sy, resolvePivot(pivot, this.bounds, this._anchors)));
  }

  moveTo(target: Point, myAnchor: AnchorRef = 'center'): this {
    const current = this.anchor(myAnchor);
    return this.translate(target.x - current.x, target.y - current.y);
  }

  clone(): Path {
    return new Path(this._points, this.closed).adoptAnchors(this);
  }

  // ==========================================
  // NEW PATHS (immutable)
  // ==========================================

  /** Same points in reverse order. */
  reverse(): Path {
    return new Path([...this._points].reverse(), this.closed);
  }

  /** Portion between normalized distances t0 and t1 (always open). */
  slice(t0: number, t1: number): Path {
    return new Path(slicePolyline(this._points, t0, t1, this.closed), false);
  }

  /** `count` evenly spaced points along the path. */
  resample(count: number): Path {
    return new Path(resamplePolyline(this._points, count, this.closed), this.closed);
  }

  /** Parallel path at `distance` pixels. Positive values move along `normalAt` (the right-hand side of the travel direction on screen). */
  offset(distance: number, miterLimit = 2.5): Path {
    if (this.closed) {
      // offsetPolygon pushes outward; flip so positive means the same side as open paths.
      const area = signedArea(this._points);
      return new Path(offsetPolygon(this._points, area > 0 ? -distance : distance, { miterLimit }), true);
    }
    return new Path(offsetPolyline(this._points, distance, miterLimit), false);
  }

  /** Circular fillet on corners. */
  roundCorners(radius: number | number[], stepsPerCorner = 4): Path {
    return new Path(filletPoints(this._points, radius, this.closed, stepsPerCorner), this.closed);
  }

  mapVertices(fn: (p: Point, index: number, count: number) => Point | void): Path {
    return new Path(mapPoints(this._points, fn), this.closed);
  }

  /** Organic noise displacement; end points of open paths stay pinned. */
  displace(options: DisplaceOptions = {}): Path {
    return new Path(displacePoints(this._points, this.closed, options), this.closed);
  }

  subdivide(maxEdge: number): Path {
    return new Path(subdividePoints(this._points, maxEdge, this.closed), this.closed);
  }

  smooth(iterations = 1): Path {
    return new Path(chaikin(this._points, iterations, this.closed), this.closed);
  }

  bend(options: BendOptions): Path {
    return new Path(bendPoints(this._points, options), this.closed);
  }

  taper(options: TaperOptions = {}): Path {
    return new Path(taperPoints(this._points, options), this.closed);
  }

  /** Free-form warp: fn(p, uv) gets a copy of each vertex and its normalized position (0..1) in the path bounds; returns the new point. */
  warp(fn: (p: Point, uv: Point) => Point | void, options: WarpOptions = {}): Path {
    return new Path(warpPoints(this._points, this.closed, this.bounds, fn, options), this.closed);
  }

  /** Rotates vertices progressively along an axis (0 at the min end, angle degrees at the max end). */
  twist(options: TwistOptions): Path {
    return new Path(twistPoints(this._points, this.closed, this.bounds, options), this.closed);
  }

  /** Swells (amount > 0) or pinches (amount < 0) the area around center with smooth radial falloff. */
  inflate(options: InflateOptions): Path {
    return new Path(inflatePoints(this._points, this.closed, this.bounds, options), this.closed);
  }

  /**
   * Mirror copy across a line (axis: 'x': left <-> right across x = at; aaxis: 'y': top <-> bottom across y = at;
   * at defaults to the bounds center). Point order is kept, so the start maps to the reflected start.
   * To build a symmetric outline from half a contour, join it with its reversed flip and close it.
   */
  flip(axis: 'x' | 'y' = 'x', at?: number): Path {
    const line = at ?? (axis === 'x' ? this.bounds.center.x : this.bounds.center.y);
    return new Path(reflectPoints(this._points, axis, line), this.closed)
      .adoptAnchors(this, p => reflectPoints([p], axis, line)[0]);
  }

  // ==========================================
  // PATH -> SHAPE
  // ==========================================

  /** Closes the path and returns it as a fillable shape (the line itself becomes the boundary). */
  close(): CompoundShape {
    return new CompoundShape(this._points);
  }

  /**
   * Turns the line into filled geometry of the given thickness (constant, taper, or function of t).
   * Open paths get `cap` ends; closed paths become a constant-width ring.
   * Accepts a number, function, ToShapeOptions, or a StrokeStyle/StrokeOptions.
   */
  toShape(options: LineToShapeInput = 2): Shape {
    const { width, cap, clean } = normalizeToShapeOptions(options);
    if (this._points.length < 2) return new CompoundShape([]);

    if (this.closed) {
      const w = typeof width === 'number'
        ? width
        : typeof width === 'function' ? width(0.5) : (width.start + width.end) / 2;
      return new CompoundShape(this._points).outline({ width: w });
    }

    const ring = new CompoundShape(strokeRing(this._points, width, cap));
    return clean ? ring.union(ring) : ring;
  }

  /** Alias of toShape (the name agents tend to reach for): turns the line into a filled ribbon. */
  toRibbon(options: LineToShapeInput = 2): Shape {
    return this.toShape(options);
  }

  // ==========================================
  // RENDERING
  // ==========================================

  /** Strokes the line with a StrokeStyle (or plain options). */
  stroke(ctx: CanvasRenderingContext2D, strokeStyle?: StrokeStyle | StrokeOptions): this {
    if (this._points.length < 2) return this;
    const style = strokeStyle instanceof StrokeStyle ? strokeStyle : new StrokeStyle(strokeStyle);
    style.render(ctx, this._points, this.closed);
    return this;
  }

  /**
   * Same contract as Shape.draw: optional `fill` (the path is closed implicitly) followed by `stroke`.
   * Shadow, textures, cel shading and `inside` apply to the filled area.
   */
  draw(ctx: CanvasRenderingContext2D, style?: ShapeStyle | ShapeStyleOptions): this {
    if (!style) return this;
    const { stroke, ...rest } = style instanceof ShapeStyle ? style.attrs : style;
    const hasFill = rest.fill || rest.celShade || rest.texture || rest.inside;
    if (hasFill) new CompoundShape(this._points).draw(ctx, rest);
    if (stroke) this.stroke(ctx, stroke);
    return this;
  }

  // ==========================================
  // STATIC FACTORIES
  // ==========================================

  /** Straight line, optionally wobbled ('smooth' | 'chiseled' | 'stepped'). */
  static line(from: Point, to: Point, options: LineShapeOptions = {}): Path {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);

    if (len < 0.001) return new Path([from, to]);
    if (!options.wobble) return new Path([from, to]);

    const opt: WobbleOptions = typeof options.wobble === 'object' ? options.wobble : {};
    const amp = opt.amplitude ?? 2.0;
    const wobbleStyle = opt.style ?? 'smooth';
    const noiseSeed = opt.seed ?? options.seed ?? 110;
    const noise2D = createNoise2D(noiseSeed);
    const freq = opt.frequency ?? 2.2;

    const nx = -dy / len;
    const ny = dx / len;

    if (wobbleStyle === 'chiseled') {
      const segLen = opt.segmentLength ?? 16;
      const steps = Math.max(2, Math.round(len / segLen));
      const pts: Point[] = [from];
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const window = Math.sin(t * Math.PI);
        const offset = noise2D(t * freq * 1.5, 0.4) * amp * window;
        pts.push({ x: from.x + dx * t + nx * offset, y: from.y + dy * t + ny * offset });
      }
      pts.push(to);
      return new Path(pts);
    }

    if (wobbleStyle === 'stepped') {
      const segLen = opt.segmentLength ?? 14;
      const steps = Math.max(2, Math.round(len / segLen));
      const pts: Point[] = [from];
      for (let i = 0; i < steps; i++) {
        const t1 = i / steps;
        const t2 = (i + 1) / steps;
        const midT = (t1 + t2) / 2;
        const window = Math.sin(midT * Math.PI);
        const offset = noise2D(midT * freq * 2.0, 0.7) * amp * window;
        pts.push({ x: from.x + dx * t1 + nx * offset, y: from.y + dy * t1 + ny * offset });
        pts.push({ x: from.x + dx * t2 + nx * offset, y: from.y + dy * t2 + ny * offset });
      }
      pts.push(to);
      return new Path(pts);
    }

    const steps = Math.max(6, opt.steps ?? Math.max(8, Math.round(len / 8)));
    const pts: Point[] = [from];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const window = Math.sin(t * Math.PI);
      const offset = noise2D(t * freq, 0.5) * amp * window;
      pts.push({ x: from.x + dx * t + nx * offset, y: from.y + dy * t + ny * offset });
    }
    pts.push(to);
    return new Path(pts);
  }

  /** Circular arc between two angles in degrees ('smooth' or 'chiseled'). */
  static arc(
    center: Point,
    radius: number,
    startAngle: number,
    endAngle: number,
    options: Partial<ArcOptions> = {}
  ): Path {
    const isChiseled = options.style === 'chiseled';
    const segs = options.segments ?? (isChiseled ? 8 : 28);
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const sweep = endRad - startRad;

    const hasWobble = Boolean(options.wobble);
    const opt: WobbleOptions = typeof options.wobble === 'object' ? options.wobble : {};
    const amp = opt.amplitude ?? 2.0;
    const noiseSeed = opt.seed ?? options.seed ?? 111;
    const noise2D = createNoise2D(noiseSeed);
    const freq = opt.frequency ?? 2.0;

    const pts: Point[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const ang = startRad + sweep * t;
      let r = radius;

      if (hasWobble) {
        const window = Math.sin(t * Math.PI);
        r += noise2D(Math.cos(ang) * freq, Math.sin(ang) * freq) * amp * window;
      }

      pts.push({ x: center.x + Math.cos(ang) * r, y: center.y + Math.sin(ang) * r });
    }

    return new Path(pts);
  }

  /**
   * Quadratic arch. `bow` is the perpendicular sagitta: the apex lies `|bow|` away from the chord.
   * A positive bow bulges along `normalAt`, which is the right-hand side of the direction of travel on screen.
   * For `from (0,0)` to `to (100,0)`, `bow: 10` passes through `(50, 10)`.
   */
  static curve(from: Point, to: Point, bow: number, options: Partial<CurveOptions> = {}): Path {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);

    if (len < 0.001) return new Path([from, to]);

    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const nx = -dy / len;
    const ny = dx / len;

    const cpX = midX + nx * (bow * 2);
    const cpY = midY + ny * (bow * 2);

    const isChiseled = options.style === 'chiseled';
    const steps = options.steps ?? (isChiseled ? (options.segments ?? 6) : Math.max(12, Math.round(len / 5)));
    const hasWobble = Boolean(options.wobble);
    const opt: WobbleOptions = typeof options.wobble === 'object' ? options.wobble : {};
    const amp = opt.amplitude ?? 2.0;
    const noiseSeed = opt.seed ?? options.seed ?? 112;
    const noise2D = createNoise2D(noiseSeed);
    const freq = opt.frequency ?? 2.2;

    const pts: Point[] = [from];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const inv = 1 - t;
      let bx = inv * inv * from.x + 2 * inv * t * cpX + t * t * to.x;
      let by = inv * inv * from.y + 2 * inv * t * cpY + t * t * to.y;

      if (hasWobble) {
        const window = Math.sin(t * Math.PI);
        const offset = noise2D(t * freq, 0.75) * amp * window;
        bx += nx * offset;
        by += ny * offset;
      }

      pts.push({ x: bx, y: by });
    }
    pts.push(to);
    return new Path(pts);
  }

  /** Catmull-Rom spline through the points ('chiseled' gives facets). */
  static spline(points: Point[], options: Partial<SplineOptions> = {}): Path {
    if (points.length < 2) return new Path(points);
    if (points.length === 2) {
      return Path.line(points[0], points[1], { wobble: options.wobble, seed: options.seed });
    }

    const isChiseled = options.style === 'chiseled';
    const tension = options.tension ?? 0.5;
    const n = points.length;
    const stepsPerSpan = isChiseled
      ? Math.max(1, Math.round((options.segments ?? (n * 2)) / (n - 1)))
      : (options.steps ?? 12);

    const hasWobble = Boolean(options.wobble);
    const opt: WobbleOptions = typeof options.wobble === 'object' ? options.wobble : {};
    const amp = opt.amplitude ?? 2.0;
    const noiseSeed = opt.seed ?? options.seed ?? 115;
    const noise2D = createNoise2D(noiseSeed);
    const freq = opt.frequency ?? 2.0;

    const pts: Point[] = [];

    for (let i = 0; i < n - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(n - 1, i + 2)];

      const m1x = tension * (p2.x - p0.x);
      const m1y = tension * (p2.y - p0.y);
      const m2x = tension * (p3.x - p1.x);
      const m2y = tension * (p3.y - p1.y);

      for (let s = 0; s < stepsPerSpan; s++) {
        const t = s / stepsPerSpan;
        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        let px = h00 * p1.x + h10 * m1x + h01 * p2.x + h11 * m2x;
        let py = h00 * p1.y + h10 * m1y + h01 * p2.y + h11 * m2y;

        if (hasWobble && (i > 0 || s > 0)) {
          const globalT = (i + t) / (n - 1);
          const window = Math.sin(globalT * Math.PI);

          const tx = (3 * t2 - 2 * t) * (m1x + m2x) + (6 * t2 - 6 * t) * (p1.x - p2.x) + m1x;
          const ty = (3 * t2 - 2 * t) * (m1y + m2y) + (6 * t2 - 6 * t) * (p1.y - p2.y) + m1y;
          const tLen = Math.hypot(tx, ty);
          if (tLen > 0.0001) {
            const nx = -ty / tLen;
            const ny = tx / tLen;
            const offset = noise2D(globalT * freq * (n - 1), 0.5) * amp * window;
            px += nx * offset;
            py += ny * offset;
          }
        }

        pts.push({ x: px, y: py });
      }
    }

    pts.push({ ...points[n - 1] });
    return new Path(pts);
  }

  /** Cubic Bezier from p1 to p2 with control points cp1, cp2. */
  static bezier(
    p1: Point,
    cp1: Point,
    cp2: Point,
    p2: Point,
    options: Partial<BezierOptions> = {}
  ): Path {
    const isChiseled = options.style === 'chiseled';
    const steps = options.steps ?? (isChiseled ? (options.segments ?? 6) : 24);

    const hasWobble = Boolean(options.wobble);
    const opt: WobbleOptions = typeof options.wobble === 'object' ? options.wobble : {};
    const amp = opt.amplitude ?? 2.0;
    const noiseSeed = opt.seed ?? options.seed ?? 116;
    const noise2D = createNoise2D(noiseSeed);
    const freq = opt.frequency ?? 2.0;

    const pts: Point[] = [p1];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const inv = 1 - t;
      const inv2 = inv * inv;
      const inv3 = inv2 * inv;
      const t2 = t * t;
      const t3 = t2 * t;

      let bx = inv3 * p1.x + 3 * inv2 * t * cp1.x + 3 * inv * t2 * cp2.x + t3 * p2.x;
      let by = inv3 * p1.y + 3 * inv2 * t * cp1.y + 3 * inv * t2 * cp2.y + t3 * p2.y;

      if (hasWobble) {
        const dx = 3 * inv2 * (cp1.x - p1.x) + 6 * inv * t * (cp2.x - cp1.x) + 3 * t2 * (p2.x - cp2.x);
        const dy = 3 * inv2 * (cp1.y - p1.y) + 6 * inv * t * (cp2.y - cp1.y) + 3 * t2 * (p2.y - cp2.y);
        const dLen = Math.hypot(dx, dy);
        if (dLen > 0.0001) {
          const nx = -dy / dLen;
          const ny = dx / dLen;
          const window = Math.sin(t * Math.PI);
          const offset = noise2D(t * freq, 0.5) * amp * window;
          bx += nx * offset;
          by += ny * offset;
        }
      }

      pts.push({ x: bx, y: by });
    }
    pts.push(p2);

    return new Path(pts);
  }

  /** Sine wave between two points. */
  static wave(
    from: Point,
    to: Point,
    cycles = 2,
    amplitude = 6,
    options: WaveShapeOptions = {}
  ): Path {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);

    if (len < 0.001) return new Path([from, to]);

    const isChiseled = options.style === 'chiseled';
    const steps = options.steps ?? (isChiseled ? (options.segments ?? (cycles * 4)) : Math.max(16, Math.round(len / 4)));
    const nx = -dy / len;
    const ny = dx / len;

    const pts: Point[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const disp = Math.sin(t * Math.PI * 2 * cycles) * amplitude;
      pts.push({ x: from.x + dx * t + nx * disp, y: from.y + dy * t + ny * disp });
    }

    return new Path(pts);
  }

  /** Polyline through arbitrary points. */
  static polyline(points: Point[], closed = false): Path {
    return new Path(points, closed);
  }

  /**
   * Joins paths end to end, welding coinciding endpoints.
   * The result is closed only if the LAST path is closed.
   */
  static concat(...paths: Path[]): Path {
    const all: Point[] = [];
    for (const p of paths) {
      for (const pt of p._points) {
        const last = all[all.length - 1];
        if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 0.001) all.push({ ...pt });
      }
    }
    return new Path(all, paths.length > 0 && paths[paths.length - 1].closed);
  }

  /** Starts a fluent builder at `startPoint`. */
  static builder(startPoint?: Point): PathBuilder {
    return new PathBuilder(startPoint);
  }
}

function normalizeToShapeOptions(options?: LineToShapeInput): { width: RibbonWidth; cap: import('../types.js').LineCap; clean: boolean } {
  if (options === undefined || options === null) {
    return { width: 2, cap: 'butt', clean: true };
  }
  if (typeof options === 'number' || typeof options === 'function' || ('start' in options && 'end' in options)) {
    return { width: options as RibbonWidth, cap: 'butt', clean: true };
  }
  if (options instanceof StrokeStyle) {
    return {
      width: options.width ?? 2,
      cap: (options.attrs as any)?.cap ?? 'butt',
      clean: true,
    };
  }
  const opt = options as any;
  return {
    width: opt.width ?? 2,
    cap: opt.cap ?? (opt.attrs?.cap ?? 'butt'),
    clean: opt.clean ?? true,
  };
}

function signedArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * Fluent builder for compound trajectories: lines, arcs, curves, splines, beziers, waves.
 * A Path has no sub-paths: every segment continues from the current point.
 */
export class PathBuilder {
  private _points: Point[] = [];

  constructor(startPoint?: Point) {
    if (startPoint) this._points.push({ ...startPoint });
  }

  get currentPoint(): Point {
    if (this._points.length === 0) return { x: 0, y: 0 };
    return { ...this._points[this._points.length - 1] };
  }

  /** Sets the start point. Accepts either a Point or (x, y) coordinates. */
  moveTo(ptOrX: Point | number, y?: number): this {
    if (this._points.length > 0) {
      throw new Error('PathBuilder.moveTo is only valid as the first call. A Path has no sub-paths: build separate Paths or use Path.concat.');
    }
    const pt: Point = typeof ptOrX === 'number' ? { x: ptOrX, y: y ?? 0 } : { x: ptOrX.x, y: ptOrX.y };
    this._points.push(pt);
    return this;
  }

  private append(segment: Path): this {
    const pts = segment.points;
    for (let i = this._points.length === 0 ? 0 : 1; i < pts.length; i++) this._points.push(pts[i]);
    return this;
  }

  /** Adds a straight line to the target. Accepts either a Point or (x, y) coordinates. */
  lineTo(ptOrX: Point | number, yOrOptions?: number | LineShapeOptions, options?: LineShapeOptions): this {
    let target: Point;
    let opts: LineShapeOptions | undefined;
    if (typeof ptOrX === 'number') {
      target = { x: ptOrX, y: typeof yOrOptions === 'number' ? yOrOptions : 0 };
      opts = options;
    } else {
      target = { x: ptOrX.x, y: ptOrX.y };
      opts = typeof yOrOptions === 'object' ? yOrOptions : options;
    }
    return this.append(Path.line(this.currentPoint, target, opts));
  }

  /** Arc around `center`; the arc is appended starting from its own first point. */
  arcTo(center: Point, radius: number, startAngle: number, endAngle: number, options?: Partial<ArcOptions>): this {
    const arc = Path.arc(center, radius, startAngle, endAngle, options);
    const pts = arc.points;
    if (pts.length === 0) return this;
    const joined = this._points.length > 0 && Math.hypot(pts[0].x - this.currentPoint.x, pts[0].y - this.currentPoint.y) < 0.01;
    for (let i = joined ? 1 : 0; i < pts.length; i++) this._points.push(pts[i]);
    return this;
  }

  curveTo(to: Point, bow: number, options?: Partial<CurveOptions>): this {
    return this.append(Path.curve(this.currentPoint, to, bow, options));
  }

  bezierTo(cp1: Point, cp2: Point, endPoint: Point, options?: Partial<BezierOptions>): this {
    return this.append(Path.bezier(this.currentPoint, cp1, cp2, endPoint, options));
  }

  /** Spline from the current point through `points`. */
  splineTo(points: Point[], options?: Partial<SplineOptions>): this {
    return this.append(Path.spline([this.currentPoint, ...points], options));
  }

  waveTo(to: Point, cycles = 2, amplitude = 6, options?: WaveShapeOptions): this {
    return this.append(Path.wave(this.currentPoint, to, cycles, amplitude, options));
  }

  /** Fillets the corners recorded so far. Call before build()/close(). */
  roundCorners(radius: number | number[], stepsPerCorner = 4): this {
    this._points = filletPoints(this._points, radius, false, stepsPerCorner);
    return this;
  }

  /** Finishes as a Path for stroking. Optionally rounds corners. */
  build(closed = false, roundRadius?: number | number[]): Path {
    const p = new Path(this._points, closed);
    return roundRadius !== undefined ? p.roundCorners(roundRadius) : p;
  }

  /** Closes and returns a fillable shape. Optionally rounds every corner, including the seam. */
  close(roundRadius?: number | number[]): CompoundShape {
    const shape = new CompoundShape(this._points);
    return roundRadius !== undefined ? (shape.roundCorners(roundRadius) as CompoundShape) : shape;
  }

  /**
   * Turns the path directly into filled geometry (ribbon) of the given thickness or stroke style.
   * Optionally rounds corners before solidifying.
   */
  toShape(options?: LineToShapeInput, roundRadius?: number | number[]): Shape {
    return this.build(false, roundRadius).toShape(options);
  }

  /** Alias of toShape: turns the path directly into a filled ribbon. */
  toRibbon(options?: LineToShapeInput, roundRadius?: number | number[]): Shape {
    return this.toShape(options, roundRadius);
  }
}

registerPathConstructor(Path);
