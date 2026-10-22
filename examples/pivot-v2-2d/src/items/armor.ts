/**
 * Armor drawn as loot, from the same pieces and proportions as the gear kit (`../gear/`): the round shield, the iron
 * greave, the iron bracer and the leather leg wraps. The gear kit draws these on a body; alone, a shell round a limb is a
 * grey slab, so each gets its own piece here, a little larger than worn, with the details that make it read in a hand.
 *
 * - `roundShield`: lies flat, face up, and the catalog tips it towards the viewer. Planks with dark seams, a crimson painted
 *   band, an iron rim with rivets and an iron boss. 16 across (twice the worn one), 1.5 thick.
 * - `greave`: a tapered iron plate along forward (knee end behind, ankle end in front), flat across the shin, with a knee cop,
 *   a ridge down the front, three leather straps with iron buckles and rivets. The catalog stands it upright, knee up.
 * - `bracer`: a short cuff for the forearm (8 long, a flared open end 8 across), dark inside, with two straps and rim bands. Short
 *   and wide where the greave is long and narrow, and lying down with its mouth to the viewer, so the two never read alike.
 * - `legWraps`: two rolls of leather strip with a loose strip across them.
 *
 * Detail tiers (all four): primary = the silhouette (disc, tapered shell, two rolls); secondary = straps, rims, bands, the
 * boss, the ridge; tertiary = rivets, buckles, seams, the dark inside of the open end.
 */

import { Polygon } from '@core/draw';
import type { ItemPiece } from '@core/rig';
import { Blob, Decal, Round, Solid, Tube, vec3, visibleArc, type Frame3, type Placed, type StageObject, type Vec3, type VolumeStyle } from '@core/volume';
import { axisFrame, ring, role, toned } from './util';

/** A band round an axis along forward: the half the camera sees, `r` out from the axis. */
function strap(o: StageObject, cam: Parameters<ItemPiece>[0]['camera'], g: Frame3, f: number, rx: number, ry: number, width: number, style: VolumeStyle, on: Placed): void {
  const arc = visibleArc(cam, g.at(f, 0, 0), g.dir(0, 1, 0), g.dir(0, 0, 1), rx, ry);
  if (arc.length > 1) o.add(new Tube(arc, width), style, { on });
}

export const roundShield: ItemPiece = ctx => {
  const { object: o, frame: g, materials } = ctx;
  const planks = role(materials, 'planks', 'wood');
  const iron = role(materials, 'iron');
  const paint = role(materials, 'clothAccent');
  const R = 8.2;
  const T = 1.5;
  const disc = Round.cylinder(g.moved(0, 0, -T / 2), R, T, R * 0.985);
  o.add(disc, planks);
  const top = T / 2 + 0.02;
  const lay = (shape: Polygon, fill: string, host: Placed, f = 0, s = 0, up = top): Decal => {
    const d = Decal.onFace(g, 'top', vec3(f, s, up), shape);
    o.add(d, { fill }, { on: host });
    return d;
  };
  // Dark plank seams, a painted band across them, then the rim, the boss and the rivets.
  const seams = [-2.8, 0, 2.8].map(x => lay(Polygon.rect(0.4, 2 * Math.sqrt((R - 1.1) ** 2 - x * x)), planks.ramp.dark, disc, 0, x));
  const band = lay(Polygon.rect(2 * R - 1.7, 3.3, { rotation: 35 }), paint.ramp.base, seams[2]);
  lay(Polygon.rect(2 * R - 1.7, 0.45, { rotation: 35, cy: -1.0 }), paint.ramp.lit, band);
  const rim = new Tube(ring(g.at(0, 0, T / 2 + 0.05), g.dir(1, 0, 0), g.dir(0, 1, 0), R - 0.55, { n: 36 }), 1.25);
  o.add(rim, iron, { on: disc });
  o.add(Round.ellipsoid(g.moved(0, 0, T / 2 + 0.1), 2.6, 2.6, 1.7), iron, { on: rim });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    o.add(Round.ellipsoid(g.moved(Math.cos(a) * (R - 0.55), Math.sin(a) * (R - 0.55), T / 2 + 0.25), 0.42, 0.42, 0.42), toned(iron, -0.35), { on: rim });
  }
};

/** The shell of a limb guard: a loft of three ellipses along forward, from the wide end (behind) to the narrow one (in front). */
function shell(g: Frame3, rings: [number, number, number][]): Round {
  return Round.loft(rings.map(([f, rs, ru]) => ({ center: g.at(f, 0, 0), rx: rs, ry: ru, axes: [g.dir(0, 1, 0), g.dir(0, 0, 1)] as [Vec3, Vec3] })));
}

export const greave: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const iron = role(materials, 'iron');
  const leather = role(materials, 'leather');
  // Half-widths across and up at forward f: wide at the knee, narrow at the ankle, and flat across the shin (a plate that wraps, not a barrel).
  const rs = (f: number) => 3.6 - (f + 8) * 0.1;
  const ru = (f: number) => 2.3 - (f + 8) * 0.065;
  const body = shell(g, [[-8, rs(-8), ru(-8)], [0, rs(0), ru(0)], [8, rs(8), ru(8)]]);
  o.add(body, iron);
  // The knee cop, with its rim and a boss.
  const cop = Round.ellipsoid(g.moved(-8.2, 0, 0.5), 2.1, 4.4, 2.9);
  o.add(cop, toned(iron, -0.15), { on: body });
  o.add(Round.ellipsoid(g.moved(-9.5, 0, 0.7), 0.9, 0.9, 0.9), toned(iron, -0.4), { on: cop });
  // The ridge down the front, with rivets along it.
  const ridge = new Tube([-6.2, -3, 0, 3, 6.4].map(f => g.at(f, 0, ru(f) + 0.2)), { start: 1.2, end: 0.8 });
  o.add(ridge, toned(iron, -0.3), { on: body });
  for (const f of [-5, -1.4, 2.2, 5.6]) o.add(Round.ellipsoid(g.moved(f, 0, ru(f) + 0.55), 0.38, 0.38, 0.38), toned(iron, -0.5), { on: ridge });
  // Three leather straps with iron buckles.
  for (const f of [-4.4, 0.4, 5]) {
    strap(o, cam, g, f, rs(f) + 0.12, ru(f) + 0.12, 1.3, leather, body);
    o.add(Solid.box(g.moved(f, 0, ru(f) + 0.1), 1.1, 1.7, 0.5), toned(iron, -0.2), { on: body });
  }
};

export const bracer: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const iron = role(materials, 'iron');
  const leather = role(materials, 'leather');
  const hollow = role(materials, 'hollow');
  // From the elbow (behind, open) to the wrist (in front): a short cuff that flares to a wide open end (8 long, 8 across the mouth).
  const L = 4;
  const rs = (f: number) => 4.1 - (f + L) * 0.17;
  const ru = (f: number) => 3.7 - (f + L) * 0.15;
  const body = shell(g, [[-L, rs(-L), ru(-L)], [0, rs(0), ru(0)], [L, rs(L), ru(L)]]);
  o.add(body, iron);
  // The open end: the inside, dark, with a flared rim round it.
  const mouth = Decal.onFace(g, 'back', vec3(-L - 0.05, 0, 0), Polygon.ellipse(rs(-L) * 0.88, ru(-L) * 0.88, { segments: 22 }));
  o.add(mouth, { fill: hollow.ramp.base }, { on: body });
  // Rim bands at both ends, two straps with buckles between them, and a row of rivets on the band at the wrist.
  for (const f of [-L + 0.35, L - 0.35]) strap(o, cam, g, f, rs(f) + 0.1, ru(f) + 0.1, 1.0, toned(iron, -0.3), body);
  for (const f of [-1.5, 1.4]) {
    strap(o, cam, g, f, rs(f) + 0.12, ru(f) + 0.12, 1.25, leather, body);
    o.add(Solid.box(g.moved(f, 0, ru(f) + 0.1), 1.0, 1.6, 0.5), toned(iron, -0.2), { on: body });
  }
  const fw = L - 0.35;
  for (const s of [-1.7, -0.6, 0.6, 1.7]) o.add(Round.ellipsoid(g.moved(fw, s, ru(fw) * Math.sqrt(1 - (s / rs(fw)) ** 2) + 0.35), 0.34, 0.34, 0.34), toned(iron, -0.5), { on: body });
};

export const legWraps: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const leather = role(materials, 'leather');
  const bone = role(materials, 'bone');
  const along = (s: number, u: number, f: number) => axisFrame(g.at(f, s, u), g.dir(1, 0, 0), g.dir(0, 0, 1));
  const rolls: Round[] = [];
  // Two rolls side by side, the second a little behind and higher, each with turns of strip showing.
  for (const [s, u, f0] of [[-2.4, 0, -3.2], [2.4, 0.9, -2.4]] as const) {
    const roll = Round.cylinder(along(s, u, f0), 2.3, 6.4, 2.2);
    o.add(roll, leather);
    rolls.push(roll);
    for (let i = 0; i < 5; i++) {
      const f = f0 + 0.9 + i * 1.2;
      const arc = visibleArc(cam, g.at(f, s, u), g.dir(0, 1, 0), g.dir(0, 0, 1), 2.32, 2.32);
      if (arc.length > 1) o.add(new Tube(arc, 0.4), toned(leather, 0.45), { on: roll });
    }
  }
  // A loose strip across both, and a bone toggle on its end.
  const strip = new Tube([g.at(-3.8, -1.4, 2.4), g.at(-0.5, 0.5, 3.4), g.at(2.4, 2.0, 3.6), g.at(5.2, 4.2, 1.4)], { start: 1.5, end: 1.3 });
  o.add(strip, toned(leather, -0.1), { on: rolls[1] });
  o.add(Round.ellipsoid(g.moved(5.4, 4.5, 1.1), 0.9, 0.5, 0.5), bone, { on: strip });
};
