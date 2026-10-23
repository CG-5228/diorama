/**
 * The reliquary amulet: a pendant in the shape of a small coffin (a reliquary of the kind the crypts keep), cast in brass
 * with a raised bezel and four rivets, holding a splinter of soul crystal behind its window; a teardrop of crystal hangs
 * from its foot and a loop of steel chain rises through its bail. The coffin is 10 units tall and 8 across, the chain's
 * links 1.2 long: about four times the size of a real pendant, so the window and the links have room.
 *
 * It hangs facing the viewer (the catalog turns it a little so its thickness shows): its face runs along the frame's
 * forward axis, its width across and its height up. Soul green is the splinter and the drop, the one saturated color.
 *
 * Detail tiers: primary = the coffin-shaped pendant and the loop of chain above it; secondary = the bezel, the window with
 * its splinter, the bail, the hanging drop; tertiary = the rivets, the links' alternate turns, the splinter's facets.
 */

import { Polygon, alpha } from '@core/draw';
import type { ItemPiece } from '@core/rig';
import { Decal, Round, Solid, Tube, add3, cross3, dot3, norm3, scale3, sub3, vec3, type Vec3 } from '@core/volume';
import { glint, ring, role } from './util';

/** The coffin's outline, x across and y up: a head, shoulders, a tapering body and a foot (units, around the pendant's middle). */
const COFFIN: [number, number][] = [[-2.1, 5.2], [2.1, 5.2], [3.9, 1.9], [2.45, -5.2], [-2.45, -5.2], [-3.9, 1.9]];

/** The outline scaled about its middle. */
const scaled = (k: number): [number, number][] => COFFIN.map(([x, y]) => [x * k, y * k]);

export const reliquaryAmulet: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const brass = role(materials, 'brass');
  const steel = role(materials, 'steel');
  const hollow = role(materials, 'hollow');
  const crystal = role(materials, 'crystal');
  const L = (f: number, s: number, u: number): Vec3 => g.at(f, s, u);
  const mid = 0; // the pendant's middle, in frame height
  const front = 0.95;

  // The pendant: the coffin extruded 1.8 along forward, centred on the frame's origin.
  const body = Solid.extrude(g.moved(-0.9, 0, mid).profile('front'), Polygon.fromPoints(COFFIN.map(([x, y]) => ({ x, y }))), 1.8);
  o.add(body, brass);
  // The bezel: a raised line round the window.
  const bezel = scaled(0.76);
  o.add(new Tube([...bezel, bezel[0]].map(([x, y]) => L(front + 0.05, -x, mid + y)), 0.55), brass, { on: body });
  // The window, dark, with a halo of soul and the splinter in it: a tall kite of three facets, as the crystal solids have.
  const flat = (shape: Polygon, fill: string, from: Decal | undefined, at = vec3(front + 0.02, 0, mid)): Decal => {
    const d = Decal.onFace(g, 'front', at, shape);
    o.add(d, { fill }, { on: from ?? body });
    return d;
  };
  const win = flat(Polygon.fromPoints(scaled(0.68).map(([x, y]) => ({ x, y: -y }))), hollow.ramp.base, undefined);
  const halo = flat(Polygon.ellipse(2.5, 3.7, { segments: 20 }), alpha(crystal.ramp.base, 0.3), win);
  const kite = (pts: [number, number][]) => Polygon.fromPoints(pts.map(([x, y]) => ({ x, y })));
  const left = flat(kite([[0, -3.1], [-1.45, -0.4], [0, 3.0], [0, -0.4]]), crystal.ramp.dark, halo, vec3(front + 0.03, 0, mid - 0.1));
  const right = flat(kite([[0, -3.1], [1.45, -0.4], [0, 3.0], [0, -0.4]]), crystal.ramp.base, left, vec3(front + 0.03, 0, mid - 0.1));
  flat(kite([[0, -3.1], [-0.75, -1.6], [0, -1.1]]), crystal.ramp.lit, right, vec3(front + 0.03, 0, mid - 0.1));
  // Four rivets at the shoulders and the foot.
  for (const [s, u] of [[-3.0, 3.6], [3.0, 3.6], [-1.95, -4.4], [1.95, -4.4]] as const) o.add(Round.ellipsoid(g.moved(front, s, mid + u), 0.36, 0.36, 0.36), { ...brass }, { on: body });

  // The bail at the head, and the loop of chain that passes through it.
  const bailTop = mid + 5.2;
  const bail = new Tube(ring(L(0, 0, bailTop + 0.55), g.dir(1, 0, 0), g.dir(0, 0, 1), 0.85, { ry: 1.05, n: 14 }), 0.55);
  o.add(bail, brass, { on: body });
  const side = g.dir(0, 1, 0);
  const up = g.dir(0, 0, 1);
  const loopBottom = bailTop + 0.2;
  const rz = 2.6;
  const loop = ring(L(0, 0, loopBottom + rz), side, up, 2.2, { ry: rz, n: 40, from: -Math.PI / 2, to: (3 * Math.PI) / 2 });
  // Links: oval rings along the loop, every other one turned a quarter so the chain reads as links and not a cord.
  const pitch = 1.2;
  const lengths = loop.slice(1).map((p, i) => Math.hypot(p.x - loop[i].x, p.y - loop[i].y, p.z - loop[i].z));
  const total = lengths.reduce((a, b) => a + b, 0);
  const links = Math.round(total / pitch);
  for (let i = 0; i < links; i++) {
    let want = ((i + 0.5) / links) * total;
    let seg = 0;
    while (seg < lengths.length - 1 && want > lengths[seg]) want -= lengths[seg++];
    const a = loop[seg];
    const b = loop[seg + 1];
    const tangent = norm3(sub3(b, a));
    const at = add3(a, scale3(tangent, want));
    const turn = i % 2 === 0 ? g.dir(1, 0, 0) : cross3(tangent, g.dir(1, 0, 0));
    const across = norm3(sub3(turn, scale3(tangent, dot3(turn, tangent))));
    o.add(new Tube(ring(at, tangent, across, pitch * 0.62, { ry: pitch * 0.34, n: 10 }), 0.42), steel, { on: bail });
  }

  // The drop hanging from the foot: a brass cap and a teardrop of crystal.
  const foot = mid - 5.2;
  o.add(Round.ellipsoid(g.moved(0, 0, foot - 0.45), 0.55, 0.55, 0.5), brass, { on: body });
  const drop = Round.ellipsoid(g.moved(0, 0, foot - 1.9), 0.9, 0.9, 1.3);
  o.add(drop, crystal, { on: body });
  o.custom(L(0, 0, foot - 1.9), c => glint(c, cam.scale, cam.project(L(0.4, -0.35, foot - 1.4)), { w: 0.3, h: 0.7, angle: 20, strength: 0.9 }), { on: drop });
};
