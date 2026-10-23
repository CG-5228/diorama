/**
 * Ossuary guard jump: the engine's `jump` (crouch, push off, an arc with the legs tucked and the
 * arms thrown up, a landing crouch, root motion `travel` for the leap) retimed for a short
 * sprite clip and with the sword following the raised arm.
 * - Retiming: the preset puts `takeoff` at 0.3 and `land` at 0.7 of the clip, which at 12 frames
 *   is frame 3.6 and 8.4, so no frame shows the feet leaving or touching the floor and the last
 *   frame is still mid-recovery. Here the clip's frames are mapped onto the preset's timeline
 *   so that `takeoff` falls on frame 3 and `land` on frame 8 (the feet are on the floor on both
 *   frames, four frames in the air between them) and the last frame is back on the idle pose.
 * - Landing: the preset's landing crouch (0.8 of the takeoff crouch, peaking after the touchdown
 *   frame) is too soft for a 32-unit leap, so the body drops a little more as the feet touch
 *   and absorbs the impact on the next frame.
 * - Sword: while the arms are up, the blade points forward and up (a leap with the weapon
 *   ready) instead of hanging forward-down through the thrown-up arm. It returns to its default
 *   angle on the first and last frames. Channels: `extra.weaponYaw` / `weaponPitch`.
 */

import { EVENTS, bump, defineClip, jump, smooth, type Clip, type Drive, type SkeletonSpec } from '@core/rig';
import { swordMix } from '../../shared/sword-angle';

/** Where the engine's jump puts takeoff and land on its own timeline (see `jump` in presets.ts). */
const UP = 0.3;
const DOWN = 0.7;

export interface GuardJumpOptions {
  /** Forward distance of the leap by root motion, in world units. */
  distance: number;
  seconds?: number;
  /** Frames of the export; the retiming needs it. Default 12. */
  frames?: number;
  /** Frames of the push-off (`takeoff` event) and of the touchdown (`land` event). */
  takeoffFrame?: number;
  landFrame?: number;
  /** Peak height of the feet above the floor, in world units. */
  height?: number;
}

export function guardJump(skeleton: SkeletonSpec, options: GuardJumpOptions): Clip {
  const N = options.frames ?? 12;
  const f0 = options.takeoffFrame ?? 3;
  const f1 = options.landFrame ?? 8;
  const base = jump(skeleton, { seconds: options.seconds, distance: options.distance, height: options.height });
  const s0 = f0 / (N - 1);
  const s1 = f1 / (N - 1);
  // Clip time -> the preset's own time. Frame f of the export sits at t = f / N; `u` reaches 1 on
  // the last frame, so the clip ends exactly on the rest pose.
  const timeline = (t: number) => {
    const u = Math.min(1, (t * N) / (N - 1));
    if (u < s0) return (u / s0) * UP;
    if (u < s1) return UP + ((u - s0) / (s1 - s0)) * (DOWN - UP);
    return DOWN + ((u - s1) / (1 - s1)) * (1 - DOWN);
  };
  return defineClip({
    ...base,
    events: [{ t: f0 / N, name: 'takeoff' }, { t: f1 / N, name: EVENTS.land }, { t: Math.min(N - 1, f1 + 2) / N, name: EVENTS.cancel }],
    travel: (t: number) => base.travel!(timeline(t)),
    drive(t: number): Drive {
      const tau = timeline(t);
      // The sword rides with the raised arms (the preset's arm envelope).
      // The blade rises faster than the arm so it is already up on the takeoff frame (held
      // horizontal there it would reach 8 units further to the side).
      const w = smooth(Math.min(1, 2 * bump(tau, UP - 0.1, DOWN)));
      const d = base.drive(tau);
      const r = d.root ?? [0, 0, 0];
      // Extra landing absorb: starts as the feet touch (frame 8), deepest on frame 9.
      const absorb = 0.07 * skeleton.height * bump(tau, 0.58, 0.94);
      return {
        ...d,
        root: [r[0], r[1], r[2] - absorb],
        extra: swordMix(0.3, 1.0, w),
      };
    },
  });
}
