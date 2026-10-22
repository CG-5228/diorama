/**
 * The two keys. Both lie along the frame's forward axis, bow behind and bit in front, so the catalog's pose can lay them
 * diagonally in the icon (bit to the upper right). Built flat, 17 units (the bone key) and 18 (the crypt key) long: about twice the length of a house key, so the bit and the bow have room.
 *
 * - `boneKey` (common): a key cut from one long bone. A knobbly ring for the bow, a shaft whose end is the two knobs of the
 *   joint, a bit of three bone plates and a few turns of leather cord where a hand holds it; a leather thong runs through
 *   the bow and ends in a bead of soul crystal, the one saturated thing in it.
 *   Detail tiers: primary = the ring bow and the notched bit; secondary = the shaft with its joint knobs, the cord wraps,
 *   the thong; tertiary = the bead, the knurl of the bow, the bone's own creases.
 * - `cryptKey` (rare): the key of the crypt door. A steel shaft and bit with three teeth, brass collars and cap, and a bow
 *   of four brass lobes round a soul crystal in a bezel.
 *   Detail tiers: primary = the lobed bow with its crystal, the toothed bit; secondary = the collars, the brass tip, the
 *   steel's own plates; tertiary = the bezel ring, the cap's knob, the faceted gem's glint.
 */

import type { ItemContext, ItemPiece } from '@core/rig';
import { Blob, Round, Solid, Tube, vec3, visibleArc, type Frame3, type Placed, type StageObject, type Vec3, type VolumeStyle } from '@core/volume';
import { axisFrame, glint, ring, role } from './util';

/** A bone's knobbly width along a tube: a swell at each end, as a long bone has. */
const bony = (w: number) => (t: number) => w * (1 + 0.28 * Math.pow(Math.cos(t * Math.PI), 4) + 0.08 * Math.sin(t * Math.PI * 7));

/** A flat box lying in the key's plane: from `f0` to `f1` along forward, `s0` to `s1` across, `th` thick and centred on the plane. */
function bar(g: Frame3, f0: number, f1: number, s0: number, s1: number, th: number): Solid {
  return Solid.box(g.moved((f0 + f1) / 2, (s0 + s1) / 2, -th / 2), f1 - f0, s1 - s0, th);
}

/** A band round the shaft (axis forward), only the half the camera sees: a wrap, a collar. */
function band(o: StageObject, cam: ItemContext['camera'], g: Frame3, f: number, r: number, width: number, style: VolumeStyle, host: Placed): void {
  const arc = visibleArc(cam, g.at(f, 0, 0), g.dir(0, 1, 0), g.dir(0, 0, 1), r, r);
  if (arc.length > 1) o.add(new Tube(arc, width), style, { on: host });
}

export const boneKey: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const bone = role(materials, 'bone');
  const knob = role(materials, 'boneLimb', 'bone');
  const leather = role(materials, 'leather');
  const crystal = role(materials, 'crystal');
  const L = (f: number, s: number, u: number): Vec3 => g.at(f, s, u);
  // The bow: a ring cut from the bone, knobbly all round.
  const bow = new Tube(ring(L(-7.1, 0, 0), g.dir(1, 0, 0), g.dir(0, 1, 0), 2.6, { n: 22 }), bony(1.2));
  o.add(bow, bone);
  // The shaft, with the joint's two knobs at its end.
  const shaft = new Blob([
    new Tube([L(-4.7, 0, 0), L(1.2, 0, 0), L(7.0, 0, 0)], bony(1.25)),
    Round.ellipsoid(g.moved(7.5, 0.75, 0), 1.1, 1.0, 0.9),
    Round.ellipsoid(g.moved(7.7, -0.7, 0), 0.95, 0.85, 0.8),
  ]);
  o.add(shaft, knob, { on: bow });
  // The bit: a spine and two prongs of different lengths.
  o.add(bar(g, 4.4, 7.2, 0.45, 1.8, 1.1), bone, { on: shaft });
  o.add(bar(g, 4.4, 5.6, 1.8, 3.9, 1.1), bone, { on: shaft });
  o.add(bar(g, 6.2, 7.2, 1.8, 3.2, 1.1), bone, { on: shaft });
  // A few turns of cord where a hand holds it.
  for (const f of [-3.5, -2.8, -2.1, -1.4]) band(o, cam, g, f, 0.9, 0.62, leather, shaft);
  // A thong through the bow, ending in a bead of soul crystal.
  const thong = [L(-9.6, 0, 0.1), L(-10.9, 1.0, 0.1), L(-11.9, 2.5, 0.1), L(-11.6, 4.0, 0.1), L(-10.4, 4.6, 0.1)];
  o.add(new Tube(thong, { start: 0.75, end: 0.6 }), leather, { on: bow });
  const bead = Round.ellipsoid(g.moved(-9.9, 4.7, 0.1), 1.0, 1.0, 1.0);
  o.add(bead, crystal, { on: bow });
  o.custom(L(-9.9, 4.7, 0.1), c => glint(c, cam.scale, cam.project(L(-10.3, 4.3, 0.7)), { w: 0.4, h: 0.4, strength: 0.9 }), { on: bead });
};

export const cryptKey: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const steel = role(materials, 'steel');
  const brass = role(materials, 'brass');
  const crystal = role(materials, 'crystal');
  const L = (f: number, s: number, u: number): Vec3 => g.at(f, s, u);
  // The bow: four brass lobes round a bezel with a soul crystal in it.
  const centre = L(-7.2, 0, 0);
  const lobes: Tube[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const c = L(-7.2 + Math.cos(a) * 2.55, Math.sin(a) * 2.55, 0);
    const lobe = new Tube(ring(c, g.dir(1, 0, 0), g.dir(0, 1, 0), 1.55, { n: 14 }), 1.05);
    lobes.push(lobe);
  }
  const bezel = new Tube(ring(centre, g.dir(1, 0, 0), g.dir(0, 1, 0), 1.9, { n: 18 }), 1.0);
  const bow = new Blob([...lobes, bezel]);
  o.add(bow, brass);
  const gem = Round.ellipsoid(g.moved(-7.2, 0, 0.1), 1.6, 1.6, 1.3);
  o.add(gem, crystal, { on: bow });
  o.custom(centre, c => glint(c, cam.scale, cam.project(L(-7.9, -0.7, 1.2)), { w: 0.4, h: 0.9, angle: 30, strength: 0.9 }), { on: gem });
  // The shaft: round steel with a brass collar at each end and a cap.
  const shaft = new Tube([L(-5.2, 0, 0), L(1.5, 0, 0), L(7.4, 0, 0)], 1.45);
  o.add(shaft, steel, { on: bow });
  const collar = (f: number, w: number) => o.add(Round.cylinder(axisFrame(L(f - w / 2, 0, 0), g.dir(1, 0, 0), g.dir(0, 0, 1)), 1.15, w), brass, { on: shaft });
  collar(-4.8, 1.0);
  collar(-1.2, 0.8);
  o.add(Round.ellipsoid(g.moved(7.7, 0, 0), 1.0, 0.85, 0.8), brass, { on: shaft });
  // The bit: a spine and three teeth of different lengths.
  o.add(bar(g, 3.0, 7.0, 0.6, 2.0, 1.2), steel, { on: shaft });
  o.add(bar(g, 3.0, 4.3, 2.0, 4.6, 1.2), steel, { on: shaft });
  o.add(bar(g, 4.9, 5.8, 2.0, 3.4, 1.2), steel, { on: shaft });
  o.add(bar(g, 6.3, 7.0, 2.0, 4.2, 1.2), steel, { on: shaft });
};
