/**
 * The dead tree of the graveyard kit: a gnarled trunk on spreading roots, limbs that fork and kink, bare
 * twigs, a hollow in the bark where two soul lights burn. 2 × 2 cells and tall (two and a half characters),
 * a real tree and not a sapling, so it breaks the horizon of a set.
 *
 * The tree is built at a design size (a trunk 48 to the fork, a crown about 100 high) in world units from its
 * pivot, then every point goes through `S`, which scales it from the pivot to the tree's nominal height
 * (`PROP_HEIGHT.tree` of the character). Tube widths and flat drawings scale by `TW`, a little less than the
 * height so a taller tree is not a clumsier one.
 *
 * The trunk, its roots and its main limbs are one `Blob`: one outline and one set of form bands over a
 * mass that forks without seams. Forks, twigs and the broken stub are separate tubes, thinner as they go and
 * without an inner line below about three line widths, so the ink never swamps them. Every number comes from
 * the frame's own seed (`pieceRng(ctx)`: it belongs to the piece and the variant, not to the cell), so a variant
 * is always the same tree and the three variants are three different trees, in a scene as on the sheet.
 */

import { Path, Polygon, alpha, type Point } from '@core/draw';
import type { Rng } from '@core';
import { Blob, Round, Tube, pieceRng, vec3, type ScenePiece, type Vec3, type VolumeStyle } from '@core/volume';
import { RAMPS, STROKES } from '../theme';
import { blob, hairline, mixTone, role, worldFrame } from './util';
import { contactShadow, scaleTo, toned } from './prop-parts';

/** Cell and pivot of the tree's sheet: room for the crown and its reach to either side, the roots and the shadow below. */
export const TREE_CELL = { width: 240, height: 240, pivot: { x: 120, y: 198 } };

/** The crown of the tree as designed stands about this high (trunk 48, leader and limbs above it). */
const TREE_DESIGN_TOP = 95;
/** Height of the trunk to the fork, as designed. */
const TRUNK_DESIGN = 48;
/** Scale from the design to the tree's nominal height (two and a half characters): positions and lengths. */
const TK = scaleTo('tree', TREE_DESIGN_TOP);
/** Scale of tube widths and flat drawings: a little less than `TK`, so a big tree keeps fine twigs. */
const TW = Math.pow(TK, 0.95);
/** A point of the design, scaled from the pivot (the tree is built around world 0, 0, 0). */
const S = (p: Vec3): Vec3 => vec3(p.x * TK, p.y * TK, p.z * TK);

/** The trunk's height to the fork in world units: the option's default and the range an editor can sweep (0.7 to 1.25 of it). */
export const TREE_TRUNK = { default: Math.round(TRUNK_DESIGN * TK), min: Math.round(TRUNK_DESIGN * TK * 0.7), max: Math.round(TRUNK_DESIGN * TK * 1.25) };

/** The dead tree's options. */
export interface DeadTreeOptions {
  /** Height of the trunk before it forks, world units. */
  trunk: number;
  /** The hollow in the bark with its two soul lights. */
  hollow: boolean;
  /** Moss at the foot of the trunk. */
  moss: boolean;
}

/** A direction from a yaw (in the floor plane, 0 = right, π/2 = towards the camera) and an elevation above it. */
const dirOf = (yaw: number, lift: number): Vec3 => vec3(Math.cos(lift) * Math.cos(yaw), Math.cos(lift) * Math.sin(yaw), Math.sin(lift));

const along = (p: Vec3, d: Vec3, len: number): Vec3 => vec3(p.x + d.x * len, p.y + d.y * len, p.z + d.z * len);

/** The points of a limb: `steps` segments from `from`, each bent a little off the last, as a gnarled branch is. */
function limbPoints(rng: Rng, from: Vec3, yaw: number, lift: number, length: number, steps: number, kink: number): { points: Vec3[]; yaws: number[]; lifts: number[] } {
  const points = [from];
  const yaws = [yaw];
  const lifts = [lift];
  let y = yaw;
  let l = lift;
  for (let i = 0; i < steps; i++) {
    y += rng.float(-kink, kink);
    l = Math.max(0.12, Math.min(1.4, l + rng.float(-kink * 0.8, kink * 0.55)));
    points.push(along(points[points.length - 1], dirOf(y, l), (length / steps) * rng.float(0.85, 1.15)));
    yaws.push(y);
    lifts.push(l);
  }
  return { points, yaws, lifts };
}

/**
 * Dead tree: a trunk that twists as it rises and forks into bare limbs, roots gripping the ground, a broken
 * stub, bark fissures, moss at the foot and a hollow with two soul lights. Round and the same from every
 * side, so one facing; three variants are three different trees.
 */
export const deadTree: ScenePiece<DeadTreeOptions> = (ctx, o) => {
  const { object: parts, ground } = ctx;
  const wood = role(ctx.materials, 'wood');
  const mossRole = role(ctx.materials, 'moss');
  const glow = role(ctx.materials, 'glow');
  // The variant is a look: the frame's seed gives every placement of it the same tree.
  const rng = pieceRng(ctx);
  const g = worldFrame(ctx);
  const cam = ctx.camera;
  const bark = toned(wood, -0.1);
  // Thin parts take a line as fine as they are; the contour does the outlining.
  const fine = (m: VolumeStyle, width: number): VolumeStyle => ({ ...m, texture: undefined, stroke: STROKES.detail.with({ color: alpha(m.ramp.dark, 0.9), width }), edge: undefined });
  const bare: VolumeStyle = { ramp: bark.ramp, form: { highlight: { ratio: 0.2, min: 0.4, max: 0.8 }, core: { ratio: 0.3, min: 0.6, max: 1.6 } } };

  // The floor: the tree's shadow falls to the right (the light is upper left), and a few patches of moss between the roots.
  contactShadow(ctx, 21 * TK, 14 * TK, { at: vec3(g.origin.x + 4 * TK, g.origin.y + 2.5 * TK, 0) });
  if (o.moss) {
    for (let i = 0; i < 5; i++) {
      const a = rng.float(0, Math.PI * 2);
      const at = S(g.at(Math.cos(a) * rng.float(9, 17), Math.sin(a) * rng.float(8, 13), 0));
      const patch = { rx: rng.float(2, 3.6) * TW, ry: rng.float(1.2, 2) * TW, seed: rng.int(1, 999) };
      ground.custom(at, (c, v) => {
        const p = v.project(at);
        blob(p.x, p.y, patch.rx, patch.ry, patch.seed, 0, 0.3).fill(c, alpha(mossRole.ramp.base, 0.9));
      }, { bias: 2 });
    }
  }

  // The trunk: a spine that wanders as it rises, wide at the foot and slimmer at the fork. The option is in world
  // units; everything below is built at the design size.
  const trunkH = o.trunk / TK;
  const phase = rng.float(0, 6);
  const lean = vec3(rng.float(-0.06, 0.06), rng.float(-0.02, 0.02), 0);
  const spine = [0, 0.18, 0.4, 0.62, 0.82, 1].map(t => {
    const z = trunkH * t;
    return g.at(Math.sin(phase + z * 0.1) * 3.4 + lean.x * z, Math.sin(phase * 1.7 + z * 0.08) * 2.4 + lean.y * z, z);
  });
  const trunkWidth = (t: number) => (6.4 + 8 * Math.pow(1 - t, 2.6)) * TW;
  const massParts: (Round | Tube)[] = [new Tube(spine.map(S), trunkWidth)];

  // Roots gripping the ground: from the foot out and down, thinning, some bowed.
  const roots = 4;
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + rng.float(-0.35, 0.35);
    const reach = rng.float(12, 19);
    const base = g.at(Math.cos(a) * 2.2, Math.sin(a) * 2.2, rng.float(6, 9));
    const mid = g.at(Math.cos(a + 0.2) * reach * 0.5, Math.sin(a + 0.2) * reach * 0.5, 2.2);
    const tip = g.at(Math.cos(a + rng.float(-0.35, 0.35)) * reach, Math.sin(a + rng.float(-0.2, 0.2)) * reach * 0.9, 0.4);
    massParts.push(new Tube([base, mid, tip].map(S), { start: 6.2 * TW, end: 1 * TW }));
  }

  // Limbs: the leader carries on up, the others spread round it, each kinked and forked.
  const top = spine[spine.length - 1];
  const limbCount = 5;
  const spread = rng.float(0, Math.PI * 2);
  const forks: { points: Vec3[]; width: number }[] = [];
  for (let i = 0; i < limbCount; i++) {
    const leader = i === 0;
    const yaw = leader ? spread : spread + ((i - 0.5) / (limbCount - 1)) * Math.PI * 2 + rng.float(-0.3, 0.3);
    const lift = leader ? rng.float(1.2, 1.35) : rng.float(0.62, 1.05);
    const length = leader ? rng.float(38, 48) : rng.float(30, 44);
    const start = i === 0 ? top : along(spine[spine.length - 2], dirOf(yaw, 0.5), 2);
    const { points, yaws, lifts } = limbPoints(rng, vec3(start.x, start.y, start.z - (leader ? 0 : rng.float(0, 4))), yaw, lift, length, 4, 0.7);
    massParts.push(new Tube(points.map(S), { start: (leader ? 5 : 4.4) * TW, end: 1.3 * TW }));
    // Forks: off the second and third joints, a thinner branch each, leaning to either side.
    for (const k of [1, 2, 3]) {
      if (k === 3 && rng.boolean(0.4)) continue;
      const side = rng.boolean() ? 1 : -1;
      const sub = limbPoints(rng, points[k], yaws[k] + side * rng.float(0.7, 1.2), Math.min(1.25, lifts[k] + rng.float(0.05, 0.3)), length * rng.float(0.4, 0.62), 2, 0.5);
      forks.push({ points: sub.points, width: k === 1 ? 3.0 : k === 2 ? 2.3 : 1.8 });
      // A twig off the fork, and a second one on the longer forks.
      const tw = limbPoints(rng, sub.points[1], sub.yaws[1] - side * rng.float(0.6, 1), Math.min(1.3, sub.lifts[1] + 0.2), rng.float(5, 8.5), 1, 0.4);
      forks.push({ points: tw.points, width: 1.5 });
    }
    // The tip of a limb splits in two short twigs.
    const tip = points[points.length - 1];
    for (const s of [-1, 1]) {
      const t = limbPoints(rng, tip, yaws[yaws.length - 1] + s * rng.float(0.4, 0.8), Math.min(1.3, lifts[lifts.length - 1] + rng.float(0, 0.25)), rng.float(5, 9), 1, 0.3);
      forks.push({ points: t.points, width: 1.4 });
    }
  }
  // A broken stub low on the trunk, with its pale cut end.
  const stubYaw = rng.float(0, Math.PI * 2);
  const stubFrom = spine[2];
  const stubTo = along(stubFrom, dirOf(stubYaw, 0.35), 8.5);
  massParts.push(new Tube([stubFrom, along(stubFrom, dirOf(stubYaw, 0.4), 4.2), stubTo].map(S), { start: 4.2 * TW, end: 2.6 * TW }));
  const trunk = new Blob(massParts);
  parts.add(trunk, bark);
  // The cut end of the stub: a pale ring of fresher wood.
  const stubEnd = S(stubTo);
  parts.custom(stubEnd, (c, v) => {
    const p = v.project(stubEnd);
    Polygon.ellipse(1.7 * TW, 1.25 * TW, { cx: p.x, cy: p.y, segments: 14 }).fill(c, mixTone(bark.ramp.lit, bark.ramp.base, 0.1));
    Polygon.ellipse(0.8 * TW, 0.55 * TW, { cx: p.x, cy: p.y, segments: 10 }).fill(c, bark.ramp.dark);
  }, { on: trunk });

  // Forks and twigs, thin and without an inner line.
  for (const f of forks) parts.add(new Tube(f.points.map(S), { start: f.width * TW, end: Math.max(0.9, f.width * 0.45 * TW) }), f.width > 2 ? fine(bark, 0.4) : bare, { on: trunk });

  // Bark: fissures running up the trunk's face, each with a pale lip on the lit side. Chosen up front, so the draw never changes them.
  const spineAt = (t: number) => cam.project(S(spine[Math.min(spine.length - 1, Math.round(t * (spine.length - 1)))]));
  const fissures = [-0.52, -0.2, 0.22, 0.5].map(k => {
    const t0 = rng.float(0.04, 0.16);
    const t1 = rng.float(0.5, 0.82);
    return Array.from({ length: 6 }, (_, i): Point => {
      const t = t0 + ((t1 - t0) * i) / 5;
      const p = spineAt(t);
      return { x: p.x + k * trunkWidth(t) * 0.5 + rng.float(-0.5, 0.5) * TW, y: p.y };
    });
  });
  parts.custom(S(spine[2]), c => {
    for (const pts of fissures) {
      const line = Path.spline(pts, { style: 'chiseled' });
      line.clone().translate(-0.7 * TW, 0).stroke(c, hairline(alpha(bark.ramp.lit, 0.55), 0.5));
      line.stroke(c, hairline(alpha(RAMPS.hollow.base, 0.85), 0.7));
    }
  }, { on: trunk });
  if (o.hollow) {
    const where = spine[3];
    const spot = S(vec3(where.x - 0.5, where.y + 3.4, where.z - 2));
    parts.custom(spot, (c, v) => {
      const p = v.project(spot);
      // The opening: a dark mouth with a lit lip above and a soul light in each of two pits.
      Polygon.ellipse(2.3 * TW, 3.1 * TW, { cx: p.x, cy: p.y, segments: 20 }).fill(c, RAMPS.hollow.dark);
      Polygon.ellipse(1.8 * TW, 2.6 * TW, { cx: p.x + 0.2 * TW, cy: p.y + 0.3 * TW, segments: 20 }).fill(c, RAMPS.hollow.base);
      new Path(Array.from({ length: 9 }, (_, i) => ({ x: p.x + Math.cos(Math.PI * (1.05 + 0.5 * (i / 8))) * 2.4 * TW, y: p.y + Math.sin(Math.PI * (1.05 + 0.5 * (i / 8))) * 3.2 * TW }))).stroke(c, hairline(alpha(bark.ramp.lit, 0.9), 0.8));
      for (const s of [-1, 1]) {
        const e = { x: p.x + s * 0.85 * TW, y: p.y - 0.3 * TW };
        Polygon.circle(0.95 * TW, { cx: e.x, cy: e.y, segments: 10 }).draw(c, { fill: glow.ramp.base, shadow: { color: alpha(glow.ramp.base, 0.95), x: 0, y: 0, blur: 4 * TW } });
        Polygon.circle(0.4 * TW, { cx: e.x, cy: e.y - 0.1 * TW, segments: 8 }).fill(c, glow.ramp.lit);
      }
    }, { on: trunk });
  }
  // Moss on the trunk's foot: a ragged band low on the shaded side.
  if (o.moss) {
    const foot = spine[0];
    const patches = Array.from({ length: 5 }, () => ({ dx: rng.float(-6, 6) * TW, dy: rng.float(-2.2, 2.2) * TW, rx: rng.float(1.6, 3) * TW, ry: rng.float(0.9, 1.5) * TW, seed: rng.int(1, 999) }));
    parts.custom(S(vec3(foot.x, foot.y + 5, 2)), (c, v) => {
      const p = v.project(S(vec3(foot.x, foot.y + 4, 3)));
      for (const m of patches) blob(p.x + m.dx, p.y + m.dy, m.rx, m.ry, m.seed, 0, 0.3).fill(c, alpha(mossRole.ramp.base, 0.95));
    }, { on: trunk });
  }
};
