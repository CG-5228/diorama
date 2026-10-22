/**
 * Malvek's dodge, the backstep (`dodge`, root motion by `travel`, negative: backwards): the engine's
 * `dodge` (the hop back, a low crouch, `cancel` on the recovery) with his body language on top.
 *
 * He leans away, the scythe comes up across his body in guard, the snath slanting forward with the
 * blade high and in front, and the flame palm is pushed out ahead of him (the flame swells a little);
 * the feet leapfrog back one after the other, each keeping its spot in the world until its step
 * (`stepsAlong`), so nothing slides when the game moves the sprite by `travel`. The pose snaps in
 * during the first frames, holds while he travels and eases out; the clip starts and ends on the idle
 * pose (the scythe at its rest angle).
 */

import { defineClip, dodge, easeOutQuad, restFeet, stepsAlong, track, type Clip, type Drive, type Local, type SkeletonSpec } from '@core/rig';
import { SCYTHE_REST_PITCH, SCYTHE_REST_YAW } from '../../../gear';
import { holdArms, lerp, smoothstep } from '../hold';

export function malvekBackstep(skeleton: SkeletonSpec, seconds = 0.45): Clip {
  const base = dodge(skeleton, { style: 'backstep', seconds });
  const k = skeleton.height / 80;
  const n = skeleton.trunk.length;
  const travel = base.travel!;
  const distance = travel(1);
  const rest = restFeet(skeleton);
  // The rear foot steps first.
  const order = skeleton.legs.map(l => l.name).sort((x, y) => rest[x][0] - rest[y][0]);
  const windows: Record<string, [number, number]> = {};
  order.forEach((name, i) => {
    const a = 0.1 + (0.4 * i) / Math.max(1, order.length);
    windows[name] = [a, a + 0.32];
  });
  return defineClip({
    ...base,
    drive(t: number): Drive {
      const d = base.drive(t);
      const e = track(t, [[0, 0], [0.2, 1, easeOutQuad], [0.5, 1], [0.92, 0]]);
      const trunk: Record<string, Local> = {};
      skeleton.trunk.forEach((j, i) => {
        const w = n > 1 ? i / (n - 1) : 1;
        const b = d.trunk?.[j.name] ?? [0, 0, 0];
        trunk[j.name] = [b[0] - 1.5 * k * e * w, b[1], b[2]];
      });
      const moved: Drive = { ...d, trunk, root: d.root };
      const w = smoothstep(e);
      return {
        ...moved,
        feet: stepsAlong(skeleton, travel, distance, windows, 0.1 * skeleton.height, t),
        pitch: (d.pitch ?? 0) * 1.5,
        twist: -5 * e,
        // The scythe rises into guard; the flame palm pushes out in front.
        arms: holdArms(moved, [5 * e, -2 * e, 6 * e], [9 * e, 3 * e, -3 * e]),
        extra: {
          weaponYaw: lerp(SCYTHE_REST_YAW, 0.45, w),
          weaponPitch: lerp(SCYTHE_REST_PITCH, 0.95, w),
          lanternSway: -0.25 * e,
          flare: 0.35 * e,
        },
      };
    },
  });
}
