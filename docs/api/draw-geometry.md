# @core/draw - Geometry, Booleans & Placement

> Auto-generated public API reference. Do not edit directly; re-run `npm run docs:api`.

Polygons and compound shapes, CSG booleans, offsets and rounded corners, deformation hooks, anchors, and placement along a path (`scatterAlong`, `attach`).

## Table of Contents

- [Classes & Constructors](#classes--constructors)
  - [`Shape`](#shape)
  - [`CompoundShape`](#compoundshape)
  - [`Polygon`](#polygon)
- [Functions & Operations](#functions--operations)
  - [`attach`](#attach)
  - [`scatterAlong`](#scatteralong)
- [Types & Interfaces](#types--interfaces)
  - [`PolygonRegion`](#polygonregion)
  - [`AttachOptions`](#attachoptions)
  - [`Scatterable`](#scatterable)
  - [`ScatterAlongOptions`](#scatteralongoptions)
  - [`Point`](#point)
  - [`Bounds`](#bounds)
  - [`InsideCallback`](#insidecallback)
  - [`ShapeLike`](#shapelike)
  - [`Placeable`](#placeable)
  - [`PolygonOptions`](#polygonoptions)
  - [`RectOptions`](#rectoptions)
  - [`CircleOptions`](#circleoptions)
  - [`EllipseOptions`](#ellipseoptions)
  - [`StarOptions`](#staroptions)
  - [`CrescentOptions`](#crescentoptions)
  - [`LobeDefinition`](#lobedefinition)
  - [`LobesOptions`](#lobesoptions)
  - [`StemOptions`](#stemoptions)
  - [`AnchorName`](#anchorname)
  - [`AnchorRef`](#anchorref)
  - [`BoundingBox`](#boundingbox)
  - [`EdgeInfo`](#edgeinfo)
  - [`DisplaceOptions`](#displaceoptions)
  - [`BendOptions`](#bendoptions)
  - [`TaperOptions`](#taperoptions)
  - [`WarpOptions`](#warpoptions)
  - [`TwistOptions`](#twistoptions)
  - [`InflateOptions`](#inflateoptions)
  - [`OutlineOptions`](#outlineoptions)
  - [`OffsetOptions`](#offsetoptions)
  - [`Transformable`](#transformable)

---

## Classes & Constructors

### `Shape`

Base class of every filled shape: transforms, anchors, booleans, deformations and drawing.

**Properties:**

- `regions: PolygonRegion[]` — Copy of every disconnected filled region (outer ring + holes).
- `bounds: BoundingBox` — Axis-aligned bounding box and its center.
- `center: Point`
- `anchorNames: string[]` — Names of the custom anchors set with `setAnchor`.

**Instance Methods:**

- `.clone(): Shape`
  Independent deep clone.
- `.toPoints(): Point[]`
  Copy of the outer ring of the primary region.
- `.anchor(name: AnchorRef): Point`
  Point of the shape by name: the 9 built-in bounding-box anchors ('center', 'top', 'bottomLeft', ...) or a custom anchor registered with `setAnchor`.
- `.setAnchor(name: string, at: Point): this`
  Registers a custom named anchor (e.g. 'hilt', 'socket') at an absolute point. Custom anchors move with `translate/rotate/scale/moveTo`, are kept by `clone()` and `flip()`, and are dropped by operations that build new geometry (booleans, offsets, deformations). Built-in names cannot be redefined.
- `.vertex(index: number): Point`
  Vertex of the primary outer ring (negative indices wrap).
- `.edge(index: number): EdgeInfo`
  Edge i -> i+1 of the primary outer ring: midpoint, outward normal, tangent, angle, length.
- `.translate(dx: number, dy: number): this`
- `.rotate(angleDegrees: number, pivot?: Point | AnchorRef | undefined): this`
  Rotates by degrees around a Point or anchor name, built-in or custom (default: center).
- `.scale(sx: number, sy?: number, pivot?: Point | AnchorRef | undefined): this`
  Scales around a Point or anchor name, built-in or custom (default: center). `sy` defaults to `sx`.
- `.moveTo(target: Point, myAnchor?: AnchorRef): this`
  Translates so that `myAnchor` (built-in or custom) lands on `target`.
- `.offset(distance: number, options?: OffsetOptions): Shape`
  Inset (distance < 0) or outset (distance > 0) by a constant distance.
- `.roundCorners(radius: number | number[], stepsPerCorner?: number): Shape`
  Circular fillet on every corner. Radius may be a number or one per vertex.
- `.union(other: Shape | Point[] | Path | (Shape | Point[] | Path)[], pathWidth?: RibbonWidth): CompoundShape`
  Geometric union (CSG). Accepts Shape, Path (converted with pathWidth, default 2), Point[], or an array of them.
- `.subtract(other: Shape | Point[] | Path | (Shape | Point[] | Path)[], pathWidth?: RibbonWidth): CompoundShape`
  Cuts `other` out of this shape (CSG). Accepts Shape, Path (converted with pathWidth, default 2), Point[], or an array of them.
- `.intersect(other: Shape | Point[] | Path | (Shape | Point[] | Path)[], pathWidth?: RibbonWidth): CompoundShape`
  Keeps only the overlap with `other` (CSG). Accepts Shape, Path (converted with pathWidth, default 2), Point[], or an array of them.
- `.unionLine(path: Path, widthOrStroke?: LineToShapeInput, cap?: LineCap): CompoundShape`
  Unites a Path directly with this shape as a solid ribbon. Accepts thickness, ToShapeOptions, or a StrokeStyle/StrokeOptions.
- `.cutLine(path: Path, widthOrStroke?: LineToShapeInput, cap?: LineCap): CompoundShape`
  Cuts this shape along a Path using a cutting ribbon. Accepts thickness, ToShapeOptions, or a StrokeStyle/StrokeOptions.
- `.mapVertices(fn: (p: Point, index: number, count: number) => void | Point): CompoundShape`
  Replaces every vertex: `fn(p, index, count)` returns the new point (or mutates the copy it receives).
- `.displace(options?: DisplaceOptions): CompoundShape`
  Organic noise displacement along the contour normal (or free 'xy' jitter). Deterministic via `seed`.
- `.subdivide(maxEdge: number): CompoundShape`
  Inserts vertices so no edge is longer than `maxEdge`.
- `.resample(count: number): CompoundShape`
  Re-spaces the outer ring to `count` evenly spaced vertices (holes get a proportional count).
- `.smooth(iterations?: number): CompoundShape`
  Chaikin corner cutting; each iteration doubles the vertex count and softens corners.
- `.bend(options: BendOptions): CompoundShape`
  Curves the shape by `angle` degrees along an axis.
- `.taper(options?: TaperOptions): CompoundShape`
  Scales the cross-section linearly along an axis (narrow one end, widen the other).
- `.warp(fn: (p: Point, uv: Point) => void | Point, options?: WarpOptions): CompoundShape`
  Free-form warp: `fn(p, uv)` receives a copy of each vertex and its normalized position `uv` (0..1) inside the shape's bounds, and returns the new point. Edges are subdivided first (`densify`, default 6px). Example: `shape.warp((p, uv) => ({ x: p.x + Math.sin(uv.y * 6) * 8, y: p.y }))`.
- `.twist(options: TwistOptions): CompoundShape`
  Rotates vertices progressively along an axis (0 at the min end, `angle` degrees at the max end).
- `.inflate(options: InflateOptions): CompoundShape`
  Swells (amount > 0) or pinches (amount < 0) the area around `center` with smooth radial falloff.
- `.flip(axis?: "x" | "y", at?: number | undefined): CompoundShape`
  Mirror copy across a line. `axis: 'x'` reflects left <-> right across the vertical line x = `at`; `axis: 'y'` reflects top <-> bottom across the horizontal line y = `at`. `at` defaults to the bounds center. Returns a NEW shape (the original is untouched); custom anchors are mirrored too. To get a symmetric whole instead of just the reflection, unite the shape with its flip.
- `.perimeter(): Path`
  The primary outer ring as a closed Path. Use `contours()` to include holes and islands.
- `.contours(): Path[]`
  Every ring (outer rings and holes of all regions) as closed Paths.
- `.outline(options?: OutlineOptions): CompoundShape`
  Turns the contour into filled geometry: a band of `width` around every ring. The result is a regular shape: fill it, texture it, union it, clip with it.
- `.createGradient(ctx: CanvasRenderingContext2D, options: GradientOptions): CanvasGradient`
  Linear or radial gradient fitted to this shape's bounds.
- `.fill(ctx: CanvasRenderingContext2D, fillStyle: Paint): this`
  Fills with the given paint (holes via even-odd).
- `.clip(ctx: CanvasRenderingContext2D, fn: InsideCallback): this`
  Runs `fn` with the context clipped to this shape. The clip is always restored.
- `.stroke(ctx: CanvasRenderingContext2D, strokeStyle?: StrokeStyle<{}> | StrokeOptions | undefined): this`
  Strokes the contour with a StrokeStyle (or plain options). Position 'center' | 'inside' | 'outside'.
- `.draw(ctx: CanvasRenderingContext2D, style?: ShapeStyle | ShapeStyleOptions | undefined): this`
  Full pipeline: shadow, outside stroke, fill (optionally cel-shaded), textures, `inside` callback, then center/inside stroke.

---

### `CompoundShape`

Shape made of one or more regions, each with optional holes.
Produced by booleans, offsets, deformations and `Path.close()`.

**Constructors:**
```ts
new CompoundShape(regions: PolygonRegion[]): CompoundShape
new CompoundShape(points: Point[], holes?: Point[][] | undefined): CompoundShape
```

**Instance Methods:**

- `.clone(): CompoundShape`
  Independent deep clone.

---

### `Polygon`

A closed, fillable polygon, built from points or from a parametric constructor such as `Polygon.rect`.

**Constructor:**
```ts
new Polygon(attrsOrPoints: Point[] | PolygonOptions): Polygon
```

**Static Factories:**

- `Polygon.fromPoints(points: Point[], attrs?: Partial<PolygonOptions>): Polygon`
  Instantiates a Polygon from arbitrary polyline/polygon points. Supports optional center offset, rotation, corner rounding, and wobble. `rotation` turns the points around the origin (0, 0), not around the shape. To turn a shape in place, call `.rotate(degrees, pivot)` on the result.
- `Polygon.regular(sides: number, radius: number, attrs?: Partial<PolygonOptions>): Polygon`
  Regular N-sided equilateral polygon (e.g. 3 = triangle, 5 = pentagon, 6 = hexagon).
- `Polygon.triangle(base: number, height: number, attrs?: Partial<PolygonOptions>): Polygon`
  Parametric isosceles triangle with explicit base width and height. Shapes are y-down, and the triangle is centred on its centroid (not on its bounding box) at `cx`, `cy` (default the origin): the apex points up on screen at (0, -2h/3), the base runs at y = +h/3 from (-base/2) to (+base/2). So `triangle(12, 18)` spans x -6..6 and y -12..6 (bounds centre at y = -h/6). `rotation` (degrees) turns it clockwise on screen around the centroid. To stand the apex on the origin, translate by (0, 2h/3); for a point-down triangle use `.flip('y', 0)`. Rounded corners (`roundness`, `radius`) pull the points in, so those bounds are smaller.
- `Polygon.diamond(width: number, height: number, attrs?: Partial<PolygonOptions>): Polygon`
  Parametric Diamond / Rhombus with explicit width and height.
- `Polygon.star(points: number, outerRadius: number, innerRadiusOrAttrs?: number | Partial<StarOptions> | undefined, attrs?: Partial<StarOptions> | undefined): Polygon`
  Parametric Star with outer point radius and inner valley radius. Can be called with (points, outerRadius, innerRadius?, options?) or (points, outerRadius, options?) omitting innerRadius. Supports concave/convex edge curvature via options.bulge.
- `Polygon.crescent(radius: number, thickness: number, options?: CrescentOptions): Polygon`
  Parametric Crescent Moon shape with outer radius, central thickness, and sharp cusps.
- `Polygon.lobes(lobes: LobeDefinition[], options?: LobesOptions): Polygon`
  Generates a continuous organic envelope enclosing multiple ellipse lobes (clouds, bushes, slime) via analytical raycasting from the barycenter without sharp CSG boolean seams.
- `Polygon.stem(base: Point, height: number, options?: StemOptions): Polygon`
  Parametric tapered stem, horn, or vine with quadratic curve and wind sway. `base` is where the stem attaches. To turn a stem around its attachment point, use `Polygon.stem(base, height).rotate(degrees, base)`. The `rotation` option pivots on the origin.
- `Polygon.rect(width: number, height: number, attrs?: Partial<RectOptions>): Polygon`
  Parametric Rectangle with individual corner radii and wobble support. Supports both explicit pixel radii (>= 1.0) and proportional factors (< 1.0).
- `Polygon.circle(radius: number, attrs?: Partial<CircleOptions>): Polygon`
  Parametric Circle with optional simplex noise wobble.
- `Polygon.ellipse(rx: number, ry: number, attrs?: Partial<EllipseOptions>): Polygon`
  Parametric Ellipse with rx, ry and rotation.
- `Polygon.capsule(width: number, height: number, attrs?: Partial<RectOptions>): Polygon`
  Parametric Capsule / Pill shape.

**Instance Methods:**

- `.clone(): Polygon`
  Independent deep clone.
- `.roundCorners(radius: number | number[], stepsPerCorner?: number): Polygon`
  Applies circular arc filleting to all corners of this polygon. Works on any polygon, including those generated from arbitrary points.

---

## Functions & Operations

### `attach`

Moves `subject` so its `from` anchor lands on the target's `at` anchor.
`attach(lid, box, { from: 'bottom', at: 'top', offset: { x: 0, y: -2 } })`

```ts
function attach<T extends Placeable>(subject: T, target: Point | Placeable, options?: AttachOptions): T
```

---

### `scatterAlong`

Places copies of `item` along a path: spikes on a spine, beads on a string, leaves on a vine.
`item` is cloned for each position (or produced by a factory `(index, t) => item`, for per-copy variation).
Returns the placed copies.

```ts
function scatterAlong<T extends Scatterable>(path: Path, item: T | ((index: number, t: number) => T), options?: ScatterAlongOptions): T[]
```

---

## Types & Interfaces

### `PolygonRegion`

A filled region: an outer ring and its holes.

```ts
interface PolygonRegion {
  outer: Point[];
  holes: Point[][];
}
```

### `AttachOptions`

Options for `attach`: the anchor on the subject (`from`), the anchor on the target (`at`) and an offset.

```ts
interface AttachOptions {
  /** Anchor of the subject that is moved onto the target (default 'center'). A Point is absolute. */
  from?: Point | AnchorRef;
  /** Anchor of the target to attach to (default 'center'). Ignored when the target is a Point. */
  at?: Point | AnchorRef;
  /** Extra offset applied after attaching. */
  offset?: Point;
}
```

### `Scatterable`

Anything `scatterAlong` can clone and orient: a Shape or a Path.

```ts
interface Scatterable {
  clone(): unknown;
  rotate(angleDegrees: number, pivot?: Point | AnchorRef | undefined): unknown;
  scale(sx: number, sy?: number | undefined, pivot?: Point | AnchorRef | undefined): unknown;
  bounds: BoundingBox;
  center: Point;
  anchor(name: AnchorRef): Point;
  translate(dx: number, dy: number): this;
}
```

### `ScatterAlongOptions`

Options for `scatterAlong`: count, spacing, range along the path and rotation.

```ts
interface ScatterAlongOptions {
  /** Number of copies (default 5, or derived from `spacing`). One copy is placed at the middle of `from..to`. */
  count?: number;
  /** Distance in pixels between copies along the path. Overrides `count`. */
  spacing?: number;
  /** Start of the covered range, normalized arc length 0..1 (default 0). */
  from?: number;
  /** End of the covered range, normalized arc length 0..1 (default 1). */
  to?: number;
  /** Rotate each copy so its +x axis follows the path tangent (default true). */
  align?: boolean;
  /** Extra rotation in degrees applied after aligning. Use -90 to make +x-pointing items stand on the path's left side. */
  rotation?: number;
  /** Anchor of each copy that rides the path (built-in, custom, or absolute-from-bounds Point). Default 'center'. */
  pivot?: AnchorRef;
  /** Pixels to push each copy along the path normal (positive = left of travel direction). */
  offset?: number;
  /** Uniform scale of each copy, or a function of t (0..1) for tapering rows of spikes, teeth or leaves. */
  scale?: number | ((t: number) => number);
}
```

### `Point`

```ts
interface Point {
  x: number;
  y: number;
}
```

### `Bounds`

A rectangle with position and size.

```ts
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### `InsideCallback`

Callback that draws inside a shape, clipped to its silhouette.

```ts
type InsideCallback = (ctx: CanvasRenderingContext2D, shape: ShapeLike) => void
```

### `ShapeLike`

Anything with bounds, a center and anchors, such as a Shape.

```ts
interface ShapeLike {
  bounds: BoundingBox;
  center: Point;
  anchor(name: AnchorName): Point;
  toPoints(): Point[];
  offset(distance: number, options?: { miterLimit?: number | undefined; } | undefined): ShapeLike;
  createGradient(ctx: CanvasRenderingContext2D, options: GradientOptions): CanvasGradient;
  fill(ctx: CanvasRenderingContext2D, fillStyle: Paint): this;
  stroke(ctx: CanvasRenderingContext2D, strokeStyle?: StrokeStyle<{}> | StrokeOptions | undefined): this;
  draw(ctx: CanvasRenderingContext2D, options?: ShapeStyleOptions | undefined): this;
  clip(ctx: CanvasRenderingContext2D, fn: InsideCallback): unknown;
}
```

### `Placeable`

Anything that can be positioned: Shape or Path. Used by attach and scatterAlong.

```ts
interface Placeable {
  bounds: BoundingBox;
  center: Point;
  anchor(name: AnchorRef): Point;
  translate(dx: number, dy: number): this;
}
```

### `PolygonOptions`

Options for polygon constructors: center, rotation, rounding, wobble and seed.

```ts
interface PolygonOptions {
  /** Number of vertices/sides (>= 3, required for regular polygons) */
  sides?: number;
  /** Base outer radius when defining geometry, or corner rounding radius when passed in options (e.g. Polygon.regular(6, 40, { radius: 6 })) */
  radius?: number;
  /** Secondary inner radius (for stars or scalloped shapes) */
  innerRadius?: number;
  /** Center X position (default: 0) */
  cx?: number;
  /** Center Y position (default: 0) */
  cy?: number;
  /** Center point position (convenient Point alternative to cx and cy) */
  center?: Point;
  /** Rotation in degrees (default: 0), applied around the origin (0, 0) before `cx`/`cy` places the result. It does not pivot on the shape itself. For a shape built from free points, rotate it after creation with `.rotate(degrees, pivot)`, for example `Polygon.stem(base, 40).rotate(180, base)`. */
  rotation?: number;
  /** Corner rounding factor (0 to 0.5, or pixel radius) */
  roundness?: number;
  /** Corner chamfer / bevel cut factor */
  bevel?: number;
  /** Procedural organic wobble deformation */
  wobble?: boolean | WobbleOptions;
  /** Deterministic PRNG seed */
  seed?: number;
}
```

### `RectOptions`

Options for `Polygon.rect` and `Polygon.capsule`: size, corner radius, bevel and center.

```ts
interface RectOptions {
  width: number;
  height: number;
  cx?: number;
  cy?: number;
  /** Uniform corner radius or [topLeft, topRight, bottomRight, bottomLeft] */
  radius?: number | [number, number, number, number];
  /** Uniform corner chamfer/bevel in pixels, or [topLeft, topRight, bottomRight, bottomLeft] */
  bevel?: number | [number, number, number, number];
  rotation?: number;
  wobble?: boolean | WobbleOptions;
  seed?: number;
}
```

### `CircleOptions`

Options for `Polygon.circle`: center, number of segments and wobble.

```ts
interface CircleOptions {
  radius: number;
  cx?: number;
  cy?: number;
  /** Number of radial segments for interpolation (default: 36) */
  segments?: number;
  wobble?: boolean | WobbleOptions;
  seed?: number;
}
```

### `EllipseOptions`

Options for `Polygon.ellipse`: radii, center, rotation and segments.

```ts
interface EllipseOptions {
  rx: number;
  ry: number;
  cx?: number;
  cy?: number;
  rotation?: number;
  segments?: number;
  wobble?: boolean | WobbleOptions;
  seed?: number;
}
```

### `StarOptions`

Options for `Polygon.star`: inner radius and edge bulge, plus the polygon options.

```ts
interface StarOptions {
  /** Secondary inner radius (for stars or scalloped shapes) */
  innerRadius?: number;
  /** Curvature of the edges between outer tips and inner valleys. Positive values bow the edges inward (concave, gothic sparkle/four-point star). Negative values puff the edges outward (convex). Default: 0 */
  bulge?: number;
  /** Number of vertices/sides (>= 3, required for regular polygons) */
  sides?: number;
  /** Base outer radius when defining geometry, or corner rounding radius when passed in options (e.g. Polygon.regular(6, 40, { radius: 6 })) */
  radius?: number;
  /** Center X position (default: 0) */
  cx?: number;
  /** Center Y position (default: 0) */
  cy?: number;
  /** Center point position (convenient Point alternative to cx and cy) */
  center?: Point;
  /** Rotation in degrees (default: 0), applied around the origin (0, 0) before `cx`/`cy` places the result. It does not pivot on the shape itself. For a shape built from free points, rotate it after creation with `.rotate(degrees, pivot)`, for example `Polygon.stem(base, 40).rotate(180, base)`. */
  rotation?: number;
  /** Corner rounding factor (0 to 0.5, or pixel radius) */
  roundness?: number;
  /** Corner chamfer / bevel cut factor */
  bevel?: number;
  /** Procedural organic wobble deformation */
  wobble?: boolean | WobbleOptions;
  /** Deterministic PRNG seed */
  seed?: number;
}
```

### `CrescentOptions`

Options for `Polygon.crescent`: arc angle, rotation and segments.

```ts
interface CrescentOptions {
  /** Central sweep angle of the arc in degrees (default: 180) */
  arcAngle?: number;
  /** Angular rotation of the crescent moon in degrees (default: 0) */
  rotation?: number;
  /** Radial segments for curve discretization (default: 36) */
  segments?: number;
  /** Number of vertices/sides (>= 3, required for regular polygons) */
  sides?: number;
  /** Base outer radius when defining geometry, or corner rounding radius when passed in options (e.g. Polygon.regular(6, 40, { radius: 6 })) */
  radius?: number;
  /** Secondary inner radius (for stars or scalloped shapes) */
  innerRadius?: number;
  /** Center X position (default: 0) */
  cx?: number;
  /** Center Y position (default: 0) */
  cy?: number;
  /** Center point position (convenient Point alternative to cx and cy) */
  center?: Point;
  /** Corner rounding factor (0 to 0.5, or pixel radius) */
  roundness?: number;
  /** Corner chamfer / bevel cut factor */
  bevel?: number;
  /** Procedural organic wobble deformation */
  wobble?: boolean | WobbleOptions;
  /** Deterministic PRNG seed */
  seed?: number;
}
```

### `LobeDefinition`

One ellipse lobe of `Polygon.lobes`: center and radii.

```ts
interface LobeDefinition {
  cx: number;
  cy: number;
  rx: number;
  ry?: number;
}
```

### `LobesOptions`

Options for `Polygon.lobes`: number of segments.

```ts
interface LobesOptions {
  /** Angular radial raycast sampling resolution (default: 96) */
  segments?: number;
  /** Number of vertices/sides (>= 3, required for regular polygons) */
  sides?: number;
  /** Base outer radius when defining geometry, or corner rounding radius when passed in options (e.g. Polygon.regular(6, 40, { radius: 6 })) */
  radius?: number;
  /** Secondary inner radius (for stars or scalloped shapes) */
  innerRadius?: number;
  /** Center X position (default: 0) */
  cx?: number;
  /** Center Y position (default: 0) */
  cy?: number;
  /** Center point position (convenient Point alternative to cx and cy) */
  center?: Point;
  /** Rotation in degrees (default: 0), applied around the origin (0, 0) before `cx`/`cy` places the result. It does not pivot on the shape itself. For a shape built from free points, rotate it after creation with `.rotate(degrees, pivot)`, for example `Polygon.stem(base, 40).rotate(180, base)`. */
  rotation?: number;
  /** Corner rounding factor (0 to 0.5, or pixel radius) */
  roundness?: number;
  /** Corner chamfer / bevel cut factor */
  bevel?: number;
  /** Procedural organic wobble deformation */
  wobble?: boolean | WobbleOptions;
  /** Deterministic PRNG seed */
  seed?: number;
}
```

### `StemOptions`

Options for `Polygon.stem`: sway, base and top width, and segments.

```ts
interface StemOptions {
  /** Horizontal sway/lean offset at the tip in pixels (default: 0) */
  sway?: number;
  /** Stem thickness at the base root in pixels (default: 8) */
  baseWidth?: number;
  /** Stem thickness at the top tip in pixels (default: 1.5) */
  topWidth?: number;
  /** Quadratic Bézier sampling steps along height (default: 16) */
  segments?: number;
  /** Number of vertices/sides (>= 3, required for regular polygons) */
  sides?: number;
  /** Base outer radius when defining geometry, or corner rounding radius when passed in options (e.g. Polygon.regular(6, 40, { radius: 6 })) */
  radius?: number;
  /** Secondary inner radius (for stars or scalloped shapes) */
  innerRadius?: number;
  /** Center X position (default: 0) */
  cx?: number;
  /** Center Y position (default: 0) */
  cy?: number;
  /** Center point position (convenient Point alternative to cx and cy) */
  center?: Point;
  /** Rotation in degrees (default: 0), applied around the origin (0, 0) before `cx`/`cy` places the result. It does not pivot on the shape itself. For a shape built from free points, rotate it after creation with `.rotate(degrees, pivot)`, for example `Polygon.stem(base, 40).rotate(180, base)`. */
  rotation?: number;
  /** Corner rounding factor (0 to 0.5, or pixel radius) */
  roundness?: number;
  /** Corner chamfer / bevel cut factor */
  bevel?: number;
  /** Procedural organic wobble deformation */
  wobble?: boolean | WobbleOptions;
  /** Deterministic PRNG seed */
  seed?: number;
}
```

### `AnchorName`

Built-in anchor names of a shape: center, the four edges and the four corners.

```ts
type AnchorName = "center" | "top" | "bottom" | "left" | "right" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight"
```

### `AnchorRef`

Anything accepted where an anchor is expected: one of the 9 built-in `AnchorName`s or a custom
anchor registered with `setAnchor(name, point)`. Built-in names keep editor autocompletion.

```ts
type AnchorRef = AnchorName | (string & {})
```

### `BoundingBox`

Bounding box of a shape, with its edges, size and center.

```ts
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Alias of `minX`. */
  left: number;
  /** Alias of `maxX`. */
  right: number;
  /** Alias of `minY` (screen coordinates: y grows downward, so `top < bottom`). */
  top: number;
  /** Alias of `maxY`. */
  bottom: number;
  center: Point;
}
```

### `EdgeInfo`

One edge of a polygon: its midpoint, normal, tangent and length.

```ts
interface EdgeInfo {
  index: number;
  start: Point;
  end: Point;
  mid: Point;
  normal: Point;
  tangent: Point;
  angle: number;
  normalAngle: number;
  length: number;
}
```

### `DisplaceOptions`

Options for `displace`: amplitude, frequency, seed and mode.

```ts
interface DisplaceOptions {
  /** Maximum displacement in pixels (default 2). */
  amplitude?: number;
  /** Noise cycles per 100 px (default 3). */
  frequency?: number;
  seed?: number;
  /** Max edge length before displacing; smaller = smoother result, 0 = keep existing vertices (default 6). */
  densify?: number;
  /** 'normal' pushes along the contour normal (default); 'xy' jitters freely. */
  mode?: "normal" | "xy";
}
```

### `BendOptions`

Options for `bend`: angle and axis.

```ts
interface BendOptions {
  /** Total bend in degrees across the extent (positive curves toward +y for axis 'x'). */
  angle: number;
  /** Axis along which the geometry is bent (default 'x'). */
  axis?: "x" | "y";
  /** Neutral point that stays put (default: bounds center). */
  pivot?: Point;
}
```

### `TaperOptions`

Options for `taper`: axis and the scale at each end.

```ts
interface TaperOptions {
  /** Axis along which the cross-section changes (default 'y'). */
  axis?: "x" | "y";
  /** Cross-section scale at the min end of the axis (default 1). */
  from?: number;
  /** Cross-section scale at the max end of the axis (default 0.5). */
  to?: number;
  pivot?: Point;
}
```

### `WarpOptions`

Options for `warp`: densification before the warp.

```ts
interface WarpOptions {
  /** Max edge length before warping; smaller = smoother result, 0 = keep existing vertices (default 6). Warping a coarse polygon without densifying only moves its few corners. */
  densify?: number;
}
```

### `TwistOptions`

Options for `twist`: angle and axis.

```ts
interface TwistOptions {
  /** Total rotation in degrees accumulated from the min end to the max end of the axis. */
  angle: number;
  /** Axis along which the rotation accumulates (default 'y'). */
  axis?: "x" | "y";
  /** Point the geometry rotates around (default: bounds center). */
  pivot?: Point;
  /** Max edge length before warping; smaller = smoother result, 0 = keep existing vertices (default 6). Warping a coarse polygon without densifying only moves its few corners. */
  densify?: number;
}
```

### `InflateOptions`

Options for `inflate`: amount and radius.

```ts
interface InflateOptions {
  /** Pixels moved away from center at full strength. Negative values pinch toward it. */
  amount: number;
  /** Center of the effect (default: bounds center). */
  center?: Point;
  /** Soft-selection radius in pixels; influence fades smoothly to 0 at this distance (default: half the largest bounds side). */
  radius?: number;
  /** Max edge length before warping; smaller = smoother result, 0 = keep existing vertices (default 6). Warping a coarse polygon without densifying only moves its few corners. */
  densify?: number;
}
```

### `OutlineOptions`

Options for `outline`: band width, position and miter limit.

```ts
interface OutlineOptions {
  /** Outline thickness in pixels (default 2). */
  width?: number;
  /** Where the band sits relative to the contour (default 'center'). */
  position?: StrokePosition;
  /** Miter limit for sharp corners (default 2.5). */
  miterLimit?: number;
}
```

### `OffsetOptions`

Options for `Shape.offset()` and `offsetPolygon()`.

```ts
interface OffsetOptions {
  /** Miter limit factor to prevent acute spikes (default: 2.5) */
  miterLimit?: number;
}
```

### `Transformable`

Anything that can be moved, rotated and scaled in place: `Shape` and `Path`.

```ts
interface Transformable {
  bounds: BoundingBox;
  center: Point;
  translate(dx: number, dy: number): this;
  rotate(angleDegrees: number, pivot?: Point | AnchorRef | undefined): this;
  scale(sx: number, sy?: number | undefined, pivot?: Point | AnchorRef | undefined): this;
  moveTo(target: Point, myAnchor?: AnchorRef | undefined): this;
}
```

