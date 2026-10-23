/**
 * Heads: a skull with a jaw, sockets and soul eyes, and the horned helm it wears.
 *
 * Both are built on `headFrame`: standing, the head stays level whatever the trunk does; once the
 * body lies down it follows the trunk and turns its face towards the camera, so the face still
 * reads from every facing. Channels read from the pose: `extra.hurt` (0..1, the hit clip) flares
 * the eyes and gapes the jaw; `extra.charge` (0..1, a charged skill) flares the eyes too.
 */

import { createRng } from '@core';
import { Polygon, alpha, lerpColor } from '@core/draw';
import { partFrame, type Part, type PartContext } from '@core/rig';
import { Blob, Decal, Round, Tube, UP, add3, cross3, dot3, lerp3, norm3, scale3, sub3, vec3, visibleArc, type Vec3 } from '@core/volume';
import { flamePath, paintEmber, paintFlame } from './fire';
import { halo, role, tones, type NoOptions } from './util';

/**
 * The head's frame for a pose: `head` (origin on the head joint, forward towards where the face
 * looks), plus the trunk's `up` and `lie`. Share it between the pieces that sit on the head so
 * they turn together.
 */
export function headFrame(ctx: Pick<PartContext, 'at' | 'kit' | 'body'>) {
  const { up, right: across, forward: chestFwd, lie } = ctx.body;
  const cam = ctx.kit.camera;
  const levelFwd = norm3(cross3(across, UP));
  const sideways = scale3(across, dot3(across, cam.viewDir) < 0 ? -1 : 1);
  // On the floor the face turns to the camera's side and tilts up, so the eyes read from every facing.
  const faceFwd = norm3(add3(lerp3(lerp3(levelFwd, chestFwd, lie), sideways, lie * 0.92), scale3(UP, 0.7 * lie * lie)));
  const head = partFrame(ctx.at.frame.origin, faceFwd, lerp3(UP, up, lie));
  return { head, faceFwd, up, lie };
}

/**
 * A skull: jaw, cranium and face as masses, a mouth with teeth, two sockets with soul eyes (and
 * their profile twins on the sides of the skull) and a nose hole. Returns the skull, so a helm or
 * a crown can rest on it (`id` it in the outfit).
 * Slot: `head`. Roles: `bone` (skull, teeth tone), `hollow` (mouth, sockets), `glow` (eyes).
 */
export const boneSkull: Part<NoOptions> = ctx => {
  const { object: o, pose, materials } = ctx;
  const { head, faceFwd, up, lie } = headFrame(ctx);
  const bone = role(materials, 'bone');
  const hollow = tones(materials, 'hollow');
  const glowRole = role(materials, 'glow');
  const hurt = pose.extra.hurt ?? 0;
  const charge = pose.extra.charge ?? 0;
  // Soul eyes: flare when hurt or charged, burn low once the body lies.
  const glow = (1 + 0.7 * hurt + 0.4 * charge) * (1 - 0.45 * lie);
  const eyeGlow = halo(glowRole, 10 * (1 + 0.9 * hurt + 0.7 * charge) * (1 - 0.6 * lie));
  const jaw = Round.ellipsoid(partFrame(head.at(2.4, 0, -4.4 - 0.9 * hurt), faceFwd, up), 2.6, 3, 1.3);
  o.add(jaw, bone);
  const skull = new Blob([Round.ellipsoid(head.moved(-0.3, 0, 0.5), 5, 4.4, 4.8), Round.ellipsoid(partFrame(head.at(2.3, 0, -2), faceFwd, up), 3, 3.4, 2.4)]);
  o.add(skull, bone, { on: jaw });
  const mouth = Decal.onFace(head, 'front', vec3(4.7, 0, -3.3 - 0.45 * hurt), Polygon.rect(3.6, 1.1 + 1.1 * hurt));
  o.add(mouth, { fill: hollow.base }, { on: skull });
  for (let i = 0; i < 4; i++) o.add(Decal.onFace(head, 'front', vec3(4.75, -1.35 + i * 0.9, -3.2), Polygon.rect(0.65, 0.9)), { fill: bone.ramp.lit }, { on: mouth });
  for (const s of [-1, 1]) {
    const socket = Decal.onFace(head, 'front', vec3(4.5, s * 1.85, -0.4), Polygon.ellipse(1.5 * (1 + 0.25 * hurt), 1.3 * (1 + 0.35 * hurt)));
    o.add(socket, { fill: hollow.dark }, { on: skull });
    const eye = Decal.onFace(head, 'front', vec3(4.7, s * 1.85, -0.5), Polygon.circle(0.85 * glow));
    o.add(eye, { fill: glowRole.ramp.base, shadow: eyeGlow }, { on: socket });
    o.add(Decal.onFace(head, 'front', vec3(4.72, s * 1.85, -0.45), Polygon.circle(0.38 * glow)), { fill: glowRole.ramp.lit }, { on: eye });
    // In profile, the socket and its eye show on the side of the skull.
    const side = s > 0 ? 'right' : 'left';
    const profile = Decal.onFace(head, side, vec3(2.6, s * 4.1, -0.4), Polygon.ellipse(1.2 * (1 + 0.2 * hurt), 1.3 * (1 + 0.3 * hurt)));
    o.add(profile, { fill: hollow.dark }, { on: skull });
    o.add(Decal.onFace(head, side, vec3(2.7, s * 4.2, -0.5), Polygon.circle(0.55 * glow)), { fill: glowRole.ramp.lit, shadow: lie > 0.5 ? undefined : halo(glowRole, 6, 0.55) }, { on: profile });
  }
  o.add(Decal.onFace(head, 'front', vec3(5, 0, -1.9), Polygon.triangle(1.2, 1.4)), { fill: hollow.dark }, { on: skull });
  return skull;
};

/** Options of `hornedHelm`. */
export interface HornedHelmOptions {
  /** Horns on the helm. Default true. */
  horns?: boolean;
  /** Scale of the dome, brim and nasal bar. Default 1. */
  size?: number;
  /** Scale of the horns (length and spread). Default 1. */
  hornSize?: number;
  /** The nasal bar down the face. Default true. */
  nasal?: boolean;
}

/**
 * A horned iron helm: a lathed dome high on the skull (it leaves the face clear under the brim),
 * a brim ring, a nasal bar and two bone horns that droop once the head rests on the floor.
 * Rests `on` the skull: give it `on: '<skull id>'` in the outfit.
 * Slot: `head`. Roles: `metal` (dome, brim, nasal bar), `bone` (horns).
 */
export const hornedHelm: Part<HornedHelmOptions> = (ctx, options) => {
  const { object: o, kit, materials, host } = ctx;
  const { horns = true, size = 1, hornSize = 1, nasal = true } = options;
  const { head, lie } = headFrame(ctx);
  const metal = role(materials, 'metal');
  const helmFrame = head.moved(-0.8, 0, 2.3);
  const helm = Round.lathe(helmFrame, [[0, 5.3 * size], [1.2 * size, 5.2 * size], [2.7 * size, 4.5 * size], [3.9 * size, 3.1 * size], [4.6 * size, 1.4 * size], [4.8 * size, 0.01]]);
  o.add(helm, metal, host ? { on: host } : {});
  const brimArc = visibleArc(kit.camera, helmFrame.origin, head.forward, head.right, 5.4 * size, 5.4 * size);
  if (brimArc.length) o.add(new Tube(brimArc, 1.4), metal, { on: helm });
  // Nasal bar: sorted by depth (not `on`), so it hides behind the skull when the guard turns away.
  if (nasal) o.add(new Tube([head.at(4.4, 0, 2.6), head.at(5.2, 0, 0.2)], { start: 1.3, end: 0.8 }), metal, { bias: 3 });
  if (horns) {
    const bone = role(materials, 'bone');
    // Horns droop (shorter along the helm's axis) once the head rests on the floor.
    const horn = (u: number) => 3.8 + (u - 3.8) * hornSize * (1 - 0.45 * lie);
    for (const s of [-1, 1]) {
      const y = (v: number) => s * v * hornSize;
      o.add(new Tube([head.at(-1, y(4.5), 3.8), head.at(0, y(7.4), horn(5.2)), head.at(1.8, y(8.4), horn(8)), head.at(3.2, y(7.6), horn(9.8))], { start: 2.1, end: 0.25 }), bone);
    }
  }
  return helm;
};

/** Options of `fireCrown`. */
export interface FireCrownOptions {
  /** Tongues of the crown, wrapped round the back and sides of the skull (the face stays clear). Default 11. */
  tongues?: number;
  /** Scale of the whole crown. Default 1. */
  size?: number;
  /** Seed of the tongues' sizes and phases. Default 'fire-crown'. */
  seed?: string;
}

/**
 * A crown of soul fire around the skull: tongues rising from a ring round the back and sides of the
 * head, in three layers (the saturated body with its halo, a lighter middle, a pale core), a few
 * licks over the crown, and embers drifting up. The tongues lean back from the way the face looks
 * and flicker on whole cycles of the clip's time (2 and 3 cycles per loop, the sway 1), so a loop
 * closes. The crown flares with `extra.charge` and `extra.hurt` and burns low once the body lies
 * (`ctx.body.lie`) or `extra.dead` is up.
 * Rests on the skull (`on: '<skull id>'`: the licks sit over it; the body of the fire sorts behind it).
 * Slot: `head`. Roles: `glow`. Channels: `extra.charge`, `extra.hurt`, `extra.dead`.
 */
export const fireCrown: Part<FireCrownOptions> = (ctx, { tongues = 11, size = 1, seed = 'fire-crown' }) => {
  const { object: o, pose, kit, materials, host } = ctx;
  const { head, faceFwd, lie } = headFrame(ctx);
  const cam = kit.camera;
  const glow = role(materials, 'glow');
  const { base, lit } = glow.ramp;
  const mid = lerpColor(base, lit, 0.55);
  const t = kit.t;
  const tau = Math.PI * 2;
  const dead = Math.max(lie, pose.extra.dead ?? 0);
  const grow = size * (1 - 0.88 * dead) * (1 + 0.3 * (pose.extra.charge ?? 0) + 0.18 * (pose.extra.hurt ?? 0));
  if (grow < 0.05) return;
  const rng = createRng(seed);
  // Where the face looks on screen: the flames stream away from it.
  const origin = head.origin;
  const o0 = cam.project(origin);
  const o1 = cam.project(add3(origin, faceFwd));
  const faceX = o1.x - o0.x;
  type Tongue = { at: Vec3; r: number; lean: number; behind: boolean };
  const list: Tongue[] = [];
  for (let i = 0; i < tongues; i++) {
    const theta = ((55 + (250 * i) / (tongues - 1)) * Math.PI) / 180;
    const middle = 1 - Math.abs(theta - Math.PI) / ((125 * Math.PI) / 180);
    const phase = rng.float(0, tau) / tau;
    const flicker = 1 + 0.1 * Math.sin(tau * (2 * t + phase)) + 0.07 * Math.sin(tau * (3 * t + phase * 1.7));
    const r = (2.6 + 2.7 * middle + rng.float(-0.4, 0.4)) * flicker * grow;
    const lean = (-faceX * 2.4 + Math.sin(theta) * 1.5 + 1.3 * Math.sin(tau * (t + phase)) + rng.float(-0.6, 0.6)) * grow;
    const p = head.at(Math.cos(theta) * 4.7, Math.sin(theta) * 4.7, 3.4 + 1.8 * middle);
    list.push({ at: p, r, lean, behind: dot3(sub3(p, origin), cam.viewDir) < 0.4 });
  }
  const halo0 = 12;
  const paintLayer = (ctx2: CanvasRenderingContext2D, c: typeof cam, group: Tongue[], scale: number, drop: number, fill: string | CanvasGradient, blur: number) => {
    ctx2.save();
    ctx2.fillStyle = fill;
    if (blur > 0) {
      ctx2.shadowColor = alpha(base, 0.9);
      ctx2.shadowBlur = blur;
    }
    ctx2.beginPath();
    for (const g of group) {
      const p = c.project(g.at);
      flamePath(ctx2, p.x, p.y + drop * g.r * (1 - scale) * 1.2, g.r * scale, g.lean * scale);
    }
    ctx2.fill();
    ctx2.restore();
  };
  const behind = list.filter(g => g.behind);
  if (behind.length) {
    o.custom(add3(origin, scale3(cam.viewDir, -7)), (ctx2, c) => {
      const ys = behind.map(g => c.project(g.at).y);
      const top = Math.min(...ys) - 14 * grow;
      const bottom = Math.max(...ys) + 4;
      const body = ctx2.createLinearGradient(0, top, 0, bottom);
      body.addColorStop(0, base);
      body.addColorStop(0.72, base);
      body.addColorStop(1, glow.ramp.dark);
      paintLayer(ctx2, c, behind, 1, 0, body, halo0);
      paintLayer(ctx2, c, behind, 0.72, 1, mid, 0);
      paintLayer(ctx2, c, behind, 0.46, 1.5, lit, 0);
      // Embers rise from the back of the crown and fade; each makes one trip per loop.
      const center = c.project(head.at(-2.5, 0, 4));
      for (let i = 0; i < 5; i++) {
        const life = (t + i / 5) % 1;
        const w = (0.8 + 0.5 * ((i * 7) % 3) * 0.5) * (1 - 0.7 * life) * grow;
        paintEmber(ctx2, glow, center.x - 7 + i * 3.6 + Math.sin(tau * life + i) * 1.6 - life * 2.2 - faceX * 2, center.y - 12 * grow - life * 13 * grow, w, w * 1.6, 1 - 0.9 * life);
      }
    });
  }
  // Licks over the crown: small tongues on the front of the skull, only where that side of it faces the camera.
  const licks: [number, number, number, number][] = [[1.6, -3.2, 5.2, 0], [3.2, 0, 4.9, 1], [1.4, 3.4, 5, 2], [-1.2, 0, 5.8, 3]];
  for (const [fx, sy, uz, n] of licks) {
    const p = head.at(fx, sy, uz);
    if (dot3(sub3(p, origin), cam.viewDir) < -0.5) continue;
    const r = (1.2 + 0.4 * (n % 2)) * grow * (1 + 0.18 * Math.sin(tau * (2 * t + n * 0.37)));
    const lean = (-faceX * 1.4 + 0.8 * Math.sin(tau * (t + n * 0.21))) * grow;
    o.custom(p, (ctx2, c) => {
      const q = c.project(p);
      paintFlame(ctx2, glow, q.x, q.y, r, { lean, halo: 6, strength: 0.7 });
    }, host ? { on: host } : {});
  }
};

/**
 * Cranial sutures on the back of a bare skull: a line along the top and down the back of the
 * cranium and a ring across the back of it, flat grooves in a darker bone tone. They are drawn only
 * where that part of the skull faces the camera, so from behind a skull is not a smooth egg, and
 * the face stays clear. Rests on the skull (give it as the host).
 * Slot: `head`. Roles: `boneGroove` (falls back to `hollow`).
 */
export const skullSutures: Part<NoOptions> = ctx => {
  const { object: o, kit, materials, host } = ctx;
  const { head, lie } = headFrame(ctx);
  if (lie > 0.6) return;
  const cam = kit.camera;
  const groove = role(materials, 'boneGroove', 'hollow');
  const c = head.moved(-0.3, 0, 0.5);
  // The cranium is an ellipsoid of radii (5, 4.4, 4.8): a unit direction picks a point on it and its normal.
  const [a, b, h] = [5.05, 4.45, 4.85];
  const point = (x: number, y: number, z: number) => c.at(x * a, y * b, z * h);
  const normal = (x: number, y: number, z: number) => norm3(add3(scale3(head.forward, x / a), add3(scale3(head.right, y / b), scale3(head.up, z / h))));
  const line = (dirs: [number, number, number][], width: number) => {
    let run: Vec3[] = [];
    const flush = () => {
      if (run.length > 1) o.add(new Tube(run, width), groove, host ? { on: host } : {});
      run = [];
    };
    for (const [x, y, z] of dirs) {
      if (cam.faces(normal(x, y, z))) run.push(point(x, y, z));
      else flush();
    }
    flush();
  };
  // Along the top and down the back, from just behind the crown.
  line(Array.from({ length: 11 }, (_, i) => {
    const psi = ((75 + 8.5 * i) * Math.PI) / 180;
    return [Math.cos(psi), 0, Math.sin(psi)] as [number, number, number];
  }), 0.7);
  // A ring across the back of the cranium, over the top and down both sides.
  line(Array.from({ length: 15 }, (_, i) => {
    const th = ((-105 + 15 * i) * Math.PI) / 180;
    return [-0.55, 0.835 * Math.sin(th), 0.835 * Math.cos(th)] as [number, number, number];
  }), 0.7);
};
