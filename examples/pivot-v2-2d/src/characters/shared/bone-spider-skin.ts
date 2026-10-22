/**
 * Bone spider skin: an undead giant spider. A pale bone carapace with a swept horn crest and a
 * cracked left shoulder, a skull face (hollow sockets, soul-fire eyes, fangs and teeth), a hollow
 * abdomen caged in bone ribs with a soul-fire hourglass glowing inside, and eight jointed bone
 * legs with a thorn on every knee. Draws any pose of `boneSpider`.
 *
 * Channels it reads from the clip (all optional):
 * - `fang`: -1 flared wide (a spit, a scream) .. 0 open .. 1 pinched shut (idle swings 0..1);
 * - `palp`: palp wiggle, -1..1;
 * - `pulse`: soul glow, 0..1 (above 1 the glow swells and its halo grows: a spit gathering);
 * - `hurt`: 0..1 eye flare (a hit); `life`: 1 alive .. 0 the soul glow gone dark (death);
 * - `flash`: 0..1 soul-fire muzzle flash at the mouth (the clip's `release` frame is its peak).
 *
 * Every part of the trunk is built along the trunk's own axis (abdomen to head) and its side, never
 * along world up, so the skin survives the pitch and drop of a hit or a death: the carapace, plate,
 * horns and abdomen lie down with the body. Only the legs and their thorns use the creature's up.
 *
 * Detail tiers: primary = eight legs with knee thorns, carapace horn crest, abdomen spine row,
 * fangs; secondary = hollow ribbed abdomen, carapace plate with grooves, pedipalps, joint knobs,
 * the waist ring, the cracked shoulder; tertiary = six eyes in sockets, teeth, rib tips, claw
 * tips, the soul hourglass.
 */

import { Path, Polygon, lerpColor } from '@core/draw';
import { partFrame, type Pose, type Skin } from '@core/rig';
import { Blob, Decal, Round, Tube, add3, lerp3, mix3, norm3, scale3, sub3, vec3, visibleArc, type Camera, type Frame3, type Vec3 } from '@core/volume';
import { GLOWS, PALETTES, RAMPS, VOLUMES } from '../../theme';

/** Soul-fire hourglass, built once: two triangles meeting at a waist (@core/draw shapes are y-down). */
const HOURGLASS = (() => {
  const base = 7;
  const height = 5.6;
  const apex = (height * 2) / 3; // a triangle is centred on its centroid
  const lower = Polygon.triangle(base, height).translate(0, apex);
  const upper = Polygon.triangle(base, height).flip('y', 0).translate(0, -apex);
  return upper.union(lower);
})();
/** Thin groove in the carapace plate, built once. */
const groove = (...pts: [number, number][]) => Path.spline(pts.map(([x, y]) => ({ x, y }))).toShape({ width: 0.55, cap: 'round', clean: false });

/** Half-height of the abdomen ellipsoid: the hourglass sits on its top. */
const RU = 8;

/**
 * The frames every part is built in, from a pose: `trunk` (thorax, along the abdomen-to-head axis),
 * `abdomen` (the sac behind it) and `head` (the skull, facing where the head points). Skins and
 * sockets share them, so a socket sits exactly on the part it names.
 */
export function spiderFrames(pose: Pose): { axis: Vec3; trunk: Frame3; abdomen: Frame3; head: Frame3 } {
  const j = pose.joints;
  const f = pose.frame;
  const axis = norm3(sub3(j.head, j.abdomen));
  const trunk = partFrame(j.thorax, axis, f.up);
  const abdomen = partFrame(add3(j.abdomen, trunk.dir(-0.5, 0, 0.5)), axis, f.up);
  const head = partFrame(j.head, norm3(add3(sub3(j.head, j.thorax), scale3(f.forward, 4))), f.up);
  return { axis, trunk, abdomen, head };
}

/** Sockets of the spider: where its spit leaves (between the fangs) and the glow on its abdomen. */
export const spiderSockets = {
  mouth: (pose: Pose) => spiderFrames(pose).head.at(5.4, 0, -3.3),
  abdomen: (pose: Pose) => spiderFrames(pose).abdomen.at(0, 0, RU),
};

/**
 * Soul-fire muzzle flash at the mouth, drawn in screen space from 3D points so it turns with the
 * head: a ragged burst, a pale core, a jet along the head's forward and a few flung drops.
 */
function muzzleFlash(o: Parameters<Skin>[0], head: Frame3, f: number): void {
  const mouth = head.at(5.4, 0, -3.3);
  const fwd = norm3(head.dir(1, 0, 0.45));
  const ray = (a: number, spread: number): Vec3 => norm3(add3(fwd, scale3(add3(scale3(head.right, Math.cos(a)), scale3(head.up, Math.sin(a))), spread)));
  const burst = (len: number, spikes: number[]) => {
    const n = spikes.length;
    const pts: Vec3[] = [];
    spikes.forEach((k, i) => {
      const a = (i / n) * Math.PI * 2 + 0.35;
      pts.push(add3(mouth, scale3(ray(a, 1.25), len * k)));
      pts.push(add3(mouth, scale3(ray(a + Math.PI / n, 0.5), len * 0.32)));
    });
    return pts;
  };
  o.custom(
    mouth,
    (ctx, cam: Camera) => {
      const shape = (pts: Vec3[]) => Polygon.fromPoints(pts.map(p => cam.project(p)));
      const halo = { ...GLOWS.soul, blur: GLOWS.soul.blur * (0.5 + 0.7 * f) };
      shape(burst(4.4 + 8.4 * f, [1, 0.62, 0.86, 0.55, 0.96, 0.7])).draw(ctx, { fill: RAMPS.soul.base, shadow: halo });
      shape(burst(3 + 5.2 * f, [0.9, 0.7, 1, 0.6, 0.85, 0.65])).draw(ctx, { fill: RAMPS.soul.lit });
      // The jet: a long diamond straight out of the mouth.
      const jet = 4 + 10 * f;
      const w = 0.9 + 1.3 * f;
      shape([mouth, add3(add3(mouth, scale3(fwd, jet * 0.35)), scale3(head.right, w)), add3(mouth, scale3(fwd, jet)), add3(add3(mouth, scale3(fwd, jet * 0.35)), scale3(head.right, -w))]).draw(ctx, { fill: RAMPS.soul.lit, shadow: GLOWS.soulFaint });
      // Drops flung ahead of it.
      if (f > 0.35) {
        for (let k = 0; k < 4; k++) {
          const p = cam.project(add3(add3(mouth, scale3(fwd, (5 + 2.3 * k) * f)), mix3([head.right, (k % 2 ? 1 : -1) * (1.3 + 0.7 * k) * f], [head.up, (k - 1.5) * 0.7 * f])));
          Polygon.circle(0.55 + 0.2 * (3 - k), { cx: p.x, cy: p.y }).draw(ctx, { fill: RAMPS.soul.base, shadow: GLOWS.soulFaint });
        }
      }
    },
    { bias: 3 },
  );
}

export const boneSpiderSkin: Skin = (o, pose, kit) => {
  const j = pose.joints;
  const f = pose.frame;
  const cam = kit.camera;
  const fang = pose.extra.fang ?? 0;
  const palp = pose.extra.palp ?? 0;
  const pulse = pose.extra.pulse ?? 0;
  const hurt = pose.extra.hurt ?? 0;
  const life = pose.extra.life ?? 1;
  const flash = pose.extra.flash ?? 0;
  const flare = Math.max(hurt, 0.5 * flash);
  const { axis, trunk: tf, abdomen: aFrame, head: hf } = spiderFrames(pose);

  // ── Legs: femur up to the knee, tibia down to the ankle, tarsus to the claw (the IK chain).
  for (const leg of kit.skeleton.legs) {
    const [hip, knee, ankle, claw] = pose.chains[leg.name];
    const side = leg.name.endsWith('L') ? -1 : 1;
    const hump = add3(lerp3(hip, knee, 0.55), f.dir(0, side * 0.5, 1.2));
    const femur = new Tube([hip, hump, knee], { start: 3, end: 2.3 });
    const knob = Round.ellipsoid(partFrame(knee, f.forward, f.up), 2.7, 2.7, 2.5);
    const tibia = new Tube([knee, ankle], { start: 2.2, end: 1.5 });
    const joint2 = Round.ellipsoid(partFrame(ankle, sub3(ankle, knee), f.up), 1.6, 1.5, 1.5);
    const tarsus = new Tube([ankle, claw], { start: 1.4, end: 0.4 });
    const limb = new Blob([femur, knob, tibia, joint2, tarsus]);
    o.add(limb, VOLUMES.legBone);
    // A thorn on every knee, leaning up and out.
    const thorn = add3(knee, f.dir(0.4, side * 1.2, 1.2));
    o.add(new Tube([thorn, add3(thorn, f.dir(0.6, side * 2.4, 3.4))], { start: 1.4, end: 0.2 }), VOLUMES.bone, { on: limb });
  }

  // ── Waist ring between the carapace and the abdomen.
  const waist = Round.ellipsoid(partFrame(lerp3(j.abdomen, j.thorax, 0.62), axis, f.up), 4.6, 4.4, 3.8);
  o.add(waist, VOLUMES.legBone);

  // ── Abdomen: a hollow sac caged by bone ribs, soul fire glowing through the top. The glow dims
  // to its dark tone when `life` runs out and its halo swells when `pulse` goes past 1.
  const RF = 11;
  const RS = 8.6;
  const abdomen = Round.ellipsoid(aFrame, RF, RS, RU);
  o.add(abdomen, VOLUMES.hollow);
  const glowFill = life < 1 ? lerpColor(RAMPS.soul.dark, RAMPS.soul.base, life) : RAMPS.soul.base;
  const glowHalo = life < 1 ? { ...GLOWS.soulFaint, blur: GLOWS.soulFaint.blur * (0.4 + 0.6 * life) } : { ...GLOWS.soul, blur: GLOWS.soul.blur * (1 + 0.8 * Math.max(0, pulse - 1)) };
  const glow = Decal.onFace(aFrame, 'top', vec3(0, 0, RU + 0.02), HOURGLASS.clone().scale(1.5));
  o.add(glow, { fill: glowFill, shadow: glowHalo }, { on: abdomen });
  o.add(Decal.onFace(aFrame, 'top', vec3(0, 0, RU + 0.04), HOURGLASS.clone().scale(0.72 + 0.16 * pulse)), { fill: life < 1 ? lerpColor(RAMPS.soul.dark, RAMPS.soul.lit, life) : RAMPS.soul.lit }, { on: glow });
  for (let i = 0; i < 7; i++) {
    const x = -9.2 + i * 3;
    const k = Math.sqrt(1 - (x / RF) ** 2);
    const arc = visibleArc(cam, aFrame.at(x, 0, 0), aFrame.right, aFrame.up, RS * k * 1.02, RU * k * 1.02);
    if (arc.length > 1) o.add(new Tube(arc, t => 0.45 + 0.95 * Math.sin(Math.PI * t)), VOLUMES.boneLimb, { on: abdomen });
  }
  // Spine row along the back of the abdomen, leaning backwards.
  // (the middle stays bare so the soul fire shows)
  for (const [i, x] of [-8.4, -5.8, 7.6].entries()) {
    const k = Math.sqrt(1 - (x / RF) ** 2);
    const base = aFrame.at(x, 0, RU * k);
    const h = 3.4 + 0.5 * i;
    o.add(new Tube([base, add3(base, mix3([aFrame.up, h], [aFrame.forward, -h * 0.55]))], { start: 1.7, end: 0.25 }), VOLUMES.bone, { on: abdomen });
  }

  // ── Carapace: thorax and head lobe as one mass, a raised plate with grooves, a horn crest.
  const body = partFrame(add3(j.thorax, tf.dir(0.5, 0, 1)), axis, f.up);
  const carapace = new Blob([
    Round.ellipsoid(body, 8.6, 7.6, 6.2),
    Round.ellipsoid(partFrame(add3(j.head, hf.dir(0.6, 0, -0.4)), hf.forward, f.up), 5.6, 5.3, 4.6),
  ]);
  o.add(carapace, VOLUMES.bone);
  const plateFrame = partFrame(add3(j.thorax, tf.dir(0, 0, 4.4)), axis, f.up);
  const plate = Round.ellipsoid(plateFrame, 6.4, 5.4, 2.8);
  o.add(plate, VOLUMES.bone, { on: carapace });
  const put = (shape: ReturnType<typeof groove>) => Decal.onFace(plateFrame, 'top', vec3(0, 0, 2.82), shape);
  const fan = [groove([0, 0], [3.2, -1.2], [5.2, -3.4]), groove([0, 0], [3.4, 1], [5.4, 3.2]), groove([0, 0], [-3, -1.2], [-5, -3.2]), groove([0, 0], [-3.2, 1.2], [-5.2, 3.2])];
  for (const g of fan) o.add(put(g), { fill: PALETTES.boneDark }, { on: plate });
  o.add(put(groove([-4.4, -3.8], [-2.8, -1.8], [-3.4, 0.2], [-1.4, 1.8])), { fill: PALETTES.hollow }, { on: plate });
  // Horn crest sweeping back from both shoulders (one broken short on the left).
  for (const s of [-1, 1]) {
    const base = add3(j.thorax, tf.dir(-1.5, s * 4.2, 4.6));
    const len = s < 0 ? 3.6 : 6;
    o.add(new Tube([base, add3(base, tf.dir(-len * 0.35, s * len * 0.35, len * 0.7)), add3(base, tf.dir(-len * 1.1, s * len * 0.5, len * 0.9))], { start: 2.4, end: 0.3 }), VOLUMES.bone, { on: carapace });
  }

  // ── Face: skull sockets with soul-fire eyes, small eyes above, teeth and fangs. A hit (or a spit)
  // flares the eyes: larger, paler towards the lit tone, a wider halo.
  const eyeBase = lerpColor(RAMPS.soul.dark, RAMPS.soul.base, 0.4 + 0.6 * life);
  const eyeColor = flare > 0 ? lerpColor(eyeBase, RAMPS.soul.lit, flare) : eyeBase;
  // A dead eye keeps no halo and no bright pupil: both follow `life` down to the dark tone.
  const eyeHalo = life < 1 ? { ...GLOWS.soulFaint, blur: GLOWS.soulFaint.blur * (0.3 + 0.7 * life) * (1 + flare) } : { ...GLOWS.soul, blur: GLOWS.soul.blur * (1 + flare) };
  const eyeSpark = life < 1 ? lerpColor(RAMPS.soul.dark, RAMPS.soul.lit, life) : RAMPS.soul.lit;
  for (const s of [-1, 1]) {
    for (const [at, rx, ry, iris] of [
      [vec3(4.95, s * 2.5, 0.9), 1.9, 1.5, 1.05],
      [vec3(5.05, s * 1.1, 3), 1, 0.8, 0.6],
      [vec3(4.1, s * 3.8, 2.6), 0.9, 0.8, 0.55],
    ] as const) {
      const r = iris * (1 + 0.45 * flare);
      const socket = Decal.onFace(hf, 'front', at, Polygon.ellipse(rx * (1 + 0.2 * flare), ry * (1 + 0.2 * flare)));
      o.add(socket, { fill: PALETTES.hollow }, { on: carapace });
      const eye = Decal.onFace(hf, 'front', add3(at, vec3(0.03, 0, 0)), Polygon.ellipse(r, r * 0.85));
      o.add(eye, { fill: eyeColor, shadow: eyeHalo }, { on: socket });
      o.add(Decal.onFace(hf, 'front', add3(at, vec3(0.06, 0, -0.05)), Polygon.ellipse(r * 0.45, r * 0.4)), { fill: eyeSpark }, { on: eye });
    }
  }
  const open = Math.max(0, -fang);
  for (const s of [-1, 1]) {
    // Fangs (chelicerae): a fat base, a hooked tusk that pinches in when `fang` rises and flares
    // out, forward and up when it goes below zero.
    const base = hf.at(4.2, s * (1.9 + 0.35 * open), -2.6);
    const tip = add3(base, mix3([hf.forward, 1.6 + 1.2 * open], [hf.up, -5.2 + 2.2 * open], [hf.right, -s * (0.4 + 1.8 * fang)]));
    const mid = add3(base, mix3([hf.forward, 1.9 + 0.4 * open], [hf.up, -2.4 + 0.4 * open], [hf.right, s * (-0.2 + 0.9 * open)]));
    o.add(Round.ellipsoid(partFrame(base, hf.forward, hf.up), 1.9, 1.7, 1.9), VOLUMES.bone, { bias: 0.5 });
    o.add(new Tube([base, mid, tip], { start: 1.7, end: 0.2 }), VOLUMES.bone, { bias: 0.6 });
    // Pedipalps: short feelers beside the fangs, wiggling in idle.
    const pBase = hf.at(3.4, s * 4.6, -1.6);
    const pMid = add3(pBase, mix3([hf.forward, 3], [hf.right, s * (1.4 + palp)], [hf.up, -1]));
    const pTip = add3(pMid, mix3([hf.forward, 2.2], [hf.right, s * (0.2 + palp * 0.8)], [hf.up, -2.4]));
    o.add(new Blob([new Tube([pBase, pMid, pTip], { start: 1.4, end: 0.35 }), Round.ellipsoid(partFrame(pMid, hf.forward, hf.up), 1.3, 1.3, 1.3)]), VOLUMES.legBone, { bias: 0.4 });
  }
  for (let i = -2; i <= 2; i++) {
    const root = hf.at(5, i * 0.78, -3.1);
    o.add(new Tube([root, add3(root, mix3([hf.up, -1.4], [hf.forward, 0.3]))], { start: 0.55, end: 0.12 }), VOLUMES.bone, { bias: 0.45 });
  }

  // ── Spit: the soul fire gathers in the throat, then bursts from the mouth.
  if (flash > 0.02) {
    const throat = Decal.onFace(hf, 'front', vec3(5.15, 0, -3.1), Polygon.ellipse(0.7 + 1.1 * flash, 0.45 + 0.7 * flash));
    o.add(throat, { fill: RAMPS.soul.lit, shadow: GLOWS.soulFaint }, { on: carapace });
    muzzleFlash(o, hf, flash);
  }
};
