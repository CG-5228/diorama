/**
 * @core/rig - Two-bone IK
 *
 * Law of cosines in 3D (as in the Shengyu devlog), with the reach clamped and eased in near
 * full extension so the middle joint never snaps straight.
 */

import { add3, cross3, dot3, len3, mix3, norm3, scale3, sub3, vec3, type Vec3 } from '../volume/vec3.js';

/** Distance kept from full extension, and the band before it where the reach eases in. */
const IK_MARGIN = 0.15;
const IK_SOFT = 1.0;

/** Longest root→target distance reached exactly, before the soft band starts. */
export const ikReach = (l1: number, l2: number): number => l1 + l2 - IK_MARGIN - IK_SOFT;

/**
 * Solves a two-bone limb from `root` towards `target`. The middle joint bends towards `hint`
 * (a direction). Returns the middle joint and the end point actually reached.
 */
export function twoBone(root: Vec3, target: Vec3, l1: number, l2: number, hint: Vec3, softReach = true): { mid: Vec3; end: Vec3 } {
  const d = sub3(target, root);
  const dist0 = len3(d);
  const u = dist0 > 1e-6 ? scale3(d, 1 / dist0) : vec3(0, 0, -1);
  const softStart = l1 + l2 - IK_MARGIN - IK_SOFT;
  let dist = Math.max(dist0, Math.abs(l1 - l2) + 0.5);
  if (softReach && dist > softStart) dist = softStart + IK_SOFT * (1 - Math.exp(-(dist - softStart) / IK_SOFT));
  dist = Math.min(dist, l1 + l2 - 1e-3);
  const end = add3(root, scale3(u, dist));

  let bend = sub3(hint, scale3(u, dot3(hint, u)));
  if (len3(bend) < 1e-4) bend = cross3(u, vec3(0, 0, 1));
  if (len3(bend) < 1e-4) bend = vec3(1, 0, 0);
  bend = norm3(bend);

  const cos = Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)));
  const a = Math.acos(cos);
  return { mid: mix3([root, 1], [u, l1 * Math.cos(a)], [bend, l1 * Math.sin(a)]), end };
}
