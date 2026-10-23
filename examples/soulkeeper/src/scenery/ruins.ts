/**
 * Ruins of the graveyard kit: the ruined crypt wall, a crypt wall that lost its cap and its upper courses.
 *
 * It is built like the crypt wall (`walls.ts`, whose strips, bond, styles and cracks it shares): the same plinth, the
 * same courses and bond, the same piers where the wall turns, ends or branches, the same edge masks, so it joins the
 * intact wall (`joins: ['crypt-wall']`) and itself without a seam. Its height is the original wall's (`ctx.height`, the
 * profile's `wall`, from which the courses follow, a block size each); what changes is the top and the foot:
 * - the wall stands at most as high as the crypt wall's courses (no cap), and how many courses are left varies along
 *   the run: four stations per cell (a quarter of its length each) hold a number of courses. The two stations at the
 *   cell's borders always keep the same courses (`BORDER_FRACTION` of the wall's courses: three quarters), in every variant, so
 *   the blocks that straddle a border are the same in both cells and any variant joins any other; the two in the
 *   middle come from the variant's break (`BREAKS`): a high top, a tooth on the left, a tooth on the right or a low
 *   breach. The courses at the borders are bonded blocks as in the crypt wall; the courses above them are loose
 *   stones, cut at the stations, that stand only where their station reaches them. The highest block of every stack
 *   has a broken top (a slope, a step), and a pier may keep its cap;
 * - fallen stones lie at the foot: scattered along the run, and heaped where the wall ends or stands alone (mask 0 is
 *   a stump in its own rubble). Leave a cell of the walls grid empty and put ruined walls at both of its ends, and the
 *   gap is a collapsed section: the ends are broken piers with a heap beyond them.
 *
 * A frame is drawn the same wherever it is laid (its seed is the frame's), so what differs between placements is the
 * variant: four of them, each with its own break. Variants 0 and 3 keep the soul rune on a pier; 1 and 2 have cracks
 * and a block that fell out.
 */

import { Polygon, alpha, type Shape } from '@core/draw';
import { Decal, EDGE, Frame3, Solid, groundShadow, pieceRng, vec3, type ScenePiece } from '@core/volume';
import { PALETTES, SHAPE_STYLES } from '../theme';
import { SPACE } from '../space';
import { WALL, bandCourse, blockPitch, courseCount, crackShape, equalBlocks, jointOnBorder, lattice, wallStyles, type Strip } from './walls';
import { blob, boxAt, castShadow, groundPatch, role, runeShape, soulMark, worldFrame } from './util';

/**
 * The share of the wall's courses left at the two border stations of a cell. It is the same for every variant and every
 * placement on purpose: the engine picks the variant of a placement by position with a well-mixed hash, so neighbours
 * routinely differ in variant, and the height at a border (and the blocks that straddle it, in odd courses) are only the
 * same in both cells when every variant keeps the same courses there. It is a fraction of the height, so the border is
 * the same share of a wall whatever its height; the courses it makes are an even number (the bond's top border course
 * is an odd one, which straddles the border and so is never cut across a broken top).
 */
export const BORDER_FRACTION = 0.75;

/** Courses left at the border stations of a wall of `courses` courses: an even share of them, at least two. */
export const borderCourses = (courses: number): number => Math.min(courses, Math.max(2, 2 * Math.round((courses * BORDER_FRACTION) / 2)));

/** What a variant does to the top of the run between the borders: the middle stations stand high, only the left one, only the right one, or fall to one course. */
type Break = 'high' | 'left' | 'right' | 'breach';

/** The break of each variant along the x axis; the y axis uses the next one, so a corner's two arms do not break alike. */
const BREAKS: readonly Break[] = ['high', 'left', 'right', 'breach'];

/** Variants whose blocks are cracked and one has fallen out; the others keep the soul rune on a pier. */
const DAMAGED = [1, 2];

/** The ruined wall's options. Its height (the wall it was before it fell) is `ctx.height`, not an option. */
export interface RuinedWallOptions {
  /** Fallen stones at the foot of the wall: 0 none, 1 usual, 2 buried. */
  rubble: number;
  /** Moss on the plinth and on the broken tops. */
  moss: boolean;
}

/** One block to build. */
interface Block {
  axis: 'x' | 'y';
  s0: number;
  s1: number;
  z0: number;
  z1: number;
  half: number;
  kind: 'plinth' | 'body' | 'band' | 'cap';
  /** Goes on into the next cell: flat, plain, never damaged (both cells must draw the same block). */
  straddles: boolean;
  course: number;
  /** Highest block of its stack (some station ends in its course): its top is broken. */
  top: boolean;
  /** The part of the block, along its axis, whose top shows (the rest has stones on it). */
  exposed?: [number, number];
  pier: boolean;
}

/** A block whose top is broken: one end stands to full height, the other drops away (a slope, a step), extruded along the wall's thickness. */
function brokenBlock(g: Frame3, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, left: boolean, reach: number, drop: number): Solid {
  const w = x1 - x0;
  const k = w * reach;
  const pts = left
    ? [{ x: x0, y: z0 }, { x: x1, y: z0 }, { x: x1, y: z1 }, { x: x0 + k, y: z1 }, { x: x0, y: z1 - drop }]
    : [{ x: x0, y: z0 }, { x: x1, y: z0 }, { x: x1, y: z1 - drop }, { x: x1 - k, y: z1 }, { x: x0, y: z1 }];
  return Solid.extrude(g.moved(0, y0, 0).profile('side'), Polygon.fromPoints(pts), y1 - y0);
}

/** Ruined crypt wall: the crypt wall's plinth, courses and piers with a broken, uneven top, and fallen stones at its foot. */
export const ruinedWall: ScenePiece<RuinedWallOptions> = (ctx, o) => {
  const mortar = role(ctx.materials, 'mortar').ramp;
  const mossRamp = role(ctx.materials, 'moss').ramp;
  const rng = pieceRng(ctx);
  const g = worldFrame(ctx);
  const front = Frame3.facing(ctx.frame.origin, Math.PI / 2);
  const origin = ctx.frame.origin;
  const { x: cx, y: cy } = ctx.grid.cell;
  const ex = cx / 2;
  const ey = cy / 2;
  const m = ctx.mask;
  const hasN = !!(m & EDGE.N);
  const hasE = !!(m & EDGE.E);
  const hasS = !!(m & EDGE.S);
  const hasW = !!(m & EDGE.W);
  const straightH = m === (EDGE.E | EDGE.W);
  const straightV = m === (EDGE.N | EDGE.S);
  const hasPier = !straightH && !straightV;
  const arms = [hasN, hasE, hasS, hasW].filter(Boolean).length;
  const H = ctx.height ?? SPACE.scale.wall;
  const { thick, pier } = WALL;
  const bodyH = H - WALL.plinth.height - WALL.cap.height;
  const courses = courseCount(H);
  const courseH = bodyH / courses;
  const z0 = WALL.plinth.height;
  const border = borderCourses(courses);
  const band = bandCourse(courses);
  const bandOver = WALL.band.over;
  const pitchX = blockPitch(cx);
  const pitchY = blockPitch(cy);

  // Towards a connected north edge the engine cuts everything above the run's top at the border (`ctx.seam`, below), so
  // nothing may stand taller than that line on screen: `reach(y)` is how many courses a stack whose rear edge is at
  // depth `y` can have and still lie below it.
  const seamY = ctx.camera.project(vec3(0, -ey, z0 + border * courseH)).y;
  const clears = (y: number, z: number) => !hasN || ctx.camera.project(vec3(0, y, z)).y >= seamY - 0.01;
  const reach = (y: number) => {
    let level = border;
    while (level < courses && clears(y, z0 + (level + 1) * courseH)) level++;
    return level;
  };

  // Courses left at four stations along each axis: the border ones are fixed, the middle ones are the variant's break
  // (along y, the stacks near the north edge are kept under the seam line).
  const stops = (kind: Break, axis: 'x' | 'y'): number[] => {
    // A tooth stands half as high again as the border: taller, a stack one station wide (a quarter of a cell) would be a chimney.
    const high = Math.min(courses, Math.round(border * 1.5));
    const breach = Math.max(1, Math.round(border / 2));
    const [a, b] = { high: [high, high], left: [high, border], right: [border, high], breach: [breach, breach] }[kind];
    return [border, axis === 'y' ? Math.min(a, reach(-ey / 2)) : a, axis === 'y' ? Math.min(b, reach(0)) : b, border];
  };
  const stopsX = stops(BREAKS[ctx.variant % BREAKS.length], 'x');
  const stopsY = stops(BREAKS[(ctx.variant + 1) % BREAKS.length], 'y');
  const stationsOf = (axis: 'x' | 'y') => (axis === 'x' ? stopsX : stopsY);
  /** The stations of an axis with the stretch of the axis each one covers (a quarter of the cell). */
  const stationSpans = (axis: 'x' | 'y') => {
    const e = axis === 'x' ? ex : ey;
    return stationsOf(axis).map((level, i) => ({ level, a: -e + (i * e) / 2, b: -e + ((i + 1) * e) / 2 }));
  };
  /**
   * The parts of the bonded block [s0, s1] of course `k` that stand: what lies over a middle station that has fallen
   * below course `k` is cut away (a clean broken edge), the rest stays. The blocks are longer than a station, so a block
   * that is part middle, part border keeps its border part when a breach takes the middle: the border's courses are the
   * same in every variant, and nothing is left hanging over the breach.
   */
  const standingParts = (axis: 'x' | 'y', s0: number, s1: number, k: number): [number, number][] => {
    let parts: [number, number][] = [[s0, s1]];
    for (const st of stationSpans(axis)) {
      if (st.level > k) continue;
      parts = parts.flatMap(([lo, hi]): [number, number][] => {
        const kept: [number, number][] = [];
        if (lo < st.a) kept.push([lo, Math.min(hi, st.a)]);
        if (hi > st.b) kept.push([Math.max(lo, st.b), hi]);
        return kept;
      });
    }
    return parts.filter(([lo, hi]) => hi - lo >= 5);
  };

  /** The lowest of the stations over [s0, s1], border ones included (what a block over it would have to stand on). */
  const lowestOver = (axis: 'x' | 'y', s0: number, s1: number): number => {
    let level = courses;
    for (const st of stationSpans(axis)) if (Math.min(s1, st.b) - Math.max(s0, st.a) >= 3) level = Math.min(level, st.level);
    return level;
  };

  /** The part of [s0, s1] whose station ends in course `k` (holds exactly k + 1 courses): where the top of that block shows. */
  const exposedOf = (axis: 'x' | 'y', s0: number, s1: number, k: number): [number, number] | undefined => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const st of stationSpans(axis)) {
      const a = Math.max(s0, st.a);
      const b = Math.min(s1, st.b);
      if (st.level !== k + 1 || b - a < 3) continue;
      lo = Math.min(lo, a);
      hi = Math.max(hi, b);
    }
    return hi > lo ? [lo, hi] : undefined;
  };

  // Footprint: strips of wall, and the pier where the wall turns, ends or branches (as the crypt wall).
  const strips: Strip[] = [];
  const t2 = thick / 2;
  const p2 = pier / 2;
  if (straightH) strips.push({ axis: 'x', a: -ex, b: ex, half: t2, aEdge: true, bEdge: true });
  else if (straightV) strips.push({ axis: 'y', a: -ey, b: ey, half: t2, aEdge: true, bEdge: true });
  else {
    if (hasW) strips.push({ axis: 'x', a: -ex, b: -p2, half: t2, aEdge: true, bEdge: false });
    if (hasE) strips.push({ axis: 'x', a: p2, b: ex, half: t2, aEdge: false, bEdge: true });
    if (hasN) strips.push({ axis: 'y', a: -ey, b: -p2, half: t2, aEdge: true, bEdge: false });
    if (hasS) strips.push({ axis: 'y', a: p2, b: ey, half: t2, aEdge: false, bEdge: true });
  }

  const blocks: Block[] = [];
  const addStrip = (s: Strip) => {
    const e = s.axis === 'x' ? ex : ey;
    const pitch = s.axis === 'x' ? pitchX : pitchY;
    const plinthA = hasPier && !s.aEdge ? s.a + WALL.plinth.over : s.a;
    const plinthB = hasPier && !s.bEdge ? s.b - WALL.plinth.over : s.b;
    for (const { s0, s1 } of equalBlocks(plinthA, plinthB, 17)) blocks.push({ axis: s.axis, s0, s1, z0: 0, z1: WALL.plinth.height, half: s.half + WALL.plinth.over, kind: 'plinth', straddles: false, course: -1, top: false, pier: false });
    const courseZ = (k: number) => ({ z0: z0 + k * courseH, z1: z0 + (k + 1) * courseH });
    // The courses that every variant keeps at the borders are bonded blocks, as in the crypt wall. Where the middle
    // stations fall to one course the second of them is gone there.
    for (let k = 0; k < border; k++) {
      for (const c of lattice(s.a, s.b, pitch, jointOnBorder(k), s.aEdge, s.bEdge, s.axis === 'x')) {
        for (const [p0, p1] of c.straddles ? [[c.s0, c.s1] as [number, number]] : standingParts(s.axis, c.s0, c.s1, k)) {
          const exposed = c.straddles ? undefined : exposedOf(s.axis, p0, p1, k);
          blocks.push({ axis: s.axis, s0: p0, s1: p1, ...courseZ(k), half: s.half + (k === band ? bandOver : 0), kind: band === k ? 'band' : 'body', straddles: c.straddles, course: k, top: !!exposed, exposed, pier: false });
        }
      }
    }
    // Above them, loose stones over the two middle stations, where their station reaches that course; neighbouring
    // stations of the same height are one stone. They stand on the course below, and never reach a border.
    for (let k = border; k < courses; k++) {
      const stones: { s0: number; s1: number; level: number }[] = [];
      for (const i of [1, 2]) {
        const level = stationsOf(s.axis)[i];
        const s0 = Math.max(s.a, -e + (i * e) / 2);
        const s1 = Math.min(s.b, -e + ((i + 1) * e) / 2);
        if (level <= k || s1 - s0 < 5) continue;
        const last = stones[stones.length - 1];
        if (last && last.level === level && Math.abs(last.s1 - s0) < 1e-6) last.s1 = s1;
        else stones.push({ s0, s1, level });
      }
      for (const c of stones) blocks.push({ axis: s.axis, s0: c.s0, s1: c.s1, ...courseZ(k), half: s.half + (k === band ? bandOver : 0), kind: band === k ? 'band' : 'body', straddles: false, course: k, top: c.level === k + 1, exposed: c.level === k + 1 ? [c.s0, c.s1] : undefined, pier: false });
    }
  };
  strips.forEach(addStrip);
  // The pier: a stump when it stands alone, a stack that kept at least the border's courses where it holds walls up.
  const pierLevel = hasPier ? Math.min(arms === 0 ? rng.int(Math.max(1, Math.round(border / 2)), border) : rng.int(border, courses), Math.max(reach(-p2), 1)) : 0;
  if (hasPier) {
    const ph = p2 + WALL.plinth.over;
    blocks.push({ axis: 'x', s0: -ph, s1: ph, z0: 0, z1: WALL.plinth.height, half: ph, kind: 'plinth', straddles: false, course: -1, top: false, pier: true });
    const split = rng.boolean() ? 3.5 : -3.5;
    for (let k = 0; k < pierLevel; k++) {
      const zs = { z0: z0 + k * courseH, z1: z0 + (k + 1) * courseH };
      const cuts = k % 2 === 1 ? [-p2, split, p2] : [-p2, p2];
      for (let i = 0; i + 1 < cuts.length; i++) blocks.push({ axis: 'x', s0: cuts[i], s1: cuts[i + 1], ...zs, half: p2 + (k === band ? bandOver : 0), kind: band === k ? 'band' : 'body', straddles: false, course: k, top: k === pierLevel - 1, pier: true });
    }
    // A pier that kept every course may keep its cap too.
    if (pierLevel === courses && clears(-p2 - WALL.cap.pierOver, H) && rng.boolean(0.4)) {
      const ch = p2 + WALL.cap.pierOver;
      blocks.push({ axis: 'x', s0: -ch, s1: ch, z0: H - WALL.cap.height, z1: H, half: ch, kind: 'cap', straddles: false, course: courses, top: false, pier: true });
    }
  }

  // Tone of a block, as the crypt wall: never one tone; straddling blocks keep the base tone in both cells.
  const { plain, tints, capStone, plinthStone, bandStone, style, fineLine, holeStyle } = wallStyles(ctx.materials);

  // Damage (variants 1 and 2): a block that fell out of a lower course, two cracked blocks. Only whole blocks inside the cell are touched.
  const damaged = DAMAGED.includes(ctx.variant);
  const isBody = (b: Block) => b.kind === 'body' || b.kind === 'band';
  const eligible = blocks.map((b, i) => ({ b, i })).filter(({ b }) => isBody(b) && !b.pier && !b.straddles && b.axis === 'x' && b.s1 - b.s0 > 6);
  // The block that fell out of the wall needs a course above it over its whole length, or its dark recess would show as a black slab on top.
  const covered = eligible.filter(({ b }) => b.course + 1 < courses && lowestOver(b.axis, b.s0 - 8, b.s1 + 8) > b.course + 1);
  const missing = damaged && covered.length ? rng.pick(covered).i : -1;
  const cracked = new Set(damaged ? rng.shuffle(eligible.filter(e => e.i !== missing)).slice(0, 2).map(e => e.i) : []);
  const spec = (b: Block) => (b.axis === 'x' ? { x0: b.s0, x1: b.s1, y0: -b.half, y1: b.half } : { x0: -b.half, x1: b.half, y0: b.s0, y1: b.s1 });

  // Towards a connected north edge the engine cuts above the run's top at the border: the height of the border stations.
  ctx.seam(z0 + border * courseH);
  const { object } = ctx;
  // The shadow on the floor: the footprint and a little more towards the light's far side (a ruin casts less than the
  // wall it was), and a pool under every heap.
  const east = 3.5;
  const north = 2.2;
  const shadows: Shape[] = [
    ...strips.map(s => {
      const [x0, x1, y0, y1] = s.axis === 'x' ? [s.a, s.b, -s.half - 1.5, s.half + 1.5] : [-s.half - 1.5, s.half + 1.5, s.a, s.b];
      return groundPatch(ctx.camera, origin, x0, x1 + (s.axis === 'y' || !s.bEdge ? east : 0), y0 - (s.axis === 'x' || !s.aEdge ? north : 0), y1);
    }),
    ...(hasPier ? [groundPatch(ctx.camera, origin, -p2 - 1.5, p2 + east + 1, -p2 - north - 1, p2 + 1.5)] : []),
  ];

  const hosts = new Map<number, Solid>();
  blocks.forEach((b, i) => {
    const { x0, x1, y0, y1 } = spec(b);
    const base = b.kind === 'cap' ? capStone : b.kind === 'band' ? bandStone : b.kind === 'plinth' ? plinthStone : b.straddles ? plain : rng.pick(tints);
    if (i === missing) {
      // A block that fell out: a dark recess where it stood.
      object.add(boxAt(g, x0, x1, y0, y1 - 3.2, b.z0, b.z1), holeStyle);
      return;
    }
    // The top of a stack is broken: the block is cut on a slope or a step. Where part of it carries stones, the cut keeps
    // that end whole and drops only the exposed one, and never reaches further than the exposed part.
    const [e0, e1] = b.exposed ?? [b.s0, b.s1];
    const part = (e1 - e0) / (b.s1 - b.s0);
    const breaks = isBody(b) && b.top && !b.straddles && (b.axis === 'x' || b.pier) && (b.pier ? b.s1 - b.s0 > 6 : b.s1 - b.s0 > 5) && part > 0.3;
    const dropsLeft = part > 0.99 ? rng.boolean() : e0 < b.s0 + 0.5;
    const reach = Math.min(rng.float(0.3, 0.65), part);
    const solid = breaks ? brokenBlock(g, x0, x1, y0, y1, b.z0, b.z1, dropsLeft, reach, Math.min((b.z1 - b.z0) * rng.float(0.35, 0.75), 8)) : boxAt(g, x0, x1, y0, y1, b.z0, b.z1);
    object.add(solid, style(base));
    hosts.set(i, solid);
  });

  // Fallen stones: lumps of the wall lying where they landed. Scattered along the runs, heaped where the wall ends.
  const B = pitchX;
  const lump = (x: number, y: number, z: number, l: number, w: number, h: number, yaw: number) => {
    const frame = g.moved(x, y, z).turned(yaw);
    object.add(Solid.box(frame, l, w, h), style(rng.pick(tints), fineLine));
    return z + h;
  };
  const heap = (hx: number, hy: number, r: number, count: number) => {
    shadows.push(groundShadow(ctx.camera, vec3(origin.x + hx, origin.y + hy, 0), r * 1.15, r * 0.85));
    const base: { x: number; y: number; top: number; l: number; w: number }[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng.float(-0.4, 0.4);
      const d = i === 0 ? 0 : r * rng.float(0.35, 0.8);
      const l = rng.float(0.26, 0.46) * B;
      const w = rng.float(0.2, 0.34) * B;
      const x = Math.max(-ex + 3.5, Math.min(ex - 3.5, hx + Math.cos(a) * d));
      const y = hy + Math.sin(a) * d * 0.8;
      base.push({ x, y, l, w, top: lump(x, y, 0, l, w, rng.float(0.18, 0.3) * B, rng.float(0, 180)) });
    }
    // A few smaller ones on top of the big ones.
    for (const b of base.slice(0, Math.max(1, Math.floor(count / 2)))) lump(b.x + rng.float(-0.9, 0.9), b.y + rng.float(-0.7, 0.7), b.top, b.l * 0.55, b.w * 0.6, rng.float(0.12, 0.2) * B, rng.float(0, 180));
  };
  if (o.rubble > 0) {
    // Along the runs, either side of the wall, clear of its footprint and of the cell's borders.
    for (const s of strips) {
      const e = s.axis === 'x' ? ex : ey;
      const lo = Math.max(s.a, -e) + 5;
      const hi = Math.min(s.b, e) - 5;
      if (hi <= lo) continue;
      const n = Math.round(o.rubble * rng.float(2, 4));
      for (let i = 0; i < n; i++) {
        const along = rng.float(lo, hi);
        const across = (rng.boolean() ? 1 : -1) * (s.half + rng.float(3, 6.5));
        const [x, y] = s.axis === 'x' ? [along, across] : [across, along];
        lump(x, y, 0, rng.float(0.16, 0.32) * B, rng.float(0.13, 0.24) * B, rng.float(0.1, 0.2) * B, rng.float(0, 180));
      }
      // One whole block that came down, lying beside the wall (only where it fits clear of the borders, so a cut never slices it).
      if (hi - lo > 14 && rng.boolean(0.35 * o.rubble)) {
        const along = rng.float(lo + 5, Math.max(lo + 5, hi - 5));
        const across = (rng.boolean() ? 1 : -1) * (s.half + 6.5);
        const [x, y] = s.axis === 'x' ? [along, across] : [across, along];
        lump(x, y, 0, 0.75 * B, 0.45 * B, 0.42 * B, s.axis === 'x' ? rng.float(-12, 12) : 90 + rng.float(-12, 12));
      }
    }
    // Where the wall ends or stands alone, its stones lie in a heap beyond it.
    if (arms <= 1) {
      const free = [!hasN && { x: 0, y: -ey * 0.55 }, !hasE && { x: ex * 0.6, y: 0 }, !hasS && { x: 0, y: ey * 0.55 }, !hasW && { x: -ex * 0.6, y: 0 }].filter(Boolean) as { x: number; y: number }[];
      // The side away from the arm (the end of the wall), and for a stump the side that faces the camera.
      const beyond = arms === 1 ? free.find(f => (hasW && f.x > 0) || (hasE && f.x < 0) || (hasN && f.y > 0) || (hasS && f.y < 0)) : undefined;
      const sites = arms === 1 && beyond ? [beyond] : [free.find(f => f.y > 0)!, free.find(f => f.x !== 0 && rng.boolean()) ?? free[1]];
      sites.forEach((f, i) => heap(f.x, f.y, (i === 0 ? 0.78 : 0.56) * B * (0.75 + o.rubble * 0.25), Math.round((i === 0 ? 8 : 5) * (0.6 + o.rubble * 0.4))));
    } else if (arms === 2 && !straightH && !straightV && rng.boolean(0.6 * o.rubble)) {
      // A corner that lost stones: a small heap on the outside of the turn.
      heap(hasE ? -ex * 0.55 : ex * 0.55, hasS ? -ey * 0.5 : ey * 0.5, 0.42 * B, 4);
    }
  }
  const shadow = shadows.length > 1 ? shadows[0].union(shadows.slice(1)) : shadows[0];
  ctx.ground.custom(origin, c => shadow.fill(c, castShadow(0.3)));

  // Detail on the faces that look at the camera: shade over the foot, pits, cracks, moss, and the pier's rune.
  const decalFront = (b: Block, xc: number, z: number, shape: Shape, st: Parameters<Decal['draw']>[2], host: Solid) =>
    object.add(Decal.onFace(front, 'front', vec3(spec(b).y1, -xc, z), shape), st, { on: host });
  const decalTop = (b: Block, xc: number, yc: number, shape: Shape, st: Parameters<Decal['draw']>[2], host: Solid) =>
    object.add(Decal.onFace(front, 'top', vec3(yc, -xc, b.z1), shape), st, { on: host });
  const shade = { fill: alpha(PALETTES.ink, 0.2) };
  // The ward on the first pier block wide enough, a course above the foot where the pier stands that high.
  const runeCourse = Math.min(1, Math.max(0, pierLevel - 1));
  const midPier = blocks.findIndex(b => isBody(b) && b.pier && b.course === runeCourse && b.s1 - b.s0 > 8);
  blocks.forEach((b, i) => {
    const host = hosts.get(i);
    if (!host || b.axis !== 'x') return;
    const w = b.s1 - b.s0;
    const xc = (b.s0 + b.s1) / 2;
    if (isBody(b)) {
      if (b.course === 0) decalFront(b, xc, b.z0 + 1.5, Polygon.rect(w, 3), shade, host);
      // The string course's shadow on the course under it.
      if (b.course === band - 1 && !b.top) decalFront(b, xc, b.z1 - 1.5, Polygon.rect(w, 3), shade, host);
      const lo = Math.max(b.s0, -ex) + 2;
      const hi = Math.min(b.s1, ex) - 2;
      for (let k = 0; k < 2 && hi > lo; k++) decalFront(b, rng.float(lo, hi), rng.float(b.z0 + 2.6, b.z1 - 2.6), Polygon.ellipse(rng.float(0.45, 0.9), rng.float(0.4, 0.65), { segments: 8 }), { fill: alpha(mortar.dark, rng.float(0.35, 0.6)) }, host);
      if (cracked.has(i)) decalFront(b, xc, (b.z0 + b.z1) / 2 + 1, crackShape(rng.int(1, 999), (b.z1 - b.z0) * 0.9), SHAPE_STYLES.stoneCrack, host);
      if (i === midPier && !damaged) decalFront(b, xc, (b.z0 + b.z1) / 2, runeShape().scale(1.5), soulMark(role(ctx.materials, 'glow')), host);
    }
    if (o.moss && Math.abs(xc) < ex - 4) {
      if (b.kind === 'plinth' && rng.boolean(0.6)) decalFront(b, xc + rng.float(-w / 4, w / 4), b.z0 + 1.9, blob(0, 0, rng.float(3, 5), 1.4, rng.int(1, 999), 0, 0.3), { fill: alpha(mossRamp.base, 0.95) }, host);
      if (isBody(b) && b.top && rng.boolean(0.55)) decalTop(b, xc + rng.float(-w / 4, w / 4), rng.float(-b.half + 2, b.half - 2), blob(0, 0, rng.float(2.8, 4.4), 1.4, rng.int(1, 999), 0, 0.3), { fill: alpha(mossRamp.base, 0.95) }, host);
    }
  });
};
