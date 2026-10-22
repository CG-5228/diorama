/**
 * Murky water, the fifth floor of the graveyard kit (priority 4, over bone gravel): a dark, still surface that
 * floods the flagstones of a crypt. Like every floor it is a `floorTile`: a dual-grid tile (the space profile's cell,
 * 48 × 36 px) painted flat in screen pixels, calmer than the actors that wade through it. A whole tile is a dark slate with soft depth
 * patches and almost nothing else; a transition is a water edge over stone, read from outside in: a dark wet ring
 * on the stone, a pale thin rim on the water, a soft bank shadow on the sides the light leaves in shade.
 *
 * The seamless rules are the floors' own (see `floors.ts`): the border of a whole tile is the bare base tone in
 * every variant and every detail lies inside the tile; the large features are soft and fade to nothing before the
 * border; a transition's edge is the engine's roughened `cornerMaskShape`, so it meets the other floors' edges and
 * its own neighbours in the same place. Its detail helpers use the tile's own `t.fit`; the water is a recessed floor, so
 * its bevel is stroked with `recessed`.
 */

import { Path, Polygon, alpha, type Point } from '@core/draw';
import type { ScenePiece } from '@core/volume';
import { castShadow, floorTile, hairline, mixTone, role, type Tile } from './util';

/** What each variant looks like, in variant order (the catalog's `variantLabels`). */
export const WATER_LOOKS = ['Lisa e parada', 'Ondas finas', 'Brilhos de alma', 'Reflexo pálido', 'Funda e escura', 'Turva, com lodo'] as const;

/** Number of looks (frames per mask). */
export const WATER_VARIANTS = WATER_LOOKS.length;

/** Over bone gravel (3), the highest floor of the kit. */
export const WATER_PRIORITY = 4;

/**
 * The cell the details of this file were first tuned on, 32 × 24 px: counts are "per tuned cell" and grow with the
 * tile's own area (`per`), so a bigger cell keeps the finish while every detail keeps its size in pixels (a ripple is
 * a ripple next to the 80-unit character, whatever the grid).
 */
const TUNED_AREA = 32 * 24;

/** `n` details per tuned cell, as many as this tile's area calls for. */
const per = (t: Tile, n: number) => Math.round((n * t.w * t.h) / TUNED_AREA);

/** A random tile-local point at least `margin` px from the border. */
function inside(t: Tile, margin: number): Point {
  const s = t.safe(margin);
  return { x: t.rng.float(s.x0, s.x1), y: t.rng.float(s.y0, s.y1) };
}

/**
 * `n` soft depth patches: ellipses of `tone` (wider than tall, as a circle on the floor looks from the camera) that
 * fade to nothing at their rim, so the water mottles without hard blotches and without printing the tile grid. Each
 * is only as big as the room it has, so none reaches the border.
 */
function patches(t: Tile, n: number, rmin: number, rmax: number, tone: string, strength: number): void {
  const { c, rng } = t;
  for (let i = 0; i < n; i++) {
    const want = rng.float(rmin, rmax);
    const at0 = { x: rng.float(-t.w / 2, t.w / 2), y: rng.float(-t.h / 2, t.h / 2) };
    // Only as big as the room it has (a patch by the border is small, never cut), but never dropped: one that would not fit
    // is a small patch moved inwards, so the border is as mottled as the middle and no calm gutter prints the grid.
    const rx = Math.max(2.4, Math.min(want, t.w / 2 - Math.abs(at0.x) - 0.3));
    const ry = rx * 0.55;
    const p = t.fit(at0, rx, ry, 0.3);
    const at = t.at(p.x, p.y);
    c.save();
    c.translate(at.x, at.y);
    c.scale(1, ry / rx);
    const patch = Polygon.circle(rx, { cx: 0, cy: 0, segments: 24 });
    patch.fill(c, patch.createGradient(c, { type: 'radial', center: { x: 0, y: 0 }, r1: 0, r2: rx, stops: [[0, alpha(tone, strength)], [0.55, alpha(tone, strength * 0.55)], [1, alpha(tone, 0)]] }));
    c.restore();
  }
}

/** A ripple: an open arc of a flat ellipse (wider than tall), a thin pale line with a darker one under it. */
function ripple(t: Tile, at: Point, rx: number, from: number, to: number, lit: string, dark: string, strength: number): void {
  const { c } = t;
  const ry = rx * 0.4;
  const p = t.fit(at, rx, ry, 1.2);
  const pts: Point[] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    pts.push(t.at(p.x + Math.cos(a) * rx, p.y + Math.sin(a) * ry));
  }
  const shadow = pts.map(q => ({ x: q.x + 0.15, y: q.y + 0.7 }));
  Path.spline(shadow, { style: 'smooth' }).stroke(c, hairline(alpha(dark, 0.4 * strength), 0.55));
  Path.spline(pts, { style: 'smooth' }).stroke(c, hairline(alpha(lit, 0.32 * strength), 0.5));
}

/** A faint soul-green glint: a tiny pale core, a halo and a short streak, as a candle's light catches a ripple. */
function glint(t: Tile, at: Point, glow: { base: string; lit: string }, strength: number): void {
  const { c } = t;
  const p = t.fit(at, 2.4, 1.2, 0.6);
  const q = t.at(p.x, p.y);
  Polygon.ellipse(2.2, 1.2, { cx: q.x, cy: q.y, segments: 12 }).fill(c, alpha(glow.base, 0.14 * strength));
  new Path([{ x: q.x - 1.7, y: q.y + 0.2 }, { x: q.x + 1.7, y: q.y + 0.2 }]).stroke(c, hairline(alpha(glow.base, 0.3 * strength), 0.5));
  Polygon.ellipse(0.8, 0.45, { cx: q.x, cy: q.y, segments: 8 }).fill(c, alpha(glow.lit, 0.85 * strength));
}

/** A pale reflection: a short horizontal streak, thinning at both ends. */
function streak(t: Tile, at: Point, length: number, lit: string, strength: number): void {
  const p = t.fit(at, length / 2, 0.4, 1.4);
  const q = t.at(p.x, p.y);
  new Path([{ x: q.x - length / 2, y: q.y }, { x: q.x, y: q.y + 0.1 }, { x: q.x + length / 2, y: q.y }]).stroke(t.c, hairline(alpha(lit, 0.34 * strength), 0.55));
}

/**
 * Still, murky water: a flat dark slate with soft depth patches, a few thin ripples and reflections, and rare,
 * faint soul-green glints. Six looks (still, fine ripples, soul glints, pale reflection, deep and dark, silty) that differ
 * in what they carry, never in where their border is. Water is the calmest floor of the kit: the least contrast
 * and the fewest details, nothing bigger than a ripple, and no accent beyond the glints.
 */
export const murkyWater: ScenePiece<{ glints: number; ripples: number }> = (ctx, o) => {
  const w = role(ctx.materials, 'water').ramp;
  const glow = role(ctx.materials, 'glow').ramp;
  floorTile(ctx, {
    priority: WATER_PRIORITY,
    salt: 0x5a91,
    paint(t) {
      const { c, rng } = t;
      const v = t.variant;
      // Wet stone round the water: the flags darken where they drink.
      if (!t.full) t.region.clone().offset(1.5).fill(c, castShadow(0.3));
      t.inRegion(() => {
        t.region.fill(c, w.base);
        // Depth: darker patches and paler ones, large and weak (the deep look is darker).
        patches(t, per(t, 9), 3.5, 8, w.dark, [0.26, 0.24, 0.24, 0.22, 0.38, 0.3][v] ?? 0.26);
        patches(t, per(t, 7), 3, 7, w.lit, [0.08, 0.1, 0.08, 0.1, 0.05, 0.09][v] ?? 0.08);
        // Fine ripples: open arcs, a handful in the second look and a few in the silty one, spread over the tile (never two
        // alike side by side) and faint so a field of them stays calm.
        const arcs = Math.round(([0, 4, 0, 0, 0, 2][v] ?? 0) * o.ripples);
        t.spread(arcs).forEach(at => {
          const from = rng.float(Math.PI * 0.05, Math.PI * 0.5);
          ripple(t, at, rng.float(3.6, 6.2), from, from + rng.float(Math.PI * 1.1, Math.PI * 1.5), mixTone(w.base, w.lit, 0.85), w.dark, 0.75);
        });
        // Pale reflection: loose rows of short streaks, as a ceiling's light lies on the water.
        if (v === 3) {
          for (let row = 0; row < per(t, 1); row++) {
            const y = rng.float(-0.32, 0.32) * t.h + (row - (per(t, 1) - 1) / 2) * t.h * 0.34;
            const x = rng.float(-0.45, -0.1) * t.w;
            for (let k = 0; k < 4; k++) streak(t, { x: x + k * rng.float(3.2, 4.6) * (t.w / 32) * 0.8, y: y + rng.float(-1.8, 1.8) }, rng.float(2.6, 5.4), w.lit, 1);
          }
        }
        // Fine grain, so the dark base is not a plain fill: a few specks, pale and dark (more of them in the silty look).
        for (const at of t.spread(per(t, v === 5 ? 34 : 18))) {
          const p = t.fit(at, 0.5, 0.5, 0.5);
          const q = t.at(p.x, p.y);
          Polygon.circle(rng.float(0.25, 0.45), { cx: q.x, cy: q.y, segments: 8 }).fill(c, rng.boolean(0.4) ? alpha(w.lit, 0.3) : alpha(w.dark, 0.55));
        }
        // Soul glints, rare: two in the glinting look and one in the deep one, a bigger tile or not (a glint is the most contrasty detail
        // of the tile, so a count that followed the area would print constellations): the other four looks carry none and a field of
        // water prints no rows of dots.
        const n = Math.round(([0, 0, 2, 0, 1, 0][v] ?? 0) * o.glints);
        t.spread(n).forEach(at => glint(t, at, glow, 1));
      });
      // The water's edge on the stone, from the water outwards: the bank's shadow on the sides it leaves in shade (the dark
      // stroke of a recessed edge), a pale wall where the bank faces the light (its lit stroke), and a thin pale rim all round.
      if (!t.full) {
        t.bevelEdge({ lit: alpha(w.lit, 0.34), dark: alpha(w.dark, 0.6), litWidth: 1.7, darkWidth: 3.2, recessed: true });
        t.inRegion(() => {
          for (const run of t.edge) {
            new Path(run).stroke(c, hairline(alpha(w.lit, 0.16), 4.6));
            new Path(run).stroke(c, hairline(alpha(mixTone(w.lit, glow.lit, 0.08), 0.62), 1.5));
          }
        });
        for (const run of t.edge) new Path(run).stroke(c, hairline(alpha(w.dark, 0.85), 0.7));
      }
    },
  });
};
