import {
  cues, cuesOn, effectSheetOf as effectSheetFrom, facingOf, frameIndex, liftAt, rowOfHeading, shown, stepFx as stepRuntimeFx,
  type ClipEvent as RuntimeClipEvent, type EffectCue, type EffectSheet as RuntimeEffectSheet, type Fx as RuntimeFx, type Vec2,
} from '@diorama/runtime';
import type { Atlas } from '../atlas';
import type { AssetFileMeta } from '../types';
import type { Actor, ClipEvent } from './actor';
import { socketPoint } from './effects';
import type { Character } from './library';
import { drawnOf, floorAt, fxInView, placeFx, sheetRef, velocityOf, viewOfFx, type AssetRef, type Drawn, type Fx } from './view';

/**
 * Visual effects in the playground: the runtime's effects (`@diorama/runtime`, contract §5 rule 9: cues on events, stay,
 * follow, fly) in the view's actor units. The runtime decides what plays, its rows, ages and ends, what follows what and
 * where a projectile is stopped; the view draws each effect where it draws the frame it came from: on the socket of the
 * frame that cued it (`effects.ts: socketPoint`), on its socket frame by frame for one that follows, moved by its
 * velocity in actor units for a projectile, and where that one ended for its impact, which faces the way the projectile
 * crossed the view. The scene calls it with the actors' events, the time and what the view and the floor allow, and draws
 * what it returns.
 */

export { frameOfFx, hasCues } from '@diorama/runtime';
export type { Fx };

export type EffectSheet = RuntimeEffectSheet<AssetRef>;

/** The effect an exported asset's atlas describes, or null when it is not an effect sheet. */
export const effectSheetOf = (asset: AssetFileMeta, atlas: Atlas): EffectSheet | null => effectSheetFrom(sheetRef(asset), atlas);

/** Everything a step needs to know about the world around the effects. */
export interface FxWorld {
  sheets: Map<string, EffectSheet>;
  /** The view: effects that leave it end. */
  bounds: { width: number; height: number };
  /**
   * Where the floor stops something flying along a floor path (actor units, floor points): the last point it can reach
   * before a cell that cannot be entered, a wall or a shut door; null when the way is clear.
   */
  blocked?: (from: { x: number; y: number }, to: { x: number; y: number }) => { x: number; y: number } | null;
}

/** The socket a cue plays at: its own, else the `spawn:<socket>` of the frame that fired, else the centre. */
const socketNamed = (cue: EffectCue, siblings: string[]) => cue.at ?? siblings.find((n) => n.startsWith('spawn:'))?.slice('spawn:'.length) ?? 'center';

/** Where an effect starts on a frame without the socket or a centre: this many actor units above the feet. */
const NO_SOCKET = 60;

/** Where the view draws a cue's effect as it starts: on its socket in the frame that fired (else the centre), or at the feet. */
function startOf(event: ClipEvent, cue: EffectCue): Drawn {
  const { actor, clip, row, frame } = event;
  const named = socketNamed(cue, event.siblings);
  const origin = named === 'feet' ? { x: actor.x, y: actor.y } : (socketPoint(actor, clip, row, frame, named) ?? socketPoint(actor, clip, row, frame, 'center') ?? { x: actor.x, y: actor.y - NO_SOCKET });
  return { x: origin.x, y: origin.y, lift: liftAt(actor, origin) };
}

/**
 * The effects a clip's event cues, ready to play in the view. `missing` lists the cues whose sheets are not in the
 * project: nothing to play for them. The view draws an effect sheet at its own export scale, so a projectile crosses the
 * view at its own sheet's rate (`travel.speed × meta.scale` px per second, the depth part shrunk by the tilt), whatever
 * the scale of the character that cued it; it ends after the same time, at `travel.range`.
 */
export function playCues(event: ClipEvent, character: Character | null, sheets: Map<string, EffectSheet>): { fx: Fx[]; missing: string[] } {
  const missing = cuesOn(character, event.clip.key, event.name).filter((cue) => !sheets.has(cue.effect)).map((cue) => cue.effect);
  // The runtime plays the cues of the actor's character whose sheets are there, in their order.
  const playing = cuesOn(event.actor.character, event.clip.key, event.name).filter((cue) => sheets.has(cue.effect));
  const played = cues(event as RuntimeClipEvent<AssetRef>, sheets);
  const heading = facingOf(event.clip.atlas, event.row);
  played.forEach((fx, i) => {
    let velocity: Vec2 | undefined;
    if (fx.fly) {
      const view = viewOfFx(fx);
      const own = fx.sheet.scale / view.scale;
      fx.fly.vx *= own;
      fx.fly.vy *= own;
      const speed = fx.fly.speed * fx.sheet.scale;
      velocity = { x: Math.cos(heading) * speed, y: Math.sin(heading) * speed * view.ky };
    }
    placeFx(fx, startOf(event, playing[i]), velocity);
  });
  return { fx: played.map((fx) => fxInView(fx)), missing };
}

/** Where the effect stands on the floor, for sorting it among what stands: the point under its origin. */
export const floorY = (fx: Pick<Fx, 'y' | 'lift'>) => fx.y + fx.lift;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Where the view draws a following effect after a step: on its socket in the frame shown now (where it was, when that frame has none), at its height above the feet. */
function following(fx: RuntimeFx<AssetRef>, was: Drawn): Drawn {
  const { socket } = fx.follow!;
  const actor = fx.follow!.actor as Actor;
  const now = shown(actor);
  const point = socket === 'feet' ? { x: actor.x, y: actor.y } : (socketPoint(actor, now.clip, now.row, frameIndex(now.clip, now.time, now.loops), socket) ?? was);
  return { x: point.x, y: point.y, lift: liftAt(actor, point) };
}

/**
 * Moves the effects on by `dt` seconds. A projectile ends where its range runs out, where the floor stops it or where it
 * leaves the view (at its edge), and plays the effect it `follows` there. Returns the effects still playing.
 */
export function stepFx(effects: Fx[], dt: number, world: FxWorld): Fx[] {
  const before = new Map(effects.map((e) => [e.fx, drawnOf(e.fx)]));
  // Where each projectile is drawn after this step if it flies on (`ahead`), and where it ended if it stops (`end`).
  const flights = new Map<RuntimeFx<AssetRef>, { ahead: Vec2; end: Vec2 }>();
  const { fx } = stepRuntimeFx(
    effects.map((e) => e.fx),
    dt,
    {
      effects: world.sheets,
      blocked: (_from, _to, flying) => {
        const was = before.get(flying)!;
        const velocity = velocityOf(flying)!;
        const ahead = { x: was.x + velocity.x * dt, y: was.y + velocity.y * dt };
        const { width, height } = world.bounds;
        // The floor points under the origin, and the view's edges, in actor units.
        const stop = world.blocked?.({ x: was.x, y: was.y + was.lift }, { x: ahead.x, y: ahead.y + was.lift }) ?? null;
        const outside = ahead.x < 0 || ahead.x > width || ahead.y + was.lift < 0 || ahead.y + was.lift > height;
        const end = stop ? { x: stop.x, y: stop.y - was.lift } : { x: clamp(ahead.x, 0, width), y: clamp(ahead.y, -was.lift, height - was.lift) };
        flights.set(flying, { ahead, end });
        return stop || outside ? floorAt(viewOfFx(flying), { x: end.x, y: end.y + was.lift }) : null;
      },
    },
  );
  for (const playing of fx) {
    const ended = playing.from ? flights.get(playing.from) : undefined;
    const flight = flights.get(playing);
    if (ended) {
      // The impact's row faces the projectile's heading on the floor, read from its velocity in the view (the depth part
      // grown back by the tilt): a shot halfway between two of the impact's rows shows the one it always showed here.
      const from = playing.from!;
      const velocity = velocityOf(from)!;
      playing.row = rowOfHeading(playing.sheet, Math.atan2(velocity.y / viewOfFx(from).ky, velocity.x));
      placeFx(playing, { ...ended.end, lift: before.get(from)!.lift });
    } else if (flight) placeFx(playing, { ...flight.ahead, lift: before.get(playing)!.lift });
    else if (playing.follow) placeFx(playing, following(playing, before.get(playing)!));
  }
  return fx.map((playing) => fxInView(playing));
}
