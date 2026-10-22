/**
 * Drawing helpers shared by the HUD kit (src/ui): flat, hard-edged stone and bone built from
 * nested slabs, the way the actors' materials are built from three tones and an ink contour.
 *
 * Every slab is lit from the upper left (top and left edges take the `lit` tone, bottom and right
 * the `dark` one), the same light as `CAMERA`. Corners are chamfered, never round: the stone is cut.
 * Everything is axis-aligned, so a nine-slice cut on an inset line falls between whole pieces.
 */

import { Polygon, Path, alpha, lerpColor, type Point, type Shape } from '@core/draw';
import type { UiBox } from '@core';
import { PALETTES, RAMPS } from '../theme';

/** Three tones of a material (dark, base, lit), as in `RAMPS`. */
export type Tones = { lit: string; base: string; dark: string };

/** The ink of every contour. */
export const INK = PALETTES.ink;

/** A box inset by `d` on every side (`dy` on top and bottom when it differs). */
export function inset(b: UiBox, d: number, dy: number = d): UiBox {
  return { x: b.x + d, y: b.y + dy, w: b.w - 2 * d, h: b.h - 2 * dy };
}

/** A box as a shape; `chamfer` cuts the corners ([tl, tr, br, bl] for one by one). */
export function slab(b: UiBox, chamfer: number | [number, number, number, number] = 0): Shape {
  // The engine reads a chamfer under 1 as a share of the side, not pixels: a cut under a pixel is no cut.
  const px = (v: number) => (v < 1 ? 0 : v);
  const cut = Array.isArray(chamfer) ? (chamfer.map(px) as [number, number, number, number]) : px(chamfer);
  const any = Array.isArray(cut) ? cut.some((v) => v > 0) : cut > 0;
  return Polygon.rect(b.w, b.h, { cx: b.x + b.w / 2, cy: b.y + b.h / 2, ...(any ? { bevel: cut } : {}) });
}

/** Fills a box with one color. */
export function fillBox(c: CanvasRenderingContext2D, b: UiBox, color: string, chamfer: number | [number, number, number, number] = 0): void {
  slab(b, chamfer).fill(c, color);
}

/** A band of thickness `t` just inside box `o`, all one color. */
export function ring(c: CanvasRenderingContext2D, o: UiBox, t: number, color: string): void {
  const i = inset(o, t);
  const R = o.x + o.w, B = o.y + o.h, ri = i.x + i.w, bi = i.y + i.h;
  const paint = (pts: Point[]) => Polygon.fromPoints(pts).fill(c, color);
  paint([{ x: o.x, y: o.y }, { x: R, y: o.y }, { x: R, y: i.y }, { x: o.x, y: i.y }]);
  paint([{ x: o.x, y: bi }, { x: R, y: bi }, { x: R, y: B }, { x: o.x, y: B }]);
  paint([{ x: o.x, y: i.y }, { x: i.x, y: i.y }, { x: i.x, y: bi }, { x: o.x, y: bi }]);
  paint([{ x: ri, y: i.y }, { x: R, y: i.y }, { x: R, y: bi }, { x: ri, y: bi }]);
}

/** A bevel just inside box `o`: top and left in `tl`, bottom and right in `br`, mitred at the corners. `t` is the band, `tb` the bottom and right band when it differs. */
export function bevel(c: CanvasRenderingContext2D, o: UiBox, t: number, tl: string, br: string, tb: number = t): void {
  const R = o.x + o.w, B = o.y + o.h;
  const paint = (pts: Point[], color: string) => Polygon.fromPoints(pts).fill(c, color);
  paint([{ x: o.x, y: o.y }, { x: R, y: o.y }, { x: R - tb, y: o.y + t }, { x: o.x + t, y: o.y + t }, { x: o.x + t, y: B - tb }, { x: o.x, y: B }], tl);
  paint([{ x: R, y: B }, { x: o.x, y: B }, { x: o.x + t, y: B - tb }, { x: R - tb, y: B - tb }, { x: R - tb, y: o.y + t }, { x: R, y: o.y }], br);
}

/** A slab: ink contour, a base fill, a bevel in the material's tones. Returns the box inside the contour and bevel. */
export function slabPlate(
  c: CanvasRenderingContext2D,
  b: UiBox,
  tones: Tones,
  o: { contour?: number; chamfer?: number | [number, number, number, number]; bevel?: number; raised?: boolean; hi?: string; face?: string } = {},
): UiBox {
  const { contour = 2, chamfer = 0, bevel: t = 1.2, raised = true, hi, face = tones.base } = o;
  fillBox(c, b, INK, chamfer);
  const body = inset(b, contour);
  const cut = typeof chamfer === 'number' ? Math.max(0, chamfer - contour * 0.55) : chamfer.map((v) => Math.max(0, v - contour * 0.55)) as [number, number, number, number];
  fillBox(c, body, face, cut);
  if (t > 0) bevel(c, body, t, raised ? (hi ?? tones.lit) : tones.dark, raised ? tones.dark : (hi ?? tones.lit));
  return inset(body, t);
}

/** Shade along the inside of a box: a recess' inner shadow (top and left) and its catch-light (bottom and right). */
export function recess(c: CanvasRenderingContext2D, b: UiBox, shadow: string, light: string | undefined, t = 2.2, tb = 1): void {
  const R = b.x + b.w, B = b.y + b.h;
  const rect = (x: number, y: number, w: number, h: number, color: string) => fillBox(c, { x, y, w, h }, color);
  rect(b.x, b.y, b.w, t, shadow);
  rect(b.x, b.y + t, t, b.h - t, shadow);
  if (light) {
    rect(b.x + t, B - tb, b.w - t, tb, light);
    rect(R - tb, b.y + t, tb, b.h - t - tb, light);
  }
}

/** A line along a path in a stroke width and color (flat, round caps). */
export function line(c: CanvasRenderingContext2D, pts: Point[], width: number, color: string, cap: 'round' | 'butt' = 'round'): void {
  new Path(pts).toShape({ width, cap }).fill(c, color);
}

/** A glyph of the kit's soul ward (stem and two raised branches, the algiz), centred on (cx, cy), `s` tall; lit with a halo, as every soul fire is. */
export function soulRune(c: CanvasRenderingContext2D, cx: number, cy: number, s: number, strength = 1, tones: Tones = RAMPS.soul): void {
  const h = s / 2;
  const w = Math.max(0.9, s * 0.2);
  const rune = (): Shape => {
    const stem = new Path([{ x: cx, y: cy + h }, { x: cx, y: cy - h }]).toShape({ width: w, cap: 'round' });
    const left = new Path([{ x: cx, y: cy - h * 0.05 }, { x: cx - h * 0.8, y: cy - h * 0.95 }]).toShape({ width: w, cap: 'round' });
    const right = new Path([{ x: cx, y: cy - h * 0.05 }, { x: cx + h * 0.8, y: cy - h * 0.95 }]).toShape({ width: w, cap: 'round' });
    return stem.union([left, right]);
  };
  if (strength <= 0) {
    rune().fill(c, tones.dark);
    return;
  }
  rune().draw(c, { fill: tones.base, shadow: { color: alpha(tones.base, 0.9 * strength), x: 0, y: 0, blur: Math.max(2, s * 0.45) } });
  rune().scale(0.55, 0.9, { x: cx, y: cy }).fill(c, lerpColor(tones.base, tones.lit, strength));
}

/** A faceted stud: ink ring, base, a lit upper-left half, as the rivets of the gear. */
export function stud(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, tones: Tones): void {
  Polygon.circle(r, { cx, cy, segments: 14 }).fill(c, INK);
  Polygon.circle(r * 0.68, { cx, cy, segments: 14 }).fill(c, tones.base);
  Polygon.circle(r * 0.34, { cx: cx - r * 0.2, cy: cy - r * 0.2, segments: 10 }).fill(c, tones.lit);
}


/**
 * A corner bracket: an L of `len` along each arm and `thick` across, its outer corner at (x, y) and
 * opening towards `corner` ('tl' brackets the top-left corner of a box). Ink contour, base fill, a
 * lit upper-left edge.
 */
export function bracket(c: CanvasRenderingContext2D, x: number, y: number, corner: 'tl' | 'tr' | 'br' | 'bl', len: number, thick: number, tones: Tones): void {
  const sx = corner === 'tl' || corner === 'bl' ? 1 : -1;
  const sy = corner === 'tl' || corner === 'tr' ? 1 : -1;
  const L = (grow: number): Point[] => {
    const t = thick + grow, l = len + grow, g = -grow;
    return [
      { x: x + g * sx, y: y + g * sy },
      { x: x + l * sx, y: y + g * sy },
      { x: x + l * sx, y: y + t * sy },
      { x: x + t * sx, y: y + t * sy },
      { x: x + t * sx, y: y + l * sy },
      { x: x + g * sx, y: y + l * sy },
    ];
  };
  Polygon.fromPoints(L(1)).fill(c, INK);
  Polygon.fromPoints(L(0)).fill(c, tones.base);
  // The lit edge runs along the outer sides that face the light, the dark one along those that face away.
  const outerX = sx === 1 ? tones.lit : tones.dark;
  const outerY = sy === 1 ? tones.lit : tones.dark;
  const edge = Math.min(0.9, thick * 0.35);
  line(c, [{ x: x + edge / 2 * sx, y: y + edge / 2 * sy }, { x: x + (len - 0.3) * sx, y: y + edge / 2 * sy }], edge, outerY, 'butt');
  line(c, [{ x: x + edge / 2 * sx, y: y + edge / 2 * sy }, { x: x + edge / 2 * sx, y: y + (len - 0.3) * sy }], edge, outerX, 'butt');
}

/** A teardrop: round belly at (cx, cy) of radius r, its tip `tip * r` above (the lost soul's flame, a drop of blood). */
export function teardrop(cx: number, cy: number, r: number, tip = 2.2): Shape {
  const top = { x: cx, y: cy - r * tip };
  return Path.builder(top)
    .bezierTo({ x: cx + r * 0.25, y: cy - r * (tip * 0.55) }, { x: cx + r * 1.05, y: cy - r * 0.8 }, { x: cx + r, y: cy })
    .arcTo({ x: cx, y: cy }, r, 0, 180)
    .bezierTo({ x: cx - r * 1.05, y: cy - r * 0.8 }, { x: cx - r * 0.25, y: cy - r * (tip * 0.55) }, top)
    .close();
}

/** Clears a box to transparent (a window in a frame). */
export function cutBox(c: CanvasRenderingContext2D, b: UiBox, chamfer: number | [number, number, number, number] = 0): void {
  c.save();
  c.globalCompositeOperation = 'destination-out';
  slab(b, chamfer).fill(c, INK);
  c.restore();
}
