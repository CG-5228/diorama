/**
 * Crests: the horsehair plume that marks a rank on a helm.
 *
 * It is a part of its own (not an option of `hornedHelm`) because it is an add-on: a helm of any
 * make can wear it, with or without horns. It rests on the helm, so the outfit gives it
 * `on: '<helm id>'`, and it reads the helm's head frame (`headFrame`), so it turns with the face,
 * follows the trunk in a hit and flops towards the floor in a death.
 */

import type { Part } from '@core/rig';
import { Tube, type Placed, type Vec3 } from '@core/volume';
import { headFrame } from './heads';
import { role } from './util';

/** Options of `helmCrest`. */
export interface HelmCrestOptions {
  /** Scale of the plume (length and height). Default 1. */
  size?: number;
  /** Strands that splay at the tip of the plume, 0 to 3: the ragged end of the hair. Default 2. */
  strands?: number;
  /** Sway of the plume in radians-ish (sideways swing at the tip), one whole cycle per clip loop. Default 0.5; 0 holds it still. */
  sway?: number;
  /** The metal comb that holds the plume along the top of the helm. Default true. */
  comb?: boolean;
}

/**
 * The dome of `hornedHelm` as `[height, radius]` pairs above and around its centre
 * (`head.moved(-0.8, 0, 2.3)`), copied from `heads.ts` at the helm's default `size` 1. A crest on
 * a bigger helm gives `size` the same value the helm has, so it sits on the dome.
 */
const DOME: [number, number][] = [[0, 5.3], [1.2, 5.2], [2.7, 4.5], [3.9, 3.1], [4.6, 1.4], [4.8, 0]];
const DOME_AT = { x: -0.8, z: 2.3 };

/** Height of the dome's surface at `radius` from its axis (zero past the rim). */
function domeHeight(radius: number): number {
  const r = Math.abs(radius);
  for (let i = 1; i < DOME.length; i++) {
    const [h0, r0] = DOME[i - 1];
    const [h1, r1] = DOME[i];
    if (r <= r0 && r >= r1) return h0 + ((h1 - h0) * (r0 - r)) / (r0 - r1 || 1);
  }
  return 0;
}

/**
 * A crest: a thin metal comb along the top of the helm from the brow to the nape and a plume of
 * horsehair rising from it, sweeping back and falling behind the head, with a few strands splayed
 * at its tip. Seen from the front it rises over the helm as a stem, from the back it hangs down the
 * nape, from the side it is a flowing arc. In a death the plume lies along the floor (never below it).
 * Rests on the helm (give it as the host). Hung on the head frame, so give it `size` equal to the
 * helm's own `size`.
 * Slot: `head`. Roles: `metal` (comb), `plume` (hair; falls back to `clothAccent`, then `cloth`).
 * Channels: none (the sway reads the clip's time).
 */
export const helmCrest: Part<HelmCrestOptions> = (ctx, { size = 1, strands = 2, sway = 0.5, comb = true }) => {
  const { object: o, kit, materials, host } = ctx;
  const { head, lie } = headFrame(ctx);
  const tau = Math.PI * 2;
  const hair = role(materials, 'plume', 'clothAccent', 'cloth');
  const floor = (p: Vec3): Vec3 => (p.z < 1 ? { ...p, z: 1 } : p);
  const on = host ? { on: host } : {};
  // Where the dome is, in the head frame: x forward, z up, from the helm's own centre.
  const at = (x: number, y: number, z: number) => floor(head.at(x, y, z));
  const surface = (dx: number) => DOME_AT.z + domeHeight(dx / size) * size;
  let anchor: Placed | undefined;
  if (comb) {
    const run = [3.4, 1.8, 0, -1.8, -3.4].map(dx => at(DOME_AT.x + dx * size, 0, surface(dx) + 0.55));
    const ridge = new Tube(run, { start: 1.2, end: 1.6 });
    o.add(ridge, role(materials, 'metal'), on);
    anchor = ridge;
  }
  // The plume: from the back of the comb, up, over and down behind the head. In a death it falls
  // flat: the height shrinks and the tip lies behind.
  const top = surface(-1.2) + 0.2;
  const rise = 1 - 0.55 * lie;
  const swing = sway * Math.sin(tau * (kit.t + 0.15)) * (1 - lie);
  const s = size;
  const path = (lateral: number, reach: number): Vec3[] => [
    [DOME_AT.x - 0.4 * s, 0, top],
    [DOME_AT.x - 1.6 * s, 0.1 * lateral, top + 3.4 * s * rise],
    [DOME_AT.x - 4.6 * s, 0.35 * lateral, top + 5.2 * s * rise],
    [DOME_AT.x - 8.2 * s * reach, 0.8 * lateral, top + 4.6 * s * rise],
    [DOME_AT.x - 10.6 * s * reach, 1.3 * lateral, top + 1.4 * s * rise],
    [DOME_AT.x - 11.6 * s * reach, 1.6 * lateral, top - 2.6 * s * rise],
  ].map(([x, y, z], i, all) => at(x, y + swing * (i / (all.length - 1)) * 2.4 * s, z));
  const plume = new Tube(path(0, 1), { start: 2.8, end: 0.45 });
  o.add(plume, hair, anchor ? { on: anchor } : on);
  // The ragged end: shorter strands splayed to both sides of the tip.
  const side = [1, -1, 0.5].slice(0, Math.max(0, Math.min(3, Math.round(strands))));
  side.forEach((lateral, i) => {
    const reach = 0.78 - 0.08 * i;
    const strand = path(lateral * 2.6, reach).slice(2);
    o.add(new Tube(strand, { start: 1.5, end: 0.3 }), hair, { on: plume });
  });
  return plume;
};
