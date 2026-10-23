/**
 * Fences of the graveyard kit: the iron fence (spiked bars between stone posts), the iron gate
 * (a double gate with a soul-fire lantern finial that joins the fence) and the wooden fence (weathered
 * pickets, some broken or missing).
 *
 * The space profile (`../space.ts`, jrpg preset) puts fences on cell BORDERS: a fence cell is the vertex where four cells
 * meet, a run is one cell edge long (two half arms, one drawn by each vertex) and a post stands at every vertex. A fence
 * cell is that post at the pivot and, towards every connected edge (N 1, E 2, S 4, W 8), an arm of bars between rails that
 * runs to the cell's border, half a cell. Bars stand on one lattice, 7.5 to a cell edge (6.4 along x; pickets 7), counted back from
 * the border: the spacing is the same across a post and across a border, so a run is one continuous fence; rails run
 * straight to the border and the engine cuts the cell there. Randomness (a bent bar, a missing picket) only touches bars
 * inside the cell.
 *
 * Heights come from the space profile (the catalog's `heights`: the iron fence 44 and 100, the wooden fence 44, the gate
 * the door's 92) through `ctx.height`, the height of the top of the bars (spear tips, picket heads): posts rise a little
 * above. Bars, rails and posts keep their size; a taller fence has more rails and thicker posts, not stretched ones.
 *
 * Arms are built in a frame that runs along them (`u` along the run, `v` across, `z` up), so one piece
 * of code serves arms to the east, west, north and south.
 *
 * The gate fills its cell with two stone hinge posts, two leaves and a central finial, along the run it joins (E|W, or
 * N|S when it joins only north or south).
 *
 * Variants are appended in the order of the `*_LOOKS` lists, so an index never changes its look. A look only touches
 * what lies inside the cell (the posts' rune, a bar, a picket); rails, post height and bar height are the same at
 * every border in every variant, so a run can mix them freely. Where a look matters (a gap, a rune beside a gate) a
 * scene chooses it per cell.
 */

import { Polygon, alpha } from '@core/draw';
import { Decal, EDGE, Frame3, Round, Solid, Tube, floorGlow, groundShadow, pieceRng, vec3, type PieceClip, type PieceContext, type ScenePiece, type SceneMaterials, type StageObject, type VolumeStyle } from '@core/volume';
import { STROKES } from '../theme';
import { SPACE } from '../space';
import { boxAt, castShadow, glowFlame, groundPatch, mixTone, role, runeShape, soulMark } from './util';
import { box, doorSpan, firstFrame, leafFrame, leafShadow, poseOf, type Channels } from './doors';
import { track } from './motion';

/** Plan sizes in world units. Bars, rails and posts keep their size at every height. */
export const FENCE = {
  /** Bars (or pickets) to a cell edge: 7.5, so a bar every 6.4 on a 48-wide cell. */
  barsPerEdge: 7.5,
  /** Iron bars: radius, and the spearhead on top (its height and base radius). */
  bar: { radius: 1.0, spear: 6, spearRadius: 1.4 },
  /** Rails: height, and thickness across the run. */
  rail: { height: 2.4, thick: 1.8 },
  /** Largest gap between two rails of a fence; taller fences get more of them. */
  railSpan: 28,
  /** Half side of a stone post's shaft at the profile's fence height, and how much it grows per unit of extra height. */
  post: 3.6,
  postGrowth: 0.025,
  /**
   * Wooden fence: pickets are 3.2 wide and 1.8 thick, 7 to a cell edge (one every 6.9 on a 48-wide cell: a picket's edge
   * and its contour stay clear of the cell's border, so every variant has the same silhouette there); its posts are a
   * little narrower than the stone ones.
   */
  wood: { post: 3, picket: 1.6, thick: 1.8, head: 4.2, perEdge: 7 },
} as const;

/** What each variant of the iron fence looks like, in variant order (the catalog's `variantLabels`). */
export const IRON_FENCE_LOOKS = ['Intact, with a rune', 'Bent bars and one missing', 'Intact, plain', 'One bent bar'] as const;
/** What each variant of the iron gate looks like. */
export const IRON_GATE_LOOKS = ["Iron and stone, will-o'-wisp lantern"] as const;
/** What each variant of the wooden fence looks like. */
export const WOOD_FENCE_LOOKS = ['Whole stakes, with a rune', 'Broken stakes and one missing', 'Uneven stakes, no rune'] as const;

type Run = { axis: 'x' | 'y'; sign: 1 | -1; from: number; to: number; pitch: number };

/** The frame an arm is built in: `u` along the run (x for east/west arms, y for north/south), `v` across, `z` up. */
const runFrame = (ctx: PieceContext, axis: 'x' | 'y'): Frame3 => Frame3.facing(ctx.frame.origin, axis === 'x' ? 0 : Math.PI / 2);

/** A box in a run frame: `u0..u1` along, `v0..v1` across, `z0..z1` up. */
const boxRun = (f: Frame3, u0: number, u1: number, v0: number, v1: number, z0: number, z1: number): Solid => Solid.box(f.moved((u0 + u1) / 2, (v0 + v1) / 2, z0), u1 - u0, v1 - v0, z1 - z0);

/** Half side of a stone post of a fence `height` tall: the posts of a tall fence are thicker, never stretched. */
export const postHalf = (height: number): number => FENCE.post + FENCE.postGrowth * Math.max(0, height - SPACE.scale.fence);

/** Heights of the rails of a fence that stands `height` tall: the lowest a hand above the ground, the top one below the spearheads, the rest evenly between (never more than `FENCE.railSpan` apart). */
export function railLevels(height: number): number[] {
  const low = Math.min(10, height * 0.2);
  const top = height - FENCE.bar.spear - 6;
  const n = Math.max(2, Math.ceil((top - low) / FENCE.railSpan) + 1);
  return Array.from({ length: n }, (_, i) => low + ((top - low) * i) / (n - 1));
}

/** Shared look of the stone posts: dressed blocks with mortar lines, no stipple (it would repeat on every post). */
function stoneStyles(materials: SceneMaterials) {
  const stone = role(materials, 'stone');
  const mortar = role(materials, 'mortar').ramp;
  const line = STROKES.detail.with({ color: mortar.base, width: 0.9 });
  const edge = STROKES.detail.with({ color: alpha(mortar.dark, 0.7), width: 0.6 });
  const plain: VolumeStyle = { ramp: stone.ramp, stroke: line, edge };
  const cap: VolumeStyle = { ramp: { ...stone.ramp, lit: mixTone(stone.ramp.lit, stone.ramp.base, 0.3) }, stroke: line, edge };
  const foot: VolumeStyle = { ramp: { lit: mixTone(stone.ramp.lit, stone.ramp.dark, 0.3), base: mixTone(stone.ramp.base, stone.ramp.dark, 0.3), dark: stone.ramp.dark }, stroke: line, edge };
  return { plain, cap, foot };
}
type StoneStyles = ReturnType<typeof stoneStyles>;

/** Thin metal and wood parts: the line is as fine as the part, the contour does the outlining. */
const thin = (m: VolumeStyle, width = 0.35): VolumeStyle => ({ ...m, texture: undefined, stroke: STROKES.detail.with({ color: alpha(m.ramp.dark, 0.9), width }), edge: undefined });

/**
 * A square stone post standing on the frame: footing, shaft with a course line every so often, cap and, optionally, a
 * stone ball. Returns the shaft and the height of the post's top.
 */
function stonePost(object: StageObject, g: Frame3, s: StoneStyles, o: { half: number; shaft: number; ball?: boolean }): { shaft: Solid; top: number } {
  const h = o.half;
  const foot = 3.5;
  object.add(boxAt(g, -h - 1, h + 1, -h - 1, h + 1, 0, foot), s.foot);
  const shaft = boxAt(g, -h, h, -h, h, foot, o.shaft);
  object.add(shaft, s.plain);
  // Course lines round the shaft, so it reads as stacked stone: one about every two courses of a wall.
  for (let z = 30; z < o.shaft - 9; z += 30) object.add(boxAt(g, -h - 0.3, h + 0.3, -h - 0.3, h + 0.3, z, z + 1.3), s.foot);
  const capH = 1.6 + h * 0.4;
  object.add(boxAt(g, -h - 1.2, h + 1.2, -h - 1.2, h + 1.2, o.shaft, o.shaft + capH), s.cap);
  const r = h * 0.75;
  if (o.ball) object.add(Round.ellipsoid(g.moved(0, 0, o.shaft + capH + r * 0.9), r, r, r), s.cap);
  return { shaft, top: o.shaft + capH + (o.ball ? r * 1.9 : 0) };
}

/** Ground shadow of a post and a thin one along its arms, a little towards the far side of the light; it grows with the fence's height. */
function fenceShadow(ctx: PieceContext, arms: Run[], half: number, height: number): void {
  const o = ctx.frame.origin;
  const w = 1.4 + 0.03 * height;
  const post = groundShadow(ctx.camera, vec3(o.x + 1.2 + height * 0.01, o.y - 0.6, 0), half + 2 + height * 0.03, half + 1.2 + height * 0.02);
  const strips = arms.map(a => (a.axis === 'x' ? groundPatch(ctx.camera, o, a.from, a.to, -0.4 * w, 0.6 * w) : groundPatch(ctx.camera, o, 0.2, 0.2 + w, a.from, a.to)));
  ctx.ground.custom(o, c => {
    post.fill(c, castShadow(0.3));
    for (const s of strips) s.fill(c, castShadow(0.22));
  });
}

/** The arms a mask asks for: extents along the run from the post to the cell's border. */
function armsOf(ctx: PieceContext, postHalfWidth: number): Run[] {
  const { x: cx, y: cy } = ctx.grid.cell;
  const m = ctx.mask;
  const out: Run[] = [];
  if (m & EDGE.W) out.push({ axis: 'x', sign: -1, from: -cx / 2, to: -postHalfWidth, pitch: cx / 2 });
  if (m & EDGE.E) out.push({ axis: 'x', sign: 1, from: postHalfWidth, to: cx / 2, pitch: cx / 2 });
  if (m & EDGE.N) out.push({ axis: 'y', sign: -1, from: -cy / 2, to: -postHalfWidth, pitch: cy / 2 });
  if (m & EDGE.S) out.push({ axis: 'y', sign: 1, from: postHalfWidth, to: cy / 2, pitch: cy / 2 });
  return out;
}

/** How far a rail runs past the cell's border: its end line then falls outside the cut, so rails of neighbouring cells meet without a joint mark. */
const RAIL_OVER = 0.35;

/** The extent of a rail along an arm, from the post to just past the cell's border. */
function railSpan(a: Run): [number, number] {
  return [Math.min(a.from, a.to) - (a.sign < 0 ? RAIL_OVER : 0), Math.max(a.from, a.to) + (a.sign > 0 ? RAIL_OVER : 0)];
}

/**
 * Positions of the bars of an arm along the run, on the lattice of `FENCE.barsPerEdge` to a cell edge counted back from
 * the cell's border: the same spacing on both sides of a border and across a post. Bars never reach the
 * post (`room` px clear of its shaft).
 */
function barPositions(arm: Run, postHalfWidth: number, room = 2.4, perEdge: number = FENCE.barsPerEdge): number[] {
  const step = arm.pitch / (perEdge / 2);
  const out: number[] = [];
  for (let k = 0; ; k++) {
    const u = arm.sign * (arm.pitch - step / 2 - k * step);
    if (Math.abs(u) < postHalfWidth + room) break;
    out.push(u);
  }
  return out;
}

// ----------------------------------------------------------------------------------------------
// Iron fence
// ----------------------------------------------------------------------------------------------

/** The iron fence's options. Its height is not one: it comes from the catalog's `heights` through `ctx.height`. */
export interface IronFenceOptions {
  spikes: boolean;
}

/** Iron fence: a stone post at every vertex and spiked bars between rails towards each connected edge. */
export const ironFence: ScenePiece<IronFenceOptions> = (ctx, o) => {
  const metal = thin(role(ctx.materials, 'metal'));
  const stone = stoneStyles(ctx.materials);
  const rng = pieceRng(ctx);
  const H = ctx.height ?? SPACE.scale.fence;
  const half = postHalf(H);
  const arms = armsOf(ctx, half);
  const { radius, spear, spearRadius } = FENCE.bar;
  const rails = railLevels(H);
  const topRail = rails[rails.length - 1];
  // Where the bars end under their spearheads.
  const barTop = o.spikes ? H - spear : H;
  // Variant 1: one bar gone and the rest of its arm bent, spikes broken, all inside the cell.
  const hurt = ctx.variant === 1 && arms.length ? { arm: rng.int(0, arms.length - 1), gone: rng.int(0, 1), side: rng.boolean() ? 1 : -1 } : undefined;
  // Variant 3: a single bar leaning along the run (towards the post for the outermost one, so its tip stays in the cell).
  const lone = ctx.variant === 3 && arms.length ? (() => {
    const arm = rng.int(0, arms.length - 1);
    return { arm, bar: rng.int(0, barPositions(arms[arm], half).length - 1), lean: rng.boolean() ? 1 : -1 };
  })() : undefined;

  // The bars' tips are the run's top at the north border (the posts, at the pivot, stand below the cut line).
  ctx.seam(H);
  const { object } = ctx;
  fenceShadow(ctx, arms, half, H);
  const { shaft, top: postTop } = stonePost(object, runFrame(ctx, 'x'), stone, { half, shaft: H + 3, ball: true });
  // The ward burned into the post of an undamaged fence (an arm towards the camera would hide it, leaving bits of glow between the bars).
  if (ctx.variant === 0 && !(ctx.mask & EDGE.S)) object.add(Decal.onFace(Frame3.facing(ctx.frame.origin, Math.PI / 2), 'front', vec3(half, 0, Math.min(H * 0.5, postTop * 0.52)), runeShape().scale(1.25)), soulMark(role(ctx.materials, 'glow')), { on: shaft });
  arms.forEach((a, ai) => {
    const f = runFrame(ctx, a.axis);
    const [lo, hi] = railSpan(a);
    // Rails, behind the bars.
    for (const z of rails) object.add(boxRun(f, lo, hi, -1.7, 0.1, z, z + FENCE.rail.height), metal);
    barPositions(a, half).forEach((u, bi) => {
      const own = hurt?.arm === ai;
      if (own && bi === hurt.gone) return;
      const bend = H - topRail;
      if (lone?.arm === ai && lone.bar === bi) {
        // The bent bar: straight to the upper rail, then leaning along the run with its spike broken off.
        const lean = bi === 0 ? -a.sign : lone.lean;
        object.add(Round.cylinder(f.moved(u, 0.5, 1.2), radius, topRail - 1.2), metal);
        object.add(new Tube([f.at(u, 0.5, topRail), f.at(u + lean * 1.8, 0.5, topRail + bend * 0.55), f.at(u + lean * 4, 0.5, H - 0.5)], { start: radius * 2, end: radius * 1.1 }), metal);
        return;
      }
      if (own && bi !== hurt.gone) {
        // The bent bar: straight to the upper rail, then leaning over with its spike broken off.
        object.add(Round.cylinder(f.moved(u, 0.5, 1.2), radius, topRail - 1.2), metal);
        // It leans away from the border (towards the post), so its tip never reaches the cut.
        object.add(new Tube([f.at(u, 0.5, topRail), f.at(u - a.sign * 0.5, 0.5 + hurt.side * 1.6, topRail + bend * 0.55), f.at(u - a.sign * 1.5, 0.5 + hurt.side * 4.4, H - 0.5)], { start: radius * 2, end: radius * 1.1 }), metal);
        return;
      }
      // A bar is a round rod with a spearhead.
      object.add(Round.cylinder(f.moved(u, 0.5, 1.2), radius, barTop - 1.2), metal);
      if (o.spikes) object.add(Round.cylinder(f.moved(u, 0.5, barTop), spearRadius, spear, 0.1), metal);
    });
  });
};

// ----------------------------------------------------------------------------------------------
// Iron gate
// ----------------------------------------------------------------------------------------------

/**
 * The iron gate is a DOOR (guide 05), not a run of fence: it stands on the cell edge between two vertices of an iron fence,
 * the fence's runs end in their posts at its edge, and it is drawn by `layoutScene` at the middle of the edge, facing across it
 * (S on a north edge, E on a west edge). The gate adds what a gate needs: two stone pillars just inside the fence's end posts,
 * taller than the fence, and two iron leaves hung on them that swing towards the way the gate faces (into the yard), up to
 * square with the fence (`IRON_GATE_OPEN`). The soul lantern burns on the pillar at the observer's right, and flares as the
 * gate is opened or slammed. The motion helpers are the crypt door's (`doors.ts`).
 */

/** Degrees the gate's leaves rest at once open: square with the fence. */
export const IRON_GATE_OPEN = 90;

/**
 * The key tables of the gate's clips, in frames (the leaf on the observer's left, `left`, leads; `right` is a frame behind and
 * the rebate leaf). `opening` (8): the leaves ease off their latch (4°, 1°), swing with gathering speed, strike past square
 * (100°, 98°) as the iron rings and settle at 90°; the lantern flares as the gate gives. `closing` (8): a small lift, a fall
 * with gathering speed, the left leaf clangs shut on frame 5 and rebounds, the right one shuts a frame later, the lantern
 * flares on the clang. The last key of each is the resting pose it ends in.
 */
export const IRON_GATE_TRACKS = {
  opening: {
    left: [[0, 0], [1, 4], [2, 30], [3, 66], [4, 92], [5, 100], [6, 93], [7, IRON_GATE_OPEN]],
    right: [[0, 0], [1, 1], [2, 14], [3, 48], [4, 80], [5, 98], [6, 96], [7, IRON_GATE_OPEN]],
    flare: [[0, 1], [1, 1.15], [2, 1.45], [3, 1.35], [4, 1.2], [5, 1.1], [6, 1.04], [7, 1]],
  },
  closing: {
    left: [[0, IRON_GATE_OPEN], [1, 92], [2, 76], [3, 46], [4, 18], [5, 0], [6, 3], [7, 0]],
    right: [[0, IRON_GATE_OPEN], [1, 91], [2, 82], [3, 56], [4, 28], [5, 7], [6, 0], [7, 0]],
    flare: [[0, 1], [1, 1], [2, 1.05], [3, 1.15], [4, 1.3], [5, 1.5], [6, 1.2], [7, 1]],
  },
} as const satisfies Record<string, Channels>;

/** The gate's clips: `open` fires on the first frame both leaves stand past 70°, `shut` on the first both are within 8° of the fence. */
export const IRON_GATE_CLIPS = {
  opening: { frames: 8, fps: 10, from: 'closed', to: 'open', events: [{ frame: firstFrame(8, f => Math.min(track(f, IRON_GATE_TRACKS.opening.left), track(f, IRON_GATE_TRACKS.opening.right)) >= 70), name: 'open' }] },
  closing: { frames: 8, fps: 10, from: 'open', to: 'closed', events: [{ frame: firstFrame(8, f => Math.max(track(f, IRON_GATE_TRACKS.closing.left), track(f, IRON_GATE_TRACKS.closing.right)) <= 8), name: 'shut' }] },
} as const satisfies Record<string, PieceClip>;

/** Half side of the gate's stone pillars. */
const GATE_PILLAR = 3;

/** The top of the gate: the lantern on its pillar (the pillar's shaft stands 6 above the leaves' tips, a cap and the lantern's 15.5 on it). `height` of its catalog entry. */
export const IRON_GATE_TOP = Math.round((SPACE.scale.door + 6 + 1.6 + GATE_PILLAR * 0.4 + 15.5) * 10) / 10;

/** Cell and pivot of the gate's sheets: room above for the pillars' lantern and below for the leaves' reach. */
export const IRON_GATE_CELL = { width: 96, height: 160, pivot: { x: 48, y: 124 } };

/** The gate's options. Its pillars and leaves are built to the door's height (`SPACE.scale.door`). */
export interface IronGateOptions {
  /** The soul-fire lantern on the right-hand pillar (off: a stone ball like the other one). */
  lantern: boolean;
}

/** Plan of the gate in world units: a stone pillar's half side, and how far the leaves' hinge pins sit inside their pillar's face. */
const GATE = { pillar: GATE_PILLAR, pin: 1, gap: 0.15 } as const;

/**
 * One leaf of the gate, built as if shut in the frame `L` of `leafFrame`: from `from` (the pillar's face) to `to` along it, a
 * hinge stile, a free stile that stands a little taller, a rail at every level a fence of this height has and round bars with
 * spearheads between them, and a hinge eye on the stile at the lowest and highest rails.
 */
function gateLeaf(object: StageObject, L: Frame3, metal: VolumeStyle, o: { from: number; to: number; height: number }): void {
  const { spear, spearRadius } = FENCE.bar;
  const { height: H } = o;
  const len = o.to - o.from;
  const stile = (s: number, top: number) => object.add(Round.cylinder(L.moved(0, s, 1), 1.25, top - 1), metal);
  stile(o.from + 1.25, H);
  stile(o.to - 1.25, H + 3);
  const rails = railLevels(H);
  for (const z of rails) object.add(box(L, -FENCE.rail.thick / 2, FENCE.rail.thick / 2, o.from, o.to, z, z + FENCE.rail.height), metal);
  for (const z of [rails[0], rails[rails.length - 1]]) object.add(Round.cylinder(L.moved(0, o.from + 1.25, z - 0.4), 1.9, FENCE.rail.height + 0.8), metal);
  // One bar to a 13-wide leaf: the pitch (about 5) stays near the fence's own (6.4), so the gate reads as open work, not a solid slab.
  const n = Math.max(1, Math.floor((len - 2.5) / 5.4));
  for (let i = 1; i <= n; i++) {
    const s = o.from + 1.25 + ((len - 2.5) * i) / (n + 1);
    object.add(Round.cylinder(L.moved(0, s, 1.2), 0.85, H - spear - 1.2), metal);
    object.add(Round.cylinder(L.moved(0, s, H - spear), spearRadius * 0.9, spear, 0.1), metal);
  }
}

/** The soul-fire lantern on a pillar's cap: an iron cage with a burning core, a peaked cap and a ring. `flare` swells the flame and its halo (1 as drawn at rest). */
function lantern(object: StageObject, g: Frame3, metal: VolumeStyle, glow: VolumeStyle, z: number, flare = 1): number {
  const h = 3.2;
  object.add(boxAt(g, -h - 0.9, h + 0.9, -h - 0.9, h + 0.9, z, z + 1.8), metal);
  const flameAt = g.at(0, 0, z + 5.6);
  object.custom(flameAt, (c, cam) => glowFlame(c, glow, cam.project(flameAt), 2.5 * (0.88 + 0.12 * flare), Math.min(1, 0.95 * flare)));
  for (const [x, y] of [[-h, -h], [h, -h], [-h, h], [h, h]]) object.add(Round.cylinder(g.moved(x, y, z + 1.8), 0.7, 7.8), metal);
  object.add(Round.cylinder(g.moved(0, 0, z + 9.6), 5.2, 4, 0.3), metal);
  object.add(Round.ellipsoid(g.moved(0, 0, z + 14.2), 1.3, 1.3, 1.3), metal);
  return z + 15.5;
}

/**
 * Iron gate (a door): two stone pillars inside the fence's end posts, two iron leaves hung on them, the soul lantern on one
 * pillar. Shut, the leaves meet in the middle (a hairline apart); open, they stand square to the fence on the facing side,
 * seen from the camera as two slim grilles with their spearheads showing (a gate on a north edge) or as two grilles lying out
 * across the floor (a gate on a west edge). The pillars are built where the fence's own posts end (`doorSpan`), so nothing of
 * the gate lies over a post, and the lantern is the one soul accent of the gate: it is the same lit state open or shut.
 */
export const ironGate: ScenePiece<IronGateOptions> = (ctx, o) => {
  const g = ctx.frame;
  const span = doorSpan(ctx);
  const pose = poseOf(ctx, IRON_GATE_TRACKS);
  const metal = thin(role(ctx.materials, 'metal'));
  const glow = role(ctx.materials, 'glow');
  const stone = stoneStyles(ctx.materials);
  const { object } = ctx;
  const H = SPACE.scale.door;
  const half = GATE.pillar;
  // The fence's end post (with its footing and cap) stops at `post` from its vertex; the pillar stands against it, inside.
  const post = postHalf(SPACE.scale.fence) + 1.2;
  const centre = span.half - post - 0.2 - half;
  const inner = centre - half;
  const shaft = H + 6;

  // Pillars: a stone ball on the left-hand one and, on the right-hand one, the lantern.
  const lit = o.lantern;
  let top = 0;
  for (const side of [-1, 1] as const) {
    const pg = g.moved(0, side * centre, 0);
    const burning = lit && side > 0;
    const built = stonePost(object, pg, stone, { half, shaft, ball: !burning });
    top = Math.max(top, built.top);
    if (burning) top = Math.max(top, lantern(object, pg, metal, glow, built.top, pose.flare));
  }

  // The leaves: hinged just inside the pillars' faces (the pin a little in, so a leaf turns clear of its pillar) and meeting in the middle.
  const pin = GATE.pin;
  const reach = inner - GATE.gap;
  const leafFrom = -pin;
  const leafTo = reach - pin;
  const leaves = [
    { L: leafFrame(g, { f: 0, s: -inner + pin }, pose.left), angle: pose.left },
    { L: leafFrame(g, { f: 0, s: inner - pin }, pose.right, true), angle: pose.right },
  ];
  for (const { L, angle } of leaves) {
    gateLeaf(object, L, metal, { from: leafFrom, to: leafTo, height: H });
    leafShadow(ctx, L, { x0: leafFrom, length: leafTo - leafFrom, thick: 1.8 }, 0.18 + 0.06 * Math.min(1, angle / IRON_GATE_OPEN));
  }

  // Floor marks: the pillars' shadows, and the lantern's faint pool of light on the ground beside its pillar.
  const world = (side: number) => g.at(0, side * centre, 0);
  const shadows = [-1, 1].map(side => groundShadow(ctx.camera, vec3(world(side).x + 1.4, world(side).y - 0.6, 0), half + 2 + shaft * 0.03, half + 1.2 + shaft * 0.02));
  ctx.ground.custom(g.origin, c => {
    for (const s of shadows) s.fill(c, castShadow(0.3));
  });
  if (lit) floorGlow(ctx.ground, vec3(world(1).x, world(1).y + 2, 0), { radius: 20, color: glow.ramp.base, strength: 0.1 * pose.flare });
  void top;
};

// ----------------------------------------------------------------------------------------------
// Wooden fence
// ----------------------------------------------------------------------------------------------

/** The wooden fence's options. Its height is not one: it comes from the catalog's `heights` through `ctx.height`. */
export type WoodFenceOptions = Record<string, never>;

/** Wooden fence: weathered pickets nailed to two rails between posts, some snapped and, in variant 1, one gone. */
export const woodFence: ScenePiece<WoodFenceOptions> = ctx => {
  const wood = role(ctx.materials, 'wood');
  const plank = thin(wood, 0.5);
  const post = thin(wood, 0.6);
  const grain = [plank, thin({ ...wood, ramp: { lit: mixTone(wood.ramp.lit, wood.ramp.base, 0.5), base: mixTone(wood.ramp.base, wood.ramp.lit, 0.25), dark: wood.ramp.dark } }, 0.5), thin({ ...wood, ramp: { lit: wood.ramp.base, base: mixTone(wood.ramp.base, wood.ramp.dark, 0.35), dark: wood.ramp.dark } }, 0.5)];
  // Rails sit in shade behind the pickets: a darker timber, so the pickets stand out from them.
  const rail = thin({ ...wood, ramp: { lit: wood.ramp.base, base: mixTone(wood.ramp.base, wood.ramp.dark, 0.55), dark: wood.ramp.dark } }, 0.5);
  const rng = pieceRng(ctx);
  const { post: half, picket: w, thick, head, perEdge } = FENCE.wood;
  const arms = armsOf(ctx, half);
  const H = ctx.height ?? SPACE.scale.fence;
  const postTop = H + 4;
  // Pickets leave room for the post: a picket's half width plus a little more than the gap between pickets.
  const room = w + 1;
  const barsOf = (a: Run) => barPositions(a, half, room, perEdge);
  // Which picket of which arm is missing or snapped: chosen up front so the draw order never changes it.
  // Variant 2 has pickets of uneven height (`tall`) and, since it is the plain look, nothing missing and no rune.
  const plan = arms.map(a => barsOf(a).map(() => ({ tone: rng.int(0, grain.length - 1), snap: rng.boolean(ctx.variant === 1 ? 0.3 : ctx.variant === 2 ? 0.07 : 0.18), cut: rng.float(0.5, 0.8), lean: rng.float(-0.4, 0.4), gone: false, tall: ctx.variant === 2 ? rng.float(0.82, 1) : undefined })));
  if (ctx.variant === 1 && plan.length) {
    const a = plan[rng.int(0, plan.length - 1)];
    if (a.length) a[rng.int(0, a.length - 1)].gone = true;
  }

  // The picket heads are the run's top at the north border (the post stands at the pivot, below the cut line).
  ctx.seam(H);
  const { object } = ctx;
  fenceShadow(ctx, arms, half, H);
  const g = Frame3.facing(ctx.frame.origin, 0);
  const front = Frame3.facing(ctx.frame.origin, Math.PI / 2);
  // The post: a square timber with a flat cap.
  const shaft = boxAt(g, -half, half, -half, half, 0, postTop);
  object.add(shaft, post);
  if (ctx.variant === 0 && !(ctx.mask & EDGE.S)) object.add(Decal.onFace(front, 'front', vec3(half, 0, postTop * 0.5), runeShape().scale(1.25)), soulMark(role(ctx.materials, 'glow')), { on: shaft });
  object.add(boxAt(g, -half - 0.9, half + 0.9, -half - 0.9, half + 0.9, postTop, postTop + 2), grain[2]);
  // Rails at the iron fence's levels, so the two fences meet rail to rail where one gives out into the other.
  const railZ = railLevels(H);
  arms.forEach((a, ai) => {
    const f = runFrame(ctx, a.axis);
    const [lo, hi] = railSpan(a);
    // Two rails behind the pickets.
    for (const z of railZ) object.add(boxRun(f, lo, hi, -3.2, -1.2, z, z + 3), rail);
    barsOf(a).forEach((u, bi) => {
      const p = plan[ai][bi];
      if (p.gone) return;
      const h = H * (p.snap ? p.cut : p.tall ?? 1 - 0.05 * (bi % 2));
      // A picket: a plank with a pointed head; a snapped one ends in a jagged break.
      const profile = p.snap
        ? [{ x: -w, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0.6, y: h + 2 }, { x: -0.3, y: h - 0.5 }, { x: -w, y: h + 1 }]
        : [{ x: -w, y: 0 }, { x: w, y: 0 }, { x: w, y: h - head }, { x: 0, y: h }, { x: -w, y: h - head }];
      // A picket leans a little, never towards the border where it would touch the cut: the outermost one only leans towards the post.
      const lean = (bi === 0 ? -a.sign * Math.abs(p.lean) : p.lean) * 0.4;
      const picket = Solid.extrude(f.moved(u + lean, -thick / 2 - 0.2, 0).profile('side'), Polygon.fromPoints(profile), thick);
      object.add(picket, grain[p.tone]);
      // Nails where the picket crosses the rails, and a dark grain line down its face (seen on arms that face the camera).
      if (a.axis === 'x') {
        const px = u + lean;
        for (const z of railZ) object.add(Decal.onFace(front, 'front', vec3(thick / 2 - 0.2, -px, z + 1.5), Polygon.circle(0.45, { segments: 8 })), { fill: alpha(wood.ramp.lit, 0.9) }, { on: picket });
        if (p.snap || p.tone === 2) object.add(Decal.onFace(front, 'front', vec3(thick / 2 - 0.2, -px + 0.5, h * 0.5), Polygon.rect(0.4, h * 0.55)), { fill: alpha(wood.ramp.dark, 0.7) }, { on: picket });
      }
    });
  });
};
