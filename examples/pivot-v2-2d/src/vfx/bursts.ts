/**
 * Bursts: a puff that plays once where something happens and leaves nothing.
 *
 * - `deathSouls`: what leaves a body at the end of its death clip. Five lost souls (the kit's
 *   hollow-eyed flames) lift off one after another, each trailing a tapering wisp of the path it
 *   took, swaying once as it climbs, growing, then thinning and going out; embers rise with them.
 *   The last frame is empty. Played at the body's `center`, where it lies.
 * - `dustPuff`: a small cloud kicked up at the feet by a landing or a heavy step: lumpy puffs in
 *   the three tones of the stone ring outwards along the floor and rise, a faint ring of dust runs
 *   over the floor under them. The last frame is empty.
 */

import { alpha, lerpColor } from '@core/draw';
import { effectRng, vec3, type EffectContext } from '@core/volume';
import { paintEmber, paintFlame } from '../gear/fire';
import { TAU, clamp01, cloud, easeOut, floorSquash, keys, puffLobes, ramp, softDisc, softPool } from './fx';

// ----------------------------------------------------------------------------------------------
// Death souls
// ----------------------------------------------------------------------------------------------

export const DEATH_SOULS_FRAMES = 10;

export function deathSouls(c: EffectContext): void {
  const { camera: cam, t } = c;
  const glow = ramp(c, 'glow');
  const o = cam.project(vec3(0, 0, 0));
  const rng = effectRng(c, 41);
  const moteRng = effectRng(c, 42);
  const f = (n: number) => n / (DEATH_SOULS_FRAMES - 1);

  const souls = Array.from({ length: 5 }, (_, i) => ({
    x0: (i - 2) * 8.2 + rng.float(-1.6, 1.6),
    delay: [0.04, 0.2, 0.1, 0.3, 0.16][i] + rng.float(0, 0.04),
    rise: [40, 58, 48, 64, 38][i] + rng.random() * 6,
    sway: 3.4 + rng.random() * 3.6,
    phase: rng.float(0, 1),
    size: 2.7 + rng.random() * 0.9,
    eyes: i !== 1,
  }));
  const motes = Array.from({ length: 9 }, () => ({ x: moteRng.float(-15, 15), born: moteRng.float(0, 0.5), rise: moteRng.float(14, 30), sway: moteRng.float(-3, 3) }));

  /** Where soul `s` is at progress `p` (0 → 1 across its own climb), in screen px. */
  const place = (s: (typeof souls)[number], p: number) => ({
    x: o.x + s.x0 + Math.sin(TAU * (p * 1 + s.phase)) * s.sway * Math.min(1, p * 3),
    y: o.y - s.rise * easeOut(p, 1.2) + 2,
  });

  c.object.custom(vec3(0, 0, 0), cx => {
    // The release: a soft flash over the body that dies away in the first third.
    const flash = clamp01(1 - t / 0.34);
    softDisc(cx, o.x, o.y - 4, 20 * (0.5 + 0.5 * flash), glow.base, 0.5 * flash);
    softDisc(cx, o.x, o.y - 4, 9 * flash, glow.lit, 0.7 * flash, 0.3);

    // Wisps first (all of them), then the heads over them.
    const live = souls.map(s => ({ s, p: clamp01((t - s.delay) / (1 - s.delay)) })).filter(({ p }) => p > 0);
    for (const { s, p } of live) {
      const a = keys(p, [[0, 0], [0.12, 1], [0.6, 0.9], [0.95, 0], [1, 0]]);
      if (a < 0.01) continue;
      const k = keys(p, [[0, 0.35], [0.18, 1], [0.7, 1], [1, 0.45]]);
      const N = 9;
      const spine = Array.from({ length: N + 1 }, (_, i) => {
        const q = place(s, Math.max(0, p - (i / N) * 0.3));
        return { x: q.x, y: q.y + s.size * k * 0.9, w: s.size * k * 0.62 * Math.pow(1 - i / N, 0.9) };
      });
      const tail = spine[N];
      const head = spine[0];
      const side = (grow: number, sgn: number) => spine.map(q => ({ x: q.x + sgn * (q.w + grow), y: q.y }));
      const strip = (grow: number) => {
        const l = side(grow, -1);
        const r = side(grow, 1);
        cx.beginPath();
        l.forEach((q, i) => (i ? cx.lineTo(q.x, q.y) : cx.moveTo(q.x, q.y)));
        for (let i = r.length - 1; i >= 0; i--) cx.lineTo(r[i].x, r[i].y);
        cx.closePath();
      };
      const fade = (color: string, a0: number) => {
        const g = cx.createLinearGradient(head.x, head.y, tail.x, tail.y);
        g.addColorStop(0, alpha(color, a * a0));
        g.addColorStop(1, alpha(color, 0));
        return g;
      };
      strip(0.5);
      cx.fillStyle = fade(glow.dark, 0.9);
      cx.fill();
      strip(0);
      cx.fillStyle = fade(glow.base, 0.85);
      cx.fill();
    }
    for (const { s, p } of live) {
      const a = keys(p, [[0, 0], [0.12, 1], [0.6, 0.9], [0.95, 0], [1, 0]]);
      if (a < 0.01) continue;
      const k = keys(p, [[0, 0.35], [0.18, 1], [0.7, 1], [1, 0.45]]);
      const q = place(s, p);
      const before = place(s, Math.max(0, p - 0.04));
      paintFlame(cx, c.materials['glow'], q.x, q.y, s.size * k, { lean: (q.x - before.x) * 2.2, halo: 7, eyes: s.eyes, strength: a });
    }

    // Embers rise with them.
    for (const m of motes) {
      const age = clamp01((t - m.born) / (1 - m.born));
      if (age <= 0) continue;
      paintEmber(cx, c.materials['glow'], o.x + m.x + m.sway * age, o.y - 3 - m.rise * easeOut(age, 1.5), 0.8 * (1 - 0.5 * age), 1.5 * (1 - 0.5 * age), 0.95 * Math.sin(Math.PI * Math.pow(age, 0.7)));
    }
  });
}

// ----------------------------------------------------------------------------------------------
// Dust puff
// ----------------------------------------------------------------------------------------------

export const DUST_PUFF_FRAMES = 6;

export function dustPuff(c: EffectContext): void {
  const { camera: cam, t } = c;
  const dust = ramp(c, 'dust');
  const sq = floorSquash(cam);
  const o = cam.project(vec3(0, 0, 0));
  const rng = effectRng(c, 51);
  const f = (n: number) => n / (DUST_PUFF_FRAMES - 1);
  // A step lighter than the stone, so the cloud reads on a dark floor.
  const tone = { lit: dust.lit, base: lerpColor(dust.base, dust.lit, 0.3), dark: lerpColor(dust.dark, dust.base, 0.3) };

  const fade = keys(t, [[0, 0.9], [f(1), 0.95], [f(3), 0.6], [f(4), 0.28], [f(5), 0]]);
  const grow = easeOut(t, 1.8);
  // Dust spreads sideways along the floor and climbs a little: wide puffs at both sides, smaller ones nearer the feet, one rising in the middle.
  const puffs = Array.from({ length: 9 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    const wide = i < 4;
    const ang = wide ? (side < 0 ? Math.PI : 0) + rng.float(-0.5, 0.5) : rng.float(0, TAU);
    return {
      ang,
      reach: wide ? 11 + rng.random() * 8 : 2 + rng.random() * 8,
      r: wide ? 3.4 + rng.random() * 2 : 2.6 + rng.random() * 2.4,
      rise: wide ? 1 + rng.random() * 3 : 3 + rng.random() * 6,
      lobes: puffLobes(rng),
    };
  }).sort((a, b) => Math.sin(a.ang) * a.reach - Math.sin(b.ang) * b.reach);

  // A faint ring of dust running out over the floor.
  c.ground.custom(vec3(0, 0, 0), cx => {
    const a = keys(t, [[0, 0.5], [f(2), 0.3], [f(4), 0.08], [f(5), 0]]);
    softPool(cx, o.x, o.y, (8 + 20 * grow) * 1.2, sq, tone.lit, a, 0.5);
  });

  c.object.custom(vec3(0, 0, 0), cx => {
    for (const p of puffs) {
      const d = p.reach * grow;
      const r = p.r * (0.55 + 0.75 * grow) * (1 - 0.18 * t);
      cloud(cx, o.x + Math.cos(p.ang) * d, o.y + Math.sin(p.ang) * d * sq - p.rise * easeOut(t, 1.5) - 1.5, r, p.lobes, tone, fade);
    }
  });
}
