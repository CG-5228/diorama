/**
 * What hangs at a belt, drawn as loot: the belt itself, the skull belt and the pouch. Same leather and iron as the gear kit's, a
 * little larger than worn so the stitching and the hardware read.
 *
 * - `belt`: a belt coiled into a loop and set down on its edge: a drum of leather with the hole through it (a dark floor seen
 *   inside a lighter far wall), a row of stitches round the top and an iron frame buckle with its prong at the front.
 *   11 across, 2.4 wide. A ring, so it never reads as the skull belt.
 * - `skullBelt`: the belt with the skull buckle (the captain's), laid out straight and standing to face the viewer: a strap with a
 *   pointed tail and its holes on one side, and on the other a steel plate with a bone skull on it, as big as the strap is wide
 *   three times over. A bar with a head, so it never reads as the coiled belt. 21 long, the plate 11 across.
 * - `pouch`: a round bag of soft leather, gathered at the mouth with a drawstring whose two ends hang with a bone bead and a
 *   bead of soul crystal, stitched down one side. 9 across, 8 tall.
 *
 * Detail tiers: primary = the loop with its buckle; the strap with its skull plate; the bag with its gathered mouth; secondary =
 * the stitching, the holes, the plate's rim, the drawstring, the frill of the mouth; tertiary = the prong, the skull's sockets,
 * teeth and nose, the rivets, the beads, the stitch dashes.
 */

import { Polygon } from '@core/draw';
import type { ItemPiece } from '@core/rig';
import { Blob, Decal, Round, Solid, Tube, vec3, visibleArc, type Placed, type Vec3 } from '@core/volume';
import { glint, holes, ring, role, stitches, toned } from './util';

/** Where the coiled belt's strap is at `t` (0 to 1, from the buckle round 1.14 turns to the tip): angle and radius on the floor. */
const COIL = { turns: 1.08, from: 5.5, to: 4.3, width: 2.4 };

export const belt: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const leather = role(materials, 'leather');
  const iron = role(materials, 'steel');
  const hollow = role(materials, 'hollow');
  const at = (t: number, lift: number): Vec3 => {
    const a = t * COIL.turns * Math.PI * 2;
    const r = COIL.from + (COIL.to - COIL.from) * t;
    return g.at(Math.cos(a) * r, Math.sin(a) * r, lift);
  };
  /** The strap from `t0` to `t1`: 16 points, a thin lift so the later turn lies over the earlier one. */
  const run = (t0: number, t1: number): Vec3[] => Array.from({ length: 17 }, (_, i) => at(t0 + ((t1 - t0) * i) / 16, 0.9 * (t0 + ((t1 - t0) * i) / 16)));
  const split = 0.62;
  const first = new Tube(run(0, split + 0.02), COIL.width);
  o.add(first, leather);
  // The tail narrows to a point in the last tenth.
  const tail = new Tube(run(split, 1), (t: number) => COIL.width * (t < 0.86 ? 1 : 1 - ((t - 0.86) / 0.14) * 0.6));
  o.add(tail, leather, { on: first });
  // Stitches along both edges and the holes near the tip, flat over the strap and sorted with the part they lie on.
  const path = (t: number): Vec3 => at(t, 0.9 * t);
  stitches(o, cam, first, path, { t0: 0.04, t1: split, step: 1.0, half: 0.82, color: leather.ramp.lit });
  stitches(o, cam, tail, path, { t0: split + 0.02, t1: 0.84, step: 1.0, half: 0.82, color: leather.ramp.lit });
  holes(o, cam, tail, [0.74, 0.79, 0.84, 0.89].map(path), hollow.ramp.base);
  // The buckle at the start of the strap: an iron frame lying across it, with its prong.
  const radial = g.dir(1, 0, 0);
  const along = g.dir(0, 1, 0);
  const c0 = at(0, 0.12);
  const corner = (a: number, b: number): Vec3 => ({ x: c0.x + radial.x * a + along.x * b, y: c0.y + radial.y * a + along.y * b, z: c0.z + radial.z * a + along.z * b });
  const frame = new Tube([corner(-2.7, -3.0), corner(2.7, -3.0), corner(2.7, 0.9), corner(-2.7, 0.9), corner(-2.7, -3.0)], 0.95);
  o.add(frame, iron, { on: first });
  o.add(new Tube([corner(-2.7, -1.0), corner(0.3, -0.9), corner(1.8, -1.0)], { start: 0.75, end: 0.55 }), toned(iron, -0.15), { on: frame });
};

export const skullBelt: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const leather = role(materials, 'leather');
  const steel = role(materials, 'steel');
  const bone = role(materials, 'bone');
  const hollow = role(materials, 'hollow');
  // The strap stands upright to face the viewer (its face runs along forward, its length across): the plate and the buckle end at
  // +side, the tail at -side. A flat band 3.4 wide, 1 thick, with a pointed tail.
  const half = 1.7;
  const strap = Solid.extrude(g.moved(-0.5, 0, 0).profile('front'), Polygon.fromPoints([{ x: 7, y: -half }, { x: -8.2, y: -half }, { x: -10.8, y: 0 }, { x: -8.2, y: half }, { x: 7, y: half }]), 1);
  o.add(strap, leather);
  const face = 0.52;
  const along = (s: number): Vec3 => g.at(face, s, 0);
  stitches(o, cam, strap, t => along(2.4 - 11.4 * t), { t0: 0, t1: 1, step: 1.0, half: 1.18, color: leather.ramp.lit });
  holes(o, cam, strap, [-4.3, -5.7, -7.1, -8.5].map(along), hollow.ramp.base, 0.45);
  // The plate: a steel oval with a raised rim, rivets round it, and the skull on it.
  const px = 5.6;
  const plate = Round.ellipsoid(g.moved(0.3, px, 0), 1.0, 5.4, 5.8);
  o.add(plate, steel, { on: strap });
  const rim = new Tube(ring(g.at(0.95, px, 0), g.dir(0, 1, 0), g.dir(0, 0, 1), 4.7, { ry: 5.1, n: 30 }), 0.8);
  o.add(rim, toned(steel, -0.2), { on: plate });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.52;
    o.add(Round.ellipsoid(g.moved(1.1, px + Math.cos(a) * 4.7, Math.sin(a) * 5.1), 0.4, 0.4, 0.4), toned(steel, -0.45), { on: rim });
  }
  // The skull: a cranium and a jaw in bone, two sockets, a nose and a row of teeth.
  const skull = new Blob([Round.ellipsoid(g.moved(1.9, px, 1.1), 1.9, 3.5, 3.3), Round.ellipsoid(g.moved(1.7, px, -2.4), 1.6, 2.3, 1.7)]);
  o.add(skull, bone, { on: plate });
  const f = 3.55;
  o.custom(g.at(f, px, 0.5), c => {
    for (const s of [-1.35, 1.35]) {
      const p = cam.project(g.at(f, px + s, 1.3));
      Polygon.ellipse(0.95 * cam.scale, 1.15 * cam.scale, { cx: p.x, cy: p.y, segments: 12 }).fill(c, hollow.ramp.base);
    }
    const n = cam.project(g.at(f, px, -0.7));
    Polygon.triangle(0.7 * cam.scale, 1.0 * cam.scale, { cx: n.x, cy: n.y }).fill(c, hollow.ramp.base);
    for (const s of [-1.2, -0.4, 0.4, 1.2]) {
      const p = cam.project(g.at(f - 0.1, px + s, -2.6));
      Polygon.rect(0.3 * cam.scale, 1.0 * cam.scale, { cx: p.x, cy: p.y }).fill(c, hollow.ramp.base);
    }
  }, { on: skull });
};

export const pouch: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const leather = role(materials, 'leather');
  const bone = role(materials, 'bone');
  const crystal = role(materials, 'crystal');
  const hollow = role(materials, 'hollow');
  const low = -4;
  // The bag: a belly and a gathered neck painted as one mass, and the frill of the mouth.
  const bag = new Blob([
    Round.ellipsoid(g.moved(0, 0, low + 3.6), 4.6, 4.3, 3.7),
    Round.cylinder(g.moved(0, 0, low + 6.4), 2.2, 2.0, 2.0),
  ]);
  o.add(bag, leather);
  const mouth = Round.cylinder(g.moved(0, 0, low + 8.0), 2.0, 1.5, 3.1);
  o.add(mouth, toned(leather, -0.1), { on: bag });
  o.add(Decal.onFace(g, 'top', vec3(0, 0, low + 9.52), Polygon.ellipse(2.5, 2.5, { segments: 20 })), { fill: hollow.ramp.base }, { on: mouth });
  // The drawstring: the half of a ring that faces us, a knot, and two ends with a bone bead and a soul bead.
  const cordStyle = toned(leather, -0.45);
  const arc = visibleArc(cam, g.at(0, 0, low + 7.9), g.dir(1, 0, 0), g.dir(0, 1, 0), 2.15, 2.15);
  if (arc.length > 1) o.add(new Tube(arc, 0.75), cordStyle, { on: mouth });
  const knot = g.at(2.15, 0.2, low + 7.9);
  o.add(Round.ellipsoid(g.moved(2.15, 0.2, low + 7.9), 0.62, 0.62, 0.62), cordStyle, { on: mouth });
  const endA = [knot, g.at(2.9, 0.9, low + 6.9), g.at(3.4, 1.7, low + 5.1)];
  const endB = [knot, g.at(2.7, -0.6, low + 6.7), g.at(3.0, -1.1, low + 4.3)];
  o.add(new Tube(endA, { start: 0.6, end: 0.45 }), cordStyle, { on: mouth });
  o.add(new Tube(endB, { start: 0.6, end: 0.45 }), cordStyle, { on: mouth });
  o.add(Round.ellipsoid(g.moved(3.45, 1.75, low + 4.7), 0.55, 0.55, 0.7), bone, { on: mouth });
  const bead = Round.ellipsoid(g.moved(3.0, -1.1, low + 3.9), 0.6, 0.6, 0.6);
  o.add(bead, crystal, { on: mouth });
  o.custom(g.at(3, -1.1, low + 3.9), c => glint(c, cam.scale, cam.project(g.at(2.8, -1.4, low + 4.2)), { w: 0.25, h: 0.25, strength: 0.9 }), { on: bead });
  // A stitched seam down the front and a belt loop at the back are leather detail: dashes along the seam.
  const seam = Array.from({ length: 6 }, (_, i) => g.at(4.1 - i * 0.12, 1.0 + i * 0.2, low + 5.2 - i * 0.95));
  o.custom(g.at(4, 1, low + 3), c => {
    for (const p of seam) {
      const q = cam.project(p);
      Polygon.rect(0.25 * cam.scale, 0.7 * cam.scale, { cx: q.x, cy: q.y, rotation: 12 }).fill(c, leather.ramp.lit);
    }
  }, { on: bag });
};
