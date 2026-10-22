/**
 * Timing and orientation helpers of the kit's living pieces (guide 05): what a prop reads from `ctx.state` and
 * `ctx.clip` to know how far along it is, the curves that give a swing its anticipation, overshoot and settle
 * (the `diorama-volume` motion reference), and the frames a hinged lid or a tumbling shard is built in.
 *
 * Nothing here draws. A piece turns its `ctx.clip` into numbers (an angle, a glow, how far a shard has flown)
 * and draws those; so the same piece serves the still sheets (a resting state), the clip sheets and a game's own
 * frames, and a transition always starts on the `from` still and ends on the `to` one.
 *
 * Rules the helpers keep:
 * - **a transition** is sampled by frame index: `playhead(clip)` is `t × (frames − 1)`, so a key table written in frames
 *   ("the lid is at 118° on frame 5") lands exactly on its frames; a game that plays at any other rate only sees them;
 * - **a loop** is sampled at `t = frame / frames` and never includes `t = 1`; `wave` is zero at `t = 0` and makes whole
 *   cycles, so frame 0 of a loop is the piece's still look and frame `frames` would be frame 0 again;
 * - **no `Math.random`**: anything that varies from one thing to the next (a spark, a shard) comes from its index.
 */

import { Frame3, add3, cross3, dot3, norm3, scale3, type Vec3 } from '@core/volume';

/** A full turn, in radians. */
export const TAU = Math.PI * 2;
/** Degrees to radians. */
export const RAD = Math.PI / 180;

export const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** How far `t` is between `a` and `b`, clamped to 0 to 1. */
export const seg = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));

/** Slow in and slow out (smoothstep). */
export const smooth = (x: number): number => x * x * (3 - 2 * x);
/** Fast at first, then slowing (quadratic ease-out): the strike of a swing. */
export const easeOut = (x: number): number => 1 - (1 - x) * (1 - x);
/** Slow at first, then speeding up (quadratic ease-in): a fall. */
export const easeIn = (x: number): number => x * x;

/**
 * A whole-cycle wave that is 0 at `t = 0` and again at `t = 1`: `cycles` full turns over the loop, shifted by
 * `phase` (a fraction of a turn). A loop built from waves has its still look on frame 0 and closes exactly.
 */
export const wave = (t: number, cycles: number, phase = 0): number => Math.sin(TAU * (cycles * t + phase)) - Math.sin(TAU * phase);

/**
 * `wave` normalised to roughly -1..1 whatever the phase (it is the plain sine minus its starting value, so it spans up to
 * 2): a flame's size and lean multiply it by a fraction.
 */
export const flutter = (t: number, cycles: number, phase = 0): number => wave(t, cycles, phase) * 0.5;

/** A Catmull-Rom spline through values given at frame positions: `keys` are `[frame, value]`, sorted by frame. */
export type Keys = readonly (readonly [number, number])[];

/**
 * The value of a hand-timed track at `x` (a frame position): exactly the key's value on a key's frame, a smooth curve
 * through the keys between them (so a swing's overshoot is a key above its target, not a blind ease), and the first
 * or last value outside them.
 */
export function track(x: number, keys: Keys): number {
  if (x <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (x >= last[0]) return last[1];
  let i = 0;
  while (keys[i + 1][0] < x) i++;
  const [x1, y1] = keys[i];
  const [x2, y2] = keys[i + 1];
  const [x0, y0] = keys[Math.max(0, i - 1)];
  const [x3, y3] = keys[Math.min(keys.length - 1, i + 2)];
  const u = (x - x1) / (x2 - x1);
  // Tangents from the neighbours, in values per frame, scaled to this segment.
  const m1 = x2 > x0 && i > 0 ? ((y2 - y0) / (x2 - x0)) * (x2 - x1) : y2 - y1;
  const m2 = x3 > x1 && i + 2 < keys.length ? ((y3 - y1) / (x3 - x1)) * (x2 - x1) : y2 - y1;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * y2 + (u3 - u2) * m2;
}

/** The position along a transition clip in frames (`t × (frames − 1)`), the `x` of `track`. */
export const playhead = (clip: { t: number; frames: number }): number => clip.t * Math.max(0, clip.frames - 1);

// ----------------------------------------------------------------------------------------------
// Frames
// ----------------------------------------------------------------------------------------------

/** Rotates a vector about a unit axis (Rodrigues); lengths are kept, so a scaled frame stays as scaled. */
export function rotateAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const k = norm3(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return add3(add3(scale3(v, c), scale3(cross3(k, v), s)), scale3(k, dot3(k, v) * (1 - c)));
}

/** The frame turned about its side axis by `angle` radians (positive lifts `forward` towards `up`): a lid on a back hinge, a tipped part. */
export function pitched(f: Frame3, angle: number): Frame3 {
  return new Frame3(f.origin, rotateAbout(f.forward, f.right, -angle), f.right, rotateAbout(f.up, f.right, -angle));
}

/** The frame turned about its forward axis by `angle` radians (positive lifts the right side). */
export function rolled(f: Frame3, angle: number): Frame3 {
  return new Frame3(f.origin, f.forward, rotateAbout(f.right, f.forward, angle), rotateAbout(f.up, f.forward, angle));
}

/**
 * A frame at `origin` turned to any attitude: `yaw` about the floor's up, then `pitch` (lifting forward) and `roll`
 * (lifting the right side), all in radians. A shard lying or flying in the air is built in one.
 */
export function attitude(origin: Vec3, yaw: number, pitch = 0, roll = 0): Frame3 {
  return rolled(pitched(Frame3.facing(origin, yaw), pitch), roll);
}
