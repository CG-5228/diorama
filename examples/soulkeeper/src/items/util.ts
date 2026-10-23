/**
 * Helpers shared by the item pieces (`flask.ts`, `keys.ts`, `scroll.ts`, `shard.ts`, `coin.ts`, `amulet.ts`, `tome.ts`,
 * `garments.ts`).
 *
 * Nothing here names a theme material: a piece asks for a role (`role(ctx.materials, 'bone')`) and the catalog's
 * `defaultMaterials` decides which theme material plays it, so a key can be re-materialed without touching its code.
 * Pieces are built in `ctx.frame` (x forward, y right, z up, origin at the item's centre), already turned to the icon's
 * view and posed by the catalog; the icon is then fitted to its square, so what matters is the item's proportions and the
 * size of its parts against the contour (1.25 px) and the inner lines (about 0.9 px), which stay the same on every icon.
 */

import { Polygon, alpha, lerpColor, type Point } from '@core/draw';
import { Frame3, Solid, add3, cross3, dot3, len3, norm3, polygonNormal, scale3, sub3, vec3, type Camera, type Face, type Placed, type SceneMaterials, type StageObject, type Vec3, type VolumeStyle } from '@core/volume';
import { PALETTES } from '../theme';

/**
 * The material that plays a role in the item. `role(m, 'cork', 'wood')` tries the names in order, so a piece can fall back
 * to a plainer role. Throws an error that names the missing role (a catalog that forgot one fails loudly, not as a black volume).
 */
export function role(materials: SceneMaterials, ...names: string[]): VolumeStyle {
  for (const name of names) {
    const material = materials[name];
    if (material) return material;
  }
  const others = names.slice(1);
  throw new Error(`items: the catalog has no material for the role "${names[0]}"${others.length ? ` (nor ${others.map(n => `"${n}"`).join(', ')})` : ''}. Roles it has: ${Object.keys(materials).join(', ') || 'none'}.`);
}

/** A tonal copy of a material: `t` of the way from each tone to the ramp's dark (t > 0) or lit (t < 0) end. Lines stay the material's own. */
export function toned(m: VolumeStyle, t: number): VolumeStyle {
  const toward = (c: string) => lerpColor(c, t > 0 ? m.ramp.dark : m.ramp.lit, Math.abs(t));
  return { ...m, ramp: { lit: toward(m.ramp.lit), base: toward(m.ramp.base), dark: toward(m.ramp.dark) } };
}

/** A matte copy of a material (no highlight crescent): worn brass, old bone, tarnish. */
export const matte = (m: VolumeStyle): VolumeStyle => ({ ...m, form: { ...m.form, highlight: false } });

/**
 * A right-handed frame at `origin` whose `up` axis is `axis` (a cylinder lying along a direction, a ring round a rod). Its
 * forward is `hint` squared against the axis (any direction across it when they are parallel).
 */
export function axisFrame(origin: Vec3, axis: Vec3, hint: Vec3 = vec3(1, 0, 0)): Frame3 {
  const u = norm3(axis);
  let f = sub3(hint, scale3(u, dot3(hint, u)));
  if (len3(f) < 1e-4) f = cross3(u, vec3(0, 1, 0));
  f = norm3(f);
  return new Frame3(origin, f, cross3(u, f), u);
}

/** Points of a circle or an arc round `center` in the plane of `a` and `b`: `center + a·cos·rx + b·sin·ry`, from angle `from` to `to` (radians). */
export function ring(center: Vec3, a: Vec3, b: Vec3, rx: number, o: { ry?: number; n?: number; from?: number; to?: number } = {}): Vec3[] {
  const { ry = rx, n = 24, from = 0, to = Math.PI * 2 } = o;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = from + ((to - from) * i) / n;
    return add3(center, add3(scale3(a, Math.cos(t) * rx), scale3(b, Math.sin(t) * ry)));
  });
}

/** A flat polygon of the frame's `forward` / `right` plane as an extruded plate of thickness `t` from `z0` up (a blade, a tag, a seal). */
export function plate(g: Frame3, profile: Polygon, z0: number, t: number): Solid {
  return Solid.extrude(g.moved(0, 0, z0), profile, t);
}

/**
 * A faceted crystal standing on the frame's origin along its `up` axis: a prism of `sides` flat faces whose ring of radius `r`
 * (at the foot, `foot` of it) rises `body` and then closes on a point `tip` higher, so it reads as a hexagonal shard. `skew`
 * leans the point (in radius units, along forward) and `rng` roughens each corner by up to 10% so no two shards are alike.
 * Its faces take their tone from the light like every faceted solid, so three tones come for free.
 */
export function crystal(g: Frame3, o: { r: number; body: number; tip: number; sides?: number; foot?: number; skew?: number; rough?: () => number }): Solid {
  const { r, body, tip, sides = 6, foot = 0.82, skew = 0.25, rough } = o;
  const jitter = (): number => 1 + (rough ? (rough() - 0.5) * 0.2 : 0);
  const angle = (i: number) => (i / sides) * Math.PI * 2 + 0.3;
  const low = Array.from({ length: sides }, (_, i) => g.at(Math.cos(angle(i)) * r * foot * jitter(), Math.sin(angle(i)) * r * foot * jitter(), 0));
  const mid = Array.from({ length: sides }, (_, i) => g.at(Math.cos(angle(i)) * r * jitter(), Math.sin(angle(i)) * r * jitter(), body));
  const apex = g.at(skew * r, 0, body + tip);
  const centre = (pts: Vec3[]) => pts.reduce((s, p) => add3(s, scale3(p, 1 / pts.length)), vec3(0, 0, 0));
  const faces: Face[] = [];
  const add = (points: Vec3[]) => {
    // The outward normal points away from the crystal's axis: flip the polygon's own when it points inwards.
    let normal = polygonNormal(points);
    const away = sub3(centre(points), g.at(0, 0, (body + tip) * 0.4));
    if (dot3(normal, away) < 0) {
      points = [...points].reverse();
      normal = polygonNormal(points);
    }
    faces.push({ points, normal });
  };
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    add([low[i], low[j], mid[j], mid[i]]);
    add([mid[i], mid[j], apex]);
  }
  add([...low].reverse());
  return new Solid(faces);
}

/**
 * A pale glint: a small lit speck or streak drawn flat over a part, for the shine of glass, brass and wet crystal. `w` and `h`
 * are in world units (so it scales with the item, like the part it shines on); `scale` is the camera's.
 */
export function glint(c: CanvasRenderingContext2D, scale: number, at: Point, o: { w: number; h: number; angle?: number; strength?: number }): void {
  Polygon.capsule(o.w * scale, o.h * scale).rotate(o.angle ?? 0).translate(at.x, at.y).fill(c, alpha(PALETTES.white, o.strength ?? 0.8));
}

/**
 * Stitches along both edges of a strap that follows `path` (a point at `t`, 0 to 1) from `t0` to `t1`: short dashes a `step`
 * apart (world units), `half` from the strap's middle, drawn flat over the part they lie on (`host`) so they sort with it.
 * The dashes follow the strap on screen, whatever the pose, so a strap that turns under itself needs one call per run.
 */
export function stitches(o: StageObject, cam: Camera, host: Placed, path: (t: number) => Vec3, a: { t0: number; t1: number; step: number; half: number; color: string }): void {
  const samples = 48;
  const pts = Array.from({ length: samples + 1 }, (_, i) => path(a.t0 + ((a.t1 - a.t0) * i) / samples));
  const run = [0];
  for (let i = 1; i <= samples; i++) run.push(run[i - 1] + len3(sub3(pts[i], pts[i - 1])));
  const total = run[samples];
  o.custom(path((a.t0 + a.t1) / 2), c => {
    for (let d = a.step / 2; d < total; d += a.step) {
      let i = 1;
      while (i < samples && run[i] < d) i++;
      const k = (d - run[i - 1]) / Math.max(1e-6, run[i] - run[i - 1]);
      const p = cam.project(add3(pts[i - 1], scale3(sub3(pts[i], pts[i - 1]), k)));
      const q = cam.project(pts[i]);
      const r = cam.project(pts[i - 1]);
      const dx = q.x - r.x;
      const dy = q.y - r.y;
      const len = Math.hypot(dx, dy) || 1;
      for (const side of [-1, 1]) {
        const off = side * a.half * cam.scale;
        Polygon.rect(0.55 * cam.scale, 0.2 * cam.scale, { cx: p.x - (dy / len) * off, cy: p.y + (dx / len) * off, rotation: (Math.atan2(dy, dx) * 180) / Math.PI }).fill(c, a.color);
      }
    }
  }, { on: host });
}

/** Small dark holes (eyelets, the holes of a belt) at the given points, flat over `host`. */
export function holes(o: StageObject, cam: Camera, host: Placed, at: Vec3[], color: string, size = 0.42): void {
  o.custom(at[0], c => {
    for (const p of at) {
      const q = cam.project(p);
      Polygon.ellipse(size * cam.scale, size * 0.72 * cam.scale, { cx: q.x, cy: q.y, segments: 10 }).fill(c, color);
    }
  }, { on: host });
}
