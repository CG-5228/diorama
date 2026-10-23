/**
 * Walls of the graveyard kit: the crypt wall, courses of dressed stone with a cap course.
 *
 * The space profile (`../space.ts`, jrpg preset) puts walls on cell BORDERS: a wall cell is the vertex where four cells
 * meet, and a run is one cell edge long, from vertex to vertex (two half arms, one drawn by each vertex). The piece draws a
 * run of blocks through its pivot, reaching the edges it is connected to (edge mask N 1, E 2, S 4, W 8) as far as the
 * cell's border (half a cell), where the engine cuts it and the neighbour's arm goes on. Where it goes straight (E|W or
 * N|S) the run goes on through the pivot; anywhere else (a corner, a T, a cross, an end, a lone post) a square pier stands
 * at the pivot and arms run from it, so every turn and end is finished stone. Mask 0 is the pier alone: a square pillar
 * with a cap.
 *
 * Heights come from the space profile (the catalog's `heights: ['wall', 'fence']`: a full wall of 100 and a low wall of
 * 44) through `ctx.height`: the blocks keep their size (a course is about 10.5 tall, a block 16 long and 16 thick, three
 * to a cell), so a tall wall has more courses and a low one fewer, never squashed ones. Plan sizes (thickness, pier) are
 * fractions of the profile's cell.
 *
 * Joints are laid so that cells meet without a seam:
 * - the plinth and the cap course are cut at every cell border (a joint there, always);
 * - the courses between them run in a bond: even courses are cut at the border, odd courses have a
 *   block that straddles it (drawn past the border and cut there by the engine, so the next cell shows
 *   the rest of the same stone). The straddling block's tone is fixed, never random, so both cells
 *   agree on it; damage (a missing block, a crack, a chip) only ever lands on blocks inside the cell.
 * - cap, wall and plinth keep the same heights in every mask and variant, so runs line up.
 *
 * Four looks (`WALL_LOOKS`), appended in this order so a variant's index never changes its look: 0 whole with the
 * ward rune burned into its piers, 1 a fallen block and cracks, 2 whole and plain (no rune), 3 mossy, with a
 * chipped block and cracks. Damage only ever lands on blocks inside the cell, never on the height at a border, so a
 * run mixes looks freely; where a look matters (a fallen block, a rune) a scene chooses it per cell.
 */

import { Path, Polygon, alpha, type Shape } from '@core/draw';
import { Decal, EDGE, Frame3, Solid, pieceRng, vec3, type ScenePiece, type SceneMaterials, type VolumeStyle } from '@core/volume';
import { PALETTES, SHAPE_STYLES, STROKES } from '../theme';
import { SPACE } from '../space';
import { blob, boxAt, castShadow, groundPatch, mixTone, role, runeShape, soulMark, tone, worldFrame } from './util';

/** What each variant of the crypt wall looks like, in variant order (the catalog's `variantLabels`). */
export const WALL_LOOKS = ['Intact, with a rune', 'Fallen block and cracks', 'Intact, plain', 'Moss, chipped block and cracks'] as const;

/**
 * Plan sizes in world units (1 unit = 1 logical px, as the rest of the project). The plan follows the profile's cell: a wall
 * is a third of a cell thick, a pier five twelfths; plinth, cap and course are block sizes and stay the same at every height.
 */
export const WALL = {
  /** Thickness of the wall between piers, and the side of a pier. */
  thick: SPACE.scale.cell / 3,
  pier: (SPACE.scale.cell * 5) / 12,
  plinth: { height: 5, over: 1.5 },
  cap: { height: 7, over: 1.5, pierOver: 2 },
  /** Courses between plinth and cap are as close to this tall as the wall's height allows. */
  course: 10.5,
  /** A tall wall wears a projecting string course in the middle (from this many courses up). */
  band: { courses: 6, over: 1.2 },
} as const;

/** Courses between the plinth and the cap of a wall that stands `height` tall: a block size, so a taller wall has more of them. */
export const courseCount = (height: number): number => Math.max(2, Math.round((height - WALL.plinth.height - WALL.cap.height) / WALL.course));

/** The course that projects as a string course in a wall of `courses` courses (-1: none). */
export const bandCourse = (courses: number): number => (courses >= WALL.band.courses ? Math.floor(courses / 2) : -1);

/** Joint pitch of the courses along an axis: three blocks to a cell, so a block is as long as the wall is thick. */
export const blockPitch = (cell: number): number => cell / 3;

/** Whether course `k` has a joint on the cell's border (even courses); the others have a block straddling it. */
export const jointOnBorder = (k: number): boolean => k % 2 === 0;

/** A stretch of a wall along one axis, to be cut into blocks (shared with the ruined wall). */
export interface Strip {
  axis: 'x' | 'y';
  /** Extent along the axis, and half of the thickness across it. */
  a: number;
  b: number;
  half: number;
  /** Which ends lie on the cell's border (E/W ends of horizontal strips straddle in odd courses). */
  aEdge: boolean;
  bEdge: boolean;
}

/** One block to build. */
interface Block {
  strip: Strip;
  /** Extent along the strip's axis. */
  s0: number;
  s1: number;
  z0: number;
  z1: number;
  /** Half thickness across the strip. */
  half: number;
  kind: 'plinth' | 'body' | 'band' | 'cap';
  /** A block that goes on into the next cell: nothing about it may be random or damaged. */
  straddles: boolean;
  course: number;
}

/**
 * Cuts [a, b] with joints on a lattice (`odd` false: every pitch; true: offset by half a pitch), merging slivers (shared with
 * the ruined wall). With the pitch a third of the cell, the offset lattice has a joint on the cell's border and the other one
 * a block straddling it (`jointOnBorder`).
 */
export function lattice(a: number, b: number, pitch: number, odd: boolean, aEdge: boolean, bEdge: boolean, straddle: boolean, minLen = 5): { s0: number; s1: number; straddles: boolean }[] {
  const joints: number[] = [];
  for (let k = -4; k <= 4; k++) joints.push((odd ? k + 0.5 : k) * pitch);
  let lo = a;
  let hi = b;
  let straddlesLo = false;
  let straddlesHi = false;
  if (straddle && aEdge) {
    lo = Math.max(...joints.filter(j => j <= a + 1e-6));
    straddlesLo = lo < a - 1e-6;
  }
  if (straddle && bEdge) {
    hi = Math.min(...joints.filter(j => j >= b - 1e-6));
    straddlesHi = hi > b + 1e-6;
  }
  const cuts = joints.filter(j => j > lo + 1e-6 && j < hi - 1e-6);
  let edges = [lo, ...cuts, hi];
  // Merge slivers into a neighbour (the end ones into the block next to them).
  for (let guard = 0; guard < 8; guard++) {
    const i = edges.findIndex((e, k) => k < edges.length - 1 && edges[k + 1] - e < minLen);
    if (i < 0 || edges.length <= 2) break;
    edges = i === 0 ? edges.filter((_, k) => k !== 1) : i === edges.length - 2 ? edges.filter((_, k) => k !== edges.length - 2) : edges.filter((_, k) => k !== i + 1);
  }
  return edges.slice(0, -1).map((s0, k) => ({ s0, s1: edges[k + 1], straddles: (k === 0 && straddlesLo) || (k === edges.length - 2 && straddlesHi) }));
}

/** Equal blocks of at most `max` along [a, b], cut at both ends (the plinth and cap courses: a joint on every border). */
export function equalBlocks(a: number, b: number, max: number): { s0: number; s1: number }[] {
  const n = Math.max(1, Math.ceil((b - a) / max - 1e-6));
  return Array.from({ length: n }, (_, k) => ({ s0: a + ((b - a) * k) / n, s1: a + ((b - a) * (k + 1)) / n }));
}

/**
 * The stone looks of a wall (shared with the ruined wall): the tints blocks are drawn in, the paler cap and the
 * darker plinth, the joint lines between blocks, and the dark recess of a block that fell out. No stipple
 * texture on walls: it would repeat the same speckle on every block.
 */
export function wallStyles(materials: SceneMaterials) {
  const stone = role(materials, 'stone');
  const mortar = role(materials, 'mortar').ramp;
  const plain: VolumeStyle = { ramp: stone.ramp };
  const tints = [plain, tone(plain, 0.1), tone(plain, -0.1)];
  const capStone: VolumeStyle = { ramp: { ...stone.ramp, lit: mixTone(stone.ramp.lit, stone.ramp.base, 0.32) } };
  const plinthStone = tone(plain, -0.22);
  /** The projecting string course of a tall wall: paler than the courses around it. */
  const bandStone = tone(plain, 0.5);
  const line = STROKES.detail.with({ color: mortar.base, width: 1 });
  const fineLine = STROKES.detail.with({ color: mortar.base, width: 0.7 });
  const edgeLine = STROKES.detail.with({ color: alpha(mortar.dark, 0.7), width: 0.6 });
  const style = (base: VolumeStyle, stroke: VolumeStyle['stroke'] = line): VolumeStyle => ({ ...base, stroke, edge: edgeLine });
  const holeStyle = style({ ramp: { lit: mortar.lit, base: mixTone(mortar.base, mortar.lit, 0.5), dark: mortar.base } });
  return { plain, tints, capStone, plinthStone, bandStone, style, fineLine, holeStyle };
}

/** The crypt wall's options. Its height is not one: it comes from the catalog's `heights` through `ctx.height`. */
export interface WallOptions {
  /** Moss on the plinth and the cap. */
  moss: boolean;
}

/** Crypt wall: stone courses with mortar joints, a plinth and a cap course; piers at corners, ends and junctions. */
export const cryptWall: ScenePiece<WallOptions> = (ctx, o) => {
  const mortar = role(ctx.materials, 'mortar').ramp;
  const mossRamp = role(ctx.materials, 'moss').ramp;
  const rng = pieceRng(ctx);
  const g = worldFrame(ctx);
  const front = Frame3.facing(ctx.frame.origin, Math.PI / 2);
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
  const H = ctx.height ?? SPACE.scale.wall;
  const { thick, pier } = WALL;
  const bodyH = H - WALL.plinth.height - WALL.cap.height;
  const courses = courseCount(H);
  const courseH = bodyH / courses;
  const z0 = WALL.plinth.height;
  const band = bandCourse(courses);
  const bandOver = WALL.band.over;
  const pitchX = blockPitch(cx);
  const pitchY = blockPitch(cy);

  // Footprint: strips of wall, and the pier where the wall turns, ends or branches.
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

  // Blocks of every strip and of the pier, course by course.
  const blocks: Block[] = [];
  const addStrip = (s: Strip) => {
    const pitch = s.axis === 'x' ? pitchX : pitchY;
    // Plinth and cap: wider than the wall, a joint on every border.
    const plinthHalf = s.half + WALL.plinth.over;
    const capHalf = s.half + WALL.cap.over;
    const capA = hasPier && !s.aEdge ? s.a + (WALL.cap.pierOver - 0) : s.a;
    const capB = hasPier && !s.bEdge ? s.b - (WALL.cap.pierOver - 0) : s.b;
    const plinthA = hasPier && !s.aEdge ? s.a + WALL.plinth.over : s.a;
    const plinthB = hasPier && !s.bEdge ? s.b - WALL.plinth.over : s.b;
    for (const { s0, s1 } of equalBlocks(plinthA, plinthB, 17)) blocks.push({ strip: s, s0, s1, z0: 0, z1: WALL.plinth.height, half: plinthHalf, kind: 'plinth', straddles: false, course: -1 });
    for (const { s0, s1 } of equalBlocks(capA, capB, 17)) blocks.push({ strip: s, s0, s1, z0: H - WALL.cap.height, z1: H, half: capHalf, kind: 'cap', straddles: false, course: courses });
    for (let k = 0; k < courses; k++) {
      const cuts = lattice(s.a, s.b, pitch, jointOnBorder(k), s.aEdge, s.bEdge, s.axis === 'x');
      for (const c of cuts) blocks.push({ strip: s, s0: c.s0, s1: c.s1, z0: z0 + k * courseH, z1: z0 + (k + 1) * courseH, half: s.half + (k === band ? bandOver : 0), kind: band === k ? 'band' : 'body', straddles: c.straddles, course: k });
    }
  };
  strips.forEach(addStrip);
  if (hasPier) {
    // The pier: a plinth, one block per course (odd courses split off-centre, like corner quoins) and a broader cap.
    const own: Strip = { axis: 'x', a: -p2, b: p2, half: p2, aEdge: false, bEdge: false };
    const ph = p2 + WALL.plinth.over;
    const ch = p2 + WALL.cap.pierOver;
    blocks.push({ strip: own, s0: -ph, s1: ph, z0: 0, z1: WALL.plinth.height, half: ph, kind: 'plinth', straddles: false, course: -1 });
    blocks.push({ strip: own, s0: -ch, s1: ch, z0: H - WALL.cap.height, z1: H, half: ch, kind: 'cap', straddles: false, course: courses });
    const split = rng.boolean() ? 3.5 : -3.5;
    for (let k = 0; k < courses; k++) {
      const zs = { z0: z0 + k * courseH, z1: z0 + (k + 1) * courseH };
      const cuts = k % 2 === 1 ? [-p2, split, p2] : [-p2, p2];
      for (let i = 0; i + 1 < cuts.length; i++) blocks.push({ strip: own, s0: cuts[i], s1: cuts[i + 1], ...zs, half: p2 + (k === band ? bandOver : 0), kind: band === k ? 'band' : 'body', straddles: false, course: k });
    }
  }

  // Tone of a block: stone is never quite one tone. Straddling blocks keep the base tone in both cells.
  const { plain, tints, capStone, plinthStone, bandStone, style, holeStyle } = wallStyles(ctx.materials);
  const isBody = (b: Block) => b.kind === 'body' || b.kind === 'band';

  // Damage: variant 1 has one missing block, one chipped and cracks; variant 3 has no hole but a chipped block and cracks
  // (and the moss below); 0 and 2 are whole. Only whole blocks inside the cell are touched, as many as the wall is tall.
  const eligible = blocks.map((b, i) => ({ b, i })).filter(({ b }) => isBody(b) && !b.straddles && b.strip.axis === 'x' && b.s1 - b.s0 > 6);
  const hurt = Math.max(3, Math.round(courses * 0.6));
  const damaged = ctx.variant === 1 || ctx.variant === 3 ? rng.shuffle(eligible).slice(0, hurt).map(e => e.i) : [];
  const mossy = ctx.variant === 3;
  const missing = mossy ? undefined : damaged[0];
  const chipped = mossy ? damaged[0] : damaged[1];
  const cracked = new Set(mossy ? damaged : damaged.slice(1));

  const spec = (b: Block) => (b.strip.axis === 'x' ? { x0: b.s0, x1: b.s1, y0: -b.half, y1: b.half } : { x0: -b.half, x1: b.half, y0: b.s0, y1: b.s1 });

  // Where the north edge is connected the engine cuts above the run's top at the border: the cap is the top there.
  ctx.seam(H);
  const { object } = ctx;
  // The shadow of the wall on the floor: its footprint and more towards the light's far side the taller the wall stands.
  const lean = Math.min(1, H / SPACE.scale.wall);
  const east = 2.5 + 3.5 * lean;
  const north = 1.5 + 2.5 * lean;
  const patches = [...strips.map(s => {
    const [x0, x1, y0, y1] = s.axis === 'x' ? [s.a, s.b, -s.half - 1.5, s.half + 1.5] : [-s.half - 1.5, s.half + 1.5, s.a, s.b];
    return groundPatch(ctx.camera, ctx.frame.origin, x0, x1 + (s.axis === 'y' || !s.bEdge ? east : 0), y0 - (s.axis === 'x' || !s.aEdge ? north : 0), y1);
  }), ...(hasPier ? [groundPatch(ctx.camera, ctx.frame.origin, -p2 - 1.5, p2 + east + 1, -p2 - north - 1, p2 + 1.5)] : [])];
  const shadow = patches.length > 1 ? patches[0].union(patches.slice(1)) : patches[0];
  ctx.ground.custom(ctx.frame.origin, c => shadow.fill(c, castShadow(0.3)));

  const hosts = new Map<number, Solid>();
  blocks.forEach((b, i) => {
    const { x0, x1, y0, y1 } = spec(b);
    const base = b.kind === 'cap' ? capStone : b.kind === 'band' ? bandStone : b.kind === 'plinth' ? plinthStone : b.straddles ? plain : rng.pick(tints);
    if (i === missing) {
      // A block that fell out: a dark recess where it stood.
      object.add(boxAt(g, x0, x1, y0, y1 - 3.2, b.z0, b.z1), holeStyle);
      return;
    }
    const solid = i === chipped ? chippedBlock(g, x0, x1, y0, y1, b.z0, b.z1, rng.boolean()) : boxAt(g, x0, x1, y0, y1, b.z0, b.z1);
    object.add(solid, style(base));
    hosts.set(i, solid);
  });

  // Detail on the faces that look at the camera: the cap's shadow on the course under it, the floor's
  // dirt on the first course, damp streaks under the cap, cracks, small pits, moss, and the soul rune of a pier.
  const decalFront = (b: Block, xc: number, z: number, shape: Shape, st: Parameters<Decal['draw']>[2], host: Solid) =>
    object.add(Decal.onFace(front, 'front', vec3(spec(b).y1, -xc, z), shape), st, { on: host });
  const decalTop = (b: Block, xc: number, yc: number, shape: Shape, st: Parameters<Decal['draw']>[2], host: Solid) =>
    object.add(Decal.onFace(front, 'top', vec3(yc, -xc, b.z1), shape), st, { on: host });
  const shade = { fill: alpha(PALETTES.ink, 0.2) };
  const streak = { fill: alpha(PALETTES.ink, 0.13) };
  const topCourse = courses - 1;
  // The ward is burned into the first pier block wide enough for it, a course above the foot so a figure standing before the wall does not hide it.
  const runeCourse = Math.min(1, courses - 1);
  const midPier = blocks.findIndex(b => isBody(b) && b.strip.half >= p2 && b.course === runeCourse && b.s1 - b.s0 > 8);
  blocks.forEach((b, i) => {
    const host = hosts.get(i);
    if (!host || b.strip.axis !== 'x') return;
    const w = b.s1 - b.s0;
    const xc = (b.s0 + b.s1) / 2;
    const lo = Math.max(b.s0, -ex) + 2;
    const hi = Math.min(b.s1, ex) - 2;
    if (isBody(b)) {
      // The cap's shadow on the course under it, and the string course's on the one below that.
      if (b.course === topCourse || b.course === band - 1) decalFront(b, xc, b.z1 - 1.5, Polygon.rect(w, 3), shade, host);
      if (b.course === 0) decalFront(b, xc, b.z0 + 1.5, Polygon.rect(w, 3), shade, host);
      // Damp streaks under the cap, none across a border.
      if (b.course === topCourse && hi - lo > 4 && rng.boolean(0.45)) {
        const len = rng.float(4, courseH - 4);
        decalFront(b, rng.float(lo, hi), b.z1 - 3 - len / 2, Polygon.rect(rng.float(0.9, 1.6), len), streak, host);
      }
      // Pits: a few small dark flecks that stay inside the visible part of the block.
      for (let k = 0; k < 2 && hi > lo; k++) decalFront(b, rng.float(lo, hi), rng.float(b.z0 + 2.6, b.z1 - 2.6), Polygon.ellipse(rng.float(0.45, 0.9), rng.float(0.4, 0.65), { segments: 8 }), { fill: alpha(mortar.dark, rng.float(0.35, 0.6)) }, host);
      if (cracked.has(i)) decalFront(b, xc, (b.z0 + b.z1) / 2 + 1, crackShape(rng.int(1, 999), (b.z1 - b.z0) * 0.9), SHAPE_STYLES.stoneCrack, host);
      if (i === midPier && ctx.variant === 0) {
        const glow = role(ctx.materials, 'glow');
        decalFront(b, xc, (b.z0 + b.z1) / 2, runeShape().scale(1.5), soulMark(glow), host);
      }
    }
    if (o.moss && Math.abs(xc) < ex - 4) {
      if (b.kind === 'plinth' && rng.boolean(mossy ? 0.9 : 0.6)) decalFront(b, xc + rng.float(-w / 4, w / 4), b.z0 + 1.9, blob(0, 0, rng.float(3, 5), 1.4, rng.int(1, 999), 0, 0.3), { fill: alpha(mossRamp.base, 0.95) }, host);
      if (b.kind === 'cap' && rng.boolean(mossy ? 0.7 : 0.45)) decalTop(b, xc + rng.float(-w / 4, w / 4), (rng.boolean() ? 1 : -1) * (b.half - 2), blob(0, 0, rng.float(2.8, 4.4), 1.4, rng.int(1, 999), 0, 0.3), { fill: alpha(mossRamp.base, 0.95) }, host);
      // The mossy look: damp climbs the first two courses in soft patches, sparser the higher it gets.
      if (mossy && isBody(b) && b.course <= 1 && rng.boolean(b.course === 0 ? 0.75 : 0.4)) {
        decalFront(b, xc + rng.float(-w / 4, w / 4), b.z0 + rng.float(1.9, 4.8), blob(0, 0, rng.float(2.8, 5.2), rng.float(1.4, 2.2), rng.int(1, 999), 0, 0.35), { fill: alpha(mossRamp.base, 0.9) }, host);
      }
    }
  });
};

/** A block with its lower corner broken off (`left` picks the end), extruded along the wall's thickness. */
function chippedBlock(g: Frame3, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, left: boolean): Solid {
  const w = x1 - x0;
  const h = z1 - z0;
  const cx = Math.min(w * 0.3, 5.5);
  const cz = Math.min(h * 0.45, 5);
  const pts = left
    ? [{ x: x0 + cx, y: z0 }, { x: x1, y: z0 }, { x: x1, y: z1 }, { x: x0, y: z1 }, { x: x0, y: z0 + cz }]
    : [{ x: x0, y: z0 }, { x: x1 - cx, y: z0 }, { x: x1, y: z0 + cz }, { x: x1, y: z1 }, { x: x0, y: z1 }];
  return Solid.extrude(g.moved(0, y0, 0).profile('side'), Polygon.fromPoints(pts), y1 - y0);
}

/** A crack running down a block face, in decal space (x right, y down), centred on the origin (shared with the ruined wall). */
export function crackShape(seed: number, length: number): Shape {
  const pts = [{ x: 0, y: -length / 2 }];
  let s = seed;
  const next = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 1; i <= 4; i++) pts.push({ x: pts[i - 1].x + (next() - 0.5) * 4, y: -length / 2 + (length * i) / 4 });
  return Path.spline(pts, { style: 'chiseled' }).toShape({ width: { start: 1.3, end: 0.3 }, cap: 'round' });
}

