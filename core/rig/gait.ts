/**
 * @core/rig - Gaits
 *
 * A gait is a pattern of leg phases plus how the body moves with it. Any number of legs: a
 * biped alternates two, a quadruped walk steps each leg a quarter apart, a gallop pairs them.
 * Loops are in place: planted feet travel backwards at the ground speed, and the game moves
 * the sprite at that speed (`groundSpeed`), so nothing slides.
 */

import { bell, smooth } from './tracks.js';

/** How a skeleton walks, trots, runs or gallops. */
export interface GaitSpec {
  /** Fraction of the cycle each foot is on the ground: ~0.6 walking, ~0.35 running (under 0.5 there is a flight phase). */
  duty: number;
  /** Distance a planted foot travels under the body during its stance, in world units. */
  stride: number;
  /** Gait cycles per second. One exported loop is one cycle. */
  cadence: number;
  /** Phase offset of each leg in the cycle (0..1). A foot touches down when its phase is 0. */
  phases: Record<string, number>;
  /** Height the swinging foot is lifted (world units): about 0.18 × hip height walking, 0.3–0.4 × running. These values already allow for the tilted camera flattening vertical motion; the presets use them. */
  lift: number;
  /** Early heel lift of running swings, 0..1: the foot rises behind before it drives forward. */
  heelKick?: number;
  /** Vertical bob of the trunk (units), how many bobs per cycle, and when the lowest point falls (0..1). */
  bob?: number;
  bobCycles?: number;
  bobPhase?: number;
  /** Forward lean: front trunk joints move ahead by this much (units). Keep it small for walks; it reads as a hunch from a high camera. */
  lean?: number;
  /** Body pitch oscillation (degrees) and its phase: galloping and bounding. */
  pitch?: number;
  pitchPhase?: number;
  /** Spine flex (units): the rear and front of the trunk move apart and together once per cycle (gallop). */
  flex?: number;
  flexPhase?: number;
  /** Hip roll (degrees): the hip over the stance leg rises, the other drops; shoulders counter-roll. */
  roll?: number;
  /**
   * Shoulder counter-rotation (degrees): the upper body turns against the hips, the shoulder of
   * the forward-swinging arm going forward. Without it a biped walk looks robotic; ~6–8 walking,
   * ~10–14 running. Applies to trunk joints after the first, like \`Drive.twist\`.
   */
  twist?: number;
  /** Arm swing amplitude (radians) for skeletons with arms. */
  armSwing?: number;
  /** Forearm bend while swinging (radians): ~0.2 walking (nearly straight), ~1.2 running (near 90°). */
  armFlex?: number;
  /** Forearm crossing towards the body on the forward swing (0..1): makes a run read from the front. */
  armAcross?: number;
  /** Tail sway amplitude (degrees) and extra lift of the tail (degrees). */
  tailSway?: number;
  tailLift?: number;
}

/** Ground speed of a gait in world units per second: stride × cadence ÷ duty. */
export function groundSpeed(g: GaitSpec): number {
  return (g.stride * g.cadence) / g.duty;
}

/**
 * Foot offset in the creature's frame at leg phase `p` (0..1): `forward` along the stride and
 * `up` above the ground. Stance runs from +stride/2 (touchdown) to −stride/2 (lift-off) at a
 * constant speed; the swing returns with a smooth start and stop and a bell-shaped lift.
 */
export function footCycle(g: GaitSpec, p: number): { forward: number; up: number; planted: boolean } {
  const ph = ((p % 1) + 1) % 1;
  const half = g.stride / 2;
  if (ph < g.duty) return { forward: half - g.stride * (ph / g.duty), up: 0, planted: true };
  const u = (ph - g.duty) / (1 - g.duty);
  const kick = g.heelKick ?? 0;
  // Running swings rise early behind, then drive forward: the lift peaks before mid-swing.
  const peak = 0.5 - 0.12 * kick;
  const v = u < peak ? (0.5 * u) / peak : 0.5 + (0.5 * (u - peak)) / (1 - peak);
  const along = smooth(Math.pow(u, 1 + 0.35 * kick));
  return { forward: -half + g.stride * along, up: g.lift * bell(v), planted: false };
}

/**
 * Warps a leg phase so that its quarter points fall on the stride extremes: 0 at touchdown
 * (foot forward), 0.5 at lift-off (foot back). Arms swing on this warped phase.
 */
export function strideWarp(g: GaitSpec, p: number): number {
  const ph = ((p % 1) + 1) % 1;
  return ph < g.duty ? (0.5 * ph) / g.duty : 0.5 + (0.5 * (ph - g.duty)) / (1 - g.duty);
}
