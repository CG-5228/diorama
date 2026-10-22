/**
 * Impacts: what a hit leaves where it lands. A game plays them at the socket of the hit (a blade's
 * tip, a mouth) or where a projectile ends; `hit` is the frame a game reacts on (hit-stop, a flash).
 *
 * - `soulBurst`: the end of a soul bolt. A hot flash on the first frame, the peak on the second (a
 *   ring of flame petals, pale rays, a shock ring), then the fire lifts and thins while sparks fly out
 *   and fall; light on the floor under it, which is where the bolt was. Ends empty.
 * - `slashSpark`: a blade on bone or armour. A crescent of white steel sweeps on and thins from its
 *   tail, steel sparks fly out and a four-point glint of soul fire marks where it bit. Ends empty.
 * - `boneDust`: a bite or a blunt blow. A puff of pale dust in three tones and a few chips of bone
 *   thrown in arcs, turning as they fall. Ends empty.
 *
 * All draw in logical px around the effect's origin. Random details come from `effectRng`, so they
 * hold still across the frames; every motion is a function of `t`.
 */

import { alpha, lerpColor } from '@core/draw';
import { effectRng, vec3, type EffectContext } from '@core/volume';
import { paintEmber } from '../gear/fire';
import { PALETTES } from '../theme';
import { TAU, clamp01, cloud, dash, easeIn, easeOut, floorSquash, glint, keys, lerp, puffLobes, ramp, rimOf, softDisc, softPool, tongue, type Tone } from './fx';

const T = (frame: number, frames: number) => frame / (frames - 1);

// ----------------------------------------------------------------------------------------------
// Soul burst
// ----------------------------------------------------------------------------------------------

export const SOUL_BURST_FRAMES = 7;
/** The burst's design size is scaled by this: about 0.8 of a torso's width at its peak. */
const BURST_SCALE = 0.8;

/** One tip of a burst's ragged outline: where it points, how far it reaches (a share of the radius) and how deep the valley after it is. */
interface Tip {
  ang: number;
  reach: number;
  valley: number;
}

/**
 * A burst of fire as a ragged blob: pointed tips joined by round valleys (a quadratic curve whose control is the valley), the tips
 * longer upwards, as flames are. (x, y) is its centre, `r` its radius, `squash` the vertical share the camera's tilt leaves it.
 */
function burstPath(cx: CanvasRenderingContext2D, x: number, y: number, r: number, tips: Tip[], squash: number, spike = 1): void {
  const at = (ang: number, k: number) => {
    const up = Math.max(0, -Math.sin(ang));
    const stretch = 1 + 0.38 * up * spike;
    return { x: x + Math.cos(ang) * r * k * stretch, y: y + Math.sin(ang) * r * k * (Math.sin(ang) < 0 ? stretch : squash) };
  };
  const first = at(tips[0].ang, 1 + (tips[0].reach - 1) * spike);
  cx.beginPath();
  cx.moveTo(first.x, first.y);
  for (let i = 0; i < tips.length; i++) {
    const a = tips[i];
    const b = tips[(i + 1) % tips.length];
    const mid = a.ang + (((b.ang - a.ang + TAU) % TAU) || TAU) / 2;
    const v = at(mid, a.valley);
    const next = at(b.ang, 1 + (b.reach - 1) * spike);
    cx.quadraticCurveTo(v.x, v.y, next.x, next.y);
  }
  cx.closePath();
}

export function soulBurst(c: EffectContext): void {
  const { camera: cam, t, height } = c;
  const glow = ramp(c, 'glow');
  const sq = floorSquash(cam);
  const o = cam.project(vec3(0, 0, 0));
  const floor = cam.project(vec3(0, 0, -height));
  // One generator per group of details, so a group skipped on a frame never shifts the others.
  const rng = effectRng(c, 3);
  const rayRng = effectRng(c, 4);
  const sparkRng = effectRng(c, 5);
  const f = (n: number) => T(n, SOUL_BURST_FRAMES);

  // Timing: a tight hot flash, the peak on frames 1 and 2, a long fall-off to nothing on the last frame.
  const flash = keys(t, [[f(0), 1], [f(1), 1], [f(2), 0.85], [f(3), 0.55], [f(4), 0.28], [f(5), 0.1], [f(6), 0]]);
  const radius = keys(t, [[f(0), 5.5], [f(1), 15], [f(2), 18.5], [f(3), 16], [f(4), 11.5], [f(5), 6], [f(6), 0]]);
  const fire = keys(t, [[f(0), 0.95], [f(1), 1], [f(2), 1], [f(3), 0.9], [f(4), 0.62], [f(5), 0.3], [f(6), 0]]);
  const spike = keys(t, [[f(0), 0.5], [f(1), 1], [f(3), 1], [f(5), 0.7], [f(6), 0.5]]);
  const lift = 10 * easeIn(t, 1.3);

  // The ragged outline: tips of uneven length, valleys of uneven depth; the same on every frame.
  const count = 11;
  const spin = rng.float(0, TAU);
  const tips: Tip[] = Array.from({ length: count }, (_, i) => ({ ang: spin + ((i + rng.float(-0.22, 0.22)) / count) * TAU, reach: rng.float(1.05, 1.5), valley: rng.float(0.5, 0.72) }));
  const core: Tip[] = Array.from({ length: 7 }, (_, i) => ({ ang: spin + 0.4 + ((i + rng.float(-0.2, 0.2)) / 7) * TAU, reach: rng.float(1.05, 1.35), valley: rng.float(0.5, 0.68) }));
  // Three flames curl up out of the top as the burst peaks, and drift off as it dies.
  const licks = [-1, 0, 1].map(k => ({ dx: k * rng.float(5, 9), len: rng.float(26, 34) * (k === 0 ? 1.2 : 0.85), w: rng.float(4.4, 5.6), bend: -k * rng.float(0.2, 0.34), delay: rng.float(0.05, 0.14) }));

  // Light on the floor where the bolt was: the burst is in the air, so its glow lands below it.
  c.ground.custom(vec3(0, 0, -height), cx => {
    if (height > 4) {
      softPool(cx, floor.x, floor.y, 26 * (0.6 + 0.4 * flash), sq, glow.base, 0.34 * flash);
      softPool(cx, floor.x, floor.y, 11 * flash, sq, glow.lit, 0.3 * flash);
    }
  });

  c.object.custom(vec3(0, 0, 0), cx => {
    // Drawn at a design size and scaled round the origin: a burst reads about the size of a torso, not of the body it lands on.
    cx.save();
    cx.translate(o.x, o.y);
    cx.scale(BURST_SCALE, BURST_SCALE);
    cx.translate(-o.x, -o.y);
    softDisc(cx, o.x, o.y - lift * 0.4, 38 * (0.55 + 0.45 * flash), glow.base, 0.5 * flash);

    // Shock ring: thin, pale at the edge, flying out of the flash along the floor.
    const ringR = 5 + 32 * easeOut(t, 2.2);
    const ringA = keys(t, [[0, 0.9], [f(2), 0.55], [f(4), 0.18], [f(5), 0]]);
    if (ringA > 0.01) {
      cx.save();
      cx.lineJoin = 'round';
      for (const [color, w] of [[glow.dark, 3.1 * (1 - t) + 0.9], [glow.lit, 1.2 * (1 - t) + 0.5]] as const) {
        cx.strokeStyle = alpha(color, ringA);
        cx.lineWidth = w;
        cx.beginPath();
        cx.ellipse(o.x, o.y + 3, ringR, ringR * 0.62, 0, 0, TAU);
        cx.stroke();
      }
      cx.restore();
    }

    // Flames curling up out of the burst, behind it: only their tips and curls show above its ragged top.
    for (const l of licks) {
      const k = clamp01((t - l.delay) / (1 - l.delay));
      const grow = keys(k, [[0, 0], [f(1), 0.5], [f(2), 1], [f(3), 0.95], [f(4), 0.7], [f(5), 0.35], [f(6), 0]]);
      tongue(cx, o.x + l.dx, o.y - lift * 0.6 - radius * 0.3, -Math.PI / 2 + l.bend * 0.6, l.len * grow, l.w * (0.5 + 0.5 * grow), glow, fire, l.bend);
    }

    // The fireball: a dark rim round a saturated ragged body, a pale hot core inside it, a flash over its heart.
    const cy = o.y - lift * 0.5;
    if (radius > 0.4) {
      burstPath(cx, o.x, cy, radius, tips, 0.84, spike);
      const body = cx.createRadialGradient(o.x, cy, radius * 0.1, o.x, cy, radius * 1.3);
      body.addColorStop(0, alpha(glow.base, fire));
      body.addColorStop(0.7, alpha(glow.base, fire));
      body.addColorStop(1, alpha(glow.base, fire));
      cx.fillStyle = body;
      cx.fill();
      cx.lineJoin = 'round';
      cx.strokeStyle = alpha(glow.dark, fire);
      cx.lineWidth = 1.5;
      cx.stroke();
      burstPath(cx, o.x - radius * 0.04, cy - radius * 0.05, radius * 0.6, core, 0.84, spike);
      cx.fillStyle = alpha(glow.lit, 0.95 * fire);
      cx.fill();
    }
    softDisc(cx, o.x, cy, 13 * flash, glow.lit, 0.95 * flash, 0.4);

    // Pale rays out of the hot centre, only while the flash is hot.
    const rayA = clamp01((flash - 0.5) / 0.5);
    for (let i = 0; i < 7; i++) {
      const ang = rayRng.float(0, TAU);
      const long = 8 + 10 * rayRng.random();
      if (rayA < 0.02) continue;
      const r0 = radius * 1.15 + 3;
      const r1 = r0 + long * flash;
      dash(cx, o.x + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.85, o.x + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.85, 1.1, alpha(glow.lit, rayA));
    }

    // Sparks: thrown out, slowed by the air, falling; a few are embers with a halo.
    for (let i = 0; i < 12; i++) {
      const ang = sparkRng.float(0, TAU);
      const speed = 24 + sparkRng.random() * 26;
      const size = 0.7 + sparkRng.random() * 0.8;
      const pale = sparkRng.boolean(0.6);
      const r = speed * easeOut(t, 1.8);
      const x = o.x + Math.cos(ang) * r;
      const y = o.y - 4 + Math.sin(ang) * r * 0.85 + 30 * t * t - 8 * (1 - t);
      const a = Math.pow(1 - t, 0.7);
      const len = 4.2 * (1 - t) + 1;
      const vx = Math.cos(ang);
      const vy = Math.sin(ang) * 0.85 + 0.5 * t;
      const vl = Math.hypot(vx, vy) || 1;
      if (i < 4) paintEmber(cx, c.materials['glow'], x, y, size + 0.5, size * 1.8 + 0.5, a);
      else dash(cx, x, y, x - (vx / vl) * len, y - (vy / vl) * len, size + 0.4, alpha(pale ? glow.lit : glow.base, a));
    }
    cx.restore();
  });
}

// ----------------------------------------------------------------------------------------------
// Slash spark
// ----------------------------------------------------------------------------------------------

export const SLASH_SPARK_FRAMES = 5;

export function slashSpark(c: EffectContext): void {
  const { camera: cam, t } = c;
  const steel = ramp(c, 'blade');
  const glow = ramp(c, 'glow');
  const o = cam.project(vec3(0, 0, 0));
  const rng = effectRng(c, 5);
  const greenRng = effectRng(c, 6);
  const f = (n: number) => T(n, SLASH_SPARK_FRAMES);

  // The crescent: an arc of a circle of radius R whose belly passes through the origin, tilted up to the right.
  const R = 18;
  const A = 1;
  const tilt = -0.5;
  const lead = keys(t, [[f(0), 0.66], [f(1), 1], [1, 1]]);
  const trail = keys(t, [[f(0), 0], [f(1), 0], [f(2), 0.3], [f(3), 0.7], [f(4), 1]]);
  const thick = keys(t, [[f(0), 2.4], [f(1), 6], [f(2), 4], [f(3), 1.9], [f(4), 0.4]]);
  const fade = keys(t, [[f(0), 1], [f(2), 1], [f(3), 0.65], [f(4), 0]]);
  const spark = keys(t, [[f(0), 0], [f(1), 1], [f(2), 0.82], [f(3), 0.38], [f(4), 0]]);
  const star = keys(t, [[f(0), 2.4], [f(1), 6.4], [f(2), 4.4], [f(3), 1.8], [f(4), 0]]);

  // A point of the crescent at arc angle `phi` and distance `radius` from the circle's centre, in screen px.
  const place = (phi: number, radius: number) => {
    const lx = radius * Math.cos(phi) - R;
    const ly = radius * Math.sin(phi);
    return { x: o.x + lx * Math.cos(tilt) - ly * Math.sin(tilt), y: o.y + lx * Math.sin(tilt) + ly * Math.cos(tilt) };
  };
  const stretch = (phi0: number, phi1: number, radius: number, width: (u: number, phi: number) => number) => {
    const steps = 24;
    const outer: { x: number; y: number }[] = [];
    const inner: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const phi = lerp(phi0, phi1, u);
      outer.push(place(phi, radius));
      inner.push(place(phi, radius - width(u, phi)));
    }
    return { outer, inner };
  };

  c.object.custom(vec3(0, 0, 0), cx => {
    softDisc(cx, o.x, o.y, 13, glow.base, 0.32 * keys(t, [[0, 0.8], [f(1), 1], [f(3), 0.2], [1, 0]]));

    // Steel sparks: thin white dashes flying out, the long ones along the blow.
    for (let i = 0; i < 9; i++) {
      const ang = tilt + (i / 8 - 0.5) * 2.5 + rng.float(-0.16, 0.16);
      const r0 = 4 + 17 * easeOut(t, 1.5) * (0.7 + 0.5 * rng.random());
      const len = (2.8 + 4 * rng.random()) * spark + 1;
      const w = 0.9 + 0.4 * rng.random();
      const pale = rng.boolean(0.8);
      if (spark < 0.02) continue;
      dash(cx, o.x + Math.cos(ang) * r0, o.y + Math.sin(ang) * r0 * 0.9, o.x + Math.cos(ang) * (r0 + len), o.y + Math.sin(ang) * (r0 + len) * 0.9, w, alpha(pale ? steel.lit : steel.base, spark));
    }
    for (let i = 0; i < 3; i++) {
      const ang = tilt + Math.PI + (i - 1) * 0.85 + greenRng.float(-0.2, 0.2);
      const r0 = 3 + 12 * easeOut(t, 1.4);
      if (spark < 0.02) continue;
      dash(cx, o.x + Math.cos(ang) * r0, o.y + Math.sin(ang) * r0 * 0.9, o.x + Math.cos(ang) * (r0 + 4 * spark), o.y + Math.sin(ang) * (r0 + 4 * spark) * 0.9, 1, alpha(glow.base, spark));
    }

    // A glint of soul fire where the blade bit, under the crescent: its points poke out round the steel.
    glint(cx, o.x, o.y, star * 1.08, glow.dark, 0.95);
    glint(cx, o.x, o.y, star, glow.base, 1, 0.14);

    // Crescent: the visible stretch runs from `trail` to `lead` of the arc; thickest at the middle of the arc, pointed at both ends.
    const phi0 = -A + 2 * A * trail;
    const phi1 = -A + 2 * A * lead;
    if (phi1 - phi0 > 0.05 && fade > 0.01) {
      const belly = (phi: number) => Math.pow(Math.max(0, Math.cos((phi / A) * (Math.PI / 2))), 1.05);
      const { outer, inner } = stretch(phi0, phi1, R, (u, phi) => thick * belly(phi) * Math.pow(Math.sin(Math.PI * u), 0.55));
      const a = outer[0];
      const b = outer[outer.length - 1];
      const g = cx.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, alpha(steel.base, fade * 0.85));
      g.addColorStop(0.5, alpha(steel.lit, fade));
      g.addColorStop(1, alpha(steel.lit, fade));
      cx.beginPath();
      outer.forEach((p, i) => (i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)));
      for (let i = inner.length - 1; i >= 0; i--) cx.lineTo(inner[i].x, inner[i].y);
      cx.closePath();
      cx.fillStyle = g;
      cx.fill();
      cx.lineJoin = 'round';
      cx.strokeStyle = alpha(rimOf(steel), 0.85 * fade);
      cx.lineWidth = 0.8;
      cx.stroke();
      // A fine second arc outside the first, shorter, the wake of the blow.
      const wake = stretch(lerp(phi0, phi1, 0.15), lerp(phi0, phi1, 0.85), R + thick * 0.55 + 2, (u, phi) => 1.1 * belly(phi) * Math.sin(Math.PI * u));
      cx.beginPath();
      wake.outer.forEach((p, i) => (i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)));
      for (let i = wake.inner.length - 1; i >= 0; i--) cx.lineTo(wake.inner[i].x, wake.inner[i].y);
      cx.closePath();
      cx.fillStyle = alpha(steel.base, 0.7 * fade);
      cx.fill();
    }
    glint(cx, o.x, o.y, star * 0.5, glow.lit, 1, 0.2);
  });
}

// ----------------------------------------------------------------------------------------------
// Bone dust
// ----------------------------------------------------------------------------------------------

export const BONE_DUST_FRAMES = 6;

export function boneDust(c: EffectContext): void {
  const { camera: cam, t } = c;
  const dust = ramp(c, 'dust');
  const bone = ramp(c, 'bone');
  const o = cam.project(vec3(0, 0, 0));
  const rng = effectRng(c, 7);
  const f = (n: number) => T(n, BONE_DUST_FRAMES);
  // Bone powder: the stone's dust warmed towards bone, a step lighter so it reads on dark floors.
  const powder: Tone = { lit: lerpColor(dust.lit, bone.lit, 0.6), base: lerpColor(lerpColor(dust.base, bone.base, 0.45), dust.lit, 0.25), dark: lerpColor(dust.base, dust.dark, 0.5) };
  const rim = lerpColor(bone.dark, PALETTES.ink, 0.6);

  const fade = keys(t, [[0, 0.95], [f(1), 1], [f(3), 0.65], [f(4), 0.3], [f(5), 0]]);
  const grow = easeOut(t, 1.9);
  const flash = keys(t, [[0, 1], [f(1), 0.5], [f(2), 0]]);

  const puffs = Array.from({ length: 6 }, (_, i) => ({
    ang: (i / 6) * TAU + rng.float(-0.3, 0.3),
    reach: 8 + rng.random() * 11,
    r: 4.4 + rng.random() * 3,
    rise: 2 + rng.random() * 6,
    lobes: puffLobes(rng),
  })).sort((a, b) => Math.sin(a.ang) - Math.sin(b.ang));
  const chips = Array.from({ length: 9 }, (_, i) => {
    const sides = 4 + (i % 2);
    const size = 2 + rng.random() * 1.9;
    return {
      ang: rng.float(-Math.PI * 0.95, -Math.PI * 0.05) + (i % 2 ? 0.3 : -0.3),
      speed: 16 + rng.random() * 20,
      spin0: rng.float(0, TAU),
      spin: rng.float(-9, 9),
      delay: 0.04 * (i % 3),
      shape: Array.from({ length: sides }, (_, k) => ({ a: (k / sides) * TAU + rng.float(-0.35, 0.35), r: size * (0.6 + rng.random() * 0.55) })),
    };
  });

  c.object.custom(vec3(0, 0, 0), cx => {
    // The hit: a pale flash with short rays, gone by the third frame.
    if (flash > 0.02) {
      softDisc(cx, o.x, o.y, 12, powder.lit, 0.7 * flash, 0.3);
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * TAU + 0.4;
        dash(cx, o.x + Math.cos(ang) * 5, o.y + Math.sin(ang) * 5 * 0.85, o.x + Math.cos(ang) * (8 + 7 * flash), o.y + Math.sin(ang) * (8 + 7 * flash) * 0.85, 1, alpha(bone.lit, flash));
      }
    }

    // Dust: a few lumpy puffs pushed out of the blow, rising a little as they thin.
    for (const p of puffs) {
      const d = p.reach * grow;
      const r = p.r * (0.5 + 0.75 * grow) * (1 - 0.2 * t);
      cloud(cx, o.x + Math.cos(p.ang) * d, o.y + Math.sin(p.ang) * d * 0.72 - p.rise * easeOut(t, 1.5), r, p.lobes, powder, fade);
    }

    // Chips of bone: thrown up and out, turning, falling; each is a shard in three tones.
    const lx = cam.lightOnScreen;
    for (const chip of chips) {
      const tau = clamp01((t - chip.delay) / (1 - chip.delay));
      const x = o.x + Math.cos(chip.ang) * chip.speed * easeOut(tau, 1.6);
      const y = o.y + Math.sin(chip.ang) * chip.speed * easeOut(tau, 1.6) + 34 * tau * tau;
      const a = tau < 0.72 ? 1 : clamp01(1 - (tau - 0.72) / 0.28);
      if (a < 0.02 || t < chip.delay) continue;
      const rot = chip.spin0 + chip.spin * tau;
      const pts = chip.shape.map(s => ({ x: x + Math.cos(s.a + rot) * s.r, y: y + Math.sin(s.a + rot) * s.r }));
      cx.save();
      cx.globalAlpha = a;
      cx.lineJoin = 'round';
      cx.beginPath();
      pts.forEach((p, k) => (k ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)));
      cx.closePath();
      cx.fillStyle = bone.base;
      cx.fill();
      // Lit corners towards the light (upper left), shadow corners away from it.
      for (const [side, color] of [[1, bone.lit], [-1, bone.dark]] as const) {
        const part = pts.filter(p => side * ((p.x - x) * lx.x + (p.y - y) * lx.y) > 0);
        if (part.length < 2) continue;
        cx.beginPath();
        cx.moveTo(x, y);
        part.forEach(p => cx.lineTo(p.x, p.y));
        cx.closePath();
        cx.fillStyle = color;
        cx.fill();
      }
      cx.beginPath();
      pts.forEach((p, k) => (k ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)));
      cx.closePath();
      cx.strokeStyle = rim;
      cx.lineWidth = 0.7;
      cx.stroke();
      cx.restore();
    }
  });
}
