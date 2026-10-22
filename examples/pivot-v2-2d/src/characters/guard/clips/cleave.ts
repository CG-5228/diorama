/**
 * Ossuary guard skill, "Soul Cleave" (`skill`, `melee`, `aoe`): a charged two-beat overhead strike.
 *
 * Beat one, the charge (about 0.3 s): the guard sets his feet, leans back and raises the sword
 * high behind the head, the shield arm comes forward to steady him, and the blade creeps a little
 * further back while the soul runes build up (`extra.charge` 0 to 1, read by the skin to light
 * the blade and flare the eyes). `cast` marks the end of the charge: the cut can no longer be
 * cancelled.
 * Beat two, the cut: the sword comes over the top and down in front in three frames, the body
 * drops into a lunge behind it, the tip meets the floor. `hit`, `release` and `spawn:tip` share
 * the impact frame (the extreme pose); the skin draws the soul-fire shockwave from there. Then a
 * short hold bent over the blow (the overshoot settles) and the recovery to the idle pose on the
 * last frame.
 *
 * Frames (14 at 0.9 s, 15.6 fps): 0-3 raise, 3-5 charge (creep), 5-8 cut, 8-10 hold, 10-11 settle,
 * 11-13 recover.
 *
 * Channels for the skin: `weaponYaw` / `weaponPitch` (the blade, driven through the vertical plane
 * so the cut goes over the top and not around the side) and `charge` (0..1).
 */

import { EVENTS, beat, defineClip, restFeet, solvePose, spawnEvent, track, type ArmDrive, type Beat, type Clip, type Drive, type Local, type SkeletonSpec } from '@core/rig';
import { Frame3, vec3 } from '@core/volume';
import { REST_ALPHA, REST_SIDE, bladeAngle } from '../../shared/sword-angle';

export const CLEAVE_FRAMES = 14;
/** Frame n of the export as normalized time of the clip (events live here). */
const F = (n: number) => n / CLEAVE_FRAMES;
/**
 * The beat runs on `u`, which reaches 1 on the last frame (not at t = 1, which no frame samples),
 * so the guard is back on the idle pose on the last frame and the next clip starts from there.
 */
const U = (frame: number) => frame / (CLEAVE_FRAMES - 1);

/** Charge until frame 5, cut over frames 5-8 (the extreme is the impact), hold to 10, settle at 11. */
export const CLEAVE_BEAT: Beat = { apex: U(3), strike: U(5), extreme: U(8), hold: U(10), settle: U(11) };

export function cleave(skeleton: SkeletonSpec, seconds = 0.9): Clip {
  const k = skeleton.height / 80;
  const b = CLEAVE_BEAT;
  const rest = restFeet(skeleton);
  // Rest hands, solved once from the idle arms: the clip starts and ends on them.
  const rp = solvePose(skeleton, Frame3.facing(vec3(0, 0, 0), 0), { arms: { armL: { swing: 0.05, flex: 0.18 }, armR: { swing: 0.05, flex: 0.18 } } });
  const hand = (name: string): Local => [rp.joints[`${name}.hand`].x, rp.joints[`${name}.hand`].y, rp.joints[`${name}.hand`].z];
  const rightRest = hand('armR');
  const leftRest = hand('armL');
  return defineClip({
    name: 'cleave',
    kind: 'skill',
    tags: ['melee', 'aoe'],
    seconds,
    events: [
      { t: F(5), name: EVENTS.cast },
      { t: F(8), name: EVENTS.hit },
      { t: F(8), name: EVENTS.release },
      { t: F(8), name: spawnEvent('tip') },
      // The recovery may be cut short by another action.
      { t: F(11), name: EVENTS.cancel },
    ],
    drive(t: number): Drive {
      const u = Math.min(1, (t * CLEAVE_FRAMES) / (CLEAVE_FRAMES - 1));
      const B = (restV: number, apex: number, extreme: number, target: number, creep = 0) => beat(u, b, restV, apex, extreme, target, creep);
      const lean = B(0, -2.5, 7, 5.5, -1.4) * k;
      const crouch = B(0, 0, 7.5, 5.5, 0) * k;
      const arms: Record<string, ArmDrive> = {
        armR: {
          target: [
            B(rightRest[0], -3 * k, 17 * k, 13 * k, -1 * k),
            B(rightRest[1], 7.5 * k, 5 * k, 5.5 * k, 0),
            B(rightRest[2], 78 * k, 27 * k, 29 * k, 2.6 * k),
          ],
          elbow: [B(0, -0.3, 0.2, 0.2), B(0.7, 1, 0.8, 0.8), B(-1, -0.3, -0.5, -0.6)],
        },
        // The shield arm comes forward and up to steady him during the charge, then swings out and
        // back as a counterweight when the blow lands.
        armL: { swing: B(0.05, 0.9, -0.25, -0.1), flex: B(0.18, 1.2, 0.5, 0.4), out: B(0.24, 0.1, 0.55, 0.4) },
      };
      return {
        root: [lean, 0, -crouch],
        pitch: B(0, 7, -16, -11, 2.2),
        twist: B(0, 6, -8, -5, 2),
        trunk: {
          chest: [B(0, -1.2, 3.5, 2.5, -0.2) * k, 0, 0],
          neck: [B(0, -1.2, 5, 3.5, -0.2) * k, 0, B(0, 0.8, -1.2, -0.8) * k],
          head: [B(0, -1.5, 6.5, 4.5, -0.2) * k, 0, B(0, 1, -2, -1.4) * k],
        },
        feet: {
          legL: [rest.legL[0] + B(0, 4, 9, 7.5) * k, rest.legL[1] + B(0, -1, -2.5, -2) * k, 0],
          legR: [rest.legR[0] + B(0, -5, -8, -7) * k, rest.legR[1] + B(0, 1, 2.5, 2) * k, 0],
        },
        arms,
        extra: {
          ...bladeAngle(B(REST_ALPHA, 2, -1.45, -1.2, 0.1), B(REST_SIDE, 0.12, 0.05, 0.1)),
          // The runes build through the charge, peak at the impact and die down in the hold.
          charge: track(u, [[0, 0], [U(1.5), 0.25], [b.apex, 0.6], [b.strike, 1], [b.extreme, 1], [U(10), 0.5], [U(12), 0.08], [1, 0]]),
        },
      };
    },
  });
}
