/**
 * Ground effects: marks of power on the floor, under every standing thing (layer `ground`).
 * Circles are ellipses on the screen (the camera's tilt squashes depth), so every ring is sampled on
 * the floor and projected, never drawn as a screen ellipse by guess.
 *
 * - `castCircle`: a rune circle about a cell in radius that draws itself round the caster: the outer
 *   ring sweeps clockwise with a pen of light, the inner ring counter-clockwise, runes ignite where
 *   the pen has passed, an eight-pointed star is drawn inside, the whole thing pulses, and on
 *   `release` it flares, throws up a column of light and a ring, and fades. Ends empty.
 * - `soulShockwave`: the area blast. A flash at the centre and a band of soul fire that runs out two
 *   and a bit cells, thinning as it goes, with flame tongues standing along it, an echo ring behind,
 *   light bleeding inside and sparks lifting off. Ends empty.
 */

import { alpha } from '@core/draw';
import { effectRng, vec3, type Camera, type EffectContext } from '@core/volume';
import { paintEmber } from '../gear/fire';
import { CELL, TAU, clamp01, easeOut, floorSquash, glint, keys, lerp, ramp, softDisc, softPool, tongue } from './fx';

type Pt = { x: number; y: number };

/** A point of the floor (centre `o` on the screen), `r` from it at angle `ang`. */
const floorPoint = (cam: Camera, o: Pt, r: number, ang: number): Pt => {
  const q = cam.project(vec3(Math.cos(ang) * r, Math.sin(ang) * r, 0));
  const q0 = cam.project(vec3(0, 0, 0));
  return { x: o.x + q.x - q0.x, y: o.y + q.y - q0.y };
};

/** Strokes a polyline in three passes: a dark rim, the saturated line, a pale core. */
function ink(cx: CanvasRenderingContext2D, pts: Pt[], glow: { dark: string; base: string; lit: string }, w: number, a: number): void {
  if (pts.length < 2 || a <= 0.01) return;
  cx.save();
  cx.lineJoin = 'round';
  cx.lineCap = 'round';
  cx.beginPath();
  pts.forEach((p, i) => (i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)));
  for (const [color, k, aa] of [[glow.dark, 1.9, 0.95], [glow.base, 1, 1], [glow.lit, 0.4, 0.95]] as const) {
    cx.strokeStyle = alpha(color, a * aa);
    cx.lineWidth = w * k;
    cx.stroke();
  }
  cx.restore();
}

// ----------------------------------------------------------------------------------------------
// Cast circle
// ----------------------------------------------------------------------------------------------

export const CAST_CIRCLE_FRAMES = 10;
/** The frame the cast lets go: the flare, and where a game releases what was cast. */
export const CAST_CIRCLE_RELEASE = 7;
/** Radius of the outer ring: a cell (the effect's `size` is a little more, for the flare). */
export const CAST_CIRCLE_RADIUS = Math.round(CELL * 0.88);

export function castCircle(c: EffectContext): void {
  const { camera: cam, t } = c;
  const glow = ramp(c, 'glow');
  const sq = floorSquash(cam);
  const o = cam.project(vec3(0, 0, 0));
  const rng = effectRng(c, 21);
  const moteRng = effectRng(c, 22);
  const f = (n: number) => n / (CAST_CIRCLE_FRAMES - 1);
  const R1 = CAST_CIRCLE_RADIUS;
  const R2 = R1 * 0.72;
  const R3 = R1 * 0.5;

  const sweep = easeOut(keys(t, [[0, 0], [f(5), 1]]), 1.4);
  const sweep2 = easeOut(keys(t, [[f(1), 0], [f(6), 1]]), 1.4);
  const star = keys(t, [[f(3), 0], [f(7), 1]]);
  // Charge: how brightly the circle burns; it builds, pulses, flares on release and goes out.
  const pulse = 1 + 0.18 * Math.sin(TAU * keys(t, [[f(5), 0], [f(9), 2]]));
  const charge = keys(t, [[0, 0.55], [f(5), 0.85], [f(6), 1], [f(CAST_CIRCLE_RELEASE), 1.35], [f(8), 0.8], [f(9), 0]]) * (t > f(5) ? pulse : 1);
  const env = keys(t, [[0, 1], [f(CAST_CIRCLE_RELEASE), 1], [f(8), 0.7], [f(9), 0]]);
  const shrink = keys(t, [[f(CAST_CIRCLE_RELEASE), 1], [f(8), 0.96], [f(9), 0.9]]);
  const a = clamp01(env * Math.min(1, charge));

  // Runes: eight glyphs between the two rings, each a short broken line in a 3 × 3 lattice, the same on every frame.
  const glyphs = Array.from({ length: 8 }, () => {
    const n = rng.int(3, 4);
    const lattice = [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    const picked: number[] = [];
    while (picked.length < n) {
      const k = rng.int(0, 8);
      if (!picked.includes(k)) picked.push(k);
    }
    return picked.map(k => lattice[k]);
  });
  const motes = Array.from({ length: 12 }, () => ({ ang: moteRng.float(0, TAU), born: moteRng.float(0.2, 0.66), r: moteRng.float(0.8, 1.04), rise: moteRng.float(10, 20), sway: moteRng.float(-3, 3) }));

  c.ground.custom(vec3(0, 0, 0), cx => {
    // Light inside the circle.
    softPool(cx, o.x, o.y, R1 * 1.05, sq, glow.base, 0.22 * a, 0.35);
    softPool(cx, o.x, o.y, R3, sq, glow.lit, 0.16 * a * clamp01(star + 0.3));

    // Column of light thrown up on release.
    const column = keys(t, [[f(CAST_CIRCLE_RELEASE - 1), 0], [f(CAST_CIRCLE_RELEASE), 1], [f(8), 0.55], [f(9), 0]]);
    if (column > 0.02) {
      const h = 46 * Math.min(1, column + 0.3);
      const w = R3 * 0.8;
      const beam = cx.createLinearGradient(0, o.y, 0, o.y - h);
      beam.addColorStop(0, alpha(glow.base, 0.3 * column));
      beam.addColorStop(1, alpha(glow.base, 0));
      cx.fillStyle = beam;
      cx.beginPath();
      cx.moveTo(o.x - w, o.y);
      cx.lineTo(o.x - w * 0.55, o.y - h);
      cx.lineTo(o.x + w * 0.55, o.y - h);
      cx.lineTo(o.x + w, o.y);
      cx.closePath();
      cx.fill();
    }

    // Rings: sampled on the floor from the far side, the outer clockwise and the inner against it.
    const ring = (r: number, from: number, to: number) => {
      const steps = 72;
      const pts: Pt[] = [];
      for (let i = 0; i <= steps; i++) pts.push(floorPoint(cam, o, r * shrink, from + ((to - from) * i) / steps));
      return pts;
    };
    const start = -Math.PI / 2;
    ink(cx, ring(R1, start, start + TAU * sweep), glow, 1.5, a);
    ink(cx, ring(R2, start + 0.4, start + 0.4 - TAU * sweep2), glow, 1.1, a);
    // A thin outer echo that appears with the pulse.
    if (t > f(5)) ink(cx, ring(R1 + 3, start, start + TAU), glow, 0.5, a * 0.35);

    // Runes ignite as the pen passes them.
    glyphs.forEach((g, i) => {
      const ang = start + ((i + 0.5) / 8) * TAU;
      const seen = clamp01((sweep - (i + 0.5) / 8) / 0.07);
      if (seen <= 0.01) return;
      const flick = seen * (0.78 + 0.22 * Math.sin(TAU * (t * 3 + i * 0.37)));
      const mid = (R1 + R2) / 2 * shrink;
      const size = (R1 - R2) * 0.4 * shrink;
      const pts = g.map(([u, v]) => floorPoint(cam, o, mid + u * size, ang + (v * size) / mid));
      ink(cx, pts, glow, 1, a * flick);
    });

    // Ticks on the outer ring, a mark every fifteen degrees, lit as the pen passes.
    for (let i = 0; i < 24; i++) {
      const ang = start + (i / 24) * TAU;
      const seen = clamp01((sweep - i / 24) / 0.05);
      if (seen <= 0.01) continue;
      const long = i % 3 === 0 ? 4.2 : 2.2;
      ink(cx, [floorPoint(cam, o, (R1 + 2.4) * shrink, ang), floorPoint(cam, o, (R1 + 2.4 + long) * shrink, ang)], glow, 0.6, a * seen * 0.9);
    }

    // The star: a pentagram, drawn edge by edge (each edge joins a point to the second one after it).
    const points = Array.from({ length: 5 }, (_, k) => floorPoint(cam, o, R3 * shrink, -Math.PI / 2 + (k * TAU) / 5));
    const edges: [Pt, Pt][] = points.map((p, k) => [p, points[(k + 2) % 5]]);
    edges.forEach(([p, q], i) => {
      const k = clamp01(star * edges.length - i);
      if (k <= 0) return;
      ink(cx, [p, { x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k) }], glow, 1, a);
    });
    // The heart: a small pool of pale light and a glint once the star is whole.
    if (star > 0.9) {
      softPool(cx, o.x, o.y, 6, sq, glow.lit, a * 0.9);
      glint(cx, o.x, o.y - 1, 3.4, glow.lit, a);
    }

    // The pen: a point of pale light at the head of each sweep.
    if (sweep > 0 && sweep < 0.999) {
      const p = floorPoint(cam, o, R1, start + TAU * sweep);
      softDisc(cx, p.x, p.y, 7, glow.base, 0.8 * a);
      glint(cx, p.x, p.y, 4, glow.lit, a);
    }
    if (sweep2 > 0 && sweep2 < 0.999) {
      const p = floorPoint(cam, o, R2, start + 0.4 - TAU * sweep2);
      softDisc(cx, p.x, p.y, 5, glow.base, 0.7 * a);
      glint(cx, p.x, p.y, 3, glow.lit, a);
    }

    // Release: a ring of light flies out of the circle.
    const flare = keys(t, [[f(CAST_CIRCLE_RELEASE - 1), 0], [f(CAST_CIRCLE_RELEASE), 1], [f(9), 0]]);
    if (flare > 0.02) {
      const u = clamp01((t - f(CAST_CIRCLE_RELEASE)) / (1 - f(CAST_CIRCLE_RELEASE)));
      const r = R1 * (1 + 0.28 * easeOut(u, 2));
      ink(cx, ring(r / shrink, start, start + TAU), glow, 1.9 * (1 - u * 0.5), flare);
    }

    // Motes of light lift off the ring.
    for (const m of motes) {
      const age = clamp01((t - m.born) / 0.34);
      if (age <= 0 || age >= 1) continue;
      const p = floorPoint(cam, o, R1 * m.r * shrink, m.ang);
      paintEmber(cx, c.materials['glow'], p.x + m.sway * age, p.y - m.rise * age, 0.8 * (1 - 0.4 * age), 1.5 * (1 - 0.4 * age), (1 - age) * clamp01(env * 1.2));
    }
  });
}

// ----------------------------------------------------------------------------------------------
// Soul shockwave
// ----------------------------------------------------------------------------------------------

export const SHOCKWAVE_FRAMES = 8;
/** How far the ring runs: two cells and a quarter. */
export const SHOCKWAVE_RADIUS = Math.round(CELL * 2.25);

export function soulShockwave(c: EffectContext): void {
  const { camera: cam, t } = c;
  const glow = ramp(c, 'glow');
  const sq = floorSquash(cam);
  const o = cam.project(vec3(0, 0, 0));
  const rng = effectRng(c, 31);
  const sparkRng = effectRng(c, 32);
  const f = (n: number) => n / (SHOCKWAVE_FRAMES - 1);
  const R = SHOCKWAVE_RADIUS * 0.93;

  const radiusAt = (u: number) => 10 + (R - 10) * easeOut(u, 2.3);
  const widthAt = (u: number) => keys(u, [[0, 16], [f(1), 14], [f(2), 11], [f(3), 9], [f(4), 7], [f(5), 5], [f(6), 4], [1, 3]]);
  const env = keys(t, [[0, 1], [f(2), 1], [f(4), 0.72], [f(5), 0.4], [f(6), 0.14], [f(7), 0]]);
  const flick = keys(t, [[0, 1], [f(2), 1], [f(4), 0.82], [f(5), 0.55], [f(6), 0.24], [f(7), 0]]);
  const r = radiusAt(t);
  const th = widthAt(t);

  // The front is not a perfect circle: a few slow lobes, the same on every frame.
  const lobe = [rng.float(0, TAU), rng.float(0, TAU), rng.float(0, TAU)];
  const wobble = (ang: number) => 1 + 0.022 * Math.sin(5 * ang + lobe[0]) + 0.012 * Math.sin(9 * ang + lobe[1]) + 0.008 * Math.sin(17 * ang + lobe[2]);
  // Flames along the front: tall ones and short ones, unevenly spaced, leaning outward.
  const tongues = Array.from({ length: 30 }, (_, i) => {
    const tall = i % 3 === 0;
    return { ang: ((i + rng.float(-0.4, 0.4)) / 30) * TAU, h: tall ? rng.float(12, 21) : rng.float(4.5, 10), w: tall ? rng.float(3.2, 4.4) : rng.float(2.2, 3.2), sway: rng.float(0, TAU) };
  });
  const sparks = Array.from({ length: 22 }, () => ({ ang: sparkRng.float(0, TAU), born: sparkRng.float(0, 0.45), rise: sparkRng.float(10, 26), drift: sparkRng.float(-6, 6) }));

  /** The ring at radius `rr` sampled on the floor, closed, with the front's lobes. */
  const sample = (rr: number): Pt[] => Array.from({ length: 97 }, (_, i) => floorPoint(cam, o, rr * wobble((i / 96) * TAU), (i / 96) * TAU));
  /** Fills the band between radii `rIn` and `rOut`. */
  const fillBand = (cx: CanvasRenderingContext2D, rIn: number, rOut: number, color: string): void => {
    const outer = sample(rOut);
    const inner = sample(Math.max(0.5, rIn));
    cx.beginPath();
    outer.forEach((p, i) => (i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)));
    cx.closePath();
    cx.moveTo(inner[0].x, inner[0].y);
    for (let i = inner.length - 1; i >= 0; i--) cx.lineTo(inner[i].x, inner[i].y);
    cx.closePath();
    cx.fillStyle = color;
    cx.fill('evenodd');
  };

  c.ground.custom(vec3(0, 0, 0), cx => {
    // Light bleeding inside the ring, and the flash at the centre on the first frames.
    softPool(cx, o.x, o.y, r * 0.98, sq, glow.base, 0.2 * env, 0.55);
    const flash = clamp01(1 - t / 0.3);
    softPool(cx, o.x, o.y, 30 * (0.5 + 0.5 * flash), sq, glow.lit, 0.9 * flash, 0.25);

    // Echo ring: the same blast a step behind, thin.
    if (t > 0.16) {
      const re = radiusAt(t - 0.16);
      ink(cx, sample(re), glow, 1.2, env * 0.5 * keys(t, [[0.16, 0.2], [f(2), 1], [f(5), 0.6], [1, 0]]));
    }

    const lickAt = (g: (typeof tongues)[number]) => {
      const p = floorPoint(cam, o, (r + th * 0.1) * wobble(g.ang), g.ang);
      const sway = Math.sin(TAU * (t * 2 + g.sway / TAU)) * 0.12;
      const body = flick * (0.4 + 0.6 * clamp01(th / 12));
      tongue(cx, p.x, p.y, -Math.PI / 2 + Math.cos(g.ang) * 0.25 + sway, g.h * body, g.w * (0.55 + 0.45 * flick), glow, env, -Math.cos(g.ang) * 0.2);
    };
    // Flames behind the band first (the far half), then the band, then the near half.
    tongues.filter(g => Math.sin(g.ang) < 0).forEach(lickAt);

    // The band in three tones across its width: a dark rim, the saturated fire, a pale outer third, and a bright line on its edge.
    const rIn = r - th * 0.66;
    const rOut = r + th * 0.34;
    fillBand(cx, rIn - th * 0.1, rOut + th * 0.1, alpha(glow.dark, 0.95 * env));
    fillBand(cx, rIn, rOut, alpha(glow.base, env));
    fillBand(cx, rOut - th * 0.38, rOut, alpha(glow.lit, 0.5 * env));
    cx.save();
    cx.lineJoin = 'round';
    cx.beginPath();
    sample(rOut).forEach((p, i) => (i ? cx.lineTo(p.x, p.y) : cx.moveTo(p.x, p.y)));
    cx.closePath();
    cx.strokeStyle = alpha(glow.lit, 0.95 * env);
    cx.lineWidth = 1;
    cx.stroke();
    cx.restore();

    tongues.filter(g => Math.sin(g.ang) >= 0).forEach(lickAt);

    // Sparks lift off the ring and fall back.
    for (const s of sparks) {
      const age = clamp01((t - s.born) / (1 - s.born));
      if (age <= 0) continue;
      const p = floorPoint(cam, o, radiusAt(s.born + (t - s.born) * 0.5), s.ang);
      const rise = s.rise * easeOut(age, 1.8) - 14 * age * age;
      if (rise < 0) continue;
      paintEmber(cx, c.materials['glow'], p.x + s.drift * age, p.y - rise, 0.8 * (1 - 0.4 * age), 1.5 * (1 - 0.4 * age), (1 - age) * env);
    }
  });
}
