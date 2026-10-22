/**
 * Projectiles: what leaves a character's hand and crosses the floor.
 *
 * `soulBolt`: a lost soul thrown as a comet. A skull of pale soul fire with hollow sockets, a nose
 * and teeth leads; behind it, along the heading, a forked tail of three flames (a long one between
 * two short ones, each waving once per loop at its own phase) sheds embers; a faint pool of light on
 * the floor, `height` below it, says it flies. It is the palm flame of Malvek's soulbolt clip let go
 * (same teardrop colours, same hollow-eyed face).
 *
 * The heading is `ctx.frame.forward` (16 facings): the tail is the heading's projection on the
 * screen, the face is turned to it on a sphere (both sockets show when it flies towards the camera,
 * a profile with one when it flies across, the sutures of the back of the skull when it flies away).
 */

import { alpha, lerpColor } from '@core/draw';
import { add3, dot3, norm3, scale3, vec3, type EffectContext, type Vec3 } from '@core/volume';
import { PALETTES } from '../theme';
import { paintEmber } from '../gear/fire';
import { TAU, clamp01, floorSquash, lerp, ramp, softDisc, softPool } from './fx';

/** Radius of the skull (logical px / world units): about a hand's size on a 80-unit character (a hand is 7, the head 14 across). */
const HEAD = 6.4;
/** Length of the tail on the screen when the bolt flies across the view. */
const TAIL = 38;

export function soulBolt(c: EffectContext): void {
  const { camera: cam, frame, t, height } = c;
  const glow = ramp(c, 'glow');
  const sq = floorSquash(cam);
  const origin = cam.project(vec3(0, 0, 0));
  const floor = cam.project(vec3(0, 0, -height));

  // Heading on the screen (the floor's projection, shortened when it runs along the view).
  const hx = frame.forward.x;
  const hy = frame.forward.y * sq;
  const hl = Math.hypot(hx, hy) || 1;
  const ux = hx / hl;
  const uy = hy / hl;
  const nx = -uy;
  const ny = ux;
  const tail = TAIL * (0.62 + 0.38 * hl);

  // The pool of light on the floor under it: faint, swelling twice per loop.
  const pulse = Math.sin(TAU * 2 * t);
  c.ground.custom(vec3(0, 0, -height), cx => {
    softPool(cx, floor.x, floor.y, 17 * (1 + 0.06 * pulse), sq, glow.base, 0.3 * (1 + 0.1 * pulse));
    softPool(cx, floor.x, floor.y, 7.5, sq, glow.lit, 0.26);
  });

  /** A flame of the tail: its spine waves once per loop at `phase`, tapering from `width` at the head to a point at `length`. */
  const flame = (side: number, length: number, width: number, phase: number) => {
    const N = 14;
    const spine = Array.from({ length: N + 1 }, (_, k) => {
      const s = k / N;
      const wave = Math.sin(TAU * (t + phase - s * 1.15)) * 2.9 * Math.pow(s, 0.8);
      const along = HEAD * 0.15 + (tail * length) * s;
      const lateral = side * HEAD * 0.6 * Math.pow(1 - s, 1.3) + wave;
      const w = width * Math.pow(1 - s, 0.82) * (1 + 0.1 * Math.sin(TAU * (2 * t + phase - s * 2.3))) + 0.3 * (1 - s);
      return { x: origin.x - ux * along + nx * lateral, y: origin.y - uy * along + ny * lateral, w };
    });
    return { spine };
  };
  const path = (cx: CanvasRenderingContext2D, spine: { x: number; y: number; w: number }[], scaleW: number, grow: number) => {
    cx.beginPath();
    spine.forEach((p, i) => (i ? cx.lineTo(p.x + nx * (p.w * scaleW + grow), p.y + ny * (p.w * scaleW + grow)) : cx.moveTo(p.x + nx * (p.w * scaleW + grow), p.y + ny * (p.w * scaleW + grow))));
    for (let i = spine.length - 1; i >= 0; i--) cx.lineTo(spine[i].x - nx * (spine[i].w * scaleW + grow), spine[i].y - ny * (spine[i].w * scaleW + grow));
    cx.closePath();
  };

  c.object.custom(vec3(0, 0, 0), cx => {
    const left = flame(-1, 0.7, HEAD * 0.58, 0.33);
    const right = flame(1, 0.62, HEAD * 0.58, 0.66);
    const mid = flame(0, 1, HEAD * 0.92, 0);

    // Halo.
    softDisc(cx, origin.x, origin.y, HEAD * 2.7, glow.base, 0.5);
    softDisc(cx, origin.x - ux * tail * 0.32, origin.y - uy * tail * 0.32, HEAD * 2.2, glow.base, 0.22);

    // Tail: each flame a darker rim under a saturated body that fades to its tip, then a pale hot core along the long one.
    cx.save();
    for (const f of [left, right, mid]) {
      const tip = f.spine[f.spine.length - 1];
      const rim = cx.createLinearGradient(origin.x, origin.y, tip.x, tip.y);
      rim.addColorStop(0, alpha(glow.dark, 0.95));
      rim.addColorStop(0.6, alpha(glow.dark, 0.6));
      rim.addColorStop(1, alpha(glow.dark, 0));
      path(cx, f.spine, 1, 0.55);
      cx.fillStyle = rim;
      cx.fill();
      const body = cx.createLinearGradient(origin.x, origin.y, tip.x, tip.y);
      body.addColorStop(0, alpha(glow.base, 1));
      body.addColorStop(0.55, alpha(glow.base, 0.82));
      body.addColorStop(1, alpha(glow.base, 0));
      path(cx, f.spine, 1, 0);
      cx.fillStyle = body;
      cx.fill();
    }
    const cut = mid.spine.slice(0, Math.round(14 * 0.66) + 1);
    const hot = cut[cut.length - 1];
    const lit = cx.createLinearGradient(origin.x, origin.y, hot.x, hot.y);
    lit.addColorStop(0, alpha(glow.lit, 0.95));
    lit.addColorStop(1, alpha(glow.lit, 0));
    path(cx, cut, 0.46, 0);
    cx.fillStyle = lit;
    cx.fill();
    cx.restore();

    // Embers shed by the tail, each living one loop and drifting back and out.
    for (let i = 0; i < 4; i++) {
      const life = (t + i / 4) % 1;
      const side = ((i * 7) % 5) - 2;
      const along = tail * (0.18 + 0.82 * life);
      const out = side * 1.8 + side * life * 2.4;
      paintEmber(cx, c.materials['glow'], origin.x - ux * along + nx * out, origin.y - uy * along + ny * out, 0.8 * (1 - 0.5 * life), 1.4 * (1 - 0.5 * life), 0.95 * (1 - life));
    }

    // The skull: a dark rim, the saturated shell, a pale cranium lit from the upper left.
    const rs = HEAD;
    cx.fillStyle = alpha(glow.dark, 1);
    cx.beginPath();
    cx.arc(origin.x, origin.y, rs + 1.25, 0, TAU);
    cx.fill();
    cx.fillStyle = glow.base;
    cx.beginPath();
    cx.arc(origin.x, origin.y, rs, 0, TAU);
    cx.fill();
    const lx = cam.lightOnScreen;
    const cr = rs * 0.8;
    const cranium = cx.createRadialGradient(origin.x + lx.x * rs * 0.22, origin.y + lx.y * rs * 0.22, 0, origin.x + lx.x * rs * 0.1, origin.y + lx.y * rs * 0.1, cr);
    cranium.addColorStop(0, glow.lit);
    cranium.addColorStop(0.72, glow.lit);
    cranium.addColorStop(1, lerpColor(glow.lit, glow.base, 0.55));
    cx.fillStyle = cranium;
    cx.beginPath();
    cx.arc(origin.x + lx.x * rs * 0.1, origin.y + lx.y * rs * 0.1, cr, 0, TAU);
    cx.fill();

    // Face and back of the skull, turned to the heading on a sphere.
    const toCam = cam.viewDir;
    const socket = lerpColor(glow.dark, PALETTES.ink, 0.55);
    const o0 = cam.project(vec3(0, 0, 0));
    const onSphere = (f: number, side: number, up: number): { p: { x: number; y: number }; seen: number } => {
      const d: Vec3 = norm3(add3(add3(scale3(frame.forward, f), scale3(frame.right, side)), vec3(0, 0, up)));
      const q = cam.project(scale3(d, cr));
      return { p: { x: q.x - o0.x + origin.x, y: q.y - o0.y + origin.y }, seen: dot3(d, toCam) };
    };
    for (const side of [-0.5, 0.5]) {
      const e = onSphere(0.8, side, 0.16);
      if (e.seen < 0.08) continue;
      const open = clamp01((e.seen - 0.08) / 0.5);
      cx.fillStyle = socket;
      cx.beginPath();
      cx.ellipse(e.p.x, e.p.y + 0.2, cr * 0.19 * (0.45 + 0.55 * open), cr * 0.27, 0, 0, TAU);
      cx.fill();
    }
    const nose = onSphere(1, 0, -0.1);
    if (nose.seen > 0.25) {
      cx.fillStyle = socket;
      cx.beginPath();
      cx.moveTo(nose.p.x, nose.p.y - cr * 0.12);
      cx.lineTo(nose.p.x + cr * 0.12, nose.p.y + cr * 0.2);
      cx.lineTo(nose.p.x - cr * 0.12, nose.p.y + cr * 0.2);
      cx.closePath();
      cx.fill();
    }
    // Teeth: a short dark line under the nose with three ticks across it.
    const mouth = onSphere(0.88, 0, -0.5);
    if (mouth.seen > 0.3) {
      const left = onSphere(0.82, -0.3, -0.5);
      const right = onSphere(0.82, 0.3, -0.5);
      cx.strokeStyle = socket;
      cx.lineWidth = 0.7;
      cx.lineCap = 'round';
      cx.beginPath();
      cx.moveTo(left.p.x, left.p.y);
      cx.lineTo(right.p.x, right.p.y);
      cx.stroke();
      for (const k of [-0.16, 0, 0.16]) {
        const tick = onSphere(0.86, k, -0.5);
        cx.beginPath();
        cx.moveTo(tick.p.x, tick.p.y - 0.9);
        cx.lineTo(tick.p.x, tick.p.y + 0.9);
        cx.stroke();
      }
    }
    // The back of the head: a suture running down from the crown.
    const crown = onSphere(-0.55, 0, 0.78);
    if (crown.seen > 0.2 && dot3(frame.forward, toCam) < 0) {
      const pts = [onSphere(-0.45, 0.02, 0.88), onSphere(-0.62, -0.12, 0.62), onSphere(-0.78, 0.1, 0.4), onSphere(-0.88, -0.04, 0.18)].filter(p => p.seen > 0.1);
      if (pts.length > 1) {
        cx.strokeStyle = alpha(glow.dark, 0.85);
        cx.lineWidth = 0.7;
        cx.lineJoin = 'round';
        cx.beginPath();
        pts.forEach((p, i) => (i ? cx.lineTo(p.p.x, p.p.y) : cx.moveTo(p.p.x, p.p.y)));
        cx.stroke();
      }
    }
    // A flick of the pale fire at the crown, so the skull burns.
    const flick = 0.5 + 0.5 * Math.sin(TAU * (t + 0.2));
    cx.fillStyle = alpha(glow.lit, 0.55 + 0.4 * flick);
    cx.beginPath();
    cx.arc(origin.x + lx.x * rs * 0.55, origin.y + lx.y * rs * 0.55, lerp(0.7, 1.2, flick), 0, TAU);
    cx.fill();
  });
}
