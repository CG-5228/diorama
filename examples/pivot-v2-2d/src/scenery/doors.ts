/**
 * Doors of the graveyard kit (guide 05): the crypt door, the crypt archway, and what the iron gate (`fences.ts`) shares with
 * them (the span between piers, the leaf frames, the pose from the clip's key tables, the floor shadows).
 *
 * A door stands on a cell EDGE, between two wall vertices (walls on borders): `layoutScene` cuts the wall run there, so the
 * walls on either side end in piers (20 wide, 24 at their caps and 23 at their plinths), and puts the door at the middle of the
 * edge, facing across it: S on a north edge (dir 0), E on a west edge (dir 3), the other two facings being its back sides. A
 * door is built in `ctx.frame` (forward = the way it faces, right = its own right hand, up), one cell long, and is drawn AFTER
 * the piers of its own edge, so a part of it inside a pier would be painted over it: the piers are the jambs, and what the door
 * draws lies between their shafts (`doorSpan().shaft`, 14 from the middle), between their plinths below (the sill, the leaf's foot)
 * and their caps above (the lintel's cap course is the wall's own, butted against theirs).
 *
 * Sizes are read from `SPACE`, never typed: the lintel's soffit is the opening's height (`SPACE.scale.door`), its cap course the
 * wall's (`SPACE.scale.wall`, `WALL.cap`), the sill the wall's plinth (`WALL.plinth`), the leaf as wide as the shafts are apart.
 *
 * The leaf hangs on the jamb at the left hand of someone standing in the doorway looking out the way the door faces (the east
 * jamb of a door facing S, the north jamb of one facing E: the right-hand side of the opening as the camera sees a door facing S)
 * and swings TOWARDS the way the door faces, into the room, up to square with the wall (`CRYPT_DOOR_OPEN`, 90°). Seen from the camera a door on a north wall opens towards it (a thin slab with its top
 * showing, the dark doorway behind it) and a door on a west wall lies out across the floor, face to the camera: that is what makes
 * an open door read from the side, where a wall run shows only its top (a shut one is only its lintel, its sill and the leaf's
 * edge there, so its ward burns on the lintel's top).
 *
 * Everything animated reads ONE pose, `poseOf(ctx, tracks)`: every channel of the clip's key table (the leaf's angle, the ward's
 * glow; the gate has one angle per leaf and a flare) at the frame. The tables are written in frames (`motion.ts`), so frame k of a
 * transition is exactly the key at k: the first frame is the `from` still and the last the `to` still (verified pixel by pixel in
 * the exported sheets). The ward is the crypt door's soul accent: lit on the shut door, it flares as the door is opened, fades
 * while the leaf swings and rests half lit on the open one (an ember, not out); closing it flashes on the slam.
 *
 * The clips are named `opening` and `closing`, not `open` and `close`: `scenery-items` writes the sheet of a state and of a clip into
 * one namespace (`<id>--open`), so a clip named like a state (the door's own `open`) would never be written.
 */

import { Polygon, alpha, type Shape } from '@core/draw';
import { Decal, Frame3, Round, Solid, Tube, pieceRng, scale3, vec3, type PieceClip, type PieceContext, type ScenePiece, type StageObject, type VolumeStyle } from '@core/volume';
import { PALETTES, STROKES } from '../theme';
import { SPACE } from '../space';
import { lerp, playhead, track, type Keys } from './motion';
import { WALL, wallStyles } from './walls';
import { castShadow, role, runeShape, tone } from './util';

// ----------------------------------------------------------------------------------------------
// Where a door stands
// ----------------------------------------------------------------------------------------------

/** What a door knows about its edge, from its facing: half its length and where the piers on either side stop. */
export interface DoorSpan {
  /** True when the door faces east or west: its edge runs in depth (y), one cell deep, instead of across the screen. */
  sideways: boolean;
  /** Half the edge: the pier's centre. */
  half: number;
  /** Where the piers' shafts end, measured from the door's middle: the stone between them is the opening. */
  shaft: number;
  /** Where the piers' caps end (the cap overhangs the shaft): what a door's own parts keep inside. */
  cap: number;
  /** Where the piers' plinths end. */
  plinth: number;
}

/** The edge a door stands on: one cell long, with the wall piers at both ends (`WALL.pier`, `WALL.cap`, `WALL.plinth`). */
export function doorSpan(ctx: Pick<PieceContext, 'yaw' | 'grid'>): DoorSpan {
  const sideways = Math.abs(Math.cos(ctx.yaw)) > Math.abs(Math.sin(ctx.yaw)) + 1e-9;
  const half = (sideways ? ctx.grid.cell.y : ctx.grid.cell.x) / 2;
  const pier = WALL.pier / 2;
  return { sideways, half, shaft: half - pier, cap: half - (pier + WALL.cap.pierOver), plinth: half - (pier + WALL.plinth.over) };
}

/** A box in a door frame: `f0..f1` along the facing, `s0..s1` across (to the door's right), `z0..z1` up. */
export const box = (g: Frame3, f0: number, f1: number, s0: number, s1: number, z0: number, z1: number): Solid => Solid.box(g.moved((f0 + f1) / 2, (s0 + s1) / 2, z0), f1 - f0, s1 - s0, z1 - z0);

/** Thin metal parts: the line is as fine as the part, the contour does the outlining (the fences' `thin`). */
export const thin = (m: VolumeStyle, width = 0.35): VolumeStyle => ({ ...m, texture: undefined, stroke: STROKES.detail.with({ color: alpha(m.ramp.dark, 0.9), width }), edge: undefined });

/**
 * The frame of a leaf hinged at `at` (door-frame forward, side, up) and turned `degrees` towards the way the door faces:
 * its forward is the leaf's face normal, its right runs along the leaf from the hinge, so a leaf is built as if shut.
 * `mirror` hangs it on the observer's right, running towards the door's left.
 */
export function leafFrame(g: Frame3, at: { f: number; s: number }, degrees: number, mirror = false): Frame3 {
  const base = g.moved(at.f, at.s, 0);
  // A leaf hinged on the observer's right runs along the door's left: its own right is the door's left.
  return (mirror ? new Frame3(base.origin, base.forward, scale3(base.right, -1), base.up) : base).turned(-degrees);
}

/**
 * How far the walls' floor shadows reach from a pier of a wall `WALL` tall (`walls.ts`): east (towards the far side of the
 * light) and north, plus the pier's own half side. The run's shadow between two piers ends where theirs begin, so a door's
 * shadow joins them without lying over them twice.
 */
const REACH = { east: 2.5 + 3.5, north: 1.5 + 2.5 };

/**
 * The shadow the door's frame and lintel cast on the floor: the part of the wall run between the piers' own shadows,
 * `thick` thick across the run, grown towards the far side of the light like the walls' (east for a door on a west or east
 * edge, north for a door on a north or south one). In world axes.
 */
export function runShadow(ctx: PieceContext, span: DoorSpan, thick: number, strength: number): void {
  const p2 = WALL.pier / 2;
  const o = ctx.frame.origin;
  const at = (x: number, y: number) => ctx.camera.project(vec3(o.x + x, o.y + y, 0));
  const t = thick + 1.5;
  const shape = span.sideways
    ? Polygon.fromPoints([at(-t, -span.half + p2 + 1.5), at(t + REACH.east, -span.half + p2 + 1.5), at(t + REACH.east, span.half - p2 - REACH.north - 1), at(-t, span.half - p2 - REACH.north - 1)])
    : Polygon.fromPoints([at(-span.half + p2 + REACH.east + 1, -t - REACH.north), at(span.half - p2 - 1.5, -t - REACH.north), at(span.half - p2 - 1.5, t), at(-span.half + p2 + REACH.east + 1, t)]);
  ctx.ground.custom(o, c => shape.fill(c, castShadow(strength)));
}

/** The floor shadow of a leaf hung at `leaf`: its footprint (`length` long, `thick` thick, from `x0`) cast a little east and north like every shadow of the kit. */
export function leafShadow(ctx: PieceContext, leaf: Frame3, o: { x0: number; length: number; thick: number }, strength: number): void {
  const at = (f: number, s: number) => {
    const p = leaf.at(f, s, 0);
    return ctx.camera.project(vec3(p.x + 3, p.y - 2, 0));
  };
  const shape = Polygon.fromPoints([at(-o.thick / 2, o.x0), at(o.thick / 2, o.x0), at(o.thick / 2, o.x0 + o.length), at(-o.thick / 2, o.x0 + o.length)]);
  ctx.ground.custom(ctx.frame.origin, c => shape.fill(c, castShadow(strength)));
}

// ----------------------------------------------------------------------------------------------
// Motion
// ----------------------------------------------------------------------------------------------

/**
 * The key tables of one clip, by channel: the angle of a leaf in degrees (0 shut, positive towards the facing side), the glow
 * of a ward or a lantern, whatever the piece animates. Every channel is in frames and never negative.
 */
export type Channels = Record<string, Keys>;

/** The first frame of a clip whose position satisfies `test`: the frame an event sits on. */
export const firstFrame = (frames: number, test: (frame: number) => boolean): number => {
  for (let f = 0; f < frames; f++) if (test(f)) return f;
  throw new Error('doors: no frame of the clip satisfies the event');
};

/**
 * The pose of a frame: every channel of the clip's key tables at its frame (`opening` and `closing`), else of the resting
 * state's. A state's resting pose is the end of the transition that leads into it: the last key of `opening` for 'open', its
 * first key for 'closed' (which is the last key of `closing`), so the first frame of a clip is the `from` still and its last
 * frame the `to` still, and the clips and the sheets always agree.
 */
export function poseOf<K extends string>(ctx: Pick<PieceContext, 'state' | 'clip'>, tracks: { opening: Record<K, Keys>; closing: Record<K, Keys> }): Record<K, number> {
  const out = {} as Record<K, number>;
  const clip = ctx.clip;
  for (const key of Object.keys(tracks.opening) as K[]) {
    const own = clip ? (clip.name === 'closing' ? tracks.closing : tracks.opening)[key] : undefined;
    const open = tracks.opening[key];
    out[key] = Math.max(0, own ? track(playhead(clip!), own) : ctx.state === 'open' ? open[open.length - 1][1] : open[0][1]);
  }
  return out;
}

// ----------------------------------------------------------------------------------------------
// The crypt door
// ----------------------------------------------------------------------------------------------

/** Degrees the crypt door's leaf rests at once open: square with the wall. */
export const CRYPT_DOOR_OPEN = 90;
/** Glow of the ward on the open door: half lit, not dead (the soul accent stays on every sheet: `inspect` counts a saturated pixel from about this glow up). */
const WARD_OPEN = 0.5;

/**
 * The key tables of the crypt door's two clips, in frames. `OPENING` (8 frames): the leaf creaks free (3° on frame 1,
 * the anticipation), swings with gathering speed (21°, 34°, 26° a frame), strikes past square (98°, the peak) as the leaf
 * meets the wall, settles back (92°, 90°). The ward flares as it breaks and fades to half lit. `CLOSING` (8 frames): the
 * leaf lifts a little (94°), falls with gathering speed (16°, 28°, 28°, 22°), slams shut on frame 5, rebounds 5° and
 * settles; the ward waits half lit and flashes on the slam. The last key of each is the resting pose it ends in.
 */
export const CRYPT_DOOR_TRACKS = {
  opening: {
    angle: [[0, 0], [1, 3], [2, 24], [3, 58], [4, 84], [5, 98], [6, 92], [7, CRYPT_DOOR_OPEN]],
    glow: [[0, 1], [1, 1.5], [2, 1.1], [3, 0.8], [4, 0.64], [5, 0.57], [6, 0.53], [7, WARD_OPEN]],
  },
  closing: {
    angle: [[0, CRYPT_DOOR_OPEN], [1, 94], [2, 78], [3, 50], [4, 22], [5, 0], [6, 5], [7, 0]],
    glow: [[0, WARD_OPEN], [1, WARD_OPEN], [2, WARD_OPEN], [3, 0.56], [4, 0.75], [5, 1.7], [6, 1.25], [7, 1]],
  },
} as const satisfies Record<string, Channels>;

/**
 * The crypt door's clips: `opening` (closed → open) has its `open` event on the first frame the leaf stands past 70° (the
 * way is clear: a leaf square to the wall leaves only its thickness in the opening), `closing` (open → closed) its `shut`
 * event on the frame the leaf meets the jamb.
 */
export const CRYPT_DOOR_CLIPS = {
  opening: { frames: 8, fps: 10, from: 'closed', to: 'open', events: [{ frame: firstFrame(8, f => track(f, CRYPT_DOOR_TRACKS.opening.angle) >= 70), name: 'open' }] },
  closing: { frames: 8, fps: 10, from: 'open', to: 'closed', events: [{ frame: firstFrame(8, f => track(f, CRYPT_DOOR_TRACKS.closing.angle) <= 1), name: 'shut' }] },
} as const satisfies Record<string, PieceClip>;

/** What the crypt door shows in its sheet: one look, dark wood with the ward. */
export const CRYPT_DOOR_LOOKS = ['Madeira escura com ferragens e runa'] as const;

/** Cell and pivot of the crypt door's sheets: the wall's height above the pivot and the leaf's reach (24 in front, up to the sill's step) around it. */
export const CRYPT_DOOR_CELL = { width: 112, height: 148, pivot: { x: 56, y: 116 } };

/** Plan of the leaf and the frame, in world units (1 unit = 1 logical px at the camera's x scale). */
const DOOR = {
  /** The leaf is this thick and hangs on a pin `axisF` forward of the wall's middle, `inset` inside its hinge edge (so it turns clear of the pier). */
  leaf: { thick: 4, axisF: 1.5, inset: 2 },
  /** The sill is the wall's plinth carried across the opening: it reaches `back` behind the wall's middle and steps `front` out in front of it. */
  sill: { back: 9, front: 13 },
  /** The iron: strap height and rivet radius, the ward's roundel (an iron boss) and the handle's ring. */
  strap: { height: 6, rivet: 0.55 },
  roundel: { r: 6.2 },
  ring: { r: 2.6, width: 1.05 },
} as const;

/** The crypt door's options: the ward is burned into the leaf and the lintel (off, it is a plain door). */
export interface CryptDoorOptions {
  ward: boolean;
}

/**
 * Crypt door: a dark wood leaf banded in iron, hung on the faces of the crypt wall's piers under a lintel (a soffit course and the
 * wall's own cap course) and over a sill that steps out, with the soul ward on an iron roundel.
 * - **front** (the facing side): three iron straps ending in points, the ward roundel and a ring handle;
 * - **back**: the same straps plain, a drop bar in two brackets and a ring;
 * - **both**: four planks, an iron-bound free edge, hinge barrels, rivets, nails and grain; the lintel shades the top of
 *   a shut leaf (the band fades as it turns away).
 * Behind the leaf, when the door faces the camera, the doorway is dark.
 */
export const cryptDoor: ScenePiece<CryptDoorOptions> = (ctx, o) => {
  const g = ctx.frame;
  const span = doorSpan(ctx);
  const rng = pieceRng(ctx);
  const pose = poseOf(ctx, CRYPT_DOOR_TRACKS);
  const { object } = ctx;
  const stone = wallStyles(ctx.materials);
  const wood = role(ctx.materials, 'darkwood');
  const metal = role(ctx.materials, 'metal');
  const iron = thin(metal, 0.5);
  const ironFine = thin(metal, 0.3);
  const glow = role(ctx.materials, 'glow');
  const H = SPACE.scale.door;
  const foot = WALL.plinth.height;
  const thick = WALL.thick / 2;
  const { cap, shaft } = span;
  const open = pose.angle / CRYPT_DOOR_OPEN;

  // The stone frame ------------------------------------------------------------------------------------------------
  // The sill: the wall's plinth continued across the opening and stepping out in front of it.
  object.add(box(g, -DOOR.sill.back, DOOR.sill.front, -span.plinth, span.plinth, 0, foot), stone.style(stone.plinthStone));
  // The lintel: a soffit course at the opening's height under the wall's own cap course, between the pier caps.
  object.add(box(g, -thick, thick, -shaft, shaft, H, H + 1), stone.style(stone.plain));
  const lintelCap = box(g, -(thick + WALL.cap.over), thick + WALL.cap.over, -cap, cap, SPACE.scale.wall - WALL.cap.height, SPACE.scale.wall);
  object.add(lintelCap, stone.style(stone.capStone));
  // The ward carved on the top of the lintel: a plate with the rune. It burns only where the leaf would hide it from the
  // camera (a door on a west or east edge), so the leaf's roundel stays the one focal accent of a door seen from the front.
  const plate = Decal.onFace(g, 'top', vec3(0, 0, SPACE.scale.wall), Polygon.rect(10, 5.2, { radius: 0.8 }));
  object.add(plate, { fill: alpha(PALETTES.ink, 0.28) }, { on: lintelCap });
  if (o.ward) {
    const lit = span.sideways ? Math.min(1, pose.glow) * 0.85 : 0;
    object.add(
      Decal.onFace(g, 'top', vec3(0, 0, SPACE.scale.wall), runeShape().scale(1.0)),
      lit > 0.05 ? { fill: alpha(glow.ramp.base, 0.3 + 0.7 * lit), shadow: { color: alpha(glow.ramp.base, 0.9 * lit), x: 0, y: 0, blur: 3 * lit + 0.5 } } : { fill: alpha(PALETTES.ink, 0.55) },
      { on: plate },
    );
  }

  // The leaf -----------------------------------------------------------------------------------------------------
  // The leaf fills the opening between the pier shafts (the jambs): it spans z from the sill to the soffit, between the plinths below and the caps above.
  const W = 2 * shaft;
  const leafTop = H - 0.3;
  const L = leafFrame(g, { f: DOOR.leaf.axisF, s: -shaft + DOOR.leaf.inset }, pose.angle);
  const half = DOOR.leaf.thick / 2;
  const s0 = -DOOR.leaf.inset;
  const s1 = W - DOOR.leaf.inset;
  // Only the face that looks at the camera gets its hardware: a part resting `on` a plank is drawn after the whole plank, from
  // every side, so the far face's straps would show through the leaf.
  const showFront = ctx.camera.faces(L.forward);
  const showBack = ctx.camera.faces(scale3(L.forward, -1));
  const planks = [0, 1, 2, 3].map(i => {
    const tint = tone(wood, [0.1, -0.08, 0.04, -0.14][(i + rng.int(0, 3)) % 4]);
    const solid = box(L, -half, half, s0 + (W * i) / 4, s0 + (W * (i + 1)) / 4, foot, leafTop);
    object.add(solid, tint);
    return solid;
  });
  const plankAt = (s: number) => planks[Math.max(0, Math.min(3, Math.floor(((s - s0) / W) * 4)))];

  // Floor shadows: the leaf's own, which swings with it, and the frame's, whole while the door is shut and thinner once open.
  leafShadow(ctx, L, { x0: s0, length: W, thick: DOOR.leaf.thick }, lerp(0.24, 0.3, open));
  runShadow(ctx, span, thick, lerp(0.3, 0.14, Math.min(1, open * 1.25)));

  // Straps, rivets and the hardware of each face, hinge barrels and the iron edge --------------------------------------
  const strapProfile = (len: number, z0: number): Shape => {
    const h = DOOR.strap.height;
    return Polygon.fromPoints([{ x: s0, y: z0 }, { x: len, y: z0 }, { x: len + 3.4, y: z0 + h / 2 }, { x: len, y: z0 + h }, { x: s0, y: z0 + h }]);
  };
  const mid = (foot + leafTop) / 2;
  const strapZ = [foot + 5, mid - DOOR.strap.height / 2 + 0.5, leafTop - DOOR.strap.height - 4];
  const strapLen = [0.72, 0.66, 0.72].map(k => k * W);
  const nailsAt = (len: number) => Array.from({ length: Math.floor((len - 3) / 4.6) }, (_, i) => s0 + 3 + i * 4.6);
  for (const [side, face, shown] of [[1, 'front', showFront], [-1, 'back', showBack]] as const) {
    if (!shown) continue;
    strapZ.forEach((z0, i) => {
      const strap = Solid.extrude(L.moved(side > 0 ? half : -half - 0.95, 0, 0).profile('front'), strapProfile(strapLen[i], z0), 0.95);
      object.add(strap, iron, { on: plankAt(s0 + strapLen[i] / 2) });
      for (const s of nailsAt(strapLen[i])) {
        object.add(Decal.onFace(L, face, vec3(side * (half + 0.95), s, z0 + DOOR.strap.height / 2), Polygon.circle(DOOR.strap.rivet, { segments: 8 })), { fill: metal.ramp.lit }, { on: strap });
      }
    });
  }
  // Hinge barrels at every strap, on the pin, and the free edge bound in iron.
  for (const z0 of strapZ) object.add(Round.cylinder(L.moved(0, 0, z0 - 0.4), 2.05, DOOR.strap.height + 0.8), iron, { on: planks[0] });
  object.add(box(L, -half - 0.5, half + 0.5, s1 - 1.6, s1, foot + 0.6, leafTop - 0.6), iron, { on: planks[3] });

  // The front: the ward roundel (an iron boss with the rune on a dark ground) and a ring handle.
  const rc = { s: (s0 + s1) / 2, z: strapZ[1] + DOOR.strap.height / 2 };
  const ring = (side: 1 | -1, s: number, z: number) => {
    const out = side * half;
    object.add(box(L, Math.min(out, out + side * 1.4), Math.max(out, out + side * 1.4), s - 1.5, s + 1.5, z - 1.5, z + 1.5), iron, { on: planks[3] });
    const pts = Array.from({ length: 15 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2;
      return L.at(out + side * 1.4, s + Math.sin(a) * DOOR.ring.r * 0.8, z - DOOR.ring.r - 0.2 + Math.cos(a) * DOOR.ring.r);
    });
    object.add(new Tube(pts, DOOR.ring.width), ironFine, { on: planks[3] });
  };
  if (showFront) {
    const disc = Round.cylinder(L.moved(half, rc.s, rc.z).profile('front'), DOOR.roundel.r, 2.05, DOOR.roundel.r * 0.9);
    object.add(disc, iron, { on: planks[2] });
    const face = half + 2.05;
    object.add(Decal.onFace(L, 'front', vec3(face, rc.s, rc.z), Polygon.circle(DOOR.roundel.r * 0.72, { segments: 24 })), { fill: alpha(PALETTES.hollow, 0.92) }, { on: disc });
    if (o.ward) {
      const lit = Math.min(1, pose.glow);
      const flare = Math.min(1.8, pose.glow);
      object.add(
        Decal.onFace(L, 'front', vec3(face + 0.05, rc.s, rc.z), runeShape().scale(1.75)),
        { fill: alpha(glow.ramp.base, 0.22 + 0.78 * lit), shadow: { color: alpha(glow.ramp.base, 0.95 * lit), x: 0, y: 0, blur: 2 + 5 * flare } },
        { on: disc },
      );
      // A flare: a pale halo over the roundel while the ward is brighter than on the shut door.
      if (flare > 1.05) object.add(Decal.onFace(L, 'front', vec3(face + 0.08, rc.s, rc.z), Polygon.circle(DOOR.roundel.r * 0.6 * (flare - 0.9), { segments: 20 })), { fill: alpha(glow.ramp.lit, 0.35 * (flare - 1)) }, { on: disc, bias: 1 });
    }
    ring(1, s1 - 5, strapZ[1] - 5);
  }
  // The back: a drop bar in two brackets and a ring.
  if (showBack) {
    const barZ = strapZ[1] + 1;
    object.add(box(L, -half - 3.1, -half - 1.6, s0 + 0.5, s1 - 0.5, barZ, barZ + 3.2), iron, { on: planks[1] });
    for (const s of [s0 + 2, s1 - 6]) object.add(box(L, -half - 3.5, -half, s, s + 3.6, barZ - 1.4, barZ + 4.6), iron, { on: planks[1] });
    ring(-1, s1 - 5, strapZ[1] - 5);
  }

  // Wear: grain on both faces, and on the front the lintel's shade on the top of a shut leaf (it fades as the leaf turns away).
  // The draws never depend on the pose, so every frame of a clip carries the same grain.
  const grain = Array.from({ length: 9 }, () => ({ s: rng.float(s0 + 2, s1 - 2), z: rng.float(foot + 6, leafTop - 6), len: rng.float(5, 13), w: rng.float(0.35, 0.7), front: rng.boolean() }));
  for (const gr of grain) {
    if (gr.front ? !showFront : !showBack) continue;
    object.add(Decal.onFace(L, gr.front ? 'front' : 'back', vec3((gr.front ? 1 : -1) * half, gr.s, gr.z), Polygon.rect(gr.w, gr.len)), { fill: alpha(wood.ramp.dark, 0.55) }, { on: plankAt(gr.s) });
  }
  const shade = 0.34 * Math.max(0, 1 - pose.angle / 40);
  if (showFront && shade > 0.01) object.add(Decal.onFace(L, 'front', vec3(half, (s0 + s1) / 2, leafTop - 2), Polygon.rect(W - 0.4, 4)), { fill: alpha(PALETTES.ink, shade) }, { on: planks[2], bias: 2 });

  // The doorway behind the leaf is dark: a gradient plate behind everything, only where the camera looks into it.
  if (!span.sideways) darkDoorway(object, g, { f: -DOOR.leaf.axisF - 3, s0: -shaft, s1: shaft, z0: foot, z1: H });
};

/**
 * The dark of a doorway seen through its open leaf: a vertical plate in the plane `f` of the door's frame, drawn behind every
 * part of the door (a large negative bias), darkest at the top and lighter near the floor. Not an outlined part: it takes
 * no contour, so it only darkens what lies behind the opening.
 */
export function darkDoorway(object: StageObject, g: Frame3, o: { f: number; s0: number; s1: number; z0: number; z1: number }): void {
  const at = g.at(o.f, 0, (o.z0 + o.z1) / 2);
  object.custom(at, (c, cam) => {
    const a = cam.project(g.at(o.f, o.s0, o.z0));
    const b = cam.project(g.at(o.f, o.s1, o.z0));
    const t0 = cam.project(g.at(o.f, o.s0, o.z1));
    const t1 = cam.project(g.at(o.f, o.s1, o.z1));
    const fade = c.createLinearGradient(0, Math.min(t0.y, t1.y), 0, Math.max(a.y, b.y));
    fade.addColorStop(0, alpha(PALETTES.hollow, 0.96));
    fade.addColorStop(1, alpha(PALETTES.hollow, 0.62));
    c.save();
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.lineTo(t1.x, t1.y);
    c.lineTo(t0.x, t0.y);
    c.closePath();
    c.fillStyle = fade;
    c.fill();
    c.restore();
  }, { bias: -1e6 });
}

// ----------------------------------------------------------------------------------------------
// The crypt archway
// ----------------------------------------------------------------------------------------------

/** What the archway looks like in its sheet: one look, a pointed arch with the ward on its cap. */
export const CRYPT_ARCHWAY_LOOKS = ['Arco ogival com runa na chave'] as const;

/** Cell and pivot of the archway's sheet: the crypt door's (the same wall height above the pivot, the same width). */
export const CRYPT_ARCHWAY_CELL = { width: 96, height: 148, pivot: { x: 48, y: 116 } };

/** The archway's options: the ward on the lintel's face (off, it is carved plain). */
export interface CryptArchwayOptions {
  ward: boolean;
}

/** Glow of the ward on the archway: steady (it has one state, nothing opens or shuts it). */
const ARCHWAY_WARD = 0.9;

/**
 * Crypt archway: an open pointed arch between the crypt wall's piers, for a passage that never closes. It has the one state,
 * 'open' (`nav.passableIn`), and no clips.
 *
 * The arch is an equilateral one (each arc as long a radius as the opening is wide, centred on the opposite springing point), its
 * soffit crowning at the opening's height (`SPACE.scale.door`); a ring of voussoirs, as tall as `ARCH.ring`, follows it and is
 * trimmed by the pier faces and by the underside of the wall's cap course, which runs on across the top (the same cap as the
 * door's lintel, `WALL.cap`). Spandrels of plain wall fill the corners above the ring; a worn threshold lies in the opening.
 * The ward is a plate on the cap's face, the focal accent; it is carved and unlit on the other face.
 */
export const cryptArchway: ScenePiece<CryptArchwayOptions> = (ctx, o) => {
  const g = ctx.frame;
  const span = doorSpan(ctx);
  const { object } = ctx;
  const stone = wallStyles(ctx.materials);
  const glow = role(ctx.materials, 'glow');
  const H = SPACE.scale.door;
  const thick = WALL.thick / 2;
  const capBottom = SPACE.scale.wall - WALL.cap.height;
  const { shaft, cap } = span;
  const R = 2 * shaft;
  const rise = Math.sqrt(R * R - shaft * shaft);
  const spring = H - rise;
  const ring = ARCH.ring;
  // A point of an arc of radius `r` `deg` up from the springing point on one half, trimmed to the opening and under the cap:
  const at = (side: -1 | 1, deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    // The left half's arc is centred on the right springing point, and the other way round.
    const s = -side * shaft + side * r * Math.cos(a);
    return { x: Math.max(-shaft, Math.min(shaft, s)), y: Math.min(capBottom, spring + r * Math.sin(a)) };
  };
  const frame = g.moved(-thick, 0, 0).profile('front');

  // Threshold: a worn slab level with the floor between the plinths.
  object.add(box(g, -thick - 1, thick + 1, -span.plinth, span.plinth, 0, 1.6), stone.style(stone.plinthStone));

  // The voussoir ring and the spandrels, half by half (the left half is mirrored on the right).
  const cuts = ARCH.joints;
  for (const side of [-1, 1] as const) {
    for (let i = 0; i + 1 < cuts.length; i++) {
      const quad = [at(side, cuts[i], R), at(side, cuts[i + 1], R), at(side, cuts[i + 1], R + ring), at(side, cuts[i], R + ring)];
      object.add(Solid.extrude(frame, Polygon.fromPoints(quad), 2 * thick), stone.style(stone.tints[(i + (side < 0 ? 0 : 1)) % 3]));
    }
    // The spandrel: the wall between the ring's outer edge, the pier face and the cap's underside.
    const outer = cuts.map(d => at(side, d, R + ring));
    const edge = outer.filter(p => p.y < capBottom - 1e-6 && Math.abs(p.x) < shaft - 1e-6);
    const corner = { x: side * shaft, y: capBottom };
    const first = edge[0] ?? at(side, cuts[0], R + ring);
    const spandrel = [{ x: side * shaft, y: first.y }, ...edge, { x: edge.length ? edge[edge.length - 1].x : 0, y: capBottom }, corner];
    object.add(Solid.extrude(frame, Polygon.fromPoints(spandrel), 2 * thick), stone.style(stone.plain));
  }

  // The lintel's cap runs on over the crown, as on the door; its top carries the ward plate (burning only where the camera would not see the face).
  const lintelCap = box(g, -(thick + WALL.cap.over), thick + WALL.cap.over, -cap, cap, capBottom, SPACE.scale.wall);
  object.add(lintelCap, stone.style(stone.capStone));
  const top = Decal.onFace(g, 'top', vec3(0, 0, SPACE.scale.wall), Polygon.rect(10, 5.2, { radius: 0.8 }));
  object.add(top, { fill: alpha(PALETTES.ink, 0.28) }, { on: lintelCap });
  const faceX = thick + WALL.cap.over;
  const midZ = (capBottom + SPACE.scale.wall) / 2;
  const burning = (lit: number) => (lit > 0.05 ? { fill: alpha(glow.ramp.base, 0.3 + 0.7 * lit), shadow: { color: alpha(glow.ramp.base, 0.9 * lit), x: 0, y: 0, blur: 3 * lit + 0.5 } } : { fill: alpha(PALETTES.ink, 0.55) });
  if (o.ward) {
    object.add(Decal.onFace(g, 'top', vec3(0, 0, SPACE.scale.wall), runeShape().scale(1.0)), burning(span.sideways ? ARCHWAY_WARD * 0.85 : 0), { on: top });
    // The plate on the cap's face: a paler slab with the rune on it, lit on the facing side only.
    for (const [face, side, lit] of [['front', 1, ARCHWAY_WARD], ['back', -1, 0]] as const) {
      const plate = Decal.onFace(g, face, vec3(side * faceX, 0, midZ), Polygon.rect(9, 5, { radius: 0.8 }));
      object.add(plate, { fill: alpha(PALETTES.ink, 0.3) }, { on: lintelCap });
      object.add(Decal.onFace(g, face, vec3(side * faceX, 0, midZ), runeShape().scale(0.9)), burning(lit), { on: plate });
    }
  }
  runShadow(ctx, span, thick, 0.2);
};

/** Plan of the archway in world units. */
const ARCH = {
  /** The voussoirs' height measured along the radius, and the angles (degrees up from the springing point) where the ring is cut, from the pier to the crown (60° is the crown of an equilateral arch). */
  ring: 5.2,
  joints: [0, 17, 29, 40, 50, 60],
} as const;
