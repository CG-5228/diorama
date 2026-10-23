/**
 * Malvek's idle and locomotion: the engine's `idle` and `locomotion` presets (breathing and weight
 * shift, the gait's feet, trunk and roll) with the arms replaced by the holds of `../hold.ts`: the
 * right hand keeps the scythe, the left keeps the flame over its open palm, and both follow the
 * trunk. The scythe's lantern swings once per idle loop and twice per stride.
 *
 * Every term is a whole number of cycles per loop, so the loops close; the preset's feet and trunk
 * are left as they are, so the gait's ground speed and planted feet hold.
 */

import { defineClip, idle, locomotion, type Clip, type Drive, type SkeletonSpec } from '@core/rig';
import { SCYTHE_REST_YAW } from '../../../gear';
import { holdArms } from '../hold';

const TAU = Math.PI * 2;

/** 1.8 s at 16 frames (8.9 fps): a slow breath, the flame hand drifting up and down once, the lantern swinging once. */
export function malvekIdle(skeleton: SkeletonSpec, seconds = 1.8): Clip {
  const base = idle(skeleton, { seconds, breath: 0.55, sway: 0.35 });
  return defineClip({
    ...base,
    drive(t: number): Drive {
      const d = base.drive(t);
      const bob = Math.sin(TAU * t);
      return {
        ...d,
        arms: holdArms(d, [0, 0, 0], [0.4 * Math.sin(TAU * t + 1.2), 0, 0.9 * Math.sin(TAU * t + 0.4) + 0.3 * bob]),
        extra: { lanternSway: 0.12 * Math.sin(TAU * t) },
      };
    },
  });
}

/**
 * Walk and run: the scythe is carried (the hand lifts a little so the foot of the snath clears the
 * floor; in the run the snath leans forward across the body) and the flame hand holds steady, with a
 * small counter-swing against the hips.
 */
export function malvekLocomotion(skeleton: SkeletonSpec, gait: 'walk' | 'run'): Clip {
  const base = locomotion(skeleton, gait);
  const run = gait === 'run';
  return defineClip({
    ...base,
    drive(t: number): Drive {
      const d = base.drive(t);
      const swingR = (d.arms?.armR?.swing ?? 0) - 0.05;
      const swingL = (d.arms?.armL?.swing ?? 0) - 0.05;
      const arms = holdArms(
        d,
        run ? [7 + 5 * swingR, -1, -3] : [1.6 * swingR, 0, 2.4],
        run ? [3 + 6 * swingL, 1.5, 0.8 * Math.abs(swingL)] : [2.4 * swingL, 0, 0.4],
      );
      const extra: Record<string, number> = { lanternSway: (run ? 0.3 : 0.18) * Math.sin(TAU * 2 * t + 0.6) };
      if (run) {
        extra.weaponYaw = SCYTHE_REST_YAW - 0.7;
        extra.weaponPitch = 1.05;
      }
      return { ...d, arms, extra };
    },
  });
}

