/**
 * Props a character uses: the lever and the funerary urn (guide 05). Each rests in states and plays clips between them,
 * and says in the catalog (`nav.interact`) what a game can do with it. Like every prop of the kit each is built at a design
 * size through a scaled frame (`scaleTo`) so its top stands at its nominal height against the character (`PROP_HEIGHT`).
 *
 * How they move, in short (the shared helpers are in `motion.ts`):
 * - the lever's arm swings about an axle between two iron plates; its angle comes from a key table written in frames, with the
 *   anticipation (a pull back before the stroke), the hard stop at the end of the stroke (the `click` event, on the frame
 *   the arm meets the stop) and the rebound off it; the soul gems in the hubs glow with how far the lever has been thrown;
 * - the urn cracks and glows through its cracks, bursts on the impact frame (the `break` event) and its shards fly out on
 *   arcs and settle where the broken still has them (every shard has a start on the whole urn and a rest, and the clip
 *   only chooses how far along between the two each frame is).
 */

import { createRng } from '@core';
import { Path, Polygon, alpha, type Point, type Shape } from '@core/draw';
import { Decal, Frame3, Round, Solid, Tube, floorGlow, groundShadow, norm3, pieceRng, scale3, vec3, visibleArc, type PieceContext, type ScenePiece, type VolumeStyle } from '@core/volume';
import { PALETTES, STROKES } from '../theme';
import { contactShadow, floorShape, ringPoints, scaleTo, soulBurst, soulMotes, toned } from './prop-parts';
import { RAD, TAU, attitude, clamp01, easeOut, lerp, pitched, playhead, seg, track, type Keys } from './motion';
import { hairline, mixTone, role, runeShape, soulMark, worldFrame } from './util';

/** A crack: a dark mark in the stone or the glaze. */
const SHAPE_CRACK = { fill: alpha(PALETTES.ink, 0.7) };

// ----------------------------------------------------------------------------------------------
// Lever
// ----------------------------------------------------------------------------------------------

/** Cell and pivot of the lever's sheet: the arm reaches to one side when it is thrown, the gems' light and the shadow lie below. */
export const LEVER_CELL = { width: 64, height: 80, pivot: { x: 32, y: 58 } };

// Local sizes as designed (world units): forward, side, up.
const BASE = { plinth: { length: 22, width: 26, height: 4 }, pedestal: { length: 14, width: 18, height: 11 }, cap: { length: 17, width: 21, height: 3 } };
/** Height of the cap's top above the floor, as designed. */
const CAP_TOP = BASE.plinth.height + BASE.pedestal.height + BASE.cap.height;
/** The axle's height above the floor, and the arm's length from it to the knob's centre. */
const AXLE_Z = CAP_TOP + 7;
const ARM = 21;
/** Angle of the arm from upright, towards the lever's right (degrees): thrown back (up) and thrown over (down). */
const ARM_UP = -24;
const ARM_DOWN = 66;
/** The lever as designed stands this tall with the arm up (to the knob's top). */
const LEVER_DESIGN_TOP = AXLE_Z + ARM * Math.cos(ARM_UP * RAD) + 2.4;
const LV = scaleTo('lever', LEVER_DESIGN_TOP);

/** The glow of the soul gems when the arm is up (a dim ember) and when it is down (lit). */
const GEM_UP = 0.14;
const GEM_DOWN = 0.7;

/**
 * The lever's clips (the catalog's `clips`), written in frames:
 * - `pull`, 8 frames: the arm is drawn back a little (anticipation), thrown over in three strides, meets the stop on frame 5
 *   (`click`, the gems flash) and rebounds off it before it settles;
 * - `push`, 8 frames: the arm is eased off the stop, pushed back up and meets the other stop on frame 5 (`click`).
 */
export const LEVER_CLIPS = {
  pull: { frames: 8, fps: 12, from: 'up', to: 'down', events: [{ frame: 5, name: 'click' }] },
  push: { frames: 8, fps: 12, from: 'down', to: 'up', events: [{ frame: 5, name: 'click' }] },
};

const PULLING = {
  angle: [[0, ARM_UP], [1, -29], [2, -10], [3, 24], [4, 52], [5, ARM_DOWN], [6, 62.5], [7, ARM_DOWN]],
  glow: [[0, GEM_UP], [1, GEM_UP], [2, 0.2], [3, 0.35], [4, 0.55], [5, 1], [6, 0.86], [7, GEM_DOWN]],
} satisfies Record<string, Keys>;
const PUSHING = {
  angle: [[0, ARM_DOWN], [1, 62], [2, 52], [3, 20], [4, -10], [5, ARM_UP], [6, -20.5], [7, ARM_UP]],
  glow: [[0, GEM_DOWN], [1, GEM_DOWN], [2, 0.6], [3, 0.45], [4, 0.3], [5, 0.38], [6, 0.24], [7, GEM_UP]],
} satisfies Record<string, Keys>;

/** The arm's angle (degrees from upright), the gems' glow and the sparks' progress (-1 for none) in a still or a frame of a clip. */
function leverPose(ctx: PieceContext): { angle: number; glow: number; sparks: number } {
  const clip = ctx.clip;
  if (!clip) return ctx.state === 'down' ? { angle: ARM_DOWN, glow: GEM_DOWN, sparks: -1 } : { angle: ARM_UP, glow: GEM_UP, sparks: -1 };
  const x = playhead(clip);
  const keys = clip.name === 'push' ? PUSHING : PULLING;
  return { angle: track(x, keys.angle), glow: track(x, keys.glow), sparks: clip.name === 'pull' ? clip.t : -1 };
}

/** The lever's options. */
export interface LeverOptions {
  /** Strength of the pool of soul light on the floor when the gems are fully lit (0 for none). */
  glow: number;
}

/** The two-tone of a soul gem that burns at `level` (0 a cold ember, 1 blazing): its pale, saturated and dark tones. */
function gemStyle(glow: VolumeStyle, level: number): VolumeStyle {
  const k = Math.min(1, level);
  return { ...glow, ramp: { lit: mixTone(glow.ramp.base, glow.ramp.lit, k), base: mixTone(glow.ramp.dark, glow.ramp.base, k), dark: mixTone(PALETTES.hollow, glow.ramp.dark, 0.35 + 0.65 * k) } };
}

/**
 * Lever: a stone pedestal on a plinth with an iron arm that swings about an axle between two arched plates, a wooden grip and a
 * knob; a soul gem is set in the hub of each plate and glows brighter the further the arm has been thrown. Four facings (the arm
 * swings across the screen facing the camera and in depth facing east or west). Two states, `up` (arm thrown back, gems dim) and
 * `down` (arm thrown over, gems lit), and the clips `pull` and `push` between them.
 */
export const lever: ScenePiece<LeverOptions> = (ctx, o) => {
  const parts = ctx.object;
  const stone = role(ctx.materials, 'stone');
  const iron = role(ctx.materials, 'metal');
  const wood = role(ctx.materials, 'darkwood');
  const glow = role(ctx.materials, 'glow');
  const pose = leverPose(ctx);
  const f = ctx.frame.scaled(LV);
  const sized = (shape: Shape): Shape => shape.scale(LV, LV, { x: 0, y: 0 });
  const thin: VolumeStyle = { ...iron, stroke: STROKES.detail.with({ color: alpha(iron.ramp.dark, 0.9), width: 0.45 }), edge: undefined };
  const lit: VolumeStyle = { ...iron, ramp: { ...iron.ramp, base: iron.ramp.lit }, stroke: thin.stroke, edge: undefined };
  const level = pose.glow;
  contactShadow(ctx, 15 * LV, 12.6 * LV, { turned: true });
  if (o.glow > 0 && level > 0.05) floorGlow(ctx.ground, ctx.frame.origin, { radius: 30 * LV, color: glow.ramp.base, strength: o.glow * level });

  // The base: a plinth, a pedestal and a cap course a little paler and wider than the pedestal.
  const plinth = Solid.box(f, BASE.plinth.length, BASE.plinth.width, BASE.plinth.height);
  parts.add(plinth, toned(stone, 0.12));
  const pedestalF = f.moved(0, 0, BASE.plinth.height);
  const pedestal = Solid.box(pedestalF, BASE.pedestal.length, BASE.pedestal.width, BASE.pedestal.height);
  parts.add(pedestal, stone, { on: plinth });
  const capF = pedestalF.moved(0, 0, BASE.pedestal.height);
  const cap = Solid.box(capF, BASE.cap.length, BASE.cap.width, BASE.cap.height);
  parts.add(cap, toned(stone, -0.14), { on: pedestal });
  // Courses and wear on the pedestal: a mortar line round its middle and a crack down one corner, on all four faces.
  const course = sized(Polygon.rect(BASE.pedestal.width, 0.55, { cx: 0, cy: 0 }));
  const courseSide = sized(Polygon.rect(BASE.pedestal.length, 0.55, { cx: 0, cy: 0 }));
  const mid = BASE.pedestal.height * 0.5;
  const seam = { fill: alpha(PALETTES.ink, 0.5) };
  parts.add(Decal.onFace(pedestalF, 'front', vec3(BASE.pedestal.length / 2, 0, mid), course), seam, { on: pedestal });
  parts.add(Decal.onFace(pedestalF, 'back', vec3(-BASE.pedestal.length / 2, 0, mid), course), seam, { on: pedestal });
  parts.add(Decal.onFace(pedestalF, 'right', vec3(0, BASE.pedestal.width / 2, mid), courseSide), seam, { on: pedestal });
  parts.add(Decal.onFace(pedestalF, 'left', vec3(0, -BASE.pedestal.width / 2, mid), courseSide), seam, { on: pedestal });
  const crack = sized(Path.spline([{ x: 0, y: 0 }, { x: 1.3, y: 2.6 }, { x: 0.4, y: 5 }, { x: 1.8, y: 7.4 }], { style: 'chiseled' }).toShape({ width: { start: 0.9, end: 0.2 }, cap: 'round' }));
  parts.add(Decal.onFace(pedestalF, 'front', vec3(BASE.pedestal.length / 2, 5.2, 0.4), crack), SHAPE_CRACK, { on: pedestal });
  parts.add(Decal.onFace(pedestalF, 'right', vec3(-2.6, BASE.pedestal.width / 2, 4.6), crack), SHAPE_CRACK, { on: pedestal });

  // Two arched plates in the plane the arm swings in (side, up), a hand apart, with an axle through them and a hub on each.
  const plateGap = 2.3;
  const plateThick = 1.3;
  const plateProfile = Polygon.rect(15, 7, { cx: 0, cy: 3.5 }).union(Polygon.circle(7.5, { cx: 0, cy: 7, segments: 28 }));
  const acrossAt = (fw: number) => new Frame3(capF.at(fw, 0, BASE.cap.height), f.dir(0, 1, 0), f.dir(0, 0, 1), f.dir(1, 0, 0));
  const plates = [-1, 1].map(side => {
    const plate = Solid.extrude(acrossAt(side * plateGap - plateThick / 2), plateProfile, plateThick);
    parts.add(plate, iron, { on: cap });
    return { side, plate };
  });
  // Axle along forward through both plates (a cylinder whose axis is the forward axis).
  const axleF = (fw: number) => new Frame3(f.at(fw, 0, AXLE_Z), f.dir(0, 1, 0), f.dir(0, 0, 1), f.dir(1, 0, 0));
  const axle = Round.cylinder(axleF(-plateGap - 1.6), 1.05, 2 * (plateGap + 1.6));
  parts.add(axle, thin, { on: plates[0].plate });
  // Rivets on each plate's face, low on its shoulders.
  for (const { side, plate } of plates) {
    for (const x of [-5.6, 5.6]) parts.add(Round.ellipsoid(f.moved(side * (plateGap + plateThick / 2 + 0.1), x, CAP_TOP + 1.6), 0.5, 0.65, 0.65), lit, { on: plate });
  }

  // The arm: an iron bar from the axle, a wooden grip over its last third, a collar and a knob.
  const phi = pose.angle * RAD;
  const along = (d: number) => f.at(0, d * Math.sin(phi), AXLE_Z + d * Math.cos(phi));
  const arm = new Tube([along(0), along(ARM * 0.5), along(ARM)], { start: 3.1 * LV, end: 2.5 * LV });
  parts.add(arm, iron);
  const grip = new Tube([along(ARM * 0.62), along(ARM * 0.82), along(ARM * 0.97)], { start: 3.9 * LV, end: 3.5 * LV });
  parts.add(grip, wood, { on: arm });
  for (const d of [0.62, 0.97]) parts.add(Round.ellipsoid(Frame3.facing(along(ARM * d), 0), 1.9 * LV, 1.9 * LV, 1.9 * LV), lit, { on: grip });
  parts.add(Round.ellipsoid(Frame3.facing(along(ARM + 1.2), 0), 2.6 * LV, 2.6 * LV, 2.6 * LV), lit, { on: grip });
  // The stops between the plates: a short pin at each end of the stroke.
  for (const a of [ARM_UP - 9, ARM_DOWN + 8]) {
    const at = f.at(0, 6.6 * Math.sin(a * RAD), AXLE_Z + 6.6 * Math.cos(a * RAD));
    parts.add(Round.cylinder(new Frame3(vec3(at.x - f.forward.x * 2, at.y - f.forward.y * 2, at.z - f.forward.z * 2), f.dir(0, 1, 0), f.dir(0, 0, 1), f.dir(1, 0, 0)), 0.8, 4), thin, { on: plates[1].plate });
  }

  // A soul gem in the hub of each plate, in an iron bezel, with a soft halo that follows how far the arm has been thrown.
  const gemTone = gemStyle(glow, level);
  for (const { side, plate } of plates) {
    const outer = side * (plateGap + plateThick / 2);
    const bezel = Round.cylinder(new Frame3(f.at(outer, 0, AXLE_Z), f.dir(0, 1, 0), f.dir(0, 0, 1), f.dir(side, 0, 0)), 3.7, 0.9, 3.3);
    parts.add(bezel, lit, { on: plate });
    const gemAt = f.at(outer + side * 0.75, 0, AXLE_Z);
    const gem = Round.ellipsoid(new Frame3(gemAt, f.dir(0, 1, 0), f.dir(0, 0, 1), f.dir(1, 0, 0)), 2.7, 2.7, 1.5);
    parts.add(gem, gemTone, { on: bezel });
    parts.custom(gemAt, (c, v) => {
      const p = v.project(gemAt);
      const r = 10 * LV;
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, alpha(glow.ramp.lit, 0.6 * Math.min(1, level)));
      g.addColorStop(1, alpha(glow.ramp.base, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(p.x, p.y, r, 0, Math.PI * 2);
      c.fill();
    }, { on: gem });
  }

  // Sparks thrown off where the arm meets its stop (the `click`).
  if (pose.sparks >= 0) {
    const hub = f.at(0, 0, AXLE_Z + 1.5);
    parts.custom(hub, (c, v) => {
      const p = v.project(hub);
      soulMotes(c, glow, { x: p.x, y: p.y }, pose.sparks, { count: 5, height: 14 * LV, spread: 9 * LV, size: 1.3, from: 0.68, until: 0.97 });
    }, { on: plates[1].plate, bias: 300 });
  }
};


// ----------------------------------------------------------------------------------------------
// Funerary urn
// ----------------------------------------------------------------------------------------------

/** Cell and pivot of the urn's sheets: room above for the lid, the burst and the soul that escapes, around it for the shards that fly out, below for the ash. */
export const URN_CELL = { width: 64, height: 96, pivot: { x: 32, y: 70 } };

/** The urn's body as designed: `[height, radius]` from the foot ring up the belly, shoulder and neck to the lip. */
const URN_BODY: [number, number][] = [[0, 6.2], [1.2, 7.2], [2.8, 6.8], [4.4, 7.6], [8, 10.6], [12.5, 12.4], [17, 12.8], [21.5, 12], [25.5, 10], [28.5, 8.2], [30.2, 7.2], [31.8, 7], [32.8, 7.9], [33.7, 8.5], [34.4, 8.3]];
/** The lip's height: the lid sits on it. */
const URN_LIP = 34.4;
/** The lid: a shallow dome (`[height, radius]`) with a bone knob. */
const URN_LID: [number, number][] = [[0, 8.6], [0.8, 8.8], [2, 8], [3.8, 6], [5.4, 3.6], [6.6, 1.8], [7, 1]];
/** The knob sits this far above the lip. */
const URN_KNOB = 7;
/** The urn as designed stands this tall, to the top of the knob. */
const URN_DESIGN_TOP = URN_LIP + URN_KNOB + 2.4;
const UK = scaleTo('urn', URN_DESIGN_TOP);
/** Where the body is cut when it breaks: the lower belly stays standing, its top edge jagged. */
const STUMP_CUT = 9;

/** The body's radius at a height (linear between the profile's points). */
function radiusAt(h: number): number {
  for (let i = 1; i < URN_BODY.length; i++) {
    const [h1, r1] = URN_BODY[i];
    if (h <= h1) {
      const [h0, r0] = URN_BODY[i - 1];
      return lerp(r0, r1, (h - h0) / (h1 - h0));
    }
  }
  return URN_BODY[URN_BODY.length - 1][1];
}

/** What soul light still glimmers in the ash of the broken urn. */
const URN_EMBER = 0.2;

/**
 * The urn's clip (the catalog's `clips`), written in frames: it wobbles and cracks with soul light seeping out (anticipation,
 * frames 1 and 2), bursts on frame 3 (`break`: a flash and a cloud of ash, the shards at their places on the urn) and its shards fly
 * out on arcs and settle by frame 9 where the broken still has them; a wisp of soul rises out of the ash and is gone.
 */
export const URN_CLIPS = {
  break: { frames: 10, fps: 12, from: 'whole', to: 'broken', events: [{ frame: 3, name: 'break' }] },
};

/** The frame the urn bursts on, and the length of the flight that follows (frames). */
const IMPACT = 3;
const FLIGHT = 6;

const BREAKING = {
  wobble: [[0, 0], [1, 2.8], [2, -2.4], [3, 0]],
  crack: [[0, 0], [1, 0.4], [2, 1], [3, 1]],
  leak: [[0, 0], [1, 0.5], [2, 1], [3, 1]],
  inside: [[3, 1], [4, 0.9], [5, 0.7], [6, 0.5], [7, 0.36], [8, 0.26], [9, URN_EMBER]],
  flash: [[3, 1], [4, 0.5], [5, 0.18], [6, 0], [9, 0]],
} satisfies Record<string, Keys>;

/** How the urn looks in one frame. */
interface UrnPose {
  /** The urn stands whole (still or before the burst), else it is the stump and its shards. */
  whole: boolean;
  /** Tilt on its foot (degrees, across the screen). */
  wobble: number;
  /** How far the cracks have run (0 to 1) and how brightly soul light seeps through them. */
  crack: number;
  leak: number;
  /** How far the shards are along their flight (0 on the urn, 1 at rest), the ash on the floor and the glow in the stump. */
  u: number;
  inside: number;
  /** The flash of the burst (0 to 1) and the progress of the ash cloud and the soul that rises (-1 for none). */
  flash: number;
  cloud: number;
}

const POSE_WHOLE: UrnPose = { whole: true, wobble: 0, crack: 0, leak: 0, u: 0, inside: 0, flash: 0, cloud: -1 };
const POSE_BROKEN: UrnPose = { whole: false, wobble: 0, crack: 1, leak: 0, u: 1, inside: URN_EMBER, flash: 0, cloud: -1 };

function urnPose(ctx: PieceContext): UrnPose {
  const clip = ctx.clip;
  if (!clip) return ctx.state === 'broken' ? POSE_BROKEN : POSE_WHOLE;
  const x = playhead(clip);
  if (x < IMPACT) return { ...POSE_WHOLE, wobble: track(x, BREAKING.wobble), crack: track(x, BREAKING.crack), leak: track(x, BREAKING.leak) };
  const u = clamp01((x - IMPACT) / FLIGHT);
  return { whole: false, wobble: 0, crack: 1, leak: 0, u, inside: track(x, BREAKING.inside), flash: track(x, BREAKING.flash), cloud: u >= 1 ? -1 : u };
}

/** One piece of the urn that flies: a flat shard (or a chip), where it starts on the urn, where it lands, and how it gets there. */
interface Bit {
  /** Where it starts: around the urn (degrees from the side facing the camera, positive to the right) and how high. */
  ang: number;
  z: number;
  /** Outline in the plate's own plane (forward, side), and its thickness. */
  poly: [number, number][];
  thick: number;
  /** The face up when it lies: the glaze (outer face) or the raw clay (inner face). */
  look: 'glaze' | 'clay';
  /** Where it lands: on the floor (x right, y towards the camera) and how it lies (degrees). */
  x: number;
  y: number;
  yaw: number;
  pitch: number;
  roll: number;
  /** How far above its straight path it rises on the way (the arc), turns it spins and the little hop when it lands. */
  lift: number;
  turns: number;
  hop: number;
  /** Fraction of the flight it waits before it goes (heavier pieces start a little later). */
  delay: number;
  /** A glowing ward on its outer face (a piece of the urn's rune). */
  rune?: boolean;
}

/** The urn's pieces, from a fixed seed: eight shards of the body, a pair of lid halves and some chips. They are the same in every frame and every facing. */
const BITS: Bit[] = (() => {
  const rng = createRng(0x75a31);
  const out: Bit[] = [];
  const plate = (rx: number, ry: number, n: number): [number, number][] =>
    Array.from({ length: n }, (_, k) => {
      const t = ((k + rng.float(-0.22, 0.22)) / n) * TAU;
      const r = rng.float(0.7, 1);
      return [Math.cos(t) * rx * r, Math.sin(t) * ry * r] as [number, number];
    });
  const land = (ang: number, near: number, far: number) => {
    const d = (ang + rng.float(-22, 22)) * RAD;
    const r = rng.float(near, far);
    return { x: r * Math.sin(d), y: Math.min(22, r * Math.cos(d)) };
  };
  const angs = [-74, -46, -14, 14, 44, 74, -118, 128, 176];
  const zs = [20, 29, 16, 24, 19, 27, 22, 17, 25];
  angs.forEach((ang, i) => {
    const size = rng.float(0.85, 1.2);
    const look = i % 3 === 0 ? 'clay' : 'glaze';
    out.push({
      ang, z: zs[i], poly: plate(4.8 * size, 3.7 * size, 5), thick: 0.85, look, ...land(ang, Math.abs(ang) > 100 ? 16 : 18, Math.abs(ang) > 100 ? 21 : 27),
      yaw: rng.float(0, 360), pitch: rng.float(-14, 14), roll: (look === 'glaze' ? 180 : 0) + rng.float(-10, 10), lift: rng.float(14, 28), turns: i % 2 + 1, hop: rng.float(0.8, 2), delay: rng.float(0, 0.08),
      ...(i === 2 ? { rune: true } : {}),
    });
  });
  // The lid, in two halves thrown up from the top.
  for (const [ang, side] of [[-20, -1], [30, 1]] as const) {
    out.push({ ang: ang * 0.2, z: 37.5, poly: [[-6, -3 * side], [0, -5.6], [6, -3.4], [6.4, 1.2], [0, 3.2], [-6.2, 1.6]], thick: 1.1, look: 'glaze', x: side * 20, y: side * 7 - 4, yaw: rng.float(0, 360), pitch: rng.float(-8, 8), roll: 180 + rng.float(-8, 8), lift: 34, turns: 2, hop: 1.4, delay: 0 });
  }
  // Chips: small flat flakes flung every way.
  for (let i = 0; i < 6; i++) {
    const ang = -150 + i * 58 + rng.float(-10, 10);
    out.push({ ang, z: rng.float(14, 34), poly: plate(1.9, 1.5, 4), thick: 0.7, look: rng.boolean(0.4) ? 'clay' : 'glaze', ...land(ang, 14, 29), yaw: rng.float(0, 360), pitch: rng.float(-20, 20), roll: rng.float(0, 360), lift: rng.float(22, 38), turns: 2, hop: rng.float(0.6, 1.4), delay: rng.float(0, 0.05) });
  }
  return out;
})();

/** The whole crack's polylines on the front of the belly, in decal space (design units from the belly's front centre, x right, y down), and when each starts to run (0 to 1 of the crack's progress). */
const CRACKS: { from: number; points: [number, number][] }[] = [
  { from: 0, points: [[-1, -13], [1.5, -9], [-0.5, -5], [2.2, -1], [0.4, 3.5], [3, 8], [1.2, 13]] },
  { from: 0.3, points: [[-0.5, -5], [-4, -3], [-6.4, 0.5], [-9, 1.5]] },
  { from: 0.45, points: [[2.2, -1], [6, -3.4], [8.6, -2.8], [11, -5]] },
];

/** The first `fraction` of a polyline (by length), its end interpolated. */
function partial(points: [number, number][], fraction: number): [number, number][] {
  const lens = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  let left = fraction * lens.reduce((a, b) => a + b, 0);
  const out: [number, number][] = [points[0]];
  for (let i = 0; i < lens.length && left > 0; i++) {
    const k = Math.min(1, left / lens[i]);
    out.push([lerp(points[i][0], points[i + 1][0], k), lerp(points[i][1], points[i + 1][1], k)]);
    left -= lens[i];
  }
  return out;
}

/** The urn's options. */
export interface UrnOptions {
  /** Strength of the soul light that seeps through the cracks, flares in the burst and lingers in the ash (0 for none). */
  glow: number;
}

/**
 * Funerary urn: a glazed ceramic body on a foot ring, with an iron band, two iron handles, a domed lid with a bone knob and a
 * soul ward burned into its belly. It rests whole (state `whole`) or broken (`broken`): the lower belly standing with a jagged
 * edge, ash and a glint of soul in it, the shards lying round it (some glaze up, some raw clay) and the ward in pieces. The clip
 * `break` goes from one to the other: the urn wobbles and cracks with soul light seeping through (frames 1 to 2), bursts on frame
 * 3 (`break`), its pieces fly out on arcs and land, ash and a wisp of soul rise out of it. One facing: round and the same from
 * every side, so the cracks, the ward and the shards are drawn for the camera.
 */
export const urn: ScenePiece<UrnOptions> = (ctx, o) => {
  const parts = ctx.object;
  const ceramic = role(ctx.materials, 'ceramic');
  const iron = role(ctx.materials, 'metal');
  const bone = role(ctx.materials, 'bone');
  const stone = role(ctx.materials, 'stone');
  const glow = role(ctx.materials, 'glow');
  const cam = ctx.camera;
  const pose = urnPose(ctx);
  const rng = pieceRng(ctx);
  const g = worldFrame(ctx);
  const origin = g.origin;
  // Everything is written at the design size; solids and positions go through this frame (tilted on its foot while it wobbles).
  const b = pitched(g.scaled(UK), pose.wobble * RAD);
  const at = (x: number, y: number, z: number) => b.at(x, y, z);
  const sized = (shape: Shape): Shape => shape.scale(UK, UK, { x: 0, y: 0 });
  const thin: VolumeStyle = { ...iron, stroke: STROKES.detail.with({ color: alpha(iron.ramp.dark, 0.9), width: 0.45 }), edge: undefined };
  const lit: VolumeStyle = { ...iron, ramp: { ...iron.ramp, base: iron.ramp.lit }, stroke: thin.stroke, edge: undefined };
  const strength = o.glow;

  // The contact shadow: a ring under the foot, wider once it is shards round a stump.
  if (pose.whole) contactShadow(ctx, 8.6 * UK, 7 * UK);
  else contactShadow(ctx, 15.5 * UK, 11.5 * UK);

  if (pose.whole) {
    // The body, with an iron band round the belly and two handles at the shoulders.
    const body = Round.lathe(b, URN_BODY);
    parts.add(body, ceramic);
    const ring = (z: number, grow: number, width: number) => {
      const arc = visibleArc(cam, at(0, 0, z), norm3(b.forward), norm3(b.right), (radiusAt(z) + grow) * UK, (radiusAt(z) + grow) * UK, 0.18);
      if (arc.length > 1) parts.add(new Tube(arc, width * UK), thin, { on: body });
    };
    // Two iron bands (a broad one low on the belly, a thinner one on the shoulder) and a collar under the lip.
    ring(10.2, 0.15, 2.4);
    ring(13.4, 0.1, 1.1);
    ring(25, 0.12, 1.7);
    ring(31.2, 0.15, 1.5);
    // The lid: a dome with a bone knob.
    const lid = Round.lathe(b.moved(0, 0, URN_LIP), URN_LID);
    parts.add(lid, toned(ceramic, -0.08), { on: body });
    parts.add(Round.ellipsoid(b.moved(0, 0, URN_LIP + URN_KNOB - 1.4), 2.1, 2.1, 2.4), bone, { on: lid });
    // The ward burned into the belly, facing the camera: it flares as the urn cracks.
    const ward = Decal.onFace(b, 'right', vec3(0, radiusAt(18.4) + 0.15, 18.4), sized(runeShape().scale(1.9)));
    parts.add(ward, { fill: mixTone(glow.ramp.base, glow.ramp.lit, pose.leak * 0.6), shadow: { color: alpha(glow.ramp.base, 0.9), x: 0, y: 0, blur: 3.5 + 6 * pose.leak * strength } }, { on: body });
    // Old wear: a hairline craze on the shoulder and a chip at the lip, baked into the still.
    const craze = sized(Path.spline([{ x: 0, y: 0 }, { x: 1.4, y: 2.2 }, { x: 0.6, y: 4.4 }, { x: 2, y: 6 }], { style: 'chiseled' }).toShape({ width: { start: 0.7, end: 0.15 }, cap: 'round' }));
    parts.add(Decal.onFace(b, 'right', vec3(-3.6, radiusAt(24) + 0.1, 26.6), craze), SHAPE_CRACK, { on: body });
    parts.add(Decal.onFace(b, 'right', vec3(4.4, radiusAt(20) + 0.1, 7.4), sized(craze.clone().scale(0.6))), SHAPE_CRACK, { on: body });
    // Cracks running from a point on the belly, with soul light in them.
    if (pose.crack > 0.01) {
      const belly = (extra: number) => vec3(0, radiusAt(18) + extra, 18);
      for (const run of CRACKS) {
        const reveal = seg(pose.crack, run.from, 1);
        if (reveal <= 0.02) continue;
        const pts = partial(run.points, reveal);
        if (pts.length < 2) continue;
        const line = (w: number): Shape => sized(Path.spline(pts.map(([x, y]) => ({ x, y })), { style: 'chiseled' }).toShape({ width: { start: w, end: w * 0.35 }, cap: 'round' }));
        parts.add(Decal.onFace(b, 'right', belly(0.12), line(1.15)), { fill: alpha(PALETTES.ink, 0.88) }, { on: body });
        if (pose.leak > 0.02 && strength > 0) parts.add(Decal.onFace(b, 'right', belly(0.14), line(0.6)), { fill: alpha(glow.ramp.lit, Math.min(1, pose.leak * strength)), shadow: { color: alpha(glow.ramp.base, 0.9 * pose.leak * strength), x: 0, y: 0, blur: 5 } }, { on: body });
      }
      if (pose.leak > 0.02 && strength > 0) {
        const heart = at(0, radiusAt(18) + 1, 18);
        parts.custom(heart, (c, v) => {
          const p = v.project(heart);
          const r = 17 * UK;
          const gr = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          gr.addColorStop(0, alpha(glow.ramp.base, 0.34 * pose.leak * strength));
          gr.addColorStop(1, alpha(glow.ramp.base, 0));
          c.fillStyle = gr;
          c.beginPath();
          c.arc(p.x, p.y, r, 0, Math.PI * 2);
          c.fill();
        }, { on: body, bias: 100 });
      }
    }
    return;
  }

  // ---- Broken: the stump with its jagged edge, the ash it holds and the shards ----
  const cutR = radiusAt(STUMP_CUT);
  const stumpProfile: [number, number][] = [...URN_BODY.filter(([h]) => h <= 9), [STUMP_CUT, cutR]];
  const stump = Round.lathe(g.scaled(UK), stumpProfile);
  parts.add(stump, ceramic);
  // Teeth: the broken edge of the belly, a slanting break (tall at the back left, down to nothing at the front right, so the inside shows).
  const teeth = 9;
  for (let i = 0; i < teeth; i++) {
    const a = ((i + rng.float(-0.28, 0.28)) / teeth) * TAU;
    const f = (Math.cos(a + 2.4) + 1) / 2;
    const h = 0.9 + 10.5 * Math.pow(f, 1.5) * rng.float(0.78, 1.2);
    const w = rng.float(3.6, 5.4);
    const radial = vec3(Math.sin(a), Math.cos(a), 0);
    const tangent = vec3(Math.cos(a), -Math.sin(a), 0);
    const base = g.at(radial.x * cutR * UK, radial.y * cutR * UK, (STUMP_CUT - 0.5) * UK);
    // Profile (tangent, up) extruded inwards from the outer face: a right-handed frame, so the extrusion axis is minus radial.
    const frame = new Frame3(base, scale3(tangent, UK), vec3(0, 0, UK), scale3(radial, -UK));
    const apex = rng.float(-1.2, 1.2);
    parts.add(Solid.extrude(frame, [{ x: -w / 2, y: 0 }, { x: apex, y: h }, { x: w / 2, y: 0 }], 1.3), toned(ceramic, -0.08), { on: stump });
  }
  // The inside: a dark hollow, a mound of grey ash and the glint of soul light that stays in it.
  const centre = g.at(0, 0, STUMP_CUT * UK);
  const ky = Math.sin((cam.tilt * Math.PI) / 180);
  const inner = (cutR - 1.4) * UK;
  const ash = mixTone(stone.ramp.dark, stone.ramp.base, 0.62);
  const ember = pose.inside * strength;
  parts.custom(centre, (c, v) => {
    const p = v.project(centre);
    Polygon.ellipse(inner, inner * ky, { cx: p.x, cy: p.y, segments: 32 }).fill(c, mixTone(PALETTES.hollow, PALETTES.ink, 0.6));
    const mound = Polygon.ellipse(inner * 0.72, inner * 0.72 * ky, { cx: p.x + 0.4 * UK, cy: p.y + 0.6 * UK, segments: 28 });
    mound.fill(c, mound.createGradient(c, { type: 'radial', center: { x: p.x, y: p.y }, r1: 0, r2: inner * 0.75, stops: [[0, mixTone(mixTone(ash, stone.ramp.base, 0.4), glow.ramp.lit, 0.25 * ember)], [0.55, mixTone(ash, glow.ramp.base, 0.18 * ember)], [1, alpha(stone.ramp.dark, 0.35)]] }));
    if (ember > 0.01) {
      const halo = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, inner * 1.1);
      halo.addColorStop(0, alpha(glow.ramp.base, 0.55 * ember));
      halo.addColorStop(1, alpha(glow.ramp.base, 0));
      c.fillStyle = halo;
      c.beginPath();
      c.ellipse(p.x, p.y, inner * 1.1, inner * 1.1 * ky, 0, 0, Math.PI * 2);
      c.fill();
      for (const [dx, dy, r] of [[-0.35, -0.1, 0.5], [0.3, 0.2, 0.42], [0.05, -0.35, 0.36], [0.5, -0.12, 0.3]]) Polygon.circle(r * UK, { cx: p.x + dx * inner, cy: p.y + dy * inner * ky, segments: 8 }).fill(c, alpha(glow.ramp.lit, Math.min(1, 0.4 + ember)));
    }
    Path.arc({ x: p.x, y: p.y }, inner, 190, 300).scale(1, ky, { x: p.x, y: p.y }).stroke(c, hairline(alpha(ceramic.ramp.lit, 0.7), 0.8));
  }, { on: stump });

  // Ash spilled on the floor, spreading as the shards land.
  const spread = easeOut(pose.u);
  if (spread > 0.02) {
    const blot = floorShape(cam, ringPoints(rng, vec3(-2.4 * UK, 11 * UK, 0), 14 * UK * spread, 7 * UK * spread, 12, 0.2));
    const blot2 = floorShape(cam, ringPoints(rng, vec3(7 * UK, 15 * UK, 0), 6 * UK * spread, 3.6 * UK * spread, 9, 0.22));
    ctx.ground.custom(vec3(-2.4 * UK, 11 * UK, 0), c => {
      for (const s of [blot, blot2]) {
        s.fill(c, alpha(mixTone(ash, stone.ramp.dark, 0.3), 0.82));
        s.clone().scale(0.78, 0.78, s.center).fill(c, alpha(ash, 0.6));
        s.stroke(c, hairline(alpha(stone.ramp.dark, 0.55), 0.5));
      }
    }, { bias: 2 });
  }
  if (pose.leak === 0 && pose.flash > 0.01) floorGlow(ctx.ground, origin, { radius: 30 * UK, color: glow.ramp.base, strength: 0.3 * pose.flash * strength });

  // The shards: each from its place on the urn to where it lies, on an arc.
  // The raw clay under the glaze: a pale mauve-bone, so a shard turned inside up still belongs to the urn.
  const clay: VolumeStyle = { ...ceramic, ramp: { lit: mixTone(bone.ramp.lit, ceramic.ramp.lit, 0.4), base: mixTone(bone.ramp.base, ceramic.ramp.base, 0.45), dark: mixTone(bone.ramp.dark, ceramic.ramp.dark, 0.5) } };
  for (const bit of BITS) {
    const ui = clamp01((pose.u - bit.delay) / (1 - bit.delay));
    const s = clamp01(ui / 0.78);
    const e = easeOut(s);
    const a0 = bit.ang * RAD;
    const start = { x: (radiusAt(bit.z) + 1) * Math.sin(a0), y: (radiusAt(bit.z) + 1) * Math.cos(a0) };
    const hop = ui > 0.78 ? bit.hop * Math.sin((Math.PI * (ui - 0.78)) / 0.22) : 0;
    const rest = 0.6 + bit.thick * 0.5;
    const x = lerp(start.x, bit.x, e);
    const y = lerp(start.y, bit.y, e);
    const z = lerp(bit.z, rest, s) + 4 * bit.lift * s * (1 - s) + hop;
    const yaw = lerp(90 - bit.ang, bit.yaw + 360 * bit.turns, e);
    const pitch = lerp(90, bit.pitch, e);
    const roll = lerp(0, bit.roll + 360 * (bit.turns - 1), e);
    const pos = g.at(x * UK, y * UK, z * UK);
    const frame = attitude(pos, yaw * RAD, pitch * RAD, roll * RAD).scaled(UK);
    const plateFrame = new Frame3(frame.at(0, 0, -bit.thick / 2), frame.forward, frame.right, frame.up);
    const solid = Solid.extrude(plateFrame, bit.poly.map(([px, py]) => ({ x: px, y: py })), bit.thick);
    parts.add(solid, bit.look === 'glaze' ? ceramic : clay);
    if (bit.rune) {
      // A piece of the ward on the glaze (the outer face is the plate's underside: its normal is minus up).
      const down = scale3(norm3(frame.up), -1);
      const origin2 = frame.at(0, 0, -bit.thick / 2 - 0.05);
      const fragment = new Decal(origin2, norm3(frame.forward), norm3(frame.right), sized(runeShape().scale(1.7)), down);
      parts.add(fragment, soulMark(glow), { on: solid });
    }
    // Its shadow on the floor: smaller and fainter the higher it is.
    const lift = z / 22;
    const size = Math.max(...bit.poly.map(p => Math.hypot(p[0], p[1]))) * 0.8;
    const shadow = groundShadow(cam, vec3(pos.x, pos.y, 0), size * UK * (1 - 0.3 * Math.min(1, lift)), size * 0.75 * UK * (1 - 0.3 * Math.min(1, lift)), yaw * RAD);
    ctx.ground.custom(vec3(pos.x, pos.y, 0), c => shadow.fill(c, alpha(PALETTES.ink, 0.3 / (1 + lift * 1.6))), { bias: 3 });
  }
  // The knob, thrown clear of the lid.
  {
    const ui = clamp01((pose.u - 0.02) / 0.98);
    const s = clamp01(ui / 0.8);
    const e = easeOut(s);
    const kz = lerp(URN_LIP + URN_KNOB - 1.4, 1.7, s) + 4 * 30 * s * (1 - s) + (ui > 0.8 ? 2 * Math.sin((Math.PI * (ui - 0.8)) / 0.2) : 0);
    const kAt = g.at(lerp(0, -9, e) * UK, lerp(0, -8, e) * UK, kz * UK);
    parts.add(Round.ellipsoid(Frame3.facing(kAt, 0), 2.1 * UK, 2.1 * UK, 2.4 * UK), bone);
  }

  // The burst: a flash over the urn, a cloud of ash that swells and thins, and a wisp of soul that rises out of the ash and is gone.
  const mid = g.at(0, 0, 20 * UK);
  if (pose.flash > 0.01 && strength > 0) {
    parts.custom(mid, c => {
      const p = cam.project(mid);
      soulBurst(c, glow, p, { radius: 24 * UK, height: 22 * UK, strength: pose.flash * Math.min(1, strength) });
    }, { on: stump, bias: 500 });
  }
  if (pose.cloud >= 0) {
    const d = pose.cloud;
    parts.custom(mid, c => {
      const p = cam.project(mid);
      const a = Math.pow(1 - d, 1.5) * 0.62;
      c.save();
      for (const [dx, dy, r] of [[-7, 2, 8], [6, 3, 9], [0, -6, 8.5], [-2, 6, 7], [9, -3, 6.5]] as const) {
        const rr = r * UK * (0.7 + 1.1 * easeOut(d));
        const spreadX = dx * UK * (0.4 + 1.6 * easeOut(d));
        const lift = dy * UK - 10 * UK * easeOut(d);
        const gr = c.createRadialGradient(p.x + spreadX, p.y + lift, 0, p.x + spreadX, p.y + lift, rr);
        gr.addColorStop(0, alpha(ash, a));
        gr.addColorStop(0.65, alpha(mixTone(ash, stone.ramp.dark, 0.35), a * 0.7));
        gr.addColorStop(1, alpha(ash, 0));
        c.fillStyle = gr;
        c.beginPath();
        c.arc(p.x + spreadX, p.y + lift, rr, 0, Math.PI * 2);
        c.fill();
      }
      c.restore();
    }, { on: stump, bias: 400 });
    // The soul: a small bright head with a trail that leans and drifts, rising out of the ash.
    if (strength > 0) {
      const base = g.at(0, 0, STUMP_CUT * UK);
      parts.custom(base, c => {
        const p = cam.project(base);
        const point = (dd: number): Point => ({ x: p.x + Math.sin(dd * TAU * 1.3 + 0.4) * 4.2 * UK * (0.3 + dd), y: p.y - (2 + 40 * easeOut(dd)) * UK });
        const a = Math.pow(Math.sin(Math.PI * d), 0.7);
        const trail = [0, 1, 2, 3, 4, 5, 6].map(k => d - k * 0.05).filter(dd => dd > 0).map(point);
        if (trail.length >= 2) Path.spline(trail, { style: 'smooth' }).toShape({ width: { start: 2.2 * UK, end: 0.2 }, cap: 'round' }).fill(c, alpha(glow.ramp.lit, 0.6 * a * Math.min(1, strength)));
        const head = point(d);
        Polygon.circle(1.7 * UK, { cx: head.x, cy: head.y, segments: 14 }).draw(c, { fill: alpha(glow.ramp.lit, a), shadow: { color: alpha(glow.ramp.base, 0.9 * a), x: 0, y: 0, blur: 7 } });
      }, { on: stump, bias: 450 });
    }
  }
};
