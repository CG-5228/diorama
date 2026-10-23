/**
 * The bone spider's spit: a projectile and the splash it follows, drawn for a mouth that sits low.
 *
 * The spider's `mouth` socket is about 6 high at the frame its spit is released (its head dips in the lunge; `SPIT_HEIGHT`),
 * where the soul bolt leaves a hand at 44. An effect's floor marks sit `height` below its origin and its size is read against
 * the body it leaves, so the bolt's pool of light, its depth and its 13 px skull were all wrong for a thing that spits from the
 * floor: this pair is its own, at the spider's scale (the abdomen is about 30 tall, the head about 8 across).
 *
 * - `soulSpit`: a glob of soul fire (a rounded body stretched along its heading, a dark rim, a pale hot core lit from the upper
 *   left, a gloss) with a short tail of fire and two droplets it sheds. About half the bolt: a 3.4 radius head (the bolt's skull is
 *   6.4), a tail of 17 on the screen across the view (the bolt's is 38). 16 facings, 6 frames round a loop; every motion is whole cycles of `t`.
 * - `spitSplash`: where it ends, low: a flash, a crown of droplets thrown out and falling back, short flames, a ring and a small
 *   pool of light on the floor under it, which is where the glob was. Ends empty.
 *
 * Colours come from the `glow` role, as every effect of the kit.
 */

import { alpha } from '@core/draw';
import { effectRng, vec3, type EffectContext } from '@core/volume';
import { paintEmber } from '../gear/fire';
import { PALETTES } from '../theme';
import { TAU, clamp01, easeOut, floorSquash, glint, keys, ramp, softDisc, softPool, tongue } from './fx';

/**
 * Height of the spider's mouth socket at the release of its spit, in world units. Measured on the spit sheet's atlas at a
 * side view, where the socket's screen offset from the pivot is all height: (pivot y 82 - socket y 77.1) / (cos 48° × 1.2) = 6.1
 * (the mouth is 11 to 19 while the head is up, and drops as it lunges). Re-measure if the spit clip or the skin changes.
 */
export const SPIT_HEIGHT = 6;

/** Radius of the glob's head (logical px / world units). */
const HEAD = 3.4;
/** Length of the tail on the screen when the spit flies across the view. */
const TAIL = 17;

export const SOUL_SPIT_FRAMES = 6;

export function soulSpit(c: EffectContext): void {
  const { camera: cam, frame, t, height } = c;
  const glow = ramp(c, 'glow');
  const sq = floorSquash(cam);
  const o = cam.project(vec3(0, 0, 0));
  const floor = cam.project(vec3(0, 0, -height));

  // Heading on the screen (the floor's projection, shortened when it runs along the view).
  const hx = frame.forward.x;
  const hy = frame.forward.y * sq;
  const hl = Math.hypot(hx, hy) || 1;
  const ux = hx / hl;
  const uy = hy / hl;
  const nx = -uy;
  const ny = ux;
  const tail = TAIL * (0.55 + 0.45 * hl);

  // The pool of light on the floor under it: small and faint, swelling twice per loop.
  const pulse = Math.sin(TAU * 2 * t);
  c.ground.custom(vec3(0, 0, -height), cx => {
    softPool(cx, floor.x, floor.y, 8.5 * (1 + 0.06 * pulse), sq, glow.base, 0.3 * (1 + 0.1 * pulse));
    softPool(cx, floor.x, floor.y, 3.6, sq, glow.lit, 0.24);
  });

  c.object.custom(vec3(0, 0, 0), cx => {
    // Halo, and a fainter one along the tail.
    softDisc(cx, o.x, o.y, HEAD * 2.7, glow.base, 0.42);
    softDisc(cx, o.x - ux * tail * 0.3, o.y - uy * tail * 0.3, HEAD * 1.9, glow.base, 0.18);

    // The tail: a long flame and a short one beside it, trailing the heading, each waving once per loop at its own phase and
    // thinning to a point that fades out (the bolt's tail at the spider's scale).
    for (const [side, length, width, phase] of [[0, 1, HEAD * 0.95, 0], [1, 0.58, HEAD * 0.5, 0.4]] as const) {
      const N = 10;
      const spine = Array.from({ length: N + 1 }, (_, k) => {
        const u = k / N;
        const wave = Math.sin(TAU * (t + phase - u * 1.1)) * 1.5 * Math.pow(u, 0.8);
        const along = HEAD * 0.2 + tail * length * u;
        const lateral = side * HEAD * 0.5 * Math.pow(1 - u, 1.3) + wave;
        const w = width * Math.pow(1 - u, 0.85) + 0.2 * (1 - u);
        return { x: o.x - ux * along + nx * lateral, y: o.y - uy * along + ny * lateral, w };
      });
      const outline = (scale: number, grow: number) => {
        cx.beginPath();
        spine.forEach((p, i) => (i ? cx.lineTo(p.x + nx * (p.w * scale + grow), p.y + ny * (p.w * scale + grow)) : cx.moveTo(p.x + nx * (p.w * scale + grow), p.y + ny * (p.w * scale + grow))));
        for (let i = spine.length - 1; i >= 0; i--) cx.lineTo(spine[i].x - nx * (spine[i].w * scale + grow), spine[i].y - ny * (spine[i].w * scale + grow));
        cx.closePath();
      };
      const tip = spine[spine.length - 1];
      const rim = cx.createLinearGradient(o.x, o.y, tip.x, tip.y);
      rim.addColorStop(0, alpha(glow.dark, 0.95));
      rim.addColorStop(0.6, alpha(glow.dark, 0.55));
      rim.addColorStop(1, alpha(glow.dark, 0));
      outline(1, 0.45);
      cx.fillStyle = rim;
      cx.fill();
      const body = cx.createLinearGradient(o.x, o.y, tip.x, tip.y);
      body.addColorStop(0, glow.base);
      body.addColorStop(0.55, alpha(glow.base, 0.82));
      body.addColorStop(1, alpha(glow.base, 0));
      outline(1, 0);
      cx.fillStyle = body;
      cx.fill();
      if (!side) {
        // A pale hot core along the long one.
        const hot = spine[Math.round(N * 0.6)];
        const lit = cx.createLinearGradient(o.x, o.y, hot.x, hot.y);
        lit.addColorStop(0, alpha(glow.lit, 0.95));
        lit.addColorStop(1, alpha(glow.lit, 0));
        cx.beginPath();
        spine.slice(0, Math.round(N * 0.6) + 1).forEach((p, i) => (i ? cx.lineTo(p.x + nx * p.w * 0.46, p.y + ny * p.w * 0.46) : cx.moveTo(p.x + nx * p.w * 0.46, p.y + ny * p.w * 0.46)));
        spine.slice(0, Math.round(N * 0.6) + 1).reverse().forEach(p => cx.lineTo(p.x - nx * p.w * 0.46, p.y - ny * p.w * 0.46));
        cx.closePath();
        cx.fillStyle = lit;
        cx.fill();
      }
    }

    // Two droplets shed by the tail, each living one loop and drifting back and out.
    for (let i = 0; i < 2; i++) {
      const life = (t + i / 2) % 1;
      const side = i ? 1 : -1;
      const along = tail * (0.22 + 0.7 * life);
      const out = side * (1.3 + 2.2 * life);
      paintEmber(cx, c.materials['glow'], o.x - ux * along + nx * out, o.y - uy * along + ny * out, 0.7 * (1 - 0.5 * life), 1.2 * (1 - 0.5 * life), 0.95 * (1 - life));
    }

    // The glob: a body stretched along the heading (more when it flies across the view), breathing once per loop.
    const breath = 0.07 * Math.sin(TAU * t);
    const ra = HEAD * (1 + 0.3 * hl) * (1 + breath);
    const rb = HEAD * (1 - 0.08 * hl) * (1 - breath);
    const ang = Math.atan2(uy, ux);
    const lx = cam.lightOnScreen;
    const blob = (grow: number) => {
      cx.beginPath();
      cx.ellipse(o.x, o.y, ra + grow, rb + grow, ang, 0, TAU);
    };
    blob(1.05);
    cx.fillStyle = glow.dark;
    cx.fill();
    blob(0);
    cx.fillStyle = glow.base;
    cx.fill();
    // Volume: the side away from the light darker, the side towards it paler.
    cx.save();
    blob(0);
    cx.clip();
    const shade = cx.createRadialGradient(o.x - lx.x * rb * 0.45, o.y - lx.y * rb * 0.45, rb * 0.6, o.x - lx.x * rb * 0.45, o.y - lx.y * rb * 0.45, rb * 1.9);
    shade.addColorStop(0, alpha(glow.dark, 0));
    shade.addColorStop(1, alpha(glow.dark, 0.7));
    cx.fillStyle = shade;
    cx.fillRect(o.x - 12, o.y - 12, 24, 24);
    cx.restore();
    // The pale hot core, off-centre towards the light, and a gloss.
    const core = cx.createRadialGradient(o.x + lx.x * rb * 0.25, o.y + lx.y * rb * 0.25, 0, o.x + lx.x * rb * 0.12, o.y + lx.y * rb * 0.12, rb * 0.8);
    core.addColorStop(0, glow.lit);
    core.addColorStop(0.6, alpha(glow.lit, 0.95));
    core.addColorStop(1, alpha(glow.lit, 0));
    cx.fillStyle = core;
    cx.beginPath();
    cx.ellipse(o.x + lx.x * rb * 0.12, o.y + lx.y * rb * 0.12, ra * 0.72, rb * 0.72, ang, 0, TAU);
    cx.fill();
    cx.fillStyle = alpha(PALETTES.white, 0.9);
    cx.beginPath();
    cx.arc(o.x + lx.x * rb * 0.55, o.y + lx.y * rb * 0.55, 0.75, 0, TAU);
    cx.fill();
  });
}

export const SPIT_SPLASH_FRAMES = 6;

export function spitSplash(c: EffectContext): void {
  const { camera: cam, t, height } = c;
  const glow = ramp(c, 'glow');
  const sq = floorSquash(cam);
  const o = cam.project(vec3(0, 0, 0));
  const floor = cam.project(vec3(0, 0, -height));
  const rng = effectRng(c, 61);
  const f = (n: number) => n / (SPIT_SPLASH_FRAMES - 1);

  // Timing: a tight flash, the peak on frames 1 and 2, a fall-off to nothing on the last frame.
  const flash = keys(t, [[f(0), 1], [f(1), 1], [f(2), 0.6], [f(3), 0.25], [f(4), 0.06], [f(5), 0]]);
  const pool = keys(t, [[f(0), 0.5], [f(1), 1], [f(2), 0.9], [f(3), 0.6], [f(4), 0.25], [f(5), 0]]);
  const ringR = 3 + 10 * easeOut(t, 2);
  const ringA = keys(t, [[f(0), 0.9], [f(2), 0.6], [f(4), 0.12], [f(5), 0]]);

  // The crown: droplets thrown out round the hit, in a ring of uneven reach.
  const drops = Array.from({ length: 9 }, (_, i) => ({
    ang: ((i + rng.float(-0.3, 0.3)) / 9) * TAU,
    reach: rng.float(10, 18),
    rise: rng.float(3, 6.5),
    len: rng.float(2.2, 4.2),
    w: rng.float(0.8, 1.25),
    pale: rng.boolean(0.55),
  }));
  const licks = [-1, 0, 1].map(k => ({ dx: k * rng.float(2.4, 3.6), len: rng.float(5.5, 8) * (k === 0 ? 1.25 : 0.9), w: rng.float(1.7, 2.2), bend: -k * rng.float(0.2, 0.34), delay: rng.float(0.02, 0.1) }));

  // Light on the floor: the pool where the glob landed, and a thin ring running out over it.
  c.ground.custom(vec3(0, 0, -height), cx => {
    softPool(cx, floor.x, floor.y, 14 * (0.7 + 0.3 * pool), sq, glow.base, 0.4 * pool);
    softPool(cx, floor.x, floor.y, 6 * pool, sq, glow.lit, 0.34 * pool);
    if (ringA > 0.01) {
      cx.save();
      cx.lineJoin = 'round';
      for (const [color, w] of [[glow.dark, 2 * (1 - t) + 0.7], [glow.lit, 0.9 * (1 - t) + 0.4]] as const) {
        cx.strokeStyle = alpha(color, ringA);
        cx.lineWidth = w;
        cx.beginPath();
        cx.ellipse(floor.x, floor.y, ringR, ringR * sq, 0, 0, TAU);
        cx.stroke();
      }
      cx.restore();
    }
  });

  c.object.custom(vec3(0, 0, 0), cx => {
    softDisc(cx, o.x, o.y - 2, 12 * (0.55 + 0.45 * flash), glow.base, 0.5 * flash);

    // Short flames lifting out of the hit, behind the droplets.
    for (const l of licks) {
      const k = clamp01((t - l.delay) / (1 - l.delay));
      const grow = keys(k, [[0, 0], [f(1), 0.6], [f(2), 1], [f(3), 0.7], [f(4), 0.3], [f(5), 0]]);
      tongue(cx, o.x + l.dx, o.y - 1 - 2 * grow, -Math.PI / 2 + l.bend * 0.6, l.len * grow, l.w * (0.5 + 0.5 * grow), glow, 1, l.bend);
    }

    // Droplets: out along the floor, up in an arc and down again; they stop on the floor under them and fade as they land.
    for (const d of drops) {
      const at = (tt: number) => {
        const rr = d.reach * easeOut(tt, 1.7);
        const lf = d.rise * 6.4 * tt * (1 - tt);
        return { x: o.x + Math.cos(d.ang) * rr, y: Math.min(o.y + Math.sin(d.ang) * rr * sq - lf, floor.y + Math.sin(d.ang) * rr * sq) };
      };
      const p = at(t);
      const q = at(Math.max(0, t - 0.06));
      const a = keys(t, [[0, 0], [f(1) * 0.5, 1], [f(3), 0.9], [f(4), 0.4], [f(5), 0]]);
      if (a < 0.02) continue;
      tongue(cx, p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x), d.len * (0.5 + 0.5 * a), d.w, glow, a);
      if (d.pale) softDisc(cx, p.x, p.y, 1.6, glow.lit, 0.5 * a);
    }

    // The glint where it bit.
    glint(cx, o.x, o.y - 1, 6 * flash, glow.dark, 0.9);
    glint(cx, o.x, o.y - 1, 5 * flash, glow.base, 1, 0.14);
    softDisc(cx, o.x, o.y - 1, 5 * flash, glow.lit, 0.95 * flash, 0.4);
  });
}
