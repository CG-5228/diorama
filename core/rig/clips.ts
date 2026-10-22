/**
 * @core/rig - Clips
 *
 * A clip is a function from normalized time t (0..1) to a `Drive`, plus what a game needs to
 * play it: its length in seconds, whether it loops, the ground speed of locomotion, and named
 * events (footsteps, the hit frame). Loops are sampled at t = frame / frames, never t = 1.
 */

import { footCycle, groundSpeed, strideWarp, type GaitSpec } from './gait.js';
import type { Drive, ArmDrive, TailDrive } from './pose.js';
import type { Local, SkeletonSpec } from './skeleton.js';

/**
 * What a clip means to a game. Players, the viewer's playground and the character manifest
 * read it to bind controls and decide what may interrupt what, so every clip declares one.
 * - idle: stands in place (loops). Locomotion (loops, moves the sprite at `speed`): walk, run,
 *   sprint, crawl, fly, swim.
 * - Actions (play once): attack (deals damage at its `hit` event), skill (commits at `cast`,
 *   its effect leaves at `release`), hit (reaction to damage), death (ends on its last frame:
 *   `hold`), dodge, jump, emote, interact, spawn (appearing). `action` = anything else.
 */
export type ActionKind =
  | 'idle'
  | 'walk' | 'run' | 'sprint' | 'crawl' | 'fly' | 'swim'
  | 'attack' | 'skill' | 'hit' | 'death' | 'dodge' | 'jump' | 'emote' | 'interact' | 'spawn' | 'action';

/** Kinds that move the sprite (loops at the clip's ground speed). */
export const LOCOMOTION_KINDS: readonly ActionKind[] = ['walk', 'run', 'sprint', 'crawl', 'fly', 'swim'];

/** Coarse category of a kind: what the sprite does while the clip plays. */
export function categoryOf(kind: ActionKind): 'idle' | 'locomotion' | 'action' {
  return kind === 'idle' ? 'idle' : LOCOMOTION_KINDS.includes(kind) ? 'locomotion' : 'action';
}

/**
 * Standard event names, understood by games and the playground (custom names are allowed too):
 * - `hit`: the frame an attack deals damage (one per strike);
 * - `cast`: a skill commits (its wind-up is over, it can no longer be cancelled);
 * - `release`: a skill's effect leaves (a projectile, a wave);
 * - `cancel`: from this frame on, the action may be interrupted by another one;
 * - `land`: a body or a jump touches the ground;
 * - `step:<leg>`: a foot touches down (locomotion adds these);
 * - `spawn:<socket>`: something appears at that socket on this frame (see `defineCharacter`).
 */
export const EVENTS = { hit: 'hit', cast: 'cast', release: 'release', cancel: 'cancel', land: 'land' } as const;

/** Event name for a foot touching down. */
export const stepEvent = (leg: string) => `step:${leg}`;
/** Event name for something appearing at a socket (a projectile leaving a hand). */
export const spawnEvent = (socket: string) => `spawn:${socket}`;

/** A named moment of a clip, in normalized time. See `EVENTS` for the standard names. */
export interface ClipEvent {
  t: number;
  name: string;
}

/** An animation for one skeleton. */
export interface Clip {
  name: string;
  /** Duration of one play (or one loop) in seconds. The export's fps is frames ÷ seconds. */
  seconds: number;
  /**
   * Loops (idle, locomotion) or plays once (attacks, hits). `defineClip` defaults it to false, so
   * any cycle built by hand must say `loop: true`.
   */
  loop: boolean;
  /** Ground speed in world units per second while it plays (0 for actions in place). */
  speed: number;
  /** The drive at normalized time t. */
  drive(t: number): Drive;
  events: ClipEvent[];
  /** What the clip means to a game (see `ActionKind`). */
  kind: ActionKind;
  /** Free qualifiers for players and filters: 'melee', 'ranged', 'heavy', 'aoe', 'charged'. */
  tags: string[];
  /** Stays on its last frame when it ends instead of returning to idle (death, a held pose). */
  hold: boolean;
  /**
   * Root motion of an action that covers ground (a pounce, a dodge roll, a lunge that keeps its
   * ground): how far forward the game moves the sprite by normalized time t, in world units
   * (0 at t = 0). The drive stays in place (the body does not leave its cell); the export writes
   * the distance per frame so players move the sprite along the facing. Locomotion uses
   * `speed` instead.
   */
  travel?: (t: number) => number;
}

/**
 * Builds a custom clip (attacks, skills, hits, emotes, idles) from a drive function.
 *
 * IMPORTANT: `loop` defaults to false: the clip plays once unless `loop: true`. Idles and any
 * other cycle must pass `loop: true`, so the export checks that the loop closes (`checkClip`
 * reports `loopGap` for every clip, but only warns about it for loops and moving clips) and the
 * game repeats it. `speed` defaults to 0 (in place); set it for locomotion.
 *
 * Declare `kind` (see `ActionKind`): without it, a moving clip is a walk, a loop an idle and
 * anything else a generic `action`, which a game cannot bind to a control. Attacks need a `hit`
 * event and skills a `cast` or `release` event (`checkClip` warns otherwise); a death needs
 * `hold: true` (the default for kind 'death').
 */
export function defineClip(
  clip: Omit<Clip, 'events' | 'speed' | 'loop' | 'kind' | 'tags' | 'hold' | 'travel'> & Partial<Pick<Clip, 'events' | 'speed' | 'loop' | 'kind' | 'tags' | 'hold' | 'travel'>>,
): Clip {
  const speed = clip.speed ?? 0;
  const loop = clip.loop ?? false;
  const kind = clip.kind ?? (speed > 0 ? 'walk' : loop ? 'idle' : 'action');
  return { events: [], tags: [], ...clip, speed, loop, kind, hold: clip.hold ?? kind === 'death' };
}

const TAU = Math.PI * 2;

/** Where each leg stands at rest, in the creature's frame. */
export function restFeet(skeleton: SkeletonSpec): Record<string, Local> {
  const out: Record<string, Local> = {};
  for (const leg of skeleton.legs) {
    const j = skeleton.trunk.find(t => t.name === leg.hip)!.at;
    const s = leg.stance ?? [0, 0, 0];
    out[leg.name] = [j[0] + leg.offset[0] + s[0], j[1] + leg.offset[1] + s[1], s[2]];
  }
  return out;
}

/**
 * Locomotion loop for one of the skeleton's gaits: feet follow the gait's phases in place,
 * the trunk bobs, leans, pitches and flexes as the gait says, arms swing with their paired
 * legs, tails sway. `speed` is the ground speed the game must move the sprite at.
 */
export function locomotion(skeleton: SkeletonSpec, gaitName: string): Clip {
  const g: GaitSpec | undefined = skeleton.gaits[gaitName];
  if (!g) throw new Error(`skeleton "${skeleton.name}" has no gait "${gaitName}"`);
  const rest = restFeet(skeleton);
  const n = skeleton.trunk.length;
  const firstLeg = skeleton.legs[0];
  const events: ClipEvent[] = skeleton.legs.map(leg => ({ t: (1 - (g.phases[leg.name] % 1)) % 1, name: stepEvent(leg.name) }));
  // The gait's name is its kind when it is one (walk, run, ...); otherwise a flight phase makes it a run.
  const kind: ActionKind = LOCOMOTION_KINDS.includes(gaitName as ActionKind) ? (gaitName as ActionKind) : g.duty < 0.5 ? 'run' : 'walk';
  return {
    name: gaitName,
    seconds: 1 / g.cadence,
    loop: true,
    speed: groundSpeed(g),
    events: events.sort((a, b) => a.t - b.t),
    kind,
    tags: [],
    hold: false,
    drive(t: number): Drive {
      const feet: Record<string, Local> = {};
      for (const leg of skeleton.legs) {
        const c = footCycle(g, t + g.phases[leg.name]);
        const r = rest[leg.name];
        feet[leg.name] = [r[0] + c.forward, r[1], r[2] + c.up];
      }
      const trunk: Record<string, Local> = {};
      const bobWave = 0.5 - 0.5 * Math.cos(TAU * (g.bobCycles ?? 2) * (t - (g.bobPhase ?? 0)));
      const flexWave = Math.sin(TAU * (t - (g.flexPhase ?? 0)));
      skeleton.trunk.forEach((j, i) => {
        const k = n > 1 ? i / (n - 1) : 0;
        const isHead = j.name === skeleton.head;
        const bob = -(g.bob ?? 0) * (1 - bobWave) * (isHead ? 0.6 : 1);
        const flex = (g.flex ?? 0) * flexWave * (k - 0.5) * 2;
        trunk[j.name] = [(g.lean ?? 0) * k + flex, 0, bob];
      });
      const arms: Record<string, ArmDrive> = {};
      for (const arm of skeleton.arms ?? []) {
        const leg = arm.swingWith ?? firstLeg.name;
        const w = strideWarp(g, t + g.phases[leg]);
        const swing = (g.armSwing ?? 0) * Math.cos(TAU * w);
        // Runners drive the arm back further than forward.
        const pumped = swing * (swing > 0 ? 1 - 0.28 * (g.armAcross ?? 0) : 1 + 0.3 * (g.armAcross ?? 0));
        arms[arm.name] = { swing: pumped + 0.05, flex: (g.armFlex ?? 0.2) - 0.18 * Math.sin(TAU * w) * (g.armSwing ?? 0), across: g.armAcross ?? 0 };
      }
      const tails: Record<string, TailDrive> = {};
      for (const tail of skeleton.tails ?? []) tails[tail.name] = { sway: g.tailSway ?? 0, phase: TAU * t, lift: g.tailLift ?? 0 };
      const rollPhase = strideWarp(g, t + g.phases[firstLeg.name]);
      return {
        feet,
        trunk,
        arms,
        tails,
        pitch: (g.pitch ?? 0) * Math.sin(TAU * (t - (g.pitchPhase ?? 0))),
        roll: (g.roll ?? 0) * Math.cos(TAU * (rollPhase - 0.25)),
        // The first leg forward swings the opposite arm forward, which turns the shoulders away
        // from that leg (negative twist turns towards the left).
        twist: -(g.twist ?? 0) * Math.cos(TAU * rollPhase),
      };
    },
  };
}

/** Options of `idle`. */
export interface IdleOptions {
  /** Seconds per loop. Default 2. */
  seconds?: number;
  /** Breathing rise of the chest, in units. Default 0.6. */
  breath?: number;
  /** Side-to-side weight shift of the trunk, in units. Default 0.4. */
  sway?: number;
  /** Tail sway in degrees. Default 10. */
  tailSway?: number;
}

/**
 * Idle loop: breathing (the front of the trunk rises and falls once per loop), a small weight
 * shift, arms hanging with a slight swing, tails swaying slowly. The head lags the chest a little.
 */
export function idle(skeleton: SkeletonSpec, options: IdleOptions = {}): Clip {
  const breath = options.breath ?? 0.6;
  const sway = options.sway ?? 0.4;
  const n = skeleton.trunk.length;
  return {
    name: 'idle',
    seconds: options.seconds ?? 2,
    loop: true,
    speed: 0,
    events: [],
    kind: 'idle',
    tags: [],
    hold: false,
    drive(t: number): Drive {
      const b = Math.sin(TAU * t);
      const trunk: Record<string, Local> = {};
      skeleton.trunk.forEach((j, i) => {
        const k = n > 1 ? i / (n - 1) : 1;
        const lag = j.name === skeleton.head ? Math.sin(TAU * t - 0.6) : b;
        trunk[j.name] = [0, sway * Math.sin(TAU * t + 0.4) * (1 - 0.5 * k), breath * lag * k];
      });
      const arms: Record<string, ArmDrive> = {};
      for (const arm of skeleton.arms ?? []) arms[arm.name] = { swing: 0.05 + 0.025 * Math.sin(TAU * t + (arm.side > 0 ? 0.5 : 0)), flex: 0.18 };
      const tails: Record<string, TailDrive> = {};
      for (const tail of skeleton.tails ?? []) tails[tail.name] = { sway: options.tailSway ?? 10, phase: TAU * t };
      return { trunk, arms, tails };
    },
  };
}
