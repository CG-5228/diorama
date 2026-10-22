/**
 * The ancient scroll: a roll of old vellum on two turned wooden rods with ball finials, tied with a leather cord that
 * carries a crimson wax seal, and unrolled a hand's breadth to one side, its torn edge written with soul runes.
 * The roll is 12 units long and 4.6 across (a forearm's length of thin scroll); the pose lays it diagonally.
 *
 * Detail tiers: primary = the roll with its rods and the unrolled sheet (the silhouette); secondary = the cord, the knot
 * and its tails, the seal, the torn hem, the roll's own shading; tertiary = the rows of runes, the finials, the seal's ward.
 */

import { Path, Polygon, alpha, type Shape } from '@core/draw';
import type { ItemPiece } from '@core/rig';
import { itemRng } from '@core/rig';
import { Decal, Round, Solid, Tube, vec3, visibleArc, type Vec3 } from '@core/volume';
import { axisFrame, role } from './util';

/** Length of the roll between its rods, and its radius. */
const LEN = 12;
const R = 2.3;

/** A rune `h` tall in shape space (x across, y down): a stem with raised branches, a zig, a bar or a ring. */
function rune(kind: number, h: number): Shape {
  const bar = (a: [number, number], b: [number, number]) => new Path([{ x: a[0] * h, y: a[1] * h }, { x: b[0] * h, y: b[1] * h }]).toShape({ width: 0.34, cap: 'round' });
  switch (kind % 4) {
    case 0: return bar([0, -0.5], [0, 0.5]).union([bar([0, -0.1], [-0.36, -0.46]), bar([0, -0.1], [0.36, -0.46])]);
    case 1: return bar([-0.3, -0.5], [0.3, 0]).union([bar([0.3, 0], [-0.3, 0.5])]);
    case 2: return bar([0, -0.5], [0, 0.5]).union([bar([-0.34, 0.15], [0.34, 0.15])]);
    default: return Polygon.circle(h * 0.32, { segments: 10 }).outline({ width: 0.34 });
  }
}

export const ancientScroll: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const vellum = role(materials, 'parchment');
  const wood = role(materials, 'cork', 'wood');
  const leather = role(materials, 'leather');
  const wax = role(materials, 'clothAccent');
  const glow = role(materials, 'glow');
  const rng = itemRng(ctx, 3);
  const L = (f: number, s: number, u: number): Vec3 => g.at(f, s, u);
  /** A frame whose up axis runs along the roll, starting at forward `f`: a cylinder lying on its side. */
  const along = (f: number) => axisFrame(L(f, 0, 0), g.dir(1, 0, 0), g.dir(0, 0, 1));

  // The sheet first, so the roll sits on its start: unrolled towards the object's right, resting where the roll does.
  const sheetFrame = g.moved(0, 0.4, -R + 0.15);
  const hem = [
    { x: -5.7, y: 0 }, { x: 5.7, y: 0 }, { x: 5.7, y: 5.8 }, { x: 4.4, y: 6.7 }, { x: 3.1, y: 5.9 }, { x: 1.5, y: 7.4 },
    { x: 0.1, y: 6.2 }, { x: -1.6, y: 7.1 }, { x: -3.0, y: 6.0 }, { x: -4.4, y: 6.8 }, { x: -5.7, y: 5.6 },
  ];
  const sheet = Solid.extrude(sheetFrame, Polygon.fromPoints(hem), 0.35);
  o.add(sheet, vellum);
  // Rows of runes on the sheet: three lines, a seeded gap here and there.
  const ink = { fill: glow.ramp.base };
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      if (rng.boolean(0.14)) continue;
      const f = -4.3 + i * 1.7 + rng.float(-0.12, 0.12);
      o.add(Decal.onFace(sheetFrame, 'top', vec3(f, 2.1 + row * 1.5, 0.37), rune(rng.int(0, 3), 0.95)), ink, { on: sheet });
    }
  }

  // The roll, its two rods and finials.
  const roll = Round.cylinder(along(-LEN / 2), R, LEN, R * 0.97);
  o.add(roll, vellum, { on: sheet });
  for (const end of [-1, 1]) {
    const rod = Round.cylinder(along(end < 0 ? -LEN / 2 - 0.9 : LEN / 2), R + 0.35, 0.9, R + 0.2);
    o.add(rod, wood, { on: roll });
    o.add(Round.ellipsoid(g.moved(end * (LEN / 2 + 1.5), 0, 0), 0.95, 0.95, 0.95), wood, { on: rod });
  }

  // The cord round the middle: its front half, a knot and two tails.
  const at = 0.4;
  const cord = visibleArc(cam, L(at, 0, 0), g.dir(0, 1, 0), g.dir(0, 0, 1), R + 0.15, R + 0.15);
  if (cord.length > 1) o.add(new Tube(cord, 0.95), leather, { on: roll });
  const knot = L(at, 0.9, R + 0.2);
  o.add(Round.ellipsoid(g.moved(at, 0.9, R + 0.15), 0.8, 0.8, 0.7), leather, { on: roll });
  o.add(new Tube([knot, L(at + 0.8, 1.6, R + 0.3), L(at + 1.2, 3.0, R - 0.4)], { start: 0.7, end: 0.5 }), leather, { on: roll });
  o.add(new Tube([knot, L(at - 0.6, 1.4, R + 0.3), L(at - 1.4, 2.4, R - 0.7)], { start: 0.7, end: 0.5 }), leather, { on: roll });

  // The wax seal on the cord, with its ward.
  const seal = Round.cylinder(axisFrame(L(at, -0.2, R + 0.1), g.dir(0, 0, 1), g.dir(1, 0, 0)), 1.2, 0.45, 1.1);
  o.add(seal, wax, { on: roll });
  o.add(Decal.onFace(g.moved(at, -0.2, 0), 'top', vec3(0, 0, R + 0.6), Polygon.circle(0.42, { segments: 10 })), { fill: alpha(glow.ramp.lit, 0.9) }, { on: seal });
};
