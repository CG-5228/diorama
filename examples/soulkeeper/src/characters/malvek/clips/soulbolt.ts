/**
 * Malvek's skill, "Soul Bolt" (`skill`, `ranged`): the left palm draws back, then thrusts forward,
 * and a bolt of soul fire leaves it.
 *
 * The right hand keeps the scythe planted. The flame hand is drawn back to the chest as he leans
 * away, the shoulders turning left and the flame swelling (anticipation, 3 frames; `charge` flares
 * the eyes and the fire crown with it), holds a frame, and `cast` marks the end of the draw: the cast
 * can no longer be cancelled. Then the palm is thrown forward in two frames, the chest turning right
 * and the body dropping onto the left foot; `release` and `spawn:palm` share the extreme frame, where
 * the flame is at its biggest and the skin throws a burst of sparks along the facing. The flame
 * is spent after the release and slowly comes back; a hold, a settle and the recovery to the idle
 * pose on the last frame. `cancel` marks the recovery.
 *
 * Frames (12 at 0.7 s, 17 fps): 0-3 draw, 3-4 hold (cast on 4), 4-6 thrust (release on 6), 6-8 hold,
 * 8-9 settle, 9-11 recover.
 *
 * Channels for the skin: `flare` (0..1, the palm flame), `charge` (0..1), `lanternSway`.
 */

import { EVENTS, beat, defineClip, restFeet, spawnEvent, track, type Beat, type Clip, type Drive, type SkeletonSpec } from '@core/rig';
import { HAND_L, holdArms } from '../hold';

export const BOLT_FRAMES = 12;
const F = (n: number) => n / BOLT_FRAMES;
const U = (frame: number) => frame / (BOLT_FRAMES - 1);

export const BOLT_BEAT: Beat = { apex: U(3), strike: U(4), extreme: U(6), hold: U(8), settle: U(9) };

export function soulbolt(skeleton: SkeletonSpec, seconds = 0.7): Clip {
  const k = skeleton.height / 80;
  const b = BOLT_BEAT;
  const feet = restFeet(skeleton);
  return defineClip({
    name: 'soulbolt',
    kind: 'skill',
    tags: ['ranged'],
    seconds,
    events: [
      { t: F(4), name: EVENTS.cast },
      { t: F(6), name: EVENTS.release },
      { t: F(6), name: spawnEvent('palm') },
      { t: F(9), name: EVENTS.cancel },
    ],
    drive(t: number): Drive {
      const u = Math.min(1, (t * BOLT_FRAMES) / (BOLT_FRAMES - 1));
      const B = (rest: number, apex: number, extreme: number, target: number, creep = 0) => beat(u, b, rest, apex, extreme, target, creep);
      const lean = B(0, -1.5, 3.5, 2.2, -0.3) * k;
      const crouch = B(0, 0.4, 2.4, 1.6, 0) * k;
      const d: Drive = {
        root: [lean * 0.5, 0, -crouch],
        pitch: B(0, 6, -5, -3, 0.8),
        twist: B(0, -16, 13, 8, -1.5),
        trunk: { chest: [lean * 0.5, 0, 0], neck: [lean * 0.55, 0, 0], head: [lean * 0.6, 0, 0] },
        feet: {
          legL: [feet.legL[0] + B(0, -1, 5, 4) * k, feet.legL[1], 0],
          legR: [feet.legR[0] + B(0, 1, -3, -2.5) * k, feet.legR[1], 0],
        },
      };
      // The palm: drawn back to the chest, then thrown out at arm's length in front of the shoulder.
      const left: [number, number, number] = [B(0, 4 - HAND_L[0], 24 - HAND_L[0], 15 - HAND_L[0]), B(0, -15 - HAND_L[1], -8 - HAND_L[1], -14 - HAND_L[1]), B(0, 56 - HAND_L[2], 56 - HAND_L[2], 57 - HAND_L[2])];
      return {
        ...d,
        arms: holdArms(d, [0, 0, 0], left),
        extra: {
          flare: track(u, [[0, 0], [U(2), 0.35], [b.apex, 0.8], [b.strike, 0.9], [b.extreme, 1], [U(7), 0.3], [b.hold, 0.12], [1, 0]]),
          charge: track(u, [[0, 0], [b.apex, 0.7], [b.strike, 0.85], [b.extreme, 1], [b.hold, 0.5], [b.settle, 0.1], [1, 0]]),
          lanternSway: track(u, [[0, 0], [b.apex, 0.18], [b.extreme, -0.28], [b.hold, 0.15], [b.settle, -0.05], [1, 0]]),
        },
      };
    },
  });
}
