/**
 * The soul shard: a cluster of three faceted crystals of soul, the tallest 8 units, rising from a chip of grave stone,
 * with two motes of light above the tip. The crystals are solids with flat faces, so the light gives them three tones by
 * itself; each is a hexagonal prism that closes on a point, roughened a little by the item's seed and leaning its own way.
 *
 * Soul green is the one saturated color; the stone under it keeps the icon from being green all over.
 *
 * Detail tiers: primary = the tall crystal and its two companions (the silhouette); secondary = the stone chip, the facets'
 * three tones, the creases inked between them; tertiary = the glints on the lit faces, the two motes, the stone's stipple.
 */

import { Polygon, alpha } from '@core/draw';
import type { ItemPiece } from '@core/rig';
import { itemRng } from '@core/rig';
import { Round, type Vec3 } from '@core/volume';
import { crystal, glint, role } from './util';

export const soulShard: ItemPiece = ctx => {
  const { object: o, camera: cam, frame: g, materials } = ctx;
  const soul = role(materials, 'crystal');
  const stone = role(materials, 'stone');
  const rng = itemRng(ctx, 5);
  const rough = () => rng.random();
  const L = (f: number, s: number, u: number): Vec3 => g.at(f, s, u);
  // The stone chip they grow from, and a smaller one beside it.
  const chip = Round.ellipsoid(g.moved(0.2, 0, -4.4), 3.9, 3.1, 1.3);
  o.add(chip, stone);
  o.add(Round.ellipsoid(g.moved(2.4, 1.9, -4.7), 1.4, 1.1, 0.8), stone, { on: chip });
  // The crystals: the tallest leans back a little, the others lean away from it.
  const tall = crystal(g.moved(0.3, 0.1, -3.4).pitched(-6).rolled(4), { r: 2.3, body: 4.6, tip: 3.4, rough });
  const left = crystal(g.moved(-2.2, -1.6, -3.4).pitched(18).rolled(-14), { r: 1.45, body: 2.6, tip: 2.3, rough });
  const right = crystal(g.moved(2.1, 1.7, -3.5).pitched(-24).rolled(16), { r: 1.2, body: 1.8, tip: 1.8, rough });
  o.add(left, soul, { on: chip });
  o.add(right, soul, { on: chip });
  o.add(tall, soul, { on: chip });
  // Glints on the lit faces and two motes of soul rising from the tip.
  o.custom(L(0, 0, 3), c => {
    glint(c, cam.scale, cam.project(L(-0.9, -0.6, 0.8)), { w: 0.4, h: 1.6, angle: 20, strength: 0.85 });
    glint(c, cam.scale, cam.project(L(-2.8, -2.0, -1.0)), { w: 0.3, h: 0.9, angle: 28, strength: 0.8 });
    for (const [f, s, u, r] of [[1.5, 0.3, 6.6, 0.5], [-1.2, -0.4, 7.4, 0.34]] as const) {
      const p = cam.project(L(f, s, u));
      Polygon.diamond(r * 2 * cam.scale, r * 2.9 * cam.scale, { cx: p.x, cy: p.y }).fill(c, alpha(soul.ramp.lit, 0.9));
    }
  }, { on: tall });
};
