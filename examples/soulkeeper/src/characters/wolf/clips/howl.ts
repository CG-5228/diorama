/**
 * Ghoul wolf howl: a skill (`aoe`). The wolf gathers low (head and neck sink, the body rocks
 * back, ears fold), then throws the front of the body up, stretches the neck and tilts the muzzle
 * to the sky with the jaw wide, holds the note shaking, and settles back to its idle stance on
 * the last frame. `cast` marks the end of the gather (the howl begins), `release` the peak, where
 * the sound leaves the mouth (`spawn:mouth`); `cancel` is when another action may cut the
 * recovery short.
 *
 * Channels for the skin: `jaw` (up to 0.74, a 46-degree gape), `ears`, `tilt` (degrees the muzzle is raised above
 * the neck line) and `flare` (eyes). The sound rings are drawn by the skin after `release`.
 */

import { EVENTS, beat, bump, defineClip, easeOutQuad, spawnEvent, track, type Beat, type Clip, type Drive, type SkeletonSpec } from '@core/rig';

const FRAMES = 12;
/** Frame n of the 12-frame export, as normalized time of the clip (events live here). */
const F = (n: number) => n / FRAMES;

/**
 * The beat runs on `u`, which reaches 1 on the last frame (not at t = 1, which no frame samples),
 * so the wolf is back at rest on frame 11: gather 2 frames, rise 3, hold the note 3, recover 3.
 */
const U = (frame: number) => frame / (FRAMES - 1);
/** The skin's full gape is 62 degrees per unit of `jaw` (the bite needs it); the howl keeps its 48-degree note. */
const JAW = 48 / 62;

export const HOWL_BEAT: Beat = { apex: U(2), strike: U(2.5), extreme: U(5), hold: U(8), settle: U(9) };

export function howl(skeleton: SkeletonSpec, seconds = 1): Clip {
  const k = skeleton.height / 37;
  const b = HOWL_BEAT;
  return defineClip({
    name: 'howl',
    kind: 'skill',
    tags: ['aoe'],
    seconds,
    events: [
      { t: F(2), name: EVENTS.cast },
      { t: F(5), name: EVENTS.release },
      { t: F(5), name: spawnEvent('mouth') },
      { t: F(9), name: EVENTS.cancel },
    ],
    drive(t: number): Drive {
      const u = Math.min(1, (t * FRAMES) / (FRAMES - 1));
      const B = (rest: number, apex: number, extreme: number, target: number, creep = 0) => beat(u, b, rest, apex, extreme, target, creep);
      // The held note shakes the head and the jaw: three tremors inside the hold, gone before the recovery.
      const hold = (u - b.extreme) / (b.hold - b.extreme);
      const shake = bump(u, b.extreme, b.hold) * Math.sin(Math.PI * 2 * 3 * hold);
      return {
        root: [B(0, -1.6, -2.2, -2, 0) * k, 0, B(0, -2.2, -0.2, -0.5, 0.2) * k],
        pitch: B(0, -5, 9, 7.5, -0.5),
        trunk: {
          neck: [B(0, 1.8, -1.6, -1.4) * k, 0, B(0, -3, 2.8, 2.4, 0.2) * k],
          head: [B(0, 3, -3.8, -3.4) * k, 0, (B(0, -4.5, 5, 4.4, 0.2) + 0.35 * shake) * k],
        },
        tails: { tail: { lift: B(0, -5, -14, -12), sway: 3, phase: Math.PI * 2 * u } },
        extra: {
          tilt: B(0, -9, 17, 15, 0) + 2.5 * shake,
          jaw: JAW * (track(u, [[0, 0], [b.apex, 0.05], [b.strike, 0.1], [b.extreme, 0.95, easeOutQuad], [b.hold, 0.88], [b.settle, 0.75], [U(10), 0.1], [1, 0]]) + 0.07 * shake),
          ears: track(u, [[0, 0], [b.apex, 0.5], [b.extreme, 1], [b.settle, 1], [1, 0]]),
          flare: track(u, [[0, 0], [b.apex, 0.3], [b.extreme, 1, easeOutQuad], [b.hold, 0.9], [U(10), 0.2], [1, 0]]),
        },
      };
    },
  });
}
