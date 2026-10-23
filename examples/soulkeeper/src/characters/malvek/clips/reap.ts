/**
 * Malvek's attack, "Reap" (`attack`, `melee`, `aoe`): a wide sweep of the scythe.
 *
 * He turns his shoulders to the right and hauls the scythe up and back over his right shoulder, the
 * snath leaning over his back and the blade high (anticipation, 3 frames), holds the breath for a
 * frame, then whips the scythe round in front of him in three frames, the snath swinging through more
 * than 200 degrees from over the right shoulder, across the front and out to the left, the body
 * dropping into a lunge behind it, the left arm flung out as a counterweight and the flame hand
 * trailing. The blade leads the sweep: `bladeAim` is held a quarter turn ahead of the snath, so it
 * cuts edge-first all the way round. `hit` is the extreme pose (frame 7); the skin draws one smear
 * on the two frames before it. A short hold bent over the blow, a settle, and a three-frame recovery to the
 * idle pose on the last frame (a one-frame recovery would pull the scythe back faster than the sweep threw it).
 *
 * Frames (14 at 0.7 s, 20 fps): 0-3 wind up, 3-4 hold, 4-7 cut, 7-9 hold, 9-10 settle, 10-13 recover.
 * The scythe's lantern is flung by the sweep and rings down over the recovery.
 *
 * Channels for the skin: `weaponYaw` / `weaponPitch` (the snath), `bladeAim`, `lanternSway`, `charge`
 * (0..1, the eyes and the fire crown flare).
 */

import { EVENTS, beat, defineClip, restFeet, track, type Beat, type Clip, type Drive, type Local, type SkeletonSpec } from '@core/rig';
import { SCYTHE_REST_AIM, SCYTHE_REST_PITCH, SCYTHE_REST_YAW } from '../../../gear';
import { ELBOW_L, ELBOW_R, HAND_L, HAND_R } from '../hold';

export const REAP_FRAMES = 14;
/** Frame n of the export as normalized time of the clip (events live here). */
const F = (n: number) => n / REAP_FRAMES;
/** The beat runs on `u`, which reaches 1 on the last frame (not at t = 1, which no frame samples), so the clip ends on the idle pose. */
const U = (frame: number) => frame / (REAP_FRAMES - 1);

export const REAP_BEAT: Beat = { apex: U(3), strike: U(4), extreme: U(7), hold: U(9), settle: U(10) };

export function reap(skeleton: SkeletonSpec, seconds = 0.7): Clip {
  const k = skeleton.height / 80;
  const b = REAP_BEAT;
  const feet = restFeet(skeleton);
  return defineClip({
    name: 'reap',
    kind: 'attack',
    tags: ['melee', 'aoe'],
    seconds,
    events: [
      { t: F(7), name: EVENTS.hit },
      { t: F(10), name: EVENTS.cancel },
    ],
    drive(t: number): Drive {
      const u = Math.min(1, (t * REAP_FRAMES) / (REAP_FRAMES - 1));
      const B = (rest: number, apex: number, extreme: number, target: number, creep = 0) => beat(u, b, rest, apex, extreme, target, creep);
      const lean = B(0, -2.5, 6, 4, -0.5) * k;
      const crouch = B(0, 0.8, 5, 3.4, 0.2) * k;
      // The hands go with the lunge: forward by half the lean, down by the crouch.
      const follow: Local = [lean * 0.5, 0, -crouch];
      const yaw = B(SCYTHE_REST_YAW, 2.15, -1.95, -1.5, 0.1);
      const pitch = B(SCYTHE_REST_PITCH, 0.55, -0.2, -0.1, 0.03);
      // The blade starts at its rest heading and turns to lead the sweep (a quarter turn ahead of the snath).
      const lead = B(SCYTHE_REST_AIM - SCYTHE_REST_YAW, -1.5, -1.5, -1.8);
      return {
        root: follow,
        pitch: B(0, 5, -9, -6, 1),
        twist: B(0, 30, -34, -22, 3),
        trunk: { chest: [lean * 0.5, 0, 0], neck: [lean * 0.55, 0, 0], head: [lean * 0.65, 0, 0] },
        feet: {
          legL: [feet.legL[0] + B(0, -2, 8, 6.5) * k, feet.legL[1] + B(0, 0, -2, -1.5) * k, 0],
          legR: [feet.legR[0] + B(0, 3, -9, -7) * k, feet.legR[1] + B(0, 0, 2, 1.5) * k, 0],
        },
        arms: {
          armR: {
            target: [B(HAND_R[0], -3, 14, 11) + follow[0], B(HAND_R[1], 22, -4, 2), B(HAND_R[2], 63, 45, 44) + follow[2]],
            elbow: [B(ELBOW_R[0], -0.4, 0.3, 0.2), B(ELBOW_R[1], 0.9, -0.6, -0.2), B(ELBOW_R[2], 0.8, -0.8, -0.9)],
          },
          // The flame hand is drawn in, then flung out and back as a counterweight, and returns.
          armL: {
            target: [B(HAND_L[0], 4, -3, 4) + follow[0], B(HAND_L[1], -14, -28, -22), B(HAND_L[2], 60, 54, 56) + follow[2]],
            elbow: ELBOW_L,
          },
        },
        extra: {
          weaponYaw: yaw,
          weaponPitch: pitch,
          bladeAim: yaw + lead,
          charge: track(u, [[0, 0], [b.apex, 0.5], [b.strike, 0.75], [b.extreme, 1], [b.hold, 0.6], [b.settle, 0.12], [1, 0]]),
          // The lantern is flung back by the whip of the sweep and rings down over the recovery.
          lanternSway: track(u, [[0, 0], [b.apex, 0.25], [b.strike, 0.3], [U(5.5), -0.7], [b.extreme, -0.4], [U(8), 0.5], [b.hold, -0.2], [b.settle, 0.12], [1, 0]]),
        },
      };
    },
  });
}
