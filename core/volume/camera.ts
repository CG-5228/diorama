/**
 * @core/volume - Camera
 *
 * A tilted orthographic camera (Hades-style 3/4 view) and the project's single light.
 * Every 2.5D asset of a project projects through the same camera settings, so props,
 * scenery and characters share one angle, one light and one height scale.
 */

import type { Point } from '../draw/types.js';
import { dot3, norm3, vec3, type Vec3 } from './vec3.js';

/** The project's light: where it comes from, on the ground plane and above it. */
export interface LightOptions {
  /** Direction the light comes from on the ground plane, in degrees: 0 = from the right (+x), 90 = from the camera side (+y), 180 = from the left. */
  azimuth: number;
  /** Height of the light above the ground plane, in degrees (90 = straight down). */
  elevation: number;
  /** Light received by faces turned away from the light, 0..1. */
  ambient?: number;
}

/** Options of a `Camera`. */
export interface CameraOptions {
  /** Angle of the view above the ground plane, in degrees. Default 48 (Hades-like 3/4 view). */
  tilt?: number;
  /**
   * Vertical stretch applied to heights. The tilted view shortens vertical parts (legs,
   * walls) more than depth; 1.2 compensates so figures and props read at a natural height.
   * Default 1.2.
   */
  heightBoost?: number;
  /** The project's light. Default: from the upper left, slightly towards the camera. */
  light?: LightOptions;
  /** Screen position of the world origin, in logical pixels. Default { x: 0, y: 0 }. */
  origin?: Point;
  /** World units per logical pixel. Default 1. */
  scale?: number;
  /**
   * The project's outer contour: one line of this width (what shows outside the silhouette)
   * and color around every stage object, heavier than the lines between parts. Set it once
   * here so every prop, character and scenery piece of the project shares it. Default: 1.7×
   * the widest part outline of each object, in that outline's color; `false` for none.
   */
  contour?: { width: number; color: string } | false;
}

/**
 * From the upper left, towards the camera: tops are lit, faces towards the camera and the
 * left are base, faces turned right or away are dark (see `rampTone`).
 */
const DEFAULT_LIGHT: Required<LightOptions> = { azimuth: 140, elevation: 45, ambient: 0.35 };

/**
 * Tilted orthographic camera. World axes: x right, y towards the camera, z up.
 * `project` maps a world point to the screen; `depth` orders parts back to front.
 * Declare one camera per project in `src/theme.ts` and place it per asset with `at(origin)`.
 */
export class Camera {
  readonly tilt: number;
  readonly heightBoost: number;
  readonly light: Required<LightOptions>;
  readonly origin: Point;
  readonly scale: number;
  readonly contour?: { width: number; color: string } | false;
  private readonly sy: number;
  private readonly sz: number;
  private readonly toCam: Vec3;
  private readonly toLight: Vec3;

  constructor(options: CameraOptions = {}) {
    this.tilt = options.tilt ?? 48;
    this.heightBoost = options.heightBoost ?? 1.2;
    this.light = { ...DEFAULT_LIGHT, ...(options.light ?? {}) };
    this.origin = options.origin ?? { x: 0, y: 0 };
    this.scale = options.scale ?? 1;
    this.contour = options.contour;
    const t = (this.tilt * Math.PI) / 180;
    this.sy = Math.sin(t);
    this.sz = Math.cos(t) * this.heightBoost;
    this.toCam = vec3(0, Math.cos(t), Math.sin(t));
    const az = (this.light.azimuth * Math.PI) / 180;
    const el = (this.light.elevation * Math.PI) / 180;
    this.toLight = norm3(vec3(Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)));
  }

  /** A copy of this camera with the world origin at `origin` on screen (and optionally another scale). */
  at(origin: Point, scale?: number): Camera {
    return new Camera({ tilt: this.tilt, heightBoost: this.heightBoost, light: this.light, origin, scale: scale ?? this.scale, contour: this.contour });
  }

  /** Screen position of a world point, in logical pixels. */
  project(p: Vec3): Point {
    return {
      x: this.origin.x + p.x * this.scale,
      y: this.origin.y + (p.y * this.sy - p.z * this.sz) * this.scale,
    };
  }

  /** Distance towards the camera: parts with a larger depth are drawn later (in front). */
  depth(p: Vec3): number {
    return dot3(p, this.toCam);
  }

  /** Unit vector from the scene towards the camera. */
  get viewDir(): Vec3 {
    return this.toCam;
  }

  /** Unit vector from the scene towards the light. */
  get lightDir(): Vec3 {
    return this.toLight;
  }

  /** Whether a surface with this outward normal faces the camera (is visible). */
  faces(normal: Vec3): boolean {
    return dot3(normal, this.toCam) > 1e-6;
  }

  /** Light received by a surface with this outward normal, from `ambient` (in shadow) to 1 (facing the light). */
  shade(normal: Vec3): number {
    const lambert = Math.max(0, dot3(norm3(normal), this.toLight));
    return this.light.ambient + (1 - this.light.ambient) * lambert;
  }

  /** Screen direction (unit, logical pixels) pointing towards the light, used to place cel highlights. */
  get lightOnScreen(): Point {
    const a = this.project(vec3(0, 0, 0));
    const b = this.project(this.toLight);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }
}
