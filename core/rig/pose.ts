/**
 * @core/rig - Drives and poses
 *
 * A clip produces a `Drive` for each moment of its loop: where the feet are, how the trunk is
 * offset, how arms swing or reach, how tails sway. `solvePose` turns a drive into world joints
 * for any skeleton: legs by two-bone IK to their feet (lowering the trunk where a foot would be
 * out of reach), arms by swing or IK, tails as chains.
 */

import { Frame3 } from '../volume/frame.js';
import { add3, cross3, dot3, len3, norm3, scale3, sub3, vec3, type Vec3 } from '../volume/vec3.js';
import { ikReach, twoBone } from './ik.js';
import type { LegSpec, Local, SkeletonSpec } from './skeleton.js';

/** How one arm is posed: a swing (forward kinematics) or a hand target (IK). */
export interface ArmDrive {
  /** Upper arm angle from hanging, radians; positive swings forward. */
  swing?: number;
  /** Extra bend of the forearm, radians. */
  flex?: number;
  /** How far the upper arm leans out to the side (0 = along the body, ~0.25 relaxed). */
  out?: number;
  /** Forearm leaning across towards the body's centre line (0..1), so a forward swing reads from the front. */
  across?: number;
  /** Hand target in the creature's frame; when set, the arm is solved by IK instead of swing. */
  target?: Local;
  /** Direction the elbow points towards when solved by IK (creature frame). Default down and out. */
  elbow?: Local;
}

/** How one tail is posed. */
export interface TailDrive {
  /** Side-to-side sway, degrees, at the tip. */
  sway?: number;
  /** Phase of the sway wave, radians; each segment lags the previous one. */
  phase?: number;
  /** Extra lift of the whole tail, degrees (positive raises it). */
  lift?: number;
  /** Curl towards the tip, degrees (positive curls up). */
  curl?: number;
}

/** Everything a clip decides at one moment. Missing parts stay at rest. */
export interface Drive {
  /** Offset of the whole trunk (a lunge, a crouch), in the creature's frame. */
  root?: Local;
  /** Offset of individual trunk joints (bob, lean, breathing), in the creature's frame. */
  trunk?: Record<string, Local>;
  /** Body pitch in degrees (positive raises the front), around the middle of the trunk. */
  pitch?: number;
  /** Upper-body yaw in degrees (positive turns towards the right), applied to trunk joints after the first. */
  twist?: number;
  /** Body roll in degrees (positive lifts the left hip): hip sockets tilt one way, shoulder sockets the other. */
  roll?: number;
  /** Ground contact of each leg, in the creature's frame (absolute, not an offset from rest: start from `restFeet(skeleton)`). z = 0 is the floor. */
  feet?: Record<string, Local>;
  arms?: Record<string, ArmDrive>;
  tails?: Record<string, TailDrive>;
  /** Free values for the skin (jaw opening, a weapon angle, a blink). */
  extra?: Record<string, number>;
}

/** The solved skeleton at one moment, in world coordinates. */
export interface Pose {
  /** The creature's frame (facing). */
  frame: Frame3;
  /** Every named joint: trunk joints, `<leg>.hip|knee|ankle|foot`, `<arm>.shoulder|elbow|hand`, `<tail>.<i>`. */
  joints: Record<string, Vec3>;
  /** Ordered chains for skins: `spine`, every leg (hip → contact), every arm (shoulder → hand), every tail (root → tip). */
  chains: Record<string, Vec3[]>;
  /** The drive's free values. */
  extra: Record<string, number>;
}

const deg = (d: number) => (d * Math.PI) / 180;

/** Rotates local point p around pivot by `a` radians in the forward/up plane (pitch). */
function pitchLocal(p: Local, pivot: Local, a: number): Local {
  const df = p[0] - pivot[0];
  const du = p[2] - pivot[2];
  return [pivot[0] + df * Math.cos(a) - du * Math.sin(a), p[1], pivot[2] + df * Math.sin(a) + du * Math.cos(a)];
}

/** Rotates local point p around pivot by `a` radians around up (yaw, positive towards the right side). */
function yawLocal(p: Local, pivot: Local, a: number): Local {
  const df = p[0] - pivot[0];
  const ds = p[1] - pivot[1];
  return [pivot[0] + df * Math.cos(a) - ds * Math.sin(a), pivot[1] + df * Math.sin(a) + ds * Math.cos(a), p[2]];
}

const addL = (a: Local, b: Local | undefined): Local => (b ? [a[0] + b[0], a[1] + b[1], a[2] + b[2]] : a);

/** Smooth maximum (log-sum-exp), never below the true maximum, so drops never kink when two legs swap. */
function softMax(values: number[], k = 0.5): number {
  if (values.length === 0) return 0;
  const m = Math.max(...values);
  return m + k * Math.log(values.reduce((s, v) => s + Math.exp((v - m) / k), 0));
}

/** The smoothed drop can fall short of the exact one by up to k·ln 2 of `softPlus`; aim this much inside the reach. */
const DROP_MARGIN = 0.3;

const softPlus = (x: number, k = 0.4) => (x > 8 * k ? x : k * Math.log(1 + Math.exp(x / k)));

/** World direction a leg's middle joint bends towards: 'forward' / 'back' along the facing, or a creature-frame vector. */
function kneeHint(frame: Frame3, knee: LegSpec['knee']): Vec3 {
  if (typeof knee === 'string') return frame.dir(knee === 'forward' ? 1 : -1, 0, 0);
  return frame.dir(knee[0], knee[1], knee[2]);
}

/** Solves a pose for `skeleton` facing `frame` from a clip's drive. */
export function solvePose(skeleton: SkeletonSpec, frame: Frame3, drive: Drive = {}): Pose {
  const joints: Record<string, Vec3> = {};
  const chains: Record<string, Vec3[]> = {};
  const W = (p: Local) => frame.at(p[0], p[1], p[2]);
  const trunkIndex = new Map(skeleton.trunk.map((j, i) => [j.name, i]));

  // 1. Trunk in local space: rest + offsets, then pitch around the middle, then upper-body twist.
  const first = skeleton.trunk[0].at;
  const last = skeleton.trunk[skeleton.trunk.length - 1].at;
  const pivot: Local = [(first[0] + last[0]) / 2, 0, (first[2] + last[2]) / 2];
  const pitch = deg(drive.pitch ?? 0);
  const twist = deg(drive.twist ?? 0);
  const placeLocal = (rest: Local, jointIndex: number): Local => {
    let p = rest;
    if (pitch) p = pitchLocal(p, pivot, pitch);
    if (twist && jointIndex > 0) p = yawLocal(p, first, twist);
    return p;
  };
  const trunkLocal = skeleton.trunk.map((j, i) => placeLocal(addL(addL(j.at, drive.trunk?.[j.name]), drive.root), i));
  // Sockets keep their offset from their joint, turned with the body.
  const roll = deg(drive.roll ?? 0);
  const socketLocal = (jointName: string, offset: Local, rollScale = 1): Local => {
    const i = trunkIndex.get(jointName)!;
    const j = skeleton.trunk[i];
    // Roll tilts the socket around the trunk's forward axis: the left side rises for positive roll.
    const r = roll * rollScale;
    const o: Local = r ? [offset[0], offset[1] * Math.cos(r) + offset[2] * Math.sin(r), offset[2] * Math.cos(r) - offset[1] * Math.sin(r)] : offset;
    const raw = addL(addL(addL(j.at, o), drive.trunk?.[j.name]), drive.root);
    return placeLocal(raw, i);
  };

  // 2. Legs: feet targets (rest stance + drive), lowering the trunk where a foot is out of reach.
  const footTarget = (leg: SkeletonSpec['legs'][number]): Local => {
    const fromDrive = drive.feet?.[leg.name];
    if (fromDrive) return fromDrive;
    const s = leg.stance ?? [0, 0, 0];
    const j = skeleton.trunk[trunkIndex.get(leg.hip)!].at;
    return [j[0] + leg.offset[0] + s[0], j[1] + leg.offset[1] + s[1], s[2]];
  };
  const ankleOf = (leg: SkeletonSpec['legs'][number], foot: Local): Local => {
    if (!leg.foot) return foot;
    const t = deg(leg.foot.tilt);
    return [foot[0] - Math.sin(t) * leg.foot.length, foot[1], foot[2] + Math.cos(t) * leg.foot.length];
  };
  const drops = new Map<string, number[]>();
  for (const leg of skeleton.legs) {
    const hip = socketLocal(leg.hip, leg.offset);
    const ankle = ankleOf(leg, footTarget(leg));
    const reach = ikReach(leg.lengths[0], leg.lengths[1]) - DROP_MARGIN;
    const h = Math.hypot(hip[0] - ankle[0], hip[1] - ankle[1]);
    const v = hip[2] - ankle[2];
    const allowed = h < reach ? Math.sqrt(reach * reach - h * h) : 0;
    const list = drops.get(leg.hip) ?? [];
    list.push(Math.max(0, v - allowed));
    drops.set(leg.hip, list);
  }
  // Each trunk joint takes the drop of the legged joints around it (interpolated between them).
  const legged = skeleton.trunk.map((j, i) => (drops.has(j.name) ? { i, d: softPlus(softMax(drops.get(j.name)!)) - softPlus(0) } : null)).filter(Boolean) as { i: number; d: number }[];
  const dropAt = (i: number): number => {
    if (legged.length === 0) return 0;
    const before = [...legged].reverse().find(l => l.i <= i);
    const after = legged.find(l => l.i >= i);
    if (!before) return after!.d;
    if (!after || after.i === before.i) return before.d;
    return before.d + ((after.d - before.d) * (i - before.i)) / (after.i - before.i);
  };
  const lowered = (p: Local, i: number): Local => [p[0], p[1], p[2] - Math.max(0, dropAt(i))];

  skeleton.trunk.forEach((j, i) => {
    joints[j.name] = W(lowered(trunkLocal[i], i));
  });
  chains.spine = skeleton.trunk.map(j => joints[j.name]);

  for (const leg of skeleton.legs) {
    const i = trunkIndex.get(leg.hip)!;
    const hip = W(lowered(socketLocal(leg.hip, leg.offset), i));
    const foot = W(footTarget(leg));
    const ankle = W(ankleOf(leg, footTarget(leg)));
    const hint = kneeHint(frame, leg.knee);
    const ik = twoBone(hip, ankle, leg.lengths[0], leg.lengths[1], hint);
    joints[`${leg.name}.hip`] = hip;
    joints[`${leg.name}.knee`] = ik.mid;
    joints[`${leg.name}.ankle`] = ik.end;
    const contact = leg.foot ? add3(ik.end, sub3(foot, ankle)) : ik.end;
    joints[`${leg.name}.foot`] = contact;
    chains[leg.name] = leg.foot ? [hip, ik.mid, ik.end, contact] : [hip, ik.mid, ik.end];
  }

  // 3. Arms: swing (FK) or hand target (IK), in the twisted upper-body frame.
  const upFrame = twist ? frame.turned((drive.twist ?? 0)) : frame;
  for (const arm of skeleton.arms ?? []) {
    const i = trunkIndex.get(arm.shoulder)!;
    const sh = W(lowered(socketLocal(arm.shoulder, arm.offset, -0.8), i));
    const d = drive.arms?.[arm.name] ?? {};
    let elbow: Vec3;
    let hand: Vec3;
    if (d.target) {
      const target = W(lowered(d.target, i));
      const e = d.elbow ?? [0, arm.side * 0.7, -1];
      const ik = twoBone(sh, target, arm.lengths[0], arm.lengths[1], upFrame.dir(e[0], e[1], e[2]));
      elbow = ik.mid;
      hand = ik.end;
    } else {
      const a = d.swing ?? 0;
      const out = d.out ?? 0.24;
      const upper = norm3(upFrame.dir(Math.sin(a), arm.side * out, -Math.cos(a)));
      elbow = add3(sh, scale3(upper, arm.lengths[0]));
      const a2 = a + (d.flex ?? 0.2);
      const inward = 0.1 - (d.across ?? 0) * Math.max(0, Math.min(1, (a + 0.2) / 0.8));
      const lower = norm3(upFrame.dir(Math.sin(a2), arm.side * inward, -Math.cos(a2)));
      hand = add3(elbow, scale3(lower, arm.lengths[1]));
    }
    joints[`${arm.name}.shoulder`] = sh;
    joints[`${arm.name}.elbow`] = elbow;
    joints[`${arm.name}.hand`] = hand;
    chains[arm.name] = [sh, elbow, hand];
  }

  // 4. Tails: a chain hanging back, swaying with a travelling wave.
  for (const tail of skeleton.tails ?? []) {
    const i = trunkIndex.get(tail.root)!;
    const d = drive.tails?.[tail.name] ?? {};
    let p = W(lowered(socketLocal(tail.root, tail.offset), i));
    const pts = [p];
    const seg = tail.length / tail.segments;
    for (let k = 0; k < tail.segments; k++) {
      const u = (k + 1) / tail.segments;
      const pitchK = deg(-tail.pitch + (d.lift ?? 0) + (d.curl ?? 0) * u) + pitch;
      const yawK = deg((d.sway ?? 0) * u * Math.sin((d.phase ?? 0) - u * 2.2));
      const dir = norm3(frame.dir(-Math.cos(pitchK) * Math.cos(yawK), Math.cos(pitchK) * Math.sin(yawK), Math.sin(pitchK)));
      p = add3(p, scale3(dir, seg));
      pts.push(p);
    }
    pts.forEach((q, k) => (joints[`${tail.name}.${k}`] = q));
    chains[tail.name] = pts;
  }

  return { frame, joints, chains, extra: { ...(drive.extra ?? {}) } };
}

/**
 * A frame for a body part: origin, the direction it points (`forward`) and an up hint.
 * Use it to build heads, snouts, blades and other parts that follow a joint's direction.
 */
export function partFrame(origin: Vec3, forward: Vec3, upHint: Vec3 = vec3(0, 0, 1)): Frame3 {
  const f = norm3(forward);
  let r = cross3(upHint, f);
  if (len3(r) < 1e-4) r = cross3(vec3(1, 0, 0), f);
  r = norm3(r);
  const u = norm3(cross3(f, r));
  return new Frame3(origin, f, r, dot3(u, upHint) < 0 ? scale3(u, -1) : u);
}

