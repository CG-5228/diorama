/**
 * The grave coin: the small tarnished brass coin laid on the eyes of the dead to pay the ferryman. Three coins, 9 across
 * (about four times a real coin, so the skull has room): two lie in a short stack and the third leans on it facing the viewer. Every face is a darker
 * brass field inside a raised rim and a ring of beads; the leaning coin carries a skull engraved in the field, with dark
 * sockets, nose and teeth. Worn brass, so it is matte: no highlight crescent.
 *
 * Coins have no forward, so everything is built on the world's axes round the item's centre (the pose does not apply).
 *
 * Detail tiers: primary = the leaning coin's disc and the two coins under it; secondary = the raised rim, the engraved skull,
 * the stack's thickness; tertiary = the ring of beads, the milled edge, the skull's sockets and teeth.
 */

import { Polygon, type Shape } from '@core/draw';
import type { ItemPiece } from '@core/rig';
import { Decal, Frame3, Round, Tube, add3, cross3, norm3, scale3, vec3, type Placed, type StageObject, type Vec3, type VolumeStyle } from '@core/volume';
import { axisFrame, matte, ring, role } from './util';

/** Radius and thickness of a coin. */
const R = 4.6;
const T = 0.95;

/**
 * The face of a coin whose flat side looks along `n`, centred on `centre` (the middle of the face's plane), `u` across it and
 * `v` along it with `v` pointing to the face's bottom (shape space: x along `u`, y along `v`): a darker field, the rim, the
 * ring of beads and, when `skull`, the skull. Each layer rests on the one before, so they draw in that order from every side.
 */
function face(o: StageObject, host: Placed, brass: VolumeStyle, centre: Vec3, n: Vec3, u: Vec3, v: Vec3, skull: boolean): void {
  const { lit, base, dark } = brass.ramp;
  const at = (x: number, y: number): Vec3 => add3(add3(centre, scale3(u, x)), scale3(v, y));
  let under: Placed = host;
  const lay = (shape: Shape, x: number, y: number, fill: string): void => {
    const d = new Decal(at(x, y), u, v, shape, n);
    o.add(d, { fill }, { on: under });
    under = d;
  };
  lay(Polygon.circle(R - 0.55, { segments: 28 }), 0, 0, base);
  o.add(new Tube(ring(centre, u, v, R - 0.42, { n: 28 }), 0.62), brass, { on: under });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    lay(Polygon.circle(0.27, { segments: 8 }), Math.cos(a) * (R - 1.3), Math.sin(a) * (R - 1.3), lit);
  }
  if (!skull) return;
  // The skull: an engraved cranium and jaw in the lit tone, with dark sockets, a nose and the gaps between the teeth.
  lay(Polygon.circle(1.85, { segments: 20 }), 0, -0.55, lit);
  lay(Polygon.rect(2.1, 1.5, { radius: 0.5 }), 0, 1.35, lit);
  for (const sx of [-0.75, 0.75]) lay(Polygon.circle(0.52, { segments: 10 }), sx, -0.45, dark);
  lay(Polygon.triangle(0.5, 0.7), 0, 0.55, dark);
  for (const tx of [-0.55, 0, 0.55]) lay(Polygon.rect(0.14, 0.9), tx, 1.45, dark);
}

export const graveCoin: ItemPiece = ctx => {
  const { object: o, frame: g, materials } = ctx;
  const brass = matte(role(materials, 'brass'));
  const dark = brass.ramp.dark;
  const origin = g.origin;
  const at = (x: number, y: number, z: number): Vec3 => add3(origin, vec3(x, y, z));

  // The stack: two coins lying flat, the upper one a little off the lower, its face the plain one.
  const lowest = Round.cylinder(axisFrame(at(-1.4, 3.4, -5.6), vec3(0, 0, 1), vec3(1, 0, 0)), R, T, R * 0.98);
  o.add(lowest, brass);
  const upperAt = at(-0.6, 3.1, -5.6 + T);
  const upper = Round.cylinder(axisFrame(upperAt, vec3(0, 0, 1), vec3(1, 0, 0)), R, T, R * 0.98);
  o.add(upper, brass, { on: lowest });
  // The milled edge: short dark ticks round the upper coin's rim, on the half that faces us.
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * 0.05 + (i / 13) * Math.PI * 0.9;
    const p = at(-0.6 + Math.cos(a) * (R + 0.02), 3.1 + Math.sin(a) * (R + 0.02), -5.6 + T * 1.5);
    o.add(Round.ellipsoid(Frame3.facing(p, 0), 0.22, 0.22, 0.4), { ...brass, ramp: { lit: dark, base: dark, dark } }, { on: upper });
  }
  face(o, upper, brass, add3(upperAt, vec3(0, 0, T + 0.02)), vec3(0, 0, 1), vec3(1, 0, 0), vec3(0, 1, 0), false);

  // The leaning coin: its face towards the viewer, turned a little to one side so its thickness shows.
  const n = norm3(vec3(0.3, 0.62, 0.74));
  const u = norm3(cross3(n, vec3(0, 0, 1)));
  const v = cross3(n, u);
  const centre = at(0.8, -0.6, 1.0);
  const coin = Round.cylinder(axisFrame(add3(centre, scale3(n, -T / 2)), n, u), R, T, R * 0.985);
  o.add(coin, brass, { on: upper });
  face(o, coin, brass, add3(centre, scale3(n, T / 2 + 0.02)), n, u, v, true);
};
