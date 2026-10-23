/**
 * Bone spider: skeleton as data (no preset). Eight legs on a short trunk (abdomen, thorax, head).
 *
 * Each leg hangs from the side of the thorax: femur and tibia are solved by IK with a vector
 * knee that arches up and out (fanned forward for the front pairs, back for the rear ones), and
 * the tarsus is the leg's `foot` segment down to the claw.
 *
 * Clips: walk, idle, hit (the hit preset plus a startled leg flinch), death (a collapse onto the
 * belly, then the legs curl in) and spit (a ranged skill). Channels for the skin, all optional:
 * `fang` (-1 flared wide .. 0 open .. 1 pinched), `palp`, `pulse` (soul glow, 0..1.6), `hurt`
 * (eye flare, 0..1), `life` (1 alive .. 0 the glow gone dark) and `flash` (muzzle flash, 0..1).
 */

import {
  EVENTS,
  beat,
  bell,
  defineClip,
  defineSkeleton,
  easeOutQuad,
  hit,
  locomotion,
  restFeet,
  smooth,
  spawnEvent,
  track,
  bump,
  type Beat,
  type Drive,
  type Local,
  type LegSpec,
  type SkeletonSpec,
  type TrunkJoint,
} from '@core/rig';

/** Per pair, front to back: hip position on the thorax, where the foot rests, and the knee fan (forward component). */
const PAIRS = [
  { n: 1, fwd: 3.2, footFwd: 17, footSide: 22, fan: 0.45 },
  { n: 2, fwd: 1.2, footFwd: 8, footSide: 27, fan: 0.15 },
  { n: 3, fwd: -0.8, footFwd: -4, footSide: 27, fan: -0.15 },
  { n: 4, fwd: -2.8, footFwd: -15, footSide: 22, fan: -0.45 },
];
/** Thorax joint at rest: the origin the pairs are measured from. */
const THORAX: [number, number, number] = [2, 0, 14.5];
const HIP_SIDE = 4.6;

const trunk: TrunkJoint[] = [
  { name: 'abdomen', at: [-12, 0, 16] },
  { name: 'thorax', at: THORAX },
  { name: 'head', at: [10, 0, 15.5] },
];
const legs: LegSpec[] = [];
/** Alternating tetrapod: legs 1L 2R 3L 4R step together, then 1R 2L 3R 4L, each leg a hair after the last. */
const phases: Record<string, number> = {};

for (const p of PAIRS) {
  for (const s of [-1, 1] as const) {
    const side = s < 0 ? 'L' : 'R';
    legs.push({
      name: `leg${p.n}${side}`,
      hip: 'thorax',
      offset: [p.fwd, s * HIP_SIDE, 0.6],
      lengths: [13, 19],
      foot: { length: 8, tilt: 0 },
      knee: [p.fan, s, 1.2],
      // The rest foot is the thorax's ground point plus `offset` (x, y) plus `stance`.
      stance: [p.footFwd - p.fwd, s * (p.footSide - HIP_SIDE), 0],
    });
    const groupA = (p.n % 2 === 1) === (s < 0); // 1L 2R 3L 4R
    phases[`leg${p.n}${side}`] = (groupA ? 0 : 0.5) + p.n * 0.04;
  }
}

export const boneSpider: SkeletonSpec = defineSkeleton({
  name: 'bone-spider',
  height: 26,
  trunk,
  head: 'head',
  legs,
  arms: undefined,
  tails: undefined,
  gaits: {
    walk: { duty: 0.62, stride: 11, cadence: 1.7, phases, lift: 5.5, bob: 0.6, bobCycles: 2, bobPhase: 0.1 },
  },
});

export const spiderWalk = () => locomotion(boneSpider, 'walk');

const REST = restFeet(boneSpider);
const TAU = Math.PI * 2;

/** Foot target: the rest foot lifted by `lift` and pushed out by `reach` and forward by `fwd`. */
function tap(leg: string, u: number, lift: number, fwd: number): Local {
  const [x, y, z] = REST[leg];
  const k = u >= 0 && u <= 1 ? bell(u) : 0;
  return [x + fwd * k, y + Math.sign(y) * 1.2 * k, z + lift * k];
}

/**
 * Idle: the spider breathes and shivers in place. Front legs lift and tap one after the other, the
 * second pair twitches, the abdomen sways. Whole cycles per loop (1, 1, 2 and 3) so it closes.
 * Channels for the skin: `fang` (0..1 pinch, 2 cycles), `palp` (-1..1 wiggle, 3 cycles), `pulse`
 * (0..1 soul glow, 1 cycle).
 */
export const spiderIdle = () =>
  defineClip({
    name: 'idle',
    seconds: 1,
    loop: true,
    drive: t => ({
      root: [0, 0, 0.5 * Math.sin(TAU * t)],
      trunk: { abdomen: [0, 0.8 * Math.sin(TAU * t + 0.8), 0.5 * Math.cos(TAU * t)], head: [0.3 * Math.sin(TAU * t + 0.4), 0, 0] },
      feet: {
        leg1L: tap('leg1L', (t - 0.04) / 0.34, 5.5, 3),
        leg1R: tap('leg1R', (t - 0.54) / 0.34, 5.5, 3),
        leg2L: tap('leg2L', (t - 0.3) / 0.22, 2.2, 1.2),
        leg2R: tap('leg2R', (t - 0.74) / 0.22, 2.2, 1.2),
      },
      extra: { fang: 0.5 + 0.5 * Math.sin(TAU * 2 * t), palp: 0.7 * Math.sin(TAU * 3 * t), pulse: 0.5 + 0.5 * Math.sin(TAU * t) },
    }),
  });

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Pair number (1 front .. 4 rear) and side (-1 left, 1 right) of a leg from its name. */
const pairOf = (leg: string) => ({ n: Number(leg[3]), s: leg.endsWith('L') ? -1 : 1 });
const HIPS = Object.fromEntries(legs.map(l => [l.name, [THORAX[0] + l.offset[0], l.offset[1]]])) as Record<string, [number, number]>;

/**
 * Hit: the preset (a snap back, a freeze on the pose, the recovery, and a knock-back by root motion,
 * a little harder than the default for a body this low) plus what only a spider does: the front
 * pairs fling up and out while the rear ones stay planted, the abdomen jerks up, the fangs flare and
 * the soul glow flickers. The preset's `hurt` (0..1) flares the eyes. The body's own snap, pitch and
 * push all come from the preset, so nothing here moves the root.
 */
export const spiderHit = () => {
  const base = hit(boneSpider, { strength: 1.25 });
  return defineClip({
    ...base,
    drive(t: number): Drive {
      const d = base.drive(t);
      const f = d.extra?.hurt ?? 0;
      const feet: Record<string, Local> = {};
      for (const leg of boneSpider.legs) {
        const { n, s } = pairOf(leg.name);
        const [x, y, z] = REST[leg.name];
        const up = [7, 3.2, 0.8, 0][n - 1] * f;
        const out = [2.2, 1.2, 0.4, 0][n - 1] * f;
        feet[leg.name] = [x - (n === 1 ? 1.5 : 0) * f, y + s * out, z + up];
      }
      return {
        ...d,
        trunk: { ...d.trunk, abdomen: [0, 0, 1.4 * f] },
        feet,
        extra: { ...d.extra, fang: 0.5 - 1.6 * f, pulse: 0.5 + 0.7 * f },
      };
    },
  });
};

/**
 * Death, held on the last frame: a jolt back, then the legs give out and the body drops onto its
 * belly (`land`), the feet skidding out; afterwards the legs curl in under the body one pair after
 * the other, rear first, the front ones twitching once as they settle. The fangs flare, then pinch
 * shut; the soul glow dims to nothing (`life` 1 .. 0). The skull stays upright on the belly, the
 * trunk's own axis never leaves the body.
 */
export const spiderDeath = (seconds = 1) => {
  const LAND = 0.5;
  const finalDrop = 7;
  return defineClip({
    name: 'death',
    kind: 'death',
    seconds,
    events: [{ t: LAND, name: EVENTS.land }],
    drive(t: number): Drive {
      const jolt = t < 0.1 ? easeOutQuad(t / 0.1) : 1 - smooth(clamp01((t - 0.1) / 0.25));
      const buckle = smooth(clamp01(t / 0.3));
      const fall = Math.pow(clamp01((t - 0.1) / (LAND - 0.1)), 2.2);
      const rebound = t > LAND ? 0.05 * bell(clamp01((t - LAND) / 0.25)) : 0;
      const down = clamp01(0.3 * buckle + 0.7 * fall - rebound);
      const feet: Record<string, Local> = {};
      for (const leg of boneSpider.legs) {
        const { n, s } = pairOf(leg.name);
        const [x, y] = REST[leg.name];
        const [hx, hy] = HIPS[leg.name];
        // Rear pairs curl first, a hair apart left to right; every pair is done by t = 0.9.
        const delay = (4 - n) * 0.035 + (s > 0 ? 0.02 : 0);
        const u = clamp01((t - 0.3 - delay) / 0.5);
        const curl = smooth(u);
        // Skid out while the body falls, then pull in: the foot ends close to the hip, low.
        const splay = 1 + 0.1 * down * (1 - curl);
        const x0 = hx + (x - hx) * splay;
        const y0 = hy + (y - hy) * splay;
        const cx = hx + (x - hx) * 0.34;
        const cy = hy + (y - hy) * 0.27;
        const twitch = n <= 2 ? 1.6 * bump(t, 0.6 + delay, 0.8 + delay) : 0;
        feet[leg.name] = [x0 + (cx - x0) * curl, y0 + (cy - y0) * curl, 0.8 * curl + 5 * bell(u) + twitch];
      }
      // The head end sags a little more; the body pitches nose-down as it falls.
      const pitch = 7 * jolt - 5 * down;
      const a = (-pitch * Math.PI) / 180;
      const dx = -1.6 * jolt;
      const dz = -finalDrop * down;
      const trunk: Record<string, Local> = {
        abdomen: [0, 0, -0.6 * down],
        thorax: [0, 0, -0.5 * down],
        head: [0, 0, -1.4 * down],
      };
      return {
        root: [dx * Math.cos(a) - dz * Math.sin(a), 0, dx * Math.sin(a) + dz * Math.cos(a)],
        trunk,
        pitch,
        roll: 9 * down,
        feet,
        extra: {
          hurt: jolt,
          fang: track(t, [[0, 0.5], [0.1, -1.1], [0.45, -0.7], [0.88, 1]]),
          pulse: track(t, [[0, 0.5], [0.1, 1.3], [0.5, 0.5], [0.88, 0]]),
          life: 1 - smooth(clamp01((t - 0.3) / 0.58)),
        },
      };
    },
  });
};

/** Rhythm of the spit: rear back (apex), gather, lunge and spit (extreme), hold, settle. */
export const SPIT_BEAT: Beat = { apex: 0.28, strike: 0.36, extreme: 0.5, hold: 0.6, settle: 0.78 };

/**
 * Spit, a ranged skill of 0.7 s: the spider rears back, abdomen and front legs lifted and the soul
 * glow swelling, then lunges forward with the fangs flared wide and spits soul fire from its mouth.
 * Events: `cast` at the end of the wind-up (the lunge starts, no longer cancellable), `release` and
 * `spawn:mouth` at the spit. Channels: `fang` (opens), `pulse` (the glow swells, then empties),
 * `flash` (the muzzle flash around the release, 0..1).
 */
export const spiderSpit = () =>
  defineClip({
    name: 'spit',
    kind: 'skill',
    tags: ['ranged'],
    seconds: 0.7,
    events: [
      { t: SPIT_BEAT.strike, name: EVENTS.cast },
      { t: SPIT_BEAT.extreme, name: EVENTS.release },
      { t: SPIT_BEAT.extreme, name: spawnEvent('mouth') },
    ],
    drive(t: number): Drive {
      const b = SPIT_BEAT;
      const B = (rest: number, apex: number, extreme: number, target: number, creep = 0, at = t) => beat(at, b, rest, apex, extreme, target, creep);
      const feet: Record<string, Local> = {};
      for (const leg of boneSpider.legs) {
        const { n, s } = pairOf(leg.name);
        const [x, y, z] = REST[leg.name];
        // The right side lags a hair, so the raised legs do not move as a mirror.
        const at = t - (s > 0 ? 0.015 : 0);
        const fx = [B(0, 3, 8.5, 4.5, 0.4, at), B(0, 1, 4, 2, 0.2, at), B(0, -0.5, 1.8, 0.8, 0, at), B(0, -1, 3, 1.2, 0, at)][n - 1];
        const out = [B(0, 3.2, -1.8, -0.6, 0.2, at), B(0, 2.4, -1, -0.3, 0.1, at), 0, 0][n - 1];
        const up = [B(0, 14, 0.6, 0, 0.4, at), B(0, 5, 0.3, 0, 0.2, at), 0, 0][n - 1];
        feet[leg.name] = [x + fx, y + s * out, z + up];
      }
      return {
        root: [B(0, -2.2, 4.2, 1.6, 0.3), 0, B(0, 1.2, -1.2, -0.3, 0.3)],
        pitch: B(0, 15, -7, -2.5, 1),
        trunk: {
          abdomen: [B(0, -1.2, 1, 0.5), 0, B(0, 6.5, 0, 0, 0.5)],
          thorax: [B(0, -0.4, 0.8, 0.3), 0, B(0, 1, 0, 0)],
          head: [B(0, -1.4, 2.6, 1.2), 0, B(0, 2.4, -1.4, -0.4, 0.3)],
        },
        feet,
        extra: {
          fang: track(t, [[0, 0.5], [b.apex, 0.9], [b.strike, 0.9], [b.extreme, -1.15], [b.hold, -1], [b.settle, 0.1], [1, 0.5]]),
          pulse: track(t, [[0, 0.5], [b.apex, 1.6], [b.strike, 1.6], [b.extreme, 0], [b.hold, 0.1], [b.settle, 0.5], [1, 0.5]]),
          flash: track(t, [[0, 0], [0.34, 0], [b.extreme, 1], [0.6, 0.45], [0.7, 0], [1, 0]]),
        },
      };
    },
  });
