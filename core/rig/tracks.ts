/**
 * @core/rig - Keyframe tracks and easing
 *
 * Values sampled at normalized time t in 0..1, plus the rhythm every deliberate action uses:
 * anticipation, apex hold, strike with overshoot, extreme hold, settle, recovery.
 */

/** An easing curve on 0..1. */
export type Ease = (t: number) => number;

export const linear: Ease = t => t;
/** Ease in and out (smoothstep). The default between keys. */
export const smooth: Ease = t => t * t * (3 - 2 * t);
export const easeOutCubic: Ease = t => 1 - Math.pow(1 - t, 3);
export const easeInCubic: Ease = t => t * t * t;
/** Gentler than easeOutCubic: over a 3-frame strike it splits the motion about 56/33/11%. */
export const easeOutQuad: Ease = t => 1 - (1 - t) * (1 - t);

/** A key: [time, value], or [time, value, ease] where the ease shapes the segment ending at this key. */
export type Key = [number, number] | [number, number, Ease];

/** Value of a keyed track at time t (clamped to the first and last keys). */
export function track(t: number, keys: Key[]): number {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1[0]) {
      const k0 = keys[i - 1];
      const ease = k1[2] ?? smooth;
      const u = (t - k0[0]) / (k1[0] - k0[0] || 1);
      return k0[1] + (k1[1] - k0[1]) * ease(u);
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * Timing of one deliberate action, as normalized times. Every value keyed with `beat` passes
 * through: rest → windup (apex) → hold → strike (extreme, past the target) → hold → settle
 * (target) → rest.
 */
export interface Beat {
  /** End of the anticipation (the apex pose). */
  apex: number;
  /** End of the apex hold; the strike starts here. */
  strike: number;
  /** End of the strike: the extreme pose, past the target. */
  extreme: number;
  /** End of the extreme hold. */
  hold: number;
  /** Back on the target pose. */
  settle: number;
}

/** Default rhythm (about 25 frames at 60 Hz for a 0.42 s action). */
export const BEAT: Beat = { apex: 0.17, strike: 0.24, extreme: 0.37, hold: 0.49, settle: 0.64 };

/**
 * Keys one channel through a beat: `rest` → `apex` (creeping by `creep` during the hold) →
 * `extreme` (eased out) → `target` → back to `rest` at t = 1. The difference between
 * `extreme` and `target` is the overshoot.
 */
export function beat(t: number, b: Beat, rest: number, apex: number, extreme: number, target: number, creep = 0): number {
  const hold = extreme + (target - extreme) * 0.25;
  return track(t, [
    [0, rest],
    [b.apex, apex],
    [b.strike, apex + creep],
    [b.extreme, extreme, easeOutQuad],
    [b.hold, hold],
    [b.settle, target],
    [1, rest],
  ]);
}

/** Bell-shaped 0..1..0 bump with zero slope at both ends (16 u² (1 − u)²). */
export const bell = (u: number): number => 16 * u * u * (1 - u) * (1 - u);

/**
 * A bump between t0 and t1 and 0 everywhere else: `bell` over the window, guarded. `bell` alone
 * is not clamped (outside 0..1 it grows again), so windowed motions (a tap, a claw flick, a jump
 * arc) use this. Keep t1 < 1 in loops, or the bump is cut at the seam.
 */
export function bump(t: number, t0: number, t1: number): number {
  const u = (t - t0) / (t1 - t0);
  return u > 0 && u < 1 ? bell(u) : 0;
}
