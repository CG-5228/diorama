# @core/draw - Procedural Textures

> Auto-generated public API reference. Do not edit directly; re-run `npm run docs:api`.

Hole-aware procedural fills: Stipple, Hatch and Grit.

## Table of Contents

- [Classes & Constructors](#classes--constructors)
  - [`Hatch`](#hatch)
  - [`Stipple`](#stipple)
  - [`Grit`](#grit)
- [Types & Interfaces](#types--interfaces)
  - [`Texture`](#texture)
  - [`HatchOptions`](#hatchoptions)
  - [`HatchBounds`](#hatchbounds)
  - [`StippleOptions`](#stippleoptions)
  - [`StippleGradient`](#stipplegradient)
  - [`GritOptions`](#gritoptions)

---

## Classes & Constructors

### `Hatch`

Hatching texture: parallel strokes clipped to a shape. Draw it with `render` or `spot`.

**Constructor:**
```ts
new Hatch(attrs?: HatchOptions): Hatch
```

**Properties:**

- `attrs: HatchOptions`
- `stroke: StrokeStyle<{}>`

**Instance Methods:**

- `.render(ctx: CanvasRenderingContext2D, target: Shape | HatchBounds, overrides?: Partial<HatchOptions>): void`
  Renders the hatching texture inside a Shape or rectangular bounding box. Strokes terminate NATURALLY with organic calligraphic tapered tips.
- `.spot(ctx: CanvasRenderingContext2D, center: Point, radius: number | { rx: number; ry: number; }, overrides?: Partial<HatchOptions>): void`
  Renders a targeted / localized focal hatch cluster around a specific center point. Strokes terminate NATURALLY with organic calligraphic tapered tips (NO dry geometric clipping!).

---

### `Stipple`

Stippling texture: random dots with an optional density gradient. Draw it with `render` or `spot`.

**Constructor:**
```ts
new Stipple(attrs?: StippleOptions): Stipple
```

**Properties:**

- `attrs: StippleOptions`

**Instance Methods:**

- `.render(ctx: CanvasRenderingContext2D, target: Shape | Bounds, overrides?: Partial<StippleOptions>): void`
  Renders the stipple texture inside a Shape or rectangular bounding box.
- `.spot(ctx: CanvasRenderingContext2D, center: Point, radius: number | { rx: number; ry: number; }, overrides?: Partial<StippleOptions>): void`
  Renders a targeted / localized stipple cluster around a specific center point.

---

### `Grit`

Grit texture: specks and scratches for wear. Draw it with `render` or `spot`.

**Constructor:**
```ts
new Grit(attrs?: GritOptions): Grit
```

**Properties:**

- `attrs: GritOptions`

**Instance Methods:**

- `.render(ctx: CanvasRenderingContext2D, target: Shape | Bounds, overrides?: Partial<GritOptions>): void`
  Renders grit flecks and scratches inside a Shape or rectangular bounding box.
- `.spot(ctx: CanvasRenderingContext2D, center: Point, radius: number | { rx: number; ry: number; }, overrides?: Partial<GritOptions>): void`
  Renders a targeted / localized grit cluster around a specific center point.

---

## Types & Interfaces

### `Texture`

A texture attached to a ShapeStyle: any object with a `render` method.

```ts
interface Texture<TOptions = unknown> {
  render(ctx: CanvasRenderingContext2D, target: Bounds | ShapeLike, overrides?: Partial<TOptions> | undefined): void;
}
```

### `HatchOptions`

Options for `Hatch`: spacing, angle, cross-hatching and jitter.

```ts
interface HatchOptions {
  /** The StrokeStyle (or StrokeOptions) used to render the hatching lines. Enables sharing the exact line style (width, tapering, handdrawn/sketchy, color) from project themes. */
  stroke?: StrokeStyle<{}> | StrokeOptions;
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
  /** Whether to enforce a hard geometric ctx.clip() mask. Default: false (strokes terminate naturally with complete tapered tips). */
  hardClip?: boolean;
  /** Direct line width shorthand (overrides stroke.width if provided) */
  width?: number;
  /** Direct line color shorthand (overrides stroke.color if provided) */
  color?: string;
}
```

### `HatchBounds`

Rectangle bounds for a Hatch texture.

```ts
interface HatchBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### `StippleOptions`

Options for `Stipple`: dot count, radius and gradient.

```ts
interface StippleOptions {
  /** Approximate dot count (default: 80) */
  count?: number;
  /** Density multiplier for dot distribution (convenience shorthand) */
  density?: number;
  /** Minimum dot radius in pixels (default: 0.5) */
  minRadius?: number;
  /** Maximum dot radius in pixels (default: 1.2) */
  maxRadius?: number;
  /** Uniform dot radius shorthand */
  radius?: number;
  /** Dot color (default: '#1c1714') */
  color?: string;
  /** Directional concentration gradient (default: 'none') */
  gradient?: StippleGradient;
  /** Deterministic PRNG seed */
  seed?: number;
}
```

### `StippleGradient`

Direction of the stipple density gradient.

```ts
type StippleGradient = "none" | "left-to-right" | "right-to-left" | "top-to-bottom" | "bottom-to-top" | "radial-in" | "radial-out"
```

### `GritOptions`

Options for `Grit`: count, scratches, size and color.

```ts
interface GritOptions {
  /** Quantity of grit flecks (default: 20) */
  count?: number;
  /** Quantity of linear scratches (default: 3) */
  scratches?: number;
  /** Alias for scratches */
  scratchCount?: number;
  /** Base particle size in pixels (default: 1.4) */
  size?: number;
  /** Ink or dirt color (default: '#1c1714') */
  color?: string;
  /** Deterministic PRNG seed */
  seed?: number;
}
```

