/**
 * Cloth and strap loot, from the gear kit's own garments: the tunic, the tabard, the high collar and the baldric. Each of these
 * is a few panels of cloth or a strap that only has a shape round a body, so alone they are drawn as they lie when set down:
 *
 * - `tunic`: laid flat, neck to the top and the sleeves spread (14 across the sleeves, 13 long), dark cloth with a dark
 *   neck opening, a lace at the throat, crimson cuffs and a stitched hem. The catalog tips it up to face the viewer.
 * - `tabard`: a long panel (16 by 9) of the crimson accent cloth, flaring to a torn hem, with trim down both edges, a bone
 *   diamond for a badge and a leather tie across the top that hangs in two ends.
 * - `highCollar`: the collar as it stands when set down on its neck-hole: a flared band of crimson cloth (3.6 across at the foot,
 *   to about 9 at the tips) that is open at the front and rises to two pointed tips at the sides, dipping between them at the
 *   back, a dark trim along its top edge and two brass hooks at the front. Worn, the part is a plate behind a neck, and
 *   drawn on its own it read as a bowl on two legs; as a ring it reads as a collar. The catalog turns its open front to the viewer.
 * - `baldric`: a strap of leather in a long S (18 long, 2.8 wide), a steel buckle at one end, holes near the tip at the
 *   other and a steel sword ring on the strap's bend. The catalog lays it on a diagonal.
 *
 * Detail tiers: primary = the shirt's T, the panel's flare and torn hem, the strap's S; secondary = the neck, the trim, the
 * badge, the buckle, the ring; tertiary = the lace, the stitches, the holes, the tie's ends.
 */

import { Polygon, alpha } from '@core/draw';
import type { ItemPiece } from '@core/rig';
import { Decal, Round, Solid, Tube, dot3, polygonNormal, vec3, type Face, type Placed, type Vec3 } from '@core/volume';
import { holes, ring, role, stitches, toned } from './util';

/** The thickness of a cloth panel. */
const CLOTH = 0.8;

export const tunic: ItemPiece = ctx => {
  const { object: o, frame: g, materials } = ctx;
  const cloth = role(materials, 'cloth');
  const trim = role(materials, 'clothAccent');
  const leather = role(materials, 'leather');
  const hollow = role(materials, 'hollow');
  // The outline in the plane: x neck (-) to hem (+), y across. Armpits tuck in between the sleeves and the body; the hem is a little uneven.
  const outline = [
    { x: -6.2, y: -1.9 }, { x: -5.4, y: 0 }, { x: -6.2, y: 1.9 }, { x: -5.6, y: 4.2 }, { x: -3.9, y: 10.2 }, { x: -0.6, y: 10.6 }, { x: -0.2, y: 4.5 },
    { x: 3.2, y: 4.9 }, { x: 6.7, y: 4.7 }, { x: 7.1, y: 2.4 }, { x: 6.5, y: 0 }, { x: 7.2, y: -2.4 }, { x: 6.8, y: -4.7 }, { x: 3.2, y: -4.9 },
    { x: -0.2, y: -4.5 }, { x: -0.6, y: -10.6 }, { x: -3.9, y: -10.2 }, { x: -5.6, y: -4.2 },
  ];
  const body = Solid.extrude(g.moved(0, 0, -CLOTH / 2), Polygon.fromPoints(outline), CLOTH);
  o.add(body, cloth);
  const top = CLOTH / 2 + 0.02;
  // A decal in the viewer's reading of the top face: x across, y towards the hem.
  let under: Placed = body;
  const lay = (shape: Polygon, fill: string, f: number, s: number): void => {
    const d = Decal.onFace(g, 'top', vec3(f, s, top), shape);
    o.add(d, { fill }, { on: under });
    under = d;
  };
  // The shade of the folds, away from the light (upper left): under each sleeve, down the body's right side and at the armpits.
  const shade = alpha(cloth.ramp.dark, 0.42);
  const thread = alpha(cloth.ramp.dark, 0.85);
  for (const side of [-1, 1]) {
    lay(Polygon.rect(6.4, 2.2, { radius: 0.8 }), shade, -1.8, side * 7.6);
    lay(Polygon.triangle(2.4, 2.8), shade, 0.6, side * 4.0);
  }
  lay(Polygon.rect(2.4, 11, { radius: 1 }), shade, 0.9, -3.0);
  lay(Polygon.ellipse(2.1, 1.3, { segments: 18 }), hollow.ramp.base, -5.4, 0);
  // The lace at the throat: three eyelets and a cross of cord below the neck.
  for (const f of [-4.1, -3.2, -2.3]) lay(Polygon.circle(0.26, { segments: 8 }), leather.ramp.base, f, 0.9 * (f === -3.2 ? -1 : 1));
  lay(Polygon.rect(0.22, 2.6, { rotation: 20 }), leather.ramp.lit, -3.2, 0);
  lay(Polygon.rect(0.22, 2.6, { rotation: -20 }), leather.ramp.lit, -3.2, 0);
  // Stitched hem and cuffs: a row of lit dashes.
  for (let i = 0; i < 9; i++) lay(Polygon.rect(0.7, 0.24), thread, 6.1, -3.6 + i * 0.9);
  // Crimson cuffs on both sleeves, a lit stripe down each.
  for (const side of [-1, 1]) {
    lay(Polygon.rect(1.3, 3.4, { radius: 0.3 }), trim.ramp.base, -2.3, side * 9.5);
    lay(Polygon.rect(0.45, 3.0), trim.ramp.lit, -2.3, side * 9.5);
  }
};

export const tabard: ItemPiece = ctx => {
  const { object: o, frame: g, materials } = ctx;
  const panel = role(materials, 'clothAccent', 'cloth');
  const trim = role(materials, 'cloth');
  const bone = role(materials, 'bone');
  const leather = role(materials, 'leather');
  // Narrow at the top (neck side, -x), flaring to a torn hem of five points (+x).
  const outline = [
    { x: -8, y: -3.4 }, { x: -8, y: 3.4 }, { x: 0, y: 4.1 }, { x: 5.6, y: 4.5 }, { x: 7.4, y: 3.6 }, { x: 8.3, y: 2.2 }, { x: 7.2, y: 1.2 },
    { x: 8.6, y: 0 }, { x: 7.4, y: -1.2 }, { x: 8.1, y: -2.3 }, { x: 7.0, y: -3.4 }, { x: 5.6, y: -4.5 }, { x: 0, y: -4.1 },
  ];
  const body = Solid.extrude(g.moved(0, 0, -CLOTH / 2), Polygon.fromPoints(outline), CLOTH);
  o.add(body, panel);
  const top = CLOTH / 2 + 0.02;
  let under: Placed = body;
  const lay = (shape: Polygon, fill: string, f: number, s: number): void => {
    const d = Decal.onFace(g, 'top', vec3(f, s, top), shape);
    o.add(d, { fill }, { on: under });
    under = d;
  };
  // Trim down both edges (a band of the dark cloth), a hem band, and the badge: a bone diamond with a dark centre.
  for (const side of [-1, 1]) lay(Polygon.rect(0.7, 14.2), trim.ramp.base, -0.4, side * 3.4);
  lay(Polygon.rect(7.2, 0.6), trim.ramp.base, 5.6, 0);
  lay(Polygon.diamond(3.4, 5.2), bone.ramp.base, 0.2, 0);
  lay(Polygon.diamond(1.5, 2.4), trim.ramp.dark, 0.2, 0);
  // The tie across the top: a leather cord, a knot and two hanging ends.
  const tie = new Tube([g.at(-8.2, -3.6, 0.4), g.at(-8.4, 0, 0.9), g.at(-8.2, 3.6, 0.4)], 0.8);
  o.add(tie, leather, { on: body });
  o.add(Round.ellipsoid(g.moved(-8.4, 0.4, 1.0), 0.8, 0.8, 0.7), leather, { on: tie });
  o.add(new Tube([g.at(-8.4, 0.4, 1.0), g.at(-6.8, 1.0, 0.7), g.at(-5.0, 1.5, 0.5)], { start: 0.7, end: 0.5 }), leather, { on: tie });
  o.add(new Tube([g.at(-8.4, 0.4, 1.0), g.at(-7.0, -0.2, 0.7), g.at(-5.6, -0.9, 0.5)], { start: 0.7, end: 0.5 }), leather, { on: tie });
};

/** The collar's height at `deg` degrees from the open front (0 to 180): low at the hooks, a pointed tip at 100, a shallow dip at the back. */
const collarHeight = (deg: number): number => {
  const table: [number, number][] = [[40, 2.3], [100, 11], [180, 5.6]];
  for (let i = 1; i < table.length; i++) {
    if (deg <= table[i][0]) {
      const [a0, h0] = table[i - 1];
      const [a1, h1] = table[i];
      return h0 + ((h1 - h0) * (deg - a0)) / (a1 - a0);
    }
  }
  return table[table.length - 1][1];
};

export const highCollar: ItemPiece = ctx => {
  const { object: o, frame: g, materials } = ctx;
  const cloth = role(materials, 'clothAccent', 'cloth');
  const trim = role(materials, 'cloth');
  const brass = role(materials, 'brass');
  const r0 = 3.6;
  const flare = 0.62;
  const thick = 0.75;
  const first = 40;
  const n = 44;
  // The angle (from the front, going round the back) of each cut, in degrees, and the wall's points at it: outer and inner, foot and top.
  const cuts = Array.from({ length: n + 1 }, (_, i) => first + ((360 - 2 * first) * i) / n);
  const at = (deg: number, r: number, z: number): Vec3 => g.at(r * Math.cos((deg * Math.PI) / 180), r * Math.sin((deg * Math.PI) / 180), z);
  const hOf = (deg: number) => collarHeight(deg > 180 ? 360 - deg : deg);
  const ring4 = cuts.map(deg => {
    const h = hOf(deg);
    return { deg, h, bo: at(deg, r0, 0), bi: at(deg, r0 - thick, 0), to: at(deg, r0 + flare * h, h), ti: at(deg, r0 + flare * h - thick, h) };
  });
  const faces: Face[] = [];
  const quad = (pts: Vec3[], hint: Vec3): void => {
    let normal = polygonNormal(pts);
    if (dot3(normal, hint) < 0) {
      pts = [...pts].reverse();
      normal = polygonNormal(pts);
    }
    faces.push({ points: pts, normal });
  };
  const radial = (deg: number, k = 1) => g.dir(Math.cos((deg * Math.PI) / 180) * k, Math.sin((deg * Math.PI) / 180) * k, 0);
  for (let i = 0; i < n; i++) {
    const a = ring4[i];
    const b = ring4[i + 1];
    const mid = (a.deg + b.deg) / 2;
    quad([a.bo, b.bo, b.to, a.to], radial(mid));
    quad([a.bi, b.bi, b.ti, a.ti], radial(mid, -1));
    quad([a.to, b.to, b.ti, a.ti], g.dir(0, 0, 1));
    quad([a.bo, a.bi, b.bi, b.bo], g.dir(0, 0, -1));
  }
  // The two ends, where the collar opens at the front.
  for (const [end, sign] of [[ring4[0], -1], [ring4[n], 1]] as const) {
    const t = (end.deg * Math.PI) / 180;
    quad([end.bo, end.to, end.ti, end.bi], g.dir(-Math.sin(t) * sign, Math.cos(t) * sign, 0));
  }
  const body = new Solid(faces);
  o.add(body, cloth);
  // The trim: a dark cord along the top edge, from tip to tip round the back.
  o.add(new Tube(ring4.map(p => at(p.deg, r0 + flare * p.h - thick / 2, p.h + 0.15)), 0.8), trim, { on: body });
  // Two brass hooks where the collar closes at the front.
  for (const end of [ring4[0], ring4[n]]) {
    const t = (end.deg * Math.PI) / 180;
    const rr = r0 - thick / 2;
    o.add(Round.ellipsoid(g.moved(rr * Math.cos(t), rr * Math.sin(t), 1.6), 0.55, 0.55, 0.55), brass, { on: body });
  }
};

export const baldric: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const leather = role(materials, 'leather');
  const steel = role(materials, 'steel');
  const hollow = role(materials, 'hollow');
  const width = 2.8;
  // The strap's centre line in the plane: an S, 18 long, 3.8 to each side, as local (forward, side).
  const local = (t: number): [number, number] => [-9 + 18 * t, 2.1 * Math.sin(t * Math.PI * 2)];
  const at = (t: number): Vec3 => g.at(local(t)[0], local(t)[1], 0);
  const strap = new Tube(Array.from({ length: 21 }, (_, i) => at(i / 20)), (t: number) => width * (t < 0.9 ? 1 : 1 - ((t - 0.9) / 0.1) * 0.55));
  o.add(strap, leather);
  stitches(o, cam, strap, at, { t0: 0.08, t1: 0.88, step: 1.0, half: 0.95, color: leather.ramp.lit });
  holes(o, cam, strap, [0.7, 0.75, 0.8, 0.85].map(at), hollow.ramp.base, 0.45);
  // The buckle at the start: a steel frame across the strap with a prong, turned along the strap's first direction.
  const [f0, s0] = local(0);
  const [f1, s1] = local(0.02);
  const n = Math.hypot(f1 - f0, s1 - s0);
  const along: [number, number] = [(f1 - f0) / n, (s1 - s0) / n];
  const across: [number, number] = [-along[1], along[0]];
  const corner = (p: number, q: number): Vec3 => g.at(f0 + along[0] * p + across[0] * q, s0 + along[1] * p + across[1] * q, 0.1);
  const frame = new Tube([corner(-2.4, -2.1), corner(0.6, -2.1), corner(0.6, 2.1), corner(-2.4, 2.1), corner(-2.4, -2.1)], 0.8);
  o.add(frame, steel, { on: strap });
  o.add(new Tube([corner(-2.4, 0.2), corner(0.1, 0.2)], 0.55), toned(steel, 0.2), { on: frame });
  // The sword ring, hung from the strap's first bend.
  const [fm, sm] = local(0.3);
  const hoop = new Tube(ring(g.at(fm + 0.4, sm + 1.6, 0.4), g.dir(1, 0, 0), g.dir(0, 1, 0), 1.6, { n: 18 }), 0.75);
  o.add(hoop, steel, { on: strap });
};
