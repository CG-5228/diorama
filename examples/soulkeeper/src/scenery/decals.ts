/**
 * Decals of the graveyard kit: marks that lie on the floor under everything else (layer 0): cracks, scattered
 * bones and a puddle of soul light. A decal is one frame of one cell, drawn flat in the floor's plane (every
 * point is a world offset from the cell's centre, which is world 0, 0, 0 whatever the cell it is laid in, projected
 * through the camera, so shapes follow the tilt) and kept calm: thin lines, small detail, a value range below the
 * props'. Variation between placements is a variant (`pieceRng(ctx)` is the same in every placement of a frame).
 *
 * Decals fill the space profile's tile (`SPACE.grid`: 48 × 36 px on screen): marks are drawn for a 32-wide tile
 * and their positions scaled by `DK` (the tile's width over 32), so a crack runs across the whole tile and a
 * puddle fills it. Bones keep a real size next to the character (a skull about as big as a character's head, a
 * long bone the length of a forearm): they are scattered over the tile, not blown up (`BONE_SIZE`).
 *
 * Decals lie over any floor, so they ask for no floor material. Cracks and puddles use theme ink and the glow
 * role; the bones use the bone role. Each has a cell a little larger than its tile, so a mark may spill a few px
 * over the border into the next tile; the details that matter stay inside the tile.
 */

import { Path, Polygon, alpha, type Point, type Shape } from '@core/draw';
import { pieceRng, vec3, type PieceContext, type ScenePiece } from '@core/volume';
import { PALETTES, RAMPS } from '../theme';
import { SPACE } from '../space';
import { hairline, mixTone, role } from './util';
import { flutter } from './motion';

/** The tile a decal fills: the space profile's grid cell on screen, in logical px. */
const TILE = SPACE.grid.screen;

/** Cell of a decal: the profile's tile with room around it for what spills over (pivot at the tile's centre). */
export const DECAL_CELL = { width: TILE.w + 8, height: TILE.h + 6, pivot: { x: (TILE.w + 8) / 2, y: (TILE.h + 6) / 2 } };

/** The decals' marks were drawn for a tile this wide (world units); positions scale by the grid's cell over it. */
const DESIGN_TILE = 32;
const DK = SPACE.grid.cell.x / DESIGN_TILE;

/** Projects a world offset on the floor (x across, y in depth) from the cell's centre to the screen, scaled by `k`. */
const floorAt = (ctx: PieceContext, k = 1) => (x: number, y: number) => ctx.camera.project(vec3(x * k, y * k, 0));

/** A closed shape from world offsets on the floor. */
const floorPoly = (to: (x: number, y: number) => Point, pts: [number, number][]): Shape => Polygon.fromPoints(pts.map(([x, y]) => to(x, y)));

/** A decal is a single drawing of its object: `draw` paints it in screen pixels. */
const decal = (ctx: PieceContext, draw: (c: CanvasRenderingContext2D) => void): void => void ctx.object.custom(ctx.frame.origin, c => draw(c));

// ----------------------------------------------------------------------------------------------
// Floor cracks
// ----------------------------------------------------------------------------------------------

/** The cracks' options. */
export interface FloorCracksOptions {
  /** Width of the main crack, px. */
  width: number;
  /** Strength of the soul light seeping from the cracks of the last variant (0 for none). */
  glow: number;
}

/**
 * Cracks in the floor: a chiselled dark line that wanders across the tile with forks and a pale lip on the
 * side the light reaches, a few chips of stone beside it. Variants 0 to 2 are a single crack, a crossing and a
 * short spur; variant 3 is a crack that soul light seeps through. The crack has to read on the dark dirt as well as
 * on flagstones, and stay a mark and not a focal point: a line about a quarter wider than `width` (variants 0 to 2), a
 * pale lip on its lit side, and a faint dark halo that sinks it into the ground.
 */
export const floorCracks: ScenePiece<FloorCracksOptions> = (ctx, o) => {
  const glow = role(ctx.materials, 'glow');
  const rng = pieceRng(ctx);
  const to = floorAt(ctx, DK);
  // Where each variant's main crack runs, in world offsets of the design tile (x across ±14, y in depth ±11), scaled to the tile by `to`.
  const runs: [number, number, number, number][] = [[-13, -4, 13, 5], [-9, -10, 9, 9], [-11, 6, 3, -8], [-12, 2, 12, -3]];
  const [x0, y0, x1, y1] = runs[ctx.variant % runs.length];
  const walk = (ax: number, ay: number, bx: number, by: number, steps: number, wobble: number): [number, number][] => {
    const pts: [number, number][] = [[ax, ay]];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      pts.push([ax + (bx - ax) * t + rng.float(-wobble, wobble), ay + (by - ay) * t + rng.float(-wobble * 0.8, wobble * 0.8)]);
    }
    pts.push([bx, by]);
    return pts;
  };
  const main = walk(x0, y0, x1, y1, 6, 1.7);
  const forks: [number, number][][] = [];
  const forkCount = ctx.variant === 2 ? 1 : 2;
  for (let i = 0; i < forkCount; i++) {
    const k = rng.int(1, main.length - 3);
    const [fx, fy] = main[k];
    const dir = rng.boolean() ? 1 : -1;
    forks.push(walk(fx, fy, fx + dir * rng.float(4, 7), fy + rng.float(3.5, 6.5) * (rng.boolean() ? 1 : -1), 3, 1));
  }
  const chips = Array.from({ length: 3 }, () => {
    const [px, py] = main[rng.int(1, main.length - 2)];
    return { x: px + rng.float(-2.6, 2.6), y: py + rng.float(-2, 2), r: rng.float(0.35, 0.7) * 1.2 };
  });
  const lit = ctx.variant === 3;
  const dark = alpha(PALETTES.ink, lit ? 0.78 : 0.82);
  const lip = alpha(PALETTES.flagLit, lit ? 0.42 : 0.74);
  const halo = alpha(PALETTES.ink, 0.11);
  const [lipX, lipY] = lit ? [-0.45, -0.5] : [-0.72, -0.82];
  const width = o.width;
  // The line itself: a quarter wider for the plain cracks; the glowing crack keeps the option's width.
  const line = lit ? width : width * 1.28;
  decal(ctx, c => {
    const span = (pts: [number, number][], w: number) => Path.spline(pts.map(([x, y]) => to(x, y)), { style: 'chiseled' }).toShape({ width: (t: number) => w * (lit ? 0.3 + 0.7 * Math.sin(Math.PI * Math.min(1, t * 1.05)) : 0.34 + 0.66 * Math.sin(Math.PI * Math.min(1, t * 1.05))), cap: 'round' });
    if (lit && o.glow > 0) {
      // Soul light under the crack: a halo, then the same line in the glow's pale tone.
      for (const pts of [main, ...forks]) span(pts, width * 3.4).fill(c, alpha(glow.ramp.base, 0.28 * o.glow));
    }
    if (!lit) for (const pts of [main, ...forks]) span(pts, line * 2.2).fill(c, halo);
    for (const pts of [main, ...forks]) span(pts, line).clone().translate(lipX, lipY).fill(c, lip);
    for (const pts of [main, ...forks]) span(pts, line).fill(c, dark);
    if (lit && o.glow > 0) {
      for (const pts of [main, ...forks]) span(pts, width * 0.8).fill(c, alpha(glow.ramp.base, 0.95 * Math.min(1, o.glow)));
      for (const pts of [main, ...forks]) span(pts, width * 0.3).fill(c, alpha(glow.ramp.lit, 0.8 * Math.min(1, o.glow)));
    }
    for (const ch of chips) {
      const p = to(ch.x, ch.y);
      Polygon.ellipse(ch.r, ch.r * 0.75, { cx: p.x, cy: p.y, segments: 8 }).fill(c, alpha(PALETTES.flagLit, 0.5));
      Polygon.ellipse(ch.r, ch.r * 0.75, { cx: p.x + 0.35, cy: p.y + 0.5, segments: 8 }).fill(c, alpha(PALETTES.ink, 0.5));
    }
  });
};

// ----------------------------------------------------------------------------------------------
// Scattered bones
// ----------------------------------------------------------------------------------------------

/** The scattered bones' options. */
export interface ScatteredBonesOptions {
  /** Pieces of bone on the cell (the variant's own, in order). */
  pieces: number;
}

/** How much bigger the bones are drawn than designed: a skull a little bigger than a character's head (8 or 9 units across), a long bone the length of a forearm. */
const BONE_SIZE = 1.2;

/** A flat bone: its shape from world offsets on the floor. A long bone is a bar with a pair of knobs at each end. */
function flatBone(to: (x: number, y: number) => Point, x: number, y: number, len: number, angle: number, width: number): Shape {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const ex = (u: number, v: number): [number, number] => [x + dx * u - dy * v, y + dy * u + dx * v];
  const half = len / 2;
  const bar = floorPoly(to, [ex(-half, -width / 2), ex(half, -width / 2), ex(half, width / 2), ex(-half, width / 2)]);
  const knob = (u: number, v: number, r: number) => Polygon.ellipse(r, r * 0.9, { cx: to(...ex(u, v)).x, cy: to(...ex(u, v)).y, segments: 10 });
  const r = width * 0.78;
  return bar.union([knob(-half, -width * 0.42, r), knob(-half, width * 0.42, r * 0.9), knob(half, -width * 0.42, r * 0.9), knob(half, width * 0.42, r)]);
}

/**
 * Scattered bones: a handful of small bones lying on the floor, a long bone or two, a rib, a vertebra and, in
 * the last variant, a skull, each with a thin dark outline, a pale lit edge and a shadow on the floor. Four
 * variants, from a few knucklebones to a long bone with a skull.
 */
export const scatteredBones: ScenePiece<ScatteredBonesOptions> = (ctx, o) => {
  const bn = role(ctx.materials, 'bone');
  const glow = role(ctx.materials, 'glow');
  const rng = pieceRng(ctx);
  // The scene is laid out on the design tile (positions scaled to the real one by DK) with bones at their own size (BONE_SIZE).
  const to = floorAt(ctx);
  const P = DK;
  const Z = BONE_SIZE;
  type Bit = { kind: 'long' | 'rib' | 'vertebra' | 'skull' | 'knuckle'; x: number; y: number; angle: number; size: number };
  const layouts: Bit[][] = [
    [{ kind: 'long', x: -3, y: 1, angle: -0.35, size: 11 }, { kind: 'knuckle', x: 8.5, y: -4, angle: 0.3, size: 1 }, { kind: 'vertebra', x: 7, y: 5, angle: 0, size: 1.5 }, { kind: 'knuckle', x: -9, y: -5.6, angle: 1, size: 0.9 }, { kind: 'vertebra', x: -1, y: -8.5, angle: 0, size: 1.3 }, { kind: 'knuckle', x: 12, y: 1.5, angle: 0.5, size: 0.8 }],
    [{ kind: 'rib', x: -2, y: 0, angle: 0.5, size: 9 }, { kind: 'rib', x: 3, y: 2.5, angle: 0.9, size: 7.5 }, { kind: 'vertebra', x: -8, y: 4.4, angle: 0, size: 1.6 }, { kind: 'vertebra', x: -5.4, y: 6.4, angle: 0, size: 1.3 }, { kind: 'knuckle', x: 9, y: -3.4, angle: 0.4, size: 1 }, { kind: 'knuckle', x: -11, y: -3, angle: 0.9, size: 0.9 }, { kind: 'vertebra', x: 11, y: 5.5, angle: 0, size: 1.2 }],
    [{ kind: 'long', x: 2, y: -2, angle: 0.5, size: 9.5 }, { kind: 'long', x: -5, y: 4.5, angle: -0.2, size: 7.5 }, { kind: 'knuckle', x: -9, y: -3, angle: 0, size: 1 }, { kind: 'knuckle', x: 10, y: 5.4, angle: 0.8, size: 0.9 }, { kind: 'vertebra', x: 0, y: 7.4, angle: 0, size: 1.4 }, { kind: 'vertebra', x: -12, y: 4, angle: 0, size: 1.2 }, { kind: 'knuckle', x: 6.5, y: -8.5, angle: 0.3, size: 0.9 }],
    [{ kind: 'skull', x: -4, y: -1.5, angle: 0, size: 4 }, { kind: 'long', x: 5, y: 3.6, angle: -0.45, size: 10 }, { kind: 'rib', x: 7.5, y: -4.6, angle: 2.3, size: 6 }, { kind: 'knuckle', x: -10, y: 5, angle: 0, size: 0.9 }, { kind: 'vertebra', x: -9.5, y: -6.5, angle: 0, size: 1.3 }, { kind: 'knuckle', x: 1.5, y: 8, angle: 0.6, size: 0.9 }],
  ];
  const bits = layouts[ctx.variant % layouts.length].slice(0, Math.max(1, Math.round(o.pieces)));
  const lit = mixTone(bn.ramp.lit, bn.ramp.base, 0.2);
  const body = mixTone(bn.ramp.base, bn.ramp.dark, 0.1);
  const line = hairline(alpha(mixTone(bn.ramp.dark, PALETTES.ink, 0.55), 0.95), 0.55);
  const shadow = alpha(PALETTES.ink, 0.38);
  const shapes = bits.map(b => {
    const jitter = rng.float(-0.12, 0.12);
    switch (b.kind) {
      case 'long': return { b, shape: flatBone(to, b.x * P, b.y * P, b.size * Z, b.angle + jitter, 1.9 * Z) };
      case 'knuckle': return { b, shape: flatBone(to, b.x * P, b.y * P, 2.6 * b.size * Z, b.angle, 1.2 * b.size * Z) };
      case 'vertebra': {
        const p = to(b.x * P, b.y * P);
        return { b, shape: Polygon.ellipse(b.size * 1.5 * Z, b.size * 1.05 * Z, { cx: p.x, cy: p.y, segments: 12 }) };
      }
      case 'skull': {
        const p = to(b.x * P, b.y * P);
        return { b, shape: Polygon.ellipse(b.size * 1.05 * Z, b.size * 0.82 * Z, { cx: p.x, cy: p.y - 0.4 * Z, segments: 18 }).union(Polygon.ellipse(b.size * 0.62 * Z, b.size * 0.46 * Z, { cx: p.x + 0.2 * Z, cy: p.y + b.size * 0.6 * Z, segments: 12 })) };
      }
      case 'rib': {
        const pts: [number, number][] = [0, 0.25, 0.5, 0.75, 1].map(t => {
          const a = b.angle + (t - 0.5) * 1.5;
          return [b.x * P + (Math.cos(a) * b.size * 0.5 - Math.cos(b.angle) * 0.4 * b.size * 0.5) * Z, b.y * P + Math.sin(a) * b.size * 0.5 * Z];
        });
        return { b, shape: Path.spline(pts.map(([x, y]) => to(x, y)), { style: 'smooth' }).toShape({ width: { start: 1.5 * Z, end: 0.9 * Z }, cap: 'round' }) };
      }
    }
  });
  const skullAt = bits.find(b => b.kind === 'skull');
  decal(ctx, c => {
    for (const { shape } of shapes) shape.clone().translate(0.5, 0.8).fill(c, shadow);
    for (const { shape } of shapes) {
      shape.fill(c, body);
      shape.clone().translate(-0.45, -0.45).intersect(shape).fill(c, lit);
      shape.stroke(c, line);
    }
    if (skullAt) {
      const p = to(skullAt.x * P, skullAt.y * P);
      for (const s of [-1, 1]) {
        Polygon.ellipse(0.8 * Z, 0.9 * Z, { cx: p.x + s * 1.35 * Z, cy: p.y - 0.3 * Z, segments: 10 }).fill(c, RAMPS.hollow.base);
        Polygon.circle(0.42 * Z, { cx: p.x + s * 1.35 * Z, cy: p.y - 0.3 * Z, segments: 8 }).draw(c, { fill: glow.ramp.base, shadow: { color: alpha(glow.ramp.base, 0.9), x: 0, y: 0, blur: 2 } });
      }
      Polygon.rect(0.5 * Z, 0.9 * Z, { cx: p.x, cy: p.y + 1.3 * Z }).fill(c, alpha(RAMPS.hollow.base, 0.8));
    }
  });
};

// ----------------------------------------------------------------------------------------------
// Soul puddle
// ----------------------------------------------------------------------------------------------

/** The puddle's loop (the catalog's `clips`): a slow shimmer, the glow breathing, the glints twinkling out of step and a ripple that swells. 8 frames at a slow 6 fps. */
export const PUDDLE_CLIPS = { shimmer: { frames: 8, fps: 6, loop: true } };

/** The puddle's options. */
export interface SoulPuddleOptions {
  /** Strength of the glow: 0 is still water, 1 a pool alight. */
  glow: number;
}

/**
 * A puddle of soul light: a dark wet patch with a faint green glow that is stronger in the middle, a pale rim
 * on the lit side, a ripple or two and a few glints. Calm on purpose: it marks the ground, it does not compete
 * with the actors. Three variants: round, long and a pair of small pools.
 */
export const soulPuddle: ScenePiece<SoulPuddleOptions> = (ctx, o) => {
  const glow = role(ctx.materials, 'glow');
  const rng = pieceRng(ctx);
  const to = floorAt(ctx);
  // Drawn for the design tile, scaled to the real one: a puddle fills its tile.
  const pools = ([
    [{ x: 0, y: 0, rx: 11.5, ry: 7.6 }],
    [{ x: 0, y: 0, rx: 14, ry: 5.6 }],
    [{ x: -5.4, y: -1.6, rx: 7, ry: 4.8 }, { x: 7.6, y: 3.4, rx: 5, ry: 3.4 }],
  ] as { x: number; y: number; rx: number; ry: number }[][]).map(row => row.map(p => ({ x: p.x * DK, y: p.y * DK, rx: p.rx * DK, ry: p.ry * DK })));
  const ring = (p: { x: number; y: number; rx: number; ry: number }, k = 1, jitter = 0.13): Shape => {
    const pts: [number, number][] = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      const j = 1 + rng.float(-jitter, jitter);
      return [p.x + Math.cos(a) * p.rx * k * j, p.y + Math.sin(a) * p.ry * k * j];
    });
    return floorPoly(to, pts).smooth(2);
  };
  const set = pools[ctx.variant % pools.length].map(p => ({ p, outer: ring(p) }));
  const glints = Array.from({ length: 4 }, () => {
    const s = set[rng.int(0, set.length - 1)].p;
    const a = rng.float(0, Math.PI * 2);
    const d = rng.float(0.1, 0.7);
    return { x: s.x + Math.cos(a) * s.rx * d, y: s.y + Math.sin(a) * s.ry * d, r: rng.float(0.3, 0.55) * 1.2 };
  });
  // The loop's phase: 0 on the still look (every wave below is zero there).
  const t = ctx.clip?.t ?? 0;
  const g = o.glow * (1 + 0.2 * flutter(t, 1, 0.1));
  const wet = alpha(mixTone(RAMPS.hollow.base, PALETTES.ink, 0.6), 0.82);
  const ky = Math.sin((ctx.camera.tilt * Math.PI) / 180);
  decal(ctx, c => {
    for (const { p, outer } of set) {
      const centre = to(p.x, p.y);
      // The wet patch, then a glow that grows towards the middle (a round gradient flattened by the tilt).
      outer.fill(c, wet);
      outer.clip(c, () => {
        c.save();
        c.translate(centre.x, centre.y);
        c.scale(1, (p.ry * ky) / p.rx);
        const grad = c.createRadialGradient(0, 0, 0, 0, 0, p.rx);
        grad.addColorStop(0, alpha(glow.ramp.base, 0.85 * g));
        grad.addColorStop(0.45, alpha(glow.ramp.dark, 0.6 * g));
        grad.addColorStop(1, alpha(glow.ramp.dark, 0.05 * g));
        c.fillStyle = grad;
        c.beginPath();
        c.arc(0, 0, p.rx, 0, Math.PI * 2);
        c.fill();
        c.restore();
      });
      outer.stroke(c, hairline(alpha(glow.ramp.dark, 0.5 + 0.3 * g), 0.5));
      // The lit side of the rim: a pale thread along the upper left edge.
      Path.arc(centre, p.rx * 0.97, 165 + 18 * flutter(t, 1, 0.2), 285 + 18 * flutter(t, 1, 0.2)).scale(1, (p.ry * ky) / p.rx, centre).stroke(c, hairline(alpha(glow.ramp.lit, 0.6 * (1 + 0.25 * flutter(t, 1, 0.45))), 0.5));
      // A ripple: a thin arc inside, on the upper left.
      Path.arc(centre, p.rx * 0.5 * (1 + 0.16 * flutter(t, 1, 0.3)), 190, 300).scale(1, 0.62, centre).stroke(c, hairline(alpha(glow.ramp.lit, 0.45 * g), 0.45));
    }
    glints.forEach((gl, i) => {
      const q = to(gl.x, gl.y);
      // Each glint twinkles on its own phase: it swells and fades twice a loop at most.
      const twinkle = 1 + 0.7 * flutter(t, 1 + (i % 2), i * 0.27 + 0.15);
      Polygon.circle(gl.r * Math.max(0.5, twinkle), { cx: q.x, cy: q.y, segments: 8 }).fill(c, alpha(glow.ramp.lit, Math.min(1, 0.9 * Math.min(1, g + 0.2) * Math.min(1, twinkle))));
    });
  });
};
