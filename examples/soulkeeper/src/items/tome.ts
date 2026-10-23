/**
 * The necromancer's tome: a heavy book bound in dusk-violet cloth over boards, 9.4 wide, 12.6 tall and 3.4 thick, standing
 * on its fore-edge facing the viewer (the catalog tips it back and turns it so the cover, the spine and the page edge all
 * show). A rounded spine with four brass bands, brass corners, a clasp, and on the cover the one thing that matters: an eye
 * of soul in two brass rings, with a ring of runes round it. A crimson ribbon hangs out of the pages.
 *
 * Built along the frame: the cover looks along forward, the width runs across and the height up, the spine on the left.
 *
 * Detail tiers: primary = the book's block with its spine and the eye on the cover; secondary = the brass corners, the
 * clasp, the spine bands, the page block and the ribbon; tertiary = the runes round the eye, the rivets on the corners,
 * the glint on the iris.
 */

import { Path, Polygon, type Shape } from '@core/draw';
import type { ItemPiece } from '@core/rig';
import { Decal, Round, Solid, Tube, visibleArc, vec3, type Frame3, type Placed, type Vec3 } from '@core/volume';
import { glint, ring, role } from './util';

const W = 9.4;
const H = 12.6;

/** A box from `f0` to `f1` along forward, `s0` to `s1` across and `u0` to `u1` up, in the book's frame. */
const box = (g: Frame3, f0: number, f1: number, s0: number, s1: number, u0: number, u1: number): Solid =>
  Solid.box(g.moved((f0 + f1) / 2, (s0 + s1) / 2, u0), f1 - f0, s1 - s0, u1 - u0);

export const necromancersTome: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const cover = role(materials, 'cloth');
  const brass = role(materials, 'brass');
  const vellum = role(materials, 'parchment');
  const leather = role(materials, 'leather');
  const ribbon = role(materials, 'clothAccent');
  const glow = role(materials, 'glow');
  const hollow = role(materials, 'hollow');
  const L = (f: number, s: number, u: number): Vec3 => g.at(f, s, u);
  const top = H / 2;

  // The boards and the pages between them: the back cover, the block of pages (a little inset) and the front cover.
  const back = box(g, -1.7, -1.2, -W / 2, W / 2, -top, top);
  o.add(back, cover);
  const pages = box(g, -1.2, 1.2, -W / 2 + 0.5, W / 2 - 0.35, -top + 0.4, top - 0.4);
  o.add(pages, vellum, { on: back });
  const front = box(g, 1.2, 1.7, -W / 2, W / 2, -top, top);
  o.add(front, cover, { on: pages });
  // The rounded spine, standing on the book's left edge, with four brass bands.
  const spine = Round.cylinder(g.moved(0, -W / 2 + 0.1, -top), 1.8, H, 1.8);
  o.add(spine, cover, { on: back });
  for (const u of [-4.7, -1.6, 1.6, 4.7]) {
    const arc = visibleArc(cam, L(0, -W / 2 + 0.1, u), g.dir(1, 0, 0), g.dir(0, 1, 0), 1.9, 1.9);
    if (arc.length > 1) o.add(new Tube(arc, 0.6), brass, { on: spine });
  }
  // Brass corners on the fore-edge side of the front cover, and two near the spine.
  const corner = (s: number, u: number, sgn: number, up: number): Solid => box(g, 1.7, 2.0, Math.min(s, s + sgn * 2.2), Math.max(s, s + sgn * 2.2), Math.min(u, u + up * 2.2), Math.max(u, u + up * 2.2));
  for (const [s, u, sg, ug] of [[W / 2, top, -1, -1], [W / 2, -top, -1, 1], [-W / 2 + 1.7, top, 1, -1], [-W / 2 + 1.7, -top, 1, 1]] as const) {
    o.add(corner(s, u, sg, ug), brass, { on: front });
    o.add(Round.ellipsoid(g.moved(2.05, s + sg * 1.1, u + ug * 1.1), 0.33, 0.33, 0.33), brass, { on: front });
  }
  // The clasp: a leather strap over the fore-edge with a brass lock plate.
  const strap = box(g, 1.7, 1.95, W / 2 - 3.0, W / 2 + 0.05, -0.55, 0.55);
  o.add(strap, leather, { on: front });
  o.add(box(g, 1.95, 2.2, W / 2 - 1.2, W / 2 - 0.1, -0.85, 0.85), brass, { on: strap });

  // The eye on the cover, in two brass rings with a ring of runes between them.
  const at = vec3(1.72, 0.45, 0.4);
  const eyeAt = L(at.x, at.y, at.z);
  const outerRing = new Tube(ring(L(1.85, at.y, at.z), g.dir(0, 1, 0), g.dir(0, 0, 1), 2.75, { n: 28 }), 0.62);
  o.add(outerRing, brass, { on: front });
  const innerRing = new Tube(ring(L(1.85, at.y, at.z), g.dir(0, 1, 0), g.dir(0, 0, 1), 1.75, { n: 24 }), 0.45);
  o.add(innerRing, brass, { on: outerRing });
  const lay = (shape: Shape, fill: string, host: Placed, dx = 0, dy = 0): Decal => {
    const d = Decal.onFace(g, 'front', vec3(1.74, at.y, at.z), shape.clone().translate(dx, dy));
    o.add(d, { fill }, { on: host });
    return d;
  };
  const field = lay(Polygon.circle(2.5, { segments: 28 }), hollow.ramp.base, front);
  let under: Placed = field;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tick = new Path([{ x: Math.cos(a) * 1.98, y: Math.sin(a) * 1.98 }, { x: Math.cos(a) * 2.38, y: Math.sin(a) * 2.38 }]).toShape({ width: 0.28, cap: 'round' });
    under = lay(tick, glow.ramp.base, under);
  }
  // The eye itself: an almond with a bright iris and a dark pupil; one saturated thing in the icon.
  const almond = Polygon.ellipse(1.55, 0.78, { segments: 24 });
  under = lay(almond, glow.ramp.lit, under);
  under = lay(Polygon.circle(0.7, { segments: 16 }), glow.ramp.base, under);
  under = lay(Polygon.circle(0.3, { segments: 12 }), hollow.ramp.dark, under);
  o.custom(eyeAt, c => glint(c, cam.scale, cam.project(L(1.9, at.y + 0.3, at.z - 0.3)), { w: 0.28, h: 0.28, strength: 0.95 }), { on: front });

  // A ribbon hanging out of the foot of the pages.
  o.add(new Tube([L(0.3, 0.8, -top + 0.5), L(0.7, 0.9, -top - 1.4), L(0.5, 1.5, -top - 3.2)], { start: 1.0, end: 0.7 }), ribbon, { on: back });
};
