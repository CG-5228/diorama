/**
 * Visual effects, following docs/guides/rig/04-atlas-contract.md §5 rule 9: a character cues effects on the events of its
 * clips (`meta.data.character.effects`), each effect is a sheet (`role: 'vfx'`) with its frames across and its facings
 * down, pivoted on the effect's origin. Effects stand on the floor like actors (world units) and are drawn above their
 * floor point by their `lift`. Effect events: an effect's own sheet events fire as its frames are reached, `end` when it
 * ends, and a projectile's damage lands on the `hit` of the impact it `follows`, or where it ends when that has none.
 */

import type { Vec2 } from './contract/atlas.js';
import type { EffectCue } from './contract/character.js';
import { overFloor, shown, socketOffset, tiltOf, type Active, type Actor, type ClipEvent } from './actor.js';
import { directionOf, facingOf, frameIndex, rowFor } from './frames.js';
import type { Character, Clip, EffectSheet } from './library.js';
import { tiltFactor } from './projection.js';
import type { SheetRef } from './read.js';

/** The sheet's row that faces nearest a heading (a world yaw, like the sheets' facings); the only row of a round effect. */
export const rowOfHeading = (sheet: EffectSheet<SheetRef>, heading: number) => (sheet.rows > 1 ? Math.min(sheet.rows - 1, rowFor(sheet.atlas, heading)) : 0);

/** Whether a character cues effects at all: a character that does keeps the generic rings out of its way. */
export const hasCues = (character: Character<SheetRef> | null) => !!character && Object.values(character.effects).some((cues) => cues.length > 0);

/** The cues of a clip that play on an event. */
export const cuesOn = (character: Character<SheetRef> | null, clipKey: string, name: string): EffectCue[] => (character?.effects[clipKey] ?? []).filter((cue) => cue.on === name);

/** A playing effect. */
export interface Fx<A extends SheetRef = SheetRef> {
  sheet: EffectSheet<A>;
  /** The point on the floor under its origin (world units): where it is sorted among what stands, and what the floor stops. */
  pos: Vec2;
  /**
   * Logical px its origin is drawn above that point: the height of the socket it left from (the actor's floor point less
   * the socket's y on the screen), never the effect's own `height`.
   */
  lift: number;
  /** The sheet's row it shows. */
  row: number;
  /** Seconds since it began. */
  age: number;
  motion: 'stay' | 'follow' | 'fly';
  /** `follow`: the actor whose socket it tracks. */
  follow?: { actor: Actor<A>; socket: string };
  /** A looping effect ends with the action it was cued in (or when the actor changes its base clip). */
  until?: { actor: Actor<A>; act: Active<A> | null; clip: Clip<A> };
  /** `fly`: velocity on the floor in world units per second, world units flown and the range they end at. */
  fly?: { vx: number; vy: number; flown: number; speed: number; range: number };
  /** The character that cued it: its camera sets how a depth distance reads on the screen. */
  character: Character<A> | null;
  /** The projectile it plays where that one ended (an impact); null for a cued effect. */
  from: Fx<A> | null;
  /** The last frame whose events were fired. */
  fired: number;
  done: boolean;
}

/** Something an effect did: one of its sheet's events (`hit` on an impact's frame), `end`, or a projectile's `hit` where it ended. */
export interface FxEvent<A extends SheetRef = SheetRef> {
  fx: Fx<A>;
  name: string;
  frame: number;
  /** Where on the floor it happened. */
  pos: Vec2;
}

/** Everything a step needs to know about the world around the effects. */
export interface FxWorld<A extends SheetRef = SheetRef> {
  /** The effect sheets by id: what a projectile plays where it ends (`follows`). */
  effects: Map<string, EffectSheet<A>>;
  /**
   * Where the floor stops a projectile flying from one floor point to another: the last point it reaches before a cell
   * that cannot be entered, a wall or a shut door (`flightStop`), or null when the way is clear.
   */
  blocked?: (from: Vec2, to: Vec2, fx: Fx<A>) => Vec2 | null;
}

/** Projectiles without a range fly this far (world units) before they end. */
const DEFAULT_RANGE = 150;
/** Where an effect starts on a clip without sockets: this many px of the sheet above the feet. */
const NO_SOCKET_PX = 60;

/**
 * How high an origin is above the floor under it, on the screen: the socket's position with its height dropped lands on
 * the actor's floor point (contract §5 rule 9), so it is the distance down to the actor's feet (in either's units).
 */
export const liftAt = (actor: { y: number }, origin: { y: number }) => Math.max(0, actor.y - origin.y);

const socketNamed = (cue: EffectCue, siblings: string[]) => cue.at ?? siblings.find((n) => n.startsWith('spawn:'))?.slice('spawn:'.length) ?? 'center';

/** Where the cue starts, relative to the actor's feet (logical px of the screen): its socket, the `spawn:<socket>` of its frame, the centre, or the feet. */
function originOf<A extends SheetRef>(event: ClipEvent<A>, cue: EffectCue): Vec2 {
  const { actor, clip, row, frame, siblings } = event;
  const named = socketNamed(cue, siblings);
  if (named === 'feet') return { x: 0, y: 0 };
  const point = socketOffset(actor, clip, row, frame, named) ?? socketOffset(actor, clip, row, frame, 'center');
  return point ?? { x: 0, y: -NO_SOCKET_PX / (actor.character?.scale ?? actor.clip.scale) };
}

/**
 * The effects a clip's event cues, ready to play: `stay` where it started, `follow` its socket, `fly` along the facing the
 * action started with (`event.row`) at the sheet's travel speed. `aim` points a `fly` cue at a floor point instead: it
 * heads there and shows the row nearest that heading. Cues whose sheets are not in `effects` play nothing.
 */
export function cues<A extends SheetRef>(event: ClipEvent<A>, effects: Map<string, EffectSheet<A>>, o: { aim?: Vec2 } = {}): Fx<A>[] {
  const fx: Fx<A>[] = [];
  const { actor } = event;
  const character = actor.character;
  for (const cue of cuesOn(character, event.clip.key, event.name)) {
    const sheet = effects.get(cue.effect);
    if (!sheet) continue;
    const { pos, lift } = overFloor(event.pos, originOf(event, cue), tiltOf(actor));
    const motion = cue.motion ?? 'stay';
    const heading = facingOf(event.clip.atlas, event.row);
    const base: Fx<A> = { sheet, pos, lift, row: 0, age: 0, motion, character, from: null, fired: -1, done: false };
    if (motion === 'fly' && sheet.travel) {
      const aimed = o.aim ? Math.atan2(o.aim.y - pos.y, o.aim.x - pos.x) : heading;
      const speed = sheet.travel.speed;
      const along = directionOf(aimed);
      base.row = rowOfHeading(sheet, aimed);
      base.fly = { vx: along.x * speed, vy: along.y * speed, flown: 0, speed, range: sheet.travel.range ?? DEFAULT_RANGE };
    } else if (motion === 'follow') {
      base.follow = { actor, socket: socketNamed(cue, event.siblings) };
      base.row = rowOfHeading(sheet, heading);
    } else {
      base.motion = motion === 'fly' ? 'stay' : motion;
      base.row = rowOfHeading(sheet, heading);
    }
    // A loop plays until the action it was cued in is over; cued by a base clip's event, until the actor leaves the clip
    // that fired it (`clip`: the base clip the actor is in, which an action's loop never looks at).
    if (sheet.loop && base.motion !== 'fly') base.until = { actor, act: event.act, clip: event.act ? actor.clip : event.clip };
    fx.push(base);
  }
  return fx;
}

/** The frame an effect shows at an age: a loop wraps, a one-shot holds its last until it is done. */
export const frameOfFx = (fx: { sheet: EffectSheet<SheetRef>; age: number }) => {
  const frame = Math.floor(fx.age * fx.sheet.fps);
  return fx.sheet.loop ? frame % fx.sheet.frames : Math.min(frame, fx.sheet.frames - 1);
};

/** The effect that follows a projectile where it ended, played once at the point it ended at. */
function impactOf<A extends SheetRef>(fx: Fx<A>, at: Vec2, sheets: Map<string, EffectSheet<A>>): Fx<A> | null {
  const next = fx.sheet.follows ? sheets.get(fx.sheet.follows) : undefined;
  if (!next) return null;
  const heading = fx.fly ? Math.atan2(fx.fly.vy, fx.fly.vx) : 0;
  return { sheet: next, pos: { x: at.x, y: at.y }, lift: fx.lift, row: rowOfHeading(next, heading), age: 0, motion: 'stay', character: fx.character, from: fx, fired: -1, done: false };
}

/**
 * Keeps a following effect where it is drawn when its socket is not in the frame shown, its lift measured again from the
 * actor's feet: drawn above them, it stands on the actor's floor point (as `overFloor` puts a socket); below, on the floor.
 */
function keepDrawn<A extends SheetRef>(fx: Fx<A>, actor: Actor<A>) {
  const ky = tiltFactor(tiltOf(actor));
  const drawnY = fx.pos.y * ky - fx.lift;
  const feetY = actor.pos.y * ky;
  fx.lift = liftAt({ y: feetY }, { y: drawnY });
  fx.pos = { x: fx.pos.x, y: drawnY <= feetY ? actor.pos.y : drawnY / ky };
}

/** Fires the sheet events of every frame an effect reached since the last step (a loop's every lap, at most one lap per step). */
function fireFx<A extends SheetRef>(fx: Fx<A>, out: FxEvent<A>[]) {
  const { frames, loop, events } = fx.sheet;
  if (!events.length) return;
  const total = Math.floor(fx.age * fx.sheet.fps);
  const last = loop ? total : Math.min(total, frames - 1);
  for (let f = Math.max(fx.fired + 1, last - frames + 1); f <= last; f++) {
    const frame = f % frames;
    for (const event of events) if (event.frame === frame) out.push({ fx, name: event.name, frame, pos: { x: fx.pos.x, y: fx.pos.y } });
  }
  fx.fired = Math.max(fx.fired, last);
}

/**
 * Moves the effects on by `dt` seconds. A projectile flies along its heading until its range runs out or the world stops
 * it, and plays the effect it `follows` there; a following effect tracks its socket; a looping one ends with the action
 * it was cued in; a one-shot ends after its last frame. Returns the effects still playing and what they did.
 */
export function stepFx<A extends SheetRef>(effects: Fx<A>[], dt: number, world: FxWorld<A>): { fx: Fx<A>[]; events: FxEvent<A>[] } {
  const alive: Fx<A>[] = [];
  const spawned: Fx<A>[] = [];
  const events: FxEvent<A>[] = [];
  for (const fx of effects) {
    fx.age += dt;
    if (fx.until) {
      const { actor, act, clip } = fx.until;
      const same = act ? actor.act === act : actor.act === null && actor.clip === clip;
      if (!same) fx.done = true;
    }
    if (fx.follow && !fx.done) {
      const { actor, socket } = fx.follow;
      if (socket === 'feet') {
        fx.pos = { x: actor.pos.x, y: actor.pos.y };
        fx.lift = 0;
      } else {
        const now = shown(actor);
        const offset = socketOffset(actor, now.clip, now.row, frameIndex(now.clip, now.time, now.loops), socket);
        if (offset) Object.assign(fx, overFloor(actor.pos, offset, tiltOf(actor)));
        else keepDrawn(fx, actor);
      }
    }
    let ended: Vec2 | null = null;
    if (fx.fly && !fx.done) {
      const to = { x: fx.pos.x + fx.fly.vx * dt, y: fx.pos.y + fx.fly.vy * dt };
      fx.fly.flown += fx.fly.speed * dt;
      const stop = world.blocked?.(fx.pos, to, fx) ?? null;
      if (stop || fx.fly.flown >= fx.fly.range) {
        ended = stop ?? to;
        const impact = impactOf(fx, ended, world.effects);
        if (impact) spawned.push(impact);
        // Damage lands on the impact's `hit`; with none to play it, where the projectile ended.
        if (!impact?.sheet.events.some((e) => e.name === 'hit')) events.push({ fx, name: 'hit', frame: frameOfFx(fx), pos: { x: ended.x, y: ended.y } });
        fx.done = true;
      } else {
        fx.pos = to;
      }
    }
    if (!fx.done) fireFx(fx, events);
    if (!fx.sheet.loop && !fx.fly && fx.age * fx.sheet.fps >= fx.sheet.frames) fx.done = true;
    if (fx.done) events.push({ fx, name: 'end', frame: frameOfFx(fx), pos: ended ?? { x: fx.pos.x, y: fx.pos.y } });
    else alive.push(fx);
  }
  return { fx: [...alive, ...spawned], events };
}
