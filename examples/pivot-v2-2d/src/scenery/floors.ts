/**
 * Floors of the graveyard kit, in the order they lie over each other (the catalog's `priority`):
 * grave dirt (0), crypt flagstones (1), dead moss (2) and bone gravel (3).
 *
 * Every floor is a `floorTile`: a dual-grid tile (the space profile's cell, 48 × 36 px) painted flat in screen pixels,
 * calmer than the actors that walk on it (one base tone, small soft detail, a thin line only where a material
 * ends). A frame is drawn the same wherever it is laid (its seed is the frame's), so the look of a field
 * comes from the variants (4-6 per floor) and from how each one spreads its detail. The rules that make
 * tiles meet without a seam, and a field without a lattice:
 * - a whole tile is the same along its border whatever the variant (mortar half-lines, or nothing but
 *   the base tone); every other detail lies wholly inside the tile;
 * - the large features (mottling, a worn patch) are soft, low in contrast and fade to nothing before
 *   the border; the sharp ones are small and sized to the room they have, so their density is the same
 *   near the border as in the middle and no grid of empty margins shows;
 * - a transition's edge is `cornerMaskShape` roughened inside the tile and faded to the exact cut;
 * - anything that sticks out of a transition's region (tufts, a slab's side, spilled pebbles) is
 *   kept away from the tile's border, so the neighbouring tile never has to continue it.
 */

import { Path, Polygon, alpha, type Point } from '@core/draw';
import type { ScenePiece } from '@core/volume';
import { SPACE } from '../space';
import { blob, castShadow, floorTile, hairline, mixTone, role, type Tile } from './util';

/** What each floor's variants look like, in variant order (the catalog's `variantLabels`). */
export const FLOOR_LOOKS = {
  dirt: ['Smooth', 'With roots', 'Cracked', 'Stony', 'Churned'],
  flags: ['Whole slab', 'Cracked slab', 'Broken slab', 'Worn slab', 'Large slab', 'Damp slab'],
  moss: ['Dense moss', 'Dry grass', 'Patchy moss', 'Thin moss', 'Scattered tufts'],
  gravel: ['Fine gravel', 'Long bone', 'Pale gravel', 'Bone fragment', 'Coarse gravel'],
} as const;

/** Number of looks of each floor (frames per mask). */
export const FLOOR_VARIANTS = { dirt: FLOOR_LOOKS.dirt.length, flags: FLOOR_LOOKS.flags.length, moss: FLOOR_LOOKS.moss.length, gravel: FLOOR_LOOKS.gravel.length } as const;

/** Which floor lies over which: the catalog's `priority`, and the layer order in a scene. */
export const FLOOR_PRIORITY = { dirt: 0, flags: 1, moss: 2, gravel: 3 } as const;

/**
 * The cell the details of this file were first tuned on, 32 × 24 px: every count below is "per tuned cell" and grows with
 * the tile's own area (`per`), so a bigger cell keeps the finish (the same density of pebbles, grit, blades) while each
 * detail keeps its size in pixels: a pebble is a pebble next to the 80-unit character, whatever the grid.
 */
const TUNED_AREA = 32 * 24;

/** `n` details per tuned cell, as many as this tile's area calls for. */
const per = (t: Tile, n: number) => Math.round((n * t.w * t.h) / TUNED_AREA);

/** `n` points inside the tile's safe area, `margin` px from its border. */
function scatter(t: Tile, n: number, margin: number): Point[] {
  const s = t.safe(margin);
  return Array.from({ length: n }, () => ({ x: t.rng.float(s.x0, s.x1), y: t.rng.float(s.y0, s.y1) }));
}

/**
 * `n` soft stains: ellipses of `tone` (wider than tall, as a circle on the floor looks from the camera) that fade
 * to nothing at their rim (a radial gradient), so the ground mottles without hard-edged blotches and without
 * showing the tile grid. Centres are spread evenly over the whole tile (`t.spread`) and each stain is only as big as the
 * room it has: none reaches the border, and the ones near it are small, so the mottling is as dense along the border as in
 * the middle (stains that keep to the middle and leave a gutter print a lattice; stains at random centres clump, and a
 * clump is a blotch that a field repeats at every tile of its look). `rmin` to `rmax` is the radius across when it fits.
 * Large and weak beat small and strong.
 */
function stains(t: Tile, n: number, rmin: number, rmax: number, tone: string, strength: number): void {
  const { c, rng } = t;
  // Centres on a jittered grid (`spread`), not at random: random centres clump, and a clump of stains is a distinctive blotch
  // that a field repeats at every tile of its look; an even mottling has no such feature to repeat.
  for (const at of t.spread(n)) {
    const want = rng.float(rmin, rmax);
    // Only as big as the room it has (so none is cut by the border), but never dropped: a stain that would not fit is a small
    // one moved inwards, so the border is as mottled as the middle and no calm gutter prints a lattice.
    const rx = Math.max(2.4, Math.min(want, t.w / 2 - Math.abs(at.x) - 0.3));
    const ry = rx * 0.72;
    const p = t.fit(at, rx, ry, 0.3);
    const q = t.at(p.x, p.y);
    c.save();
    c.translate(q.x, q.y);
    c.scale(1, ry / rx);
    const patch = Polygon.circle(rx, { cx: 0, cy: 0, segments: 24 });
    patch.fill(c, patch.createGradient(c, { type: 'radial', center: { x: 0, y: 0 }, r1: 0, r2: rx, stops: [[0, alpha(tone, strength)], [0.5, alpha(tone, strength * 0.6)], [1, alpha(tone, 0)]] }));
    c.restore();
  }
}

/** A speck of grit: a dot a pixel or less across, dark or pale. */
function grit(t: Tile, n: number, dark: string, lit: string, pale = 0.45): void {
  for (const at of t.spread(n)) {
    const p = t.fit(at, 0.55, 0.55, 0.3);
    const q = t.at(p.x, p.y);
    Polygon.circle(t.rng.float(0.28, 0.55), { cx: q.x, cy: q.y, segments: 8 }).fill(t.c, t.rng.boolean(pale) ? lit : dark);
  }
}

/** A crack: a chiselled dark line with a pale lip under it, wandering from `from` to `to`. */
function crack(t: Tile, from: Point, to: Point, dark: string, lit: string, width = 0.6): void {
  const n = 4;
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const wob = i === 0 || i === n ? 0 : t.rng.float(-1.1, 1.1);
    pts.push({ x: from.x + (to.x - from.x) * k + wob * 0.6, y: from.y + (to.y - from.y) * k + wob * 0.5 });
  }
  const line = Path.spline(pts, { style: 'chiseled' });
  line.clone().translate(0.45, 0.55).stroke(t.c, hairline(lit, width * 0.8));
  line.stroke(t.c, hairline(dark, width));
}

/** A small lump on the floor (a pebble, a clod): a soft contact shadow, a body, a shaded underside and a faint glint. Quiet on purpose: embedded in the ground, not sitting on it. */
function lump(t: Tile, q: Point, rx: number, ry: number, ramp: { base: string; dark: string; lit: string }, body: string): void {
  const { c } = t;
  const seed = t.rng.int(1, 9999);
  blob(q.x + 0.3, q.y + 0.6, rx * 1.08, ry * 1.08, seed).fill(c, alpha(ramp.dark, 0.6));
  const shape = blob(q.x, q.y, rx, ry, seed);
  shape.fill(c, body);
  shape.clip(c, () => blob(q.x + rx * 0.35, q.y + ry * 0.5, rx * 1.05, ry * 0.9, seed).fill(c, alpha(ramp.dark, 0.34)));
  Polygon.circle(Math.max(0.25, rx * 0.17), { cx: q.x - rx * 0.35, cy: q.y - ry * 0.4, segments: 8 }).fill(c, alpha(ramp.lit, 0.5));
}

/**
 * `n` lumps of radius `rmin` to `rmax`, many small and few big, each wherever it fits inside the tile. The points start
 * on `t.spread` (so the border is as busy as the middle), are shaken off that grid and kept `gap` px clear of the lumps
 * already in `taken` (every set of one tile shares it), so no pair or row forms inside the tile; a lump keeps clear of
 * the border too, so two tiles' lumps do not touch across it. A lump with no room after a few tries is skipped.
 */
function lumps(t: Tile, taken: Point[], n: number, rmin: number, rmax: number, ramp: { base: string; dark: string; lit: string }, body: string, gap = 5.2): void {
  const { rng } = t;
  const room = (p: Point) => taken.every(o => Math.hypot(p.x - o.x, (p.y - o.y) / 0.75) >= gap);
  for (const at of t.spread(n)) {
    const rx = rmin + (rmax - rmin) * rng.float(0, 1) ** 1.7;
    const ry = rx * rng.float(0.62, 0.85);
    const pad = 1.3 + rx * 0.4;
    let p = t.fit({ x: at.x + rng.float(-2.6, 2.6), y: at.y + rng.float(-1.8, 1.8) }, rx * 1.1, ry * 1.1, pad);
    for (let tries = 0; tries < 6 && !room(p); tries++) {
      const s = t.safe(pad + rx);
      p = { x: rng.float(s.x0, s.x1), y: rng.float(s.y0, s.y1) };
    }
    if (!room(p)) continue;
    taken.push(p);
    lump(t, t.at(p.x, p.y), rx, ry, ramp, body);
  }
}

// ----------------------------------------------------------------------------------------------
// Grave dirt
// ----------------------------------------------------------------------------------------------

/** One root fibre: a pale strand with its shadow, wandering a few px and thinning out. */
function root(t: Tile, r: { base: string; dark: string; lit: string }): void {
  const { c, rng } = t;
  const s = t.safe(4.5);
  let at = { x: rng.float(s.x0, s.x1), y: rng.float(s.y0, s.y1) };
  let a = rng.float(0, Math.PI * 2);
  const pts = [t.at(at.x, at.y)];
  for (let k = 0; k < 4; k++) {
    a += rng.float(-0.7, 0.7);
    const len = rng.float(2.2, 3.2);
    at = { x: Math.max(s.x0, Math.min(s.x1, at.x + Math.cos(a) * len)), y: Math.max(s.y0, Math.min(s.y1, at.y + Math.sin(a) * len * 0.75)) };
    pts.push(t.at(at.x, at.y));
  }
  const strand = Path.spline(pts, { style: 'smooth' });
  strand.clone().translate(0.3, 0.7).toShape({ width: { start: 0.75, end: 0.25 }, cap: 'round' }).fill(c, alpha(r.dark, 0.3));
  strand.toShape({ width: { start: 0.75, end: 0.25 }, cap: 'round' }).fill(c, alpha(mixTone(r.base, r.lit, 0.4), 0.55));
}

/**
 * Packed grave earth: a flat brown with soft mottling, grit, pebbles and thin root fibres. Five looks (smooth,
 * roots, cracked, stony, turned over) that differ in what they carry, never in where their border is.
 */
export const graveDirt: ScenePiece<{ pebbles: number }> = (ctx, o) => {
  const r = role(ctx.materials, 'dirt').ramp;
  floorTile(ctx, {
    priority: FLOOR_PRIORITY.dirt,
    salt: 0x1d17,
    paint(t) {
      const { c, rng } = t;
      const v = t.variant;
      t.inRegion(() => {
        t.region.fill(c, r.base);
        // Soft mottling: darker damp patches and paler dry ones, large and weak.
        stains(t, per(t, 9), 3.5, 7, r.dark, [0.3, 0.26, 0.3, 0.24, 0.3][v] ?? 0.3);
        stains(t, per(t, 8), 3, 6.5, r.lit, [0.22, 0.24, 0.2, 0.2, 0.24][v] ?? 0.22);
        grit(t, per(t, [60, 56, 60, 56, 80][v] ?? 60), alpha(r.dark, 0.9), alpha(r.lit, 0.85), 0.5);
        // Root fibres, in the second look only: a motif is kept to one or two looks, or a field prints it everywhere.
        for (let i = 0; i < per(t, [0, 1, 0, 0, 0][v] ?? 0); i++) root(t, r);
        // The cracked look: fissures and short ones.
        if (v === 2) {
          const s = t.safe(4);
          for (let i = 0; i < per(t, 1); i++) {
            const a = { x: rng.float(s.x0, s.x1 - 7), y: rng.float(s.y0, s.y1 - 3) };
            crack(t, t.at(a.x, a.y), t.at(a.x + rng.float(3, 5.5), a.y + rng.float(2.5, 4.5)), alpha(r.dark, 0.5), alpha(r.lit, 0.22), 0.55);
            const b = { x: rng.float(s.x0, s.x1 - 5), y: rng.float(s.y0, s.y1 - 2) };
            crack(t, t.at(b.x, b.y), t.at(b.x + rng.float(2.5, 4), b.y + rng.float(-1.5, 2)), alpha(r.dark, 0.4), alpha(r.lit, 0.16), 0.45);
          }
        }
        // Pebbles, many small and a few big, kept apart so they never pair up or line into rows: a dusty body only a
        // step above the ground, a shaded underside and a faint glint.
        const pale = mixTone(r.base, r.lit, 0.56);
        const count = (n: number) => Math.round(per(t, n) * o.pebbles);
        const taken: Point[] = [];
        lumps(t, taken, count([6, 5, 5, 8, 4][v] ?? 6), 0.6, 1.3, r, pale);
        lumps(t, taken, count([1, 1, 1, 2, 0][v] ?? 1), 1.4, 2, r, pale);
        // Turned earth: clods a little darker than the ground, with a pale top.
        if (v === 4) lumps(t, taken, per(t, 7), 0.9, 1.7, r, mixTone(r.base, r.lit, 0.14));
      });
      // Where the dirt ends (it is the lowest floor, so this only shows over a lower material in a retheme): a line a little firmer than
      // before, so the edge keeps its share of the sheet's darkest pixels now that a tile has fewer edge pixels per area (the value spread).
      for (const run of t.edge) new Path(run).stroke(c, hairline(alpha(r.dark, 0.92), 0.95));
    },
  });
};

// ----------------------------------------------------------------------------------------------
// Crypt flagstones
// ----------------------------------------------------------------------------------------------

/** Width of the mortar joint at a tile's border: each tile paints its half, so two tiles make a joint twice this wide. */
const JOINT = 0.8;

/**
 * A flagstone of the crypt, in world units: 0.3 of a character on a side (about half a metre of an adult). The count of
 * slabs in a cell follows from it, so a slab reads as a flagstone next to the character and not as a paving block: a cell
 * of the jrpg preset (0.6 of a character) holds two courses of two slabs.
 */
const SLAB = 0.3 * SPACE.scale.character;

/** A slab of a tile: its box in tile-local px, inside the half joints. */
interface Slab {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The mortar joints of a tile, as tile-local segments (the ones at the border are drawn apart, as half joints). */
type Joint = [x0: number, y0: number, x1: number, y1: number];

/**
 * The slabs of a tile: `courses` rows of `across` slabs, laid in running bond. Each course joint and each slab joint wanders on
 * its own from an even spacing (so a tile is never a plain grid, and the courses break bond), but a tile's border is always a
 * joint: a slab ends where the tile does, whatever the variant, and tiles side by side meet in a T like masonry. `tall` lays
 * one big slab the height of the tile beside two small ones (when the cell is two courses of two), which breaks the courses.
 */
function layoutSlabs(t: Tile, wander: { x: number; y: number }, across: number, courses: number, tall = false): { slabs: Slab[]; joints: Joint[] } {
  const { rng } = t;
  const x0 = -t.w / 2;
  const x1 = t.w / 2;
  const y0 = -t.h / 2;
  const y1 = t.h / 2;
  if (tall && across === 2 && courses === 2) {
    const left = rng.boolean();
    const xj = left ? x0 + t.w * rng.float(0.54, 0.66) : x1 - t.w * rng.float(0.54, 0.66);
    const yj = rng.float(-0.14, 0.14) * t.h;
    const big: Slab = left ? { x0: x0 + JOINT, x1: xj - JOINT, y0: y0 + JOINT, y1: y1 - JOINT } : { x0: xj + JOINT, x1: x1 - JOINT, y0: y0 + JOINT, y1: y1 - JOINT };
    const side = left ? { x0: xj + JOINT, x1: x1 - JOINT } : { x0: x0 + JOINT, x1: xj - JOINT };
    return {
      slabs: [big, { ...side, y0: y0 + JOINT, y1: yj - JOINT }, { ...side, y0: yj + JOINT, y1: y1 - JOINT }],
      joints: [[xj, y0, xj, y1], left ? [xj, yj, x1, yj] : [x0, yj, xj, yj]],
    };
  }
  const courseH = t.h / courses;
  const ys = Array.from({ length: courses - 1 }, (_, k) => y0 + courseH * (k + 1) + rng.float(-wander.y, wander.y) * courseH * 0.8);
  const slabs: Slab[] = [];
  const joints: Joint[] = ys.map(y => [x0, y, x1, y]);
  for (let k = 0; k < courses; k++) {
    const top = k === 0 ? y0 : ys[k - 1];
    const bottom = k === courses - 1 ? y1 : ys[k];
    const xs = Array.from({ length: across - 1 }, (_, i) => x0 + (t.w / across) * (i + 1) + rng.float(-wander.x, wander.x) * (t.w / across));
    const edges = [x0 + JOINT, ...xs.flatMap(x => [x - JOINT, x + JOINT]), x1 - JOINT];
    for (let i = 0; i < edges.length; i += 2) slabs.push({ x0: edges[i], x1: edges[i + 1], y0: top + JOINT, y1: bottom - JOINT });
    for (const x of xs) joints.push([x, top, x, bottom]);
  }
  return { slabs, joints };
}

/**
 * Worn crypt flagstones: a few slabs per tile (a cell is two courses of two, see `SLAB`) with mortar between them and at the
 * border. Six looks: whole, cracked, one slab split in two with a chipped corner, worn (a pale patch and pits), a big
 * slab the height of the tile beside two small ones (it breaks the courses) and damp (darker, with soft stains). A slab's tone drifts a little from its
 * neighbours': new stones among old ones.
 */
export const cryptFlags: ScenePiece<{ wear: number }> = (ctx, o) => {
  const stone = role(ctx.materials, 'flagstone', 'stone');
  const mortar = role(ctx.materials, 'mortar').ramp;
  const r = stone.ramp;
  const across = Math.max(1, Math.round(ctx.grid.cell.x / SLAB));
  const courses = Math.max(1, Math.round(ctx.grid.cell.y / SLAB));
  floorTile(ctx, {
    priority: FLOOR_PRIORITY.flags,
    salt: 0x1f1a,
    paint(t) {
      const { c, rng } = t;
      const v = t.variant;
      const { slabs, joints } = layoutSlabs(t, { x: 0.28, y: 0.34 }, across, courses, v === 4);
      // The look's own drift of tone (the worn slabs are paler, the split and damp ones darker), and each slab's own on top of it.
      const bias = [0, 0.12, -0.14, 0.05, 0, -0.2][v] ?? 0;
      const slabTone = () => {
        const d = bias + rng.float(-0.12, 0.12);
        return d >= 0 ? mixTone(r.base, r.lit, d) : mixTone(r.base, r.dark, -d);
      };
      // A transition is a slab lying on the dirt: a soft shadow under it.
      if (!t.full) t.region.clone().translate(0.4, 2.4).fill(c, castShadow(0.2));
      const order = rng.shuffle(slabs.map((_, i) => i));
      const wide = (s: Slab) => s.x1 - s.x0;
      const tall = (s: Slab) => s.y1 - s.y0;
      const rect = (s: Slab) => Polygon.rect(wide(s), tall(s), { cx: t.cx + (s.x0 + s.x1) / 2, cy: t.cy + (s.y0 + s.y1) / 2 });
      const line = (ax: number, ay: number, bx: number, by: number, color: string, w: number) => new Path([t.at(ax, ay), t.at(bx, by)]).stroke(c, hairline(color, w));
      t.inRegion(() => {
        // The mortar is the ground: every slab is laid on it, so the joints are what is left between them.
        t.region.fill(c, mortar.base);
        for (const s of slabs) {
          rect(s).fill(c, slabTone());
          // Bevel: pale on the sides that face the light, dark on the others (light from the upper left).
          line(s.x0 + 0.5, s.y0 + 0.6, s.x1 - 0.5, s.y0 + 0.6, alpha(r.lit, 1), 0.9);
          line(s.x0 + 0.6, s.y0 + 0.6, s.x0 + 0.6, s.y1 - 0.5, alpha(r.lit, 0.6), 0.9);
          line(s.x0 + 0.5, s.y1 - 0.55, s.x1 - 0.5, s.y1 - 0.55, alpha(r.dark, 0.8), 1.1);
          line(s.x1 - 0.6, s.y0 + 0.8, s.x1 - 0.6, s.y1 - 0.5, alpha(r.dark, 0.65), 0.9);
        }
        // The worn look: stone rubbed pale where feet crossed it, soft and wide, never reaching the joint (two slabs of the tile).
        if (v === 3) {
          for (const i of order.slice(0, 2)) {
            const s = slabs[i];
            const w = Math.min(rng.float(7, 9), wide(s) * 0.36);
            const at = t.at((s.x0 + s.x1) / 2 + rng.float(-2, 2), (s.y0 + s.y1) / 2 + rng.float(-1, 1));
            c.save();
            c.translate(at.x, at.y);
            c.scale(1, 0.62);
            const patch = Polygon.circle(w, { cx: 0, cy: 0, segments: 24 });
            patch.fill(c, patch.createGradient(c, { type: 'radial', center: { x: 0, y: 0 }, r1: 0, r2: w, stops: [[0, alpha(r.lit, 0.3 * o.wear)], [0.6, alpha(r.lit, 0.16 * o.wear)], [1, alpha(r.lit, 0)]] }));
            c.restore();
          }
        }
        // The damp look: soft dark stains where the water stands, calm and never reaching the border.
        if (v === 5) stains(t, per(t, 3), 3.5, 7, r.dark, 0.2 * Math.max(0.5, o.wear));
        // Surface wear: grit and scuffs.
        grit(t, per(t, v === 3 ? 30 : 22), alpha(r.dark, 0.6), alpha(r.lit, 0.5), 0.5);
        for (const p of scatter(t, Math.round(per(t, v === 3 ? 5 : 3) * o.wear), 4)) {
          const q = t.at(p.x, p.y);
          new Path([q, { x: q.x + rng.float(2, 4.5), y: q.y + rng.float(-0.6, 0.6) }]).stroke(c, hairline(alpha(r.lit, 0.34), 0.5));
        }
        // Pits of the worn look: small dark flecks with a pale lip.
        if (v === 3) {
          for (const p of scatter(t, Math.round(per(t, 7) * o.wear), 3)) {
            const q = t.at(p.x, p.y);
            Polygon.ellipse(rng.float(0.4, 0.7), rng.float(0.3, 0.5), { cx: q.x, cy: q.y, segments: 8 }).fill(c, alpha(mortar.dark, 0.6));
            Polygon.circle(0.25, { cx: q.x + 0.3, cy: q.y + 0.5, segments: 6 }).fill(c, alpha(r.lit, 0.4));
          }
        }
        // Cracked slab: a short fissure from a slab's top joint, and a hairline from the left joint of another slab.
        if (v === 1 && o.wear > 0) {
          const s = slabs[order[0]];
          const a = { x: rng.float(s.x0 + 4, s.x1 - 4), y: s.y0 + 1.1 };
          crack(t, t.at(a.x, a.y), t.at(a.x + rng.float(-3, 3), a.y + tall(s) * rng.float(0.34, 0.5)), alpha(mortar.dark, 0.9), alpha(r.lit, 0.5), 0.65);
          const h = slabs[order[Math.min(1, slabs.length - 1)]];
          crack(t, t.at(h.x0 + 1.1, h.y0 + tall(h) * rng.float(0.3, 0.5)), t.at(h.x0 + rng.float(5, 8), h.y0 + tall(h) * rng.float(0.5, 0.7)), alpha(mortar.dark, 0.75), alpha(r.lit, 0.38), 0.5);
        }
        // Split slab: one slab broken across, the break a joint of its own (narrower than the laid ones, a little crooked).
        if (v === 2 && o.wear > 0) {
          const s = slabs[order[0]];
          const x = s.x0 + wide(s) * rng.float(0.3, 0.7);
          const pts = [t.at(x, s.y0), t.at(x + rng.float(-1.6, 1.6), (s.y0 + s.y1) / 2 + rng.float(-1.5, 1.5)), t.at(x + rng.float(-2.4, 2.4), s.y1)];
          Path.spline(pts, { style: 'chiseled' }).stroke(c, hairline(mortar.base, JOINT * 1.5));
          Path.spline(pts.map(p => ({ x: p.x + 0.9, y: p.y + 0.2 })), { style: 'chiseled' }).stroke(c, hairline(alpha(r.lit, 0.45), 0.5));
          // Chipped corner of another slab: the mortar shows through where the stone broke.
          const b = slabs[order[Math.min(1, slabs.length - 1)]];
          const sx = rng.boolean() ? 1 : -1;
          const sy = rng.boolean() ? 1 : -1;
          const corner = { x: sx > 0 ? b.x1 : b.x0, y: sy > 0 ? b.y1 : b.y0 };
          Polygon.fromPoints([
            t.at(corner.x, corner.y),
            t.at(corner.x - sx * rng.float(3.6, 5), corner.y),
            t.at(corner.x - sx * rng.float(2, 3), corner.y - sy * rng.float(1.2, 2)),
            t.at(corner.x, corner.y - sy * rng.float(3, 4.2)),
          ]).fill(c, mortar.base);
        }
        // Mortar at the border and between the slabs: the same border in every variant, half in this tile and half in its neighbour.
        Polygon.rect(t.w, t.h, { cx: t.cx, cy: t.cy }).stroke(c, hairline(mortar.base, JOINT * 2));
        for (const [ax, ay, bx, by] of joints) line(ax, ay, bx, by, mortar.base, JOINT * 2);
      });
      // The slab's broken edge on the dirt: its side where it faces away from the light, a pale lip where it faces it, a dark line round it.
      if (!t.full) {
        t.bevelEdge({ lit: alpha(r.lit, 0.75), dark: mixTone(r.dark, mortar.base, 0.4), litWidth: 0.8, darkWidth: 1.6 });
        for (const run of t.edge) new Path(run).stroke(c, hairline(alpha(mortar.dark, 0.9), 0.8));
      }
    },
  });
};

// ----------------------------------------------------------------------------------------------
// Dead moss
// ----------------------------------------------------------------------------------------------

/** One blade of dead grass: a short bowed stroke from its root, up and a little aside. */
function blade(t: Tile, root: Point, length: number, lean: number, color: string, width = 0.6, bow = 1): void {
  const tip = { x: root.x + Math.sin(lean) * length, y: root.y - Math.cos(lean) * length };
  Path.curve(root, tip, length * 0.18 * bow * (lean < 0 ? -1 : 1)).stroke(t.c, hairline(color, width));
}

/** A blade rooted near `at` (moved just enough) so that its tip stays inside the tile: no empty strip along the border, nothing crossing it. */
function bladeInside(t: Tile, at: Point, length: number, lean: number, color: string, width: number): void {
  const dx = Math.sin(lean) * length;
  const rise = Math.cos(lean) * length;
  const pad = 0.55 + length * 0.18;
  const x = Math.max(-t.w / 2 + pad + Math.max(0, -dx), Math.min(t.w / 2 - pad - Math.max(0, dx), at.x));
  const y = Math.max(-t.h / 2 + 0.45 + rise, Math.min(t.h / 2 - 0.5, at.y));
  blade(t, t.at(x, y), length, lean, color, width);
}

/** Dead grass and moss: a flat olive with darker mats, short blades and, at its edge, tufts that break the outline. */
export const moss: ScenePiece<{ tufts: number }> = (ctx, o) => {
  const r = role(ctx.materials, 'moss').ramp;
  floorTile(ctx, {
    priority: FLOOR_PRIORITY.moss,
    salt: 0x3a55,
    paint(t) {
      const { c, rng } = t;
      const v = t.variant;
      // A shadow of the mat on the ground, then the mat.
      if (!t.full) t.region.clone().translate(0, 1.6).fill(c, castShadow(0.26));
      t.inRegion(() => {
        t.region.fill(c, r.base);
        // Mottling: dark damp mats and pale dry ones, large and weak (the mottled look has stronger dark ones).
        stains(t, per(t, 9), 3.5, 7, r.dark, [0.3, 0.24, 0.34, 0.2, 0.26][v] ?? 0.3);
        stains(t, per(t, 8), 3, 6.5, r.lit, [0.14, 0.16, 0.12, 0.18, 0.14][v] ?? 0.14);
        // Dead blades, dark underneath and pale over them: dense and short, long and dry, or few.
        const [density, short, long] = [[84, 1.2, 2.7], [54, 2.4, 4.2], [52, 1.4, 3.0], [40, 1.4, 3.0], [58, 1.3, 2.8]][v] ?? [60, 1.4, 3];
        for (const at of t.spread(per(t, density))) {
          const dark = rng.boolean(0.42);
          bladeInside(t, at, rng.float(short, long), rng.float(-0.5, 0.5) * (v === 1 ? 1.5 : 1), dark ? alpha(r.dark, 0.8) : alpha(r.lit, 0.7), 0.5);
        }
        // Scattered tufts: a handful of blades from one root, a little paler at their tips.
        if (v === 4) {
          for (const p of scatter(t, per(t, 5), 4.5)) {
            const n = rng.int(4, 6);
            for (let k = 0; k < n; k++) {
              const lean = (k - (n - 1) / 2) * 0.24 + rng.float(-0.08, 0.08);
              blade(t, t.at(p.x + rng.float(-0.6, 0.6), p.y + rng.float(0, 0.6)), rng.float(2.4, 3.8), lean, k % 2 ? alpha(r.dark, 0.85) : mixTone(r.base, r.lit, 0.6), 0.55, -0.5);
            }
          }
        }
      });
      // Tufts that break the outline of a transition, kept 4 px from the border so the neighbour never continues them.
      if (!t.full) {
        const fade = 4.5;
        const per = [4.5, 5.2, 4, 5, 4.5][v] ?? 4.5;
        for (const run of t.edge) {
          const path = new Path(run);
          const length = path.length;
          for (let d = per * 0.6; d < length - per * 0.4; d += per * rng.float(0.8, 1.3)) {
            const p = path.pointAt(d / length);
            if (Math.min(t.w / 2 - Math.abs(p.x - t.cx), t.h / 2 - Math.abs(p.y - t.cy)) < fade) continue;
            const n = Math.max(2, Math.round(rng.float(2, 4.4) * o.tufts));
            for (let k = 0; k < n; k++) {
              const lean = rng.float(-0.9, 0.9);
              const col = k % 2 ? alpha(r.dark, 0.9) : mixTone(r.base, r.lit, 0.6);
              blade(t, { x: p.x + rng.float(-1.2, 1.2), y: p.y + rng.float(-0.3, 0.8) }, rng.float(1.6, 3.8), lean, col, 0.65);
            }
          }
        }
        for (const run of t.edge) new Path(run).stroke(c, hairline(alpha(r.dark, 0.6), 0.6));
      }
    },
  });
};

// ----------------------------------------------------------------------------------------------
// Bone gravel
// ----------------------------------------------------------------------------------------------

/** A weathered long bone lying in the gravel: a shaft with a knob at each end, sunk into a shadow. */
function longBone(t: Tile, at: Point, length: number, angle: number, bone: { base: string; dark: string; lit: string }): void {
  const dx = Math.cos(angle) * length * 0.5;
  const dy = Math.sin(angle) * length * 0.5;
  const a = { x: at.x - dx, y: at.y - dy };
  const b = { x: at.x + dx, y: at.y + dy };
  const body = (shift: number) => {
    const shaft = new Path([{ x: a.x + shift, y: a.y + shift * 1.4 }, { x: b.x + shift, y: b.y + shift * 1.4 }]).toShape({ width: 0.9, cap: 'round' });
    const knob = (p: Point, k: number) => Polygon.circle(0.72, { cx: p.x + shift + Math.cos(angle + Math.PI / 2) * k * 0.38, cy: p.y + shift * 1.4 + Math.sin(angle + Math.PI / 2) * k * 0.38, segments: 12 });
    return shaft.union([knob(a, 1), knob(a, -1), knob(b, 1), knob(b, -1)]);
  };
  body(0.3).fill(t.c, alpha(bone.dark, 0.5));
  const shape = body(0);
  shape.fill(t.c, bone.base);
  new Path([{ x: a.x - 0.2, y: a.y - 0.4 }, { x: b.x - 0.2, y: b.y - 0.4 }]).stroke(t.c, hairline(alpha(bone.lit, 0.6), 0.4));
  shape.stroke(t.c, hairline(alpha(bone.dark, 0.7), 0.4));
}

/**
 * A broken fragment of old bone: an angular shard, a straight break on one side, a shadow under it, a pale top and a
 * hairline suture. It reads as a bit of bone and not as a face: no round dome, no socket.
 */
function shard(t: Tile, at: Point, size: number, bone: { base: string; dark: string; lit: string }): void {
  const n = 6;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + t.rng.float(-0.3, 0.3);
    const r = size * t.rng.float(0.72, 1.12);
    return { x: at.x + Math.cos(a) * r, y: at.y + Math.sin(a) * r * 0.62 };
  });
  const shape = Polygon.fromPoints(pts).roundCorners(0.35);
  shape.clone().translate(0.3, 0.6).fill(t.c, alpha(bone.dark, 0.5));
  shape.fill(t.c, bone.base);
  shape.clone().translate(-0.4, -0.4).intersect(shape).fill(t.c, alpha(bone.lit, 0.75));
  Path.curve({ x: at.x - size * 0.5, y: at.y + size * 0.1 }, { x: at.x + size * 0.45, y: at.y - size * 0.2 }, 0.5).stroke(t.c, hairline(alpha(bone.dark, 0.55), 0.35));
  shape.stroke(t.c, hairline(alpha(bone.dark, 0.7), 0.4));
}

/**
 * Where a bone may lie: anywhere well inside a whole tile; in a transition, deep inside one of the covered
 * quarters, so the edge of the gravel never cuts a bone in two.
 */
function bonePlace(t: Tile): Point {
  if (t.full) return scatter(t, 1, 6)[0];
  const quarters = [[1, -1, -1], [2, 1, -1], [4, 1, 1], [8, -1, 1]].filter(([bit]) => t.mask & bit);
  const [, sx, sy] = t.rng.pick(quarters);
  return { x: sx * t.rng.float(0.53, 0.78) * (t.w / 2), y: sy * t.rng.float(0.46, 0.71) * (t.h / 2) };
}

/**
 * Gravel with a few old bones in it: a flat grey with packed pebbles, a few pale chips of bone among them and
 * pebbles spilled at its edge. Five looks: fine gravel, a long bone, pale gravel, a fragment of bone and coarse
 * gravel. Bones lie in two of the five (the long bone and the fragment), small and toned toward the gravel, so a
 * field reads as one stony ground with a find now and then and no repeated icon.
 */
export const boneGravel: ScenePiece<{ bones: number }> = (ctx, o) => {
  const g = role(ctx.materials, 'gravel').ramp;
  const bone = role(ctx.materials, 'bone').ramp;
  // Old bone: sunk and stained, toned toward the gravel (only a little paler and warmer than its lit stones).
  const old = { lit: mixTone(g.lit, bone.lit, 0.24), base: mixTone(g.base, bone.base, 0.3), dark: mixTone(g.dark, bone.dark, 0.35) };
  floorTile(ctx, {
    priority: FLOOR_PRIORITY.gravel,
    salt: 0x77b3,
    paint(t) {
      const { c, rng } = t;
      const v = t.variant;
      // Packed stones, as many as the look says, each wherever it fits inside the tile.
      const stones = (count: number, size: number, pale = false) => {
        for (const at of t.spread(count)) {
          const rx = rng.float(0.55, 1.25) * size;
          const ry = rx * rng.float(0.65, 0.9);
          const p = t.fit(at, rx, ry, 0.8);
          const q = t.at(p.x, p.y);
          const seed = rng.int(1, 9999);
          const tone = rng.pick(pale ? [g.base, mixTone(g.base, g.lit, 0.35), mixTone(g.base, g.lit, 0.55), g.lit] : size > 1.2 ? [mixTone(g.base, g.dark, 0.3), g.base, g.base, mixTone(g.base, g.lit, 0.35)] : [mixTone(g.base, g.dark, 0.45), g.base, mixTone(g.base, g.lit, 0.5), g.lit]);
          blob(q.x + 0.2, q.y + 0.45, rx, ry, seed, 0, 0.2).fill(c, alpha(g.dark, 0.7));
          blob(q.x, q.y, rx, ry, seed, 0, 0.2).fill(c, tone);
        }
      };
      // Chips of old bone: tiny, pale and spread like the pebbles, so the bone shows as a grain of the ground.
      const chips = (count: number) => {
        for (const at of t.spread(count)) {
          const len = rng.float(0.8, 1.5);
          const a = rng.float(0, Math.PI);
          const p = t.fit(at, len * 0.6, len * 0.4, 0.5);
          const q = t.at(p.x, p.y);
          const seed = rng.int(1, 9999);
          blob(q.x + 0.2, q.y + 0.4, len * 0.55, 0.42, seed, a, 0.15).fill(c, alpha(g.dark, 0.6));
          blob(q.x, q.y, len * 0.55, 0.42, seed, a, 0.15).fill(c, mixTone(g.lit, old.base, 0.5));
        }
      };
      if (!t.full) t.region.clone().translate(0, 1.4).fill(c, castShadow(0.24));
      t.inRegion(() => {
        t.region.fill(c, g.base);
        stains(t, per(t, 9), 3.5, 7, g.dark, [0.3, 0.26, 0.3, 0.3, 0.26][v] ?? 0.3);
        stains(t, per(t, 6), 3, 6.5, g.lit, 0.14);
        const [stoneCount, stoneSize, stonePale] = [[66, 0.85], [44, 1], [52, 1, true], [44, 1], [24, 1.55]][v] as [number, number, boolean?];
        stones(per(t, stoneCount), stoneSize, stonePale);
        chips(per(t, [5, 4, 7, 4, 3][v] ?? 4));
        // Bones, in two looks only and never close to the border: a small long bone, or two bits of a broken one. A find
        // now and then, not a density: a bigger tile does not get more of them.
        const n = Math.round(([0, 1, 0, 2, 0][v] ?? 0) * o.bones);
        for (let i = 0; i < n; i++) {
          const p = bonePlace(t);
          const q = t.at(p.x, p.y);
          if (v === 3) shard(t, q, i === 0 ? rng.float(1.8, 2.2) : rng.float(1.2, 1.5), old);
          else longBone(t, q, rng.float(3.6, 4.6), rng.float(-1.1, 1.1), old);
        }
      });
      // Pebbles spilled over the edge of a transition, away from the tile's border.
      if (!t.full) {
        for (const run of t.edge) {
          const path = new Path(run);
          const length = path.length;
          for (let d = 2; d < length - 1; d += rng.float(2.4, 4.6)) {
            const p = path.pointAt(d / length);
            if (Math.min(t.w / 2 - Math.abs(p.x - t.cx), t.h / 2 - Math.abs(p.y - t.cy)) < 4) continue;
            const rx = rng.float(0.5, 1.15);
            const q = { x: p.x + rng.float(-1.3, 1.3), y: p.y + rng.float(-0.6, 1.7) };
            blob(q.x + 0.2, q.y + 0.45, rx, rx * 0.75, rng.int(1, 999), 0, 0.2).fill(c, alpha(g.dark, 0.65));
            blob(q.x, q.y, rx, rx * 0.75, rng.int(1, 999), 0, 0.2).fill(c, rng.boolean(0.5) ? g.base : mixTone(g.base, g.lit, 0.55));
          }
        }
        for (const run of t.edge) new Path(run).stroke(c, hairline(alpha(g.dark, 0.7), 0.6));
      }
    },
  });
};
