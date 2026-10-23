/**
 * Malvek's hit: the engine's `hit` (a snap back in a frame or two, a freeze on the pose, the
 * recovery, knock-back by root motion, `extra.hurt` for the skin) with his hands on their holds.
 * The recoil is spread along the trunk like a bent-back spine (chest 0.44, neck 0.54, head 0.77 of
 * the preset's head offset), so the skull stays on its thin neck instead of kinking off it. The right
 * hand keeps the scythe, whose head leans forward as the body is thrown back from under it; the flame hand is flung out and
 * back and the flame flares (`extra.flare`, in step with `hurt`); the lantern is thrown by the blow.
 * The skin flares the eyes and the fire crown and gapes the jaw from `hurt`.
 */

import { defineClip, hit, type Clip, type Drive, type HitOptions, type SkeletonSpec } from '@core/rig';
import { SCYTHE_REST_PITCH, SCYTHE_REST_YAW } from '../../../gear';
import { holdArms, lerp } from '../hold';

/** Share of the preset's head offset (along the facing) that each trunk joint takes. */
const RECOIL = { chest: 0.44, neck: 0.54, head: 0.77 };

export function malvekHit(skeleton: SkeletonSpec, options: HitOptions | number = {}): Clip {
  const base = hit(skeleton, options);
  return defineClip({
    ...base,
    drive(t: number): Drive {
      const d = base.drive(t);
      const hurt = d.extra?.hurt ?? 0;
      const back = d.trunk?.head?.[0] ?? 0;
      const trunk = { ...d.trunk };
      for (const [name, share] of Object.entries(RECOIL)) {
        const o = d.trunk?.[name] ?? [0, 0, 0];
        trunk[name] = [back * share, o[1], o[2]];
      }
      const moved = { ...d, trunk };
      return {
        ...moved,
        arms: holdArms(moved, [-3 * hurt, -1.5 * hurt, 3 * hurt], [-10 * hurt, -5 * hurt, 3 * hurt]),
        extra: {
          ...d.extra,
          weaponYaw: lerp(SCYTHE_REST_YAW, SCYTHE_REST_YAW - 0.7, hurt),
          weaponPitch: lerp(SCYTHE_REST_PITCH, 1.15, hurt),
          lanternSway: -0.6 * hurt,
          flare: 0.7 * hurt,
        },
      };
    },
  });
}
