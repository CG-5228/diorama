/**
 * Shoulders: the lamed pauldron and the skull pauldron.
 */

import { Polygon } from '@core/draw';
import { partFrame, type Part } from '@core/rig';
import { Decal, Round, Tube, add3, norm3, scale3, sub3, vec3, visibleArc } from '@core/volume';
import { role, tones } from './util';

/** Options of `lamedPauldron`. */
export interface LamedPauldronOptions {
  /** Iron plates stacked over the shoulder, 1 to 4 (the top one is the largest). Default 2. */
  lames?: number;
  /** A spike on the top lame. Default true. */
  spike?: boolean;
  /** Two rivets on the top lame. Default true. */
  rivets?: boolean;
  /** Scale of the plates. Default 1. */
  size?: number;
}

/**
 * A pauldron of stacked lames: a cap over the shoulder, smaller lames stepping down and out
 * below it, an optional spike and rivets. Mirrored by side: it steps down towards the arm of
 * the side it is worn on.
 * Slot: `shoulder` (side -1 left, 1 right). Roles: `metal` (plates, spike; the rivets take its lit tone).
 * Returns the top lame.
 */
export const lamedPauldron: Part<LamedPauldronOptions> = (ctx, options) => {
  const { object: o, body, at, materials } = ctx;
  const { lames = 2, spike = true, rivets = true, size = 1 } = options;
  const { up, right: across, forward: chestFwd } = body;
  const side = at.side;
  const metal = role(materials, 'metal');
  const base = add3(at.frame.origin, add3(scale3(up, 1.3), scale3(across, 0.5 * side)));
  // The plates tilt outwards, along the line of the shoulder.
  const tilt = norm3(sub3(up, scale3(across, 0.45 * side)));
  const count = Math.max(1, Math.min(4, Math.round(lames)));
  let host: ReturnType<typeof Round.ellipsoid> | undefined;
  // From the lowest lame (stepped down and out, smaller) up to the cap at the shoulder.
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 1 : i / (count - 1);
    const lerp = (low: number, high: number) => high * t + low * (1 - t);
    const centre = add3(base, add3(scale3(up, lerp(-2.1, 0)), scale3(across, lerp(1.5, 0) * side)));
    const lame = Round.ellipsoid(partFrame(centre, chestFwd, tilt), lerp(3.6, 4.5) * size, lerp(3.8, 4.9) * size, lerp(1.9, 2.6) * size);
    o.add(lame, metal, host ? { on: host } : {});
    host = lame;
  }
  const top = host!;
  const lameFrame = partFrame(base, chestFwd, tilt);
  if (spike) o.add(new Tube([lameFrame.at(-0.4, 0.6 * side, 2 * size), lameFrame.at(-0.6, 2.2 * side, 6.2 * size)], { start: 1.7, end: 0.2 }), metal, { on: top });
  if (rivets) for (const s of [-1, 1]) o.add(Decal.onFace(lameFrame, 'front', vec3(4.1, s * 2.2, 0.9), Polygon.circle(0.45)), { fill: tones(materials, 'metal').lit }, { on: top });
  return top;
};

/** Depth bias that lays the skull of a pauldron over the collarbone while it faces the camera. */
const PAULDRON_SKULL_LIFT = 2.5;

/** Options of `skullPauldron`. */
export interface SkullPauldronOptions {
  /** Scale of the shell, the skull and the spikes. Default 1. */
  size?: number;
  /** Two bone spikes rising from the shell. Default true. */
  spikes?: boolean;
}

/**
 * A shoulder shell with a small skull on top and two bone spikes: an iron cap over the shoulder
 * with a thin rim, a cranium and jaw on its front-top turned forward and a little outwards, and
 * spikes that rise outwards and up. The skull sorts by depth (it hides behind the shell from
 * behind); its sockets, nose and teeth are decals, drawn only while that face looks at the camera.
 * Mirrored by side. Returns the shell.
 * Slot: `shoulder` (side -1 left, 1 right). Roles: `metal` (shell, rim), `bone` (skull, spikes), `hollow` (sockets).
 */
export const skullPauldron: Part<SkullPauldronOptions> = (ctx, { size = 1, spikes = true }) => {
  const { object: o, kit, body, at, materials } = ctx;
  const { up, right: across, forward: chestFwd } = body;
  const side = at.side;
  const metal = role(materials, 'metal');
  const bone = role(materials, 'bone');
  const hollow = tones(materials, 'hollow');
  const base = add3(at.frame.origin, add3(scale3(up, 1.5), scale3(across, 0.9 * side)));
  const tilt = norm3(sub3(up, scale3(across, 0.5 * side)));
  const shellFrame = partFrame(base, chestFwd, tilt);
  const shell = Round.ellipsoid(shellFrame, 4.8 * size, 6 * size, 2.9 * size);
  o.add(shell, metal);
  // A thin lit rim round the shell: only the half that faces the camera.
  const rim = visibleArc(kit.camera, shellFrame.at(0, 0, 0.5 * size), shellFrame.forward, shellFrame.right, 4.9 * size, 6.1 * size);
  if (rim.length) o.add(new Tube(rim, 0.7), metal, { on: shell });
  // The skull on top, looking forward and out.
  const face = norm3(add3(scale3(chestFwd, 0.85), scale3(across, 0.5 * side)));
  const sf = partFrame(shellFrame.at(1.8 * size, 0.2 * side * size, 2.3 * size), face, tilt);
  // While the skull looks at the camera it is drawn over what crosses its shoulder (the collarbones of a rib
  // breastplate, which rest on the plate and would cut across its face); turned away it sorts by depth.
  const lift = kit.camera.faces(face) ? PAULDRON_SKULL_LIFT : 0;
  const jaw = Round.ellipsoid(partFrame(sf.at(0.9 * size, 0, -1.9 * size), face, tilt), 1.4 * size, 1.7 * size, 0.9 * size);
  o.add(jaw, bone, { bias: 0.4 + lift });
  const cranium = Round.ellipsoid(sf, 2.4 * size, 2.6 * size, 2.6 * size);
  o.add(cranium, bone, { bias: 0.6 + lift });
  for (const s of [-1, 1]) {
    o.add(Decal.onFace(sf, 'front', vec3(2.3 * size, s * 1.0 * size, 0.3 * size), Polygon.ellipse(0.8 * size, 0.78 * size)), { fill: hollow.dark }, { on: cranium });
  }
  o.add(Decal.onFace(sf, 'front', vec3(2.45 * size, 0, -0.9 * size), Polygon.triangle(0.6 * size, 0.8 * size)), { fill: hollow.dark }, { on: cranium });
  o.add(Decal.onFace(sf, 'front', vec3(1.6 * size, 0, -2.5 * size), Polygon.rect(1.7 * size, 0.45 * size)), { fill: hollow.base }, { on: jaw });
  if (spikes) {
    const spike = (from: [number, number, number], to: [number, number, number]) =>
      o.add(new Tube([shellFrame.at(...from), shellFrame.at(...to)], { start: 1.6 * size, end: 0.25 }), bone, { bias: -0.2 });
    spike([-0.8 * size, 3.6 * side * size, 1.7 * size], [-1.5 * size, 6.6 * side * size, 4 * size]);
    spike([-2.0 * size, 2.0 * side * size, 2.2 * size], [-3 * size, 3.4 * side * size, 5.6 * size]);
  }
  return shell;
};
