/**
 * @core/rig - Clip checks
 *
 * Measures what makes procedural animation look broken, for any skeleton and clip: bones that
 * stretch, planted feet that slide against the ground speed, feet that sink below the floor and
 * loops that do not close (the end-to-start gap is measured for every clip, warned about for
 * loops and moving clips). `defineCharacterAsset` runs it on every export and writes the result
 * to the atlas JSON, so `npm run inspect` can warn about a new creature or clip without a test.
 */

import { Frame3 } from '../volume/frame.js';
import { len3, sub3, vec3, type Vec3 } from '../volume/vec3.js';
import type { Clip } from './clips.js';
import { footCycle } from './gait.js';
import { solvePose } from './pose.js';
import type { SkeletonSpec } from './skeleton.js';

/** Result of `checkClip`, in world units (logical px). */
export interface ClipCheck {
  /** Worst change of a bone's length from its spec. */
  boneDrift: number;
  /** Locomotion only: worst difference between a planted foot's motion and the ground speed. */
  footSlide: number | null;
  /** Lowest foot height (negative = below the floor). */
  lowestFoot: number;
  /** Lowest height of any joint (a body or tail sinking into the floor shows as negative). */
  lowestJoint: number;
  /**
   * Worst joint distance between the end and the start of the clip, measured for every clip.
   * Loops (`loop: true`) and moving clips (`speed` > 0) are warned about when it is not ~0; a
   * non-looping clip in place (an attack) may legitimately end elsewhere, so it is only reported.
   */
  loopGap: number;
  /** One line per problem, with the usual cause. Empty when the clip is clean. */
  warnings: string[];
}

const dist = (a: Vec3, b: Vec3) => len3(sub3(a, b));

/** Samples a clip `samples` times and measures bone drift, foot slide, floor contact and loop closure. */
export function checkClip(skeleton: SkeletonSpec, clip: Clip, samples = 96): ClipCheck {
  const frame = Frame3.facing(vec3(0, 0, 0), 0);
  const pose = (t: number) => solvePose(skeleton, frame, clip.drive(((t % 1) + 1) % 1));
  const gait = clip.speed > 0 ? skeleton.gaits[clip.name] : undefined;
  let boneDrift = 0;
  let footSlide = 0;
  let lowestFoot = Infinity;
  let lowestJoint = Infinity;
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const p = pose(t);
    for (const leg of skeleton.legs) {
      const c = p.chains[leg.name];
      boneDrift = Math.max(boneDrift, Math.abs(dist(c[0], c[1]) - leg.lengths[0]), Math.abs(dist(c[1], c[2]) - leg.lengths[1]));
      if (leg.foot) boneDrift = Math.max(boneDrift, Math.abs(dist(c[2], c[3]) - leg.foot.length));
      lowestFoot = Math.min(lowestFoot, p.joints[`${leg.name}.foot`].z);
    }
    for (const q of Object.values(p.joints)) lowestJoint = Math.min(lowestJoint, q.z);
    for (const arm of skeleton.arms ?? []) {
      const c = p.chains[arm.name];
      boneDrift = Math.max(boneDrift, Math.abs(dist(c[0], c[1]) - arm.lengths[0]), Math.abs(dist(c[1], c[2]) - arm.lengths[1]));
    }
    // A planted foot moves backwards at exactly the ground speed: the game moves the sprite
    // forward at that speed, so on screen the foot stays on the floor.
    if (gait) {
      const q = pose(t + 1 / samples);
      for (const leg of skeleton.legs) {
        const ph = gait.phases[leg.name];
        if (!footCycle(gait, t + ph).planted || !footCycle(gait, t + 1 / samples + ph).planted) continue;
        const moved = dist(p.joints[`${leg.name}.foot`], q.joints[`${leg.name}.foot`]);
        footSlide = Math.max(footSlide, Math.abs(moved - clip.speed * (clip.seconds / samples)));
      }
    }
  }
  const first = pose(0);
  const last = pose(1 - 1e-9);
  const loopGap = Math.max(0, ...Object.keys(first.joints).map(k => dist(first.joints[k], last.joints[k])));
  const round = (x: number) => Math.round(x * 1000) / 1000;
  const warnings: string[] = [];
  if (boneDrift > 0.05) warnings.push(`bones stretch by ${round(boneDrift)}: a target is out of reach and soft IK gave way; shorten the reach or lower the trunk`);
  if (gait && footSlide > 0.05) warnings.push(`planted feet slide by ${round(footSlide)} per sample: the trunk drop cannot keep a foot on its stride; reduce stride or lift, or raise duty`);
  if (lowestFoot < -0.05) warnings.push(`a foot sinks ${round(-lowestFoot)} below the floor: feet targets must have z ≥ 0`);
  if (lowestJoint < -1) warnings.push(`a joint sinks ${round(-lowestJoint)} below the floor: lower the trunk less, or lift the tail or head`);
  // The action contract: what players and the playground rely on.
  const names = clip.events.map(e => e.name);
  if (clip.kind === 'attack' && !names.includes('hit')) warnings.push('an attack without a `hit` event: games deal damage on that frame');
  if (clip.kind === 'skill' && !names.includes('cast') && !names.includes('release')) warnings.push('a skill without a `cast` or `release` event: games fire the effect on that frame');
  if (clip.kind === 'death' && !clip.hold) warnings.push('a death without `hold: true`: it would return to idle when it ends');
  for (const e of clip.events) if (!(e.t >= 0 && e.t < 1)) warnings.push(`event "${e.name}" at t = ${e.t}: events must be in [0, 1)`);
  // Only cycles must close: loops, and locomotion (a clip with ground speed repeats even when
  // `loop` was left at its default of false). Attacks and other one-shots return to rest or not.
  if ((clip.loop || clip.speed > 0) && loopGap > 0.05) {
    const hint = clip.loop ? '' : ' (the clip moves but `loop` is false: pass `loop: true` to defineClip)';
    warnings.push(`the loop does not close (gap ${round(loopGap)}): every periodic term needs a whole number of cycles per loop${hint}`);
  }
  return { boneDrift: round(boneDrift), footSlide: gait ? round(footSlide) : null, lowestFoot: round(lowestFoot), lowestJoint: round(lowestJoint), loopGap: round(loopGap), warnings };
}
