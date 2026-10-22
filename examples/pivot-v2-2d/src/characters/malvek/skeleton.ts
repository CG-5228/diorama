/**
 * Malvek's skeleton: the project's `humanoid()` at 1.12, made gaunt. The legs are 6% longer (the
 * trunk rides up with them, so the hips still sit just under the legs' reach and the knees never
 * lock), the arms 10% longer, and the hips and shoulders 10% and 14% narrower. The gaits, the
 * trunk's joints and the arm and leg names are the preset's, so every preset clip (locomotion, hit,
 * death, dodge) and every piece of the gear kit works on it unchanged.
 */

import { defineSkeleton, humanoid, type Local, type SkeletonSpec } from '@core/rig';

const LEGS = 1.06;
const ARMS = 1.1;
const HIPS = 0.9;
const SHOULDERS = 0.86;

export function malvekSkeleton(scale = 1.12): SkeletonSpec {
  const base = humanoid(scale);
  const legReach = (s: SkeletonSpec) => s.legs[0].lengths[0] + s.legs[0].lengths[1];
  // Hip height keeps its ratio to the legs' reach, so the trunk rises by what the legs gained.
  const rise = (legReach(base) * LEGS - legReach(base)) * 0.985;
  const lift = ([x, y, z]: Local): Local => [x, y, z + rise];
  return defineSkeleton({
    ...base,
    height: base.height + rise,
    trunk: base.trunk.map(j => ({ ...j, at: lift(j.at) })),
    legs: base.legs.map(l => ({ ...l, lengths: [l.lengths[0] * LEGS, l.lengths[1] * LEGS], offset: [l.offset[0], l.offset[1] * HIPS, l.offset[2]] })),
    arms: (base.arms ?? []).map(a => ({ ...a, lengths: [a.lengths[0] * ARMS, a.lengths[1] * ARMS], offset: [a.offset[0], a.offset[1] * SHOULDERS, a.offset[2]] })),
  });
}
