import type { Atlas, EffectCue, EffectMeta, Rect } from '../atlas';
import { clipFrames } from '../atlas';
import type { AssetFileMeta } from '../types';
import { facingOf, frameIndex, rowFor, shown, type Active, type Actor, type ClipEvent } from './actor';
import { socketPoint } from './effects';
import type { Character, Clip } from './library';

/**
 * Visual effects in the playground, following docs/guides/rig/04-atlas-contract.md §5 rule 9: a character cues effects on
 * the events of its clips (`meta.data.character.effects`), each effect is a sheet (`role: 'vfx'`) with its frames across
 * and its facings down, pivoted on the effect's origin. This module is pure: the scene calls it with the actors, the time
 * and what the floor allows, and draws what it returns.
 */

/** An effect's sheet, read from its atlas. */
export interface EffectSheet {
  id: string;
  asset: AssetFileMeta;
  atlas: Atlas;
  kind: string;
  frames: number;
  fps: number;
  loop: boolean;
  layer: 'ground' | 'air';
  /** World units: where the effect draws its own floor marks (a projectile's pool of light is this far below its origin). It does not place the effect: the origin goes on the socket. */
  height: number;
  /** Radius it reaches, world units. */
  size: number;
  events: { frame: number; name: string }[];
  travel: { speed: number; range: number | undefined } | null;
  /** The effect played where this one ends. */
  follows: string | null;
  /** Exported px per world unit. */
  scale: number;
  /** The effect's origin inside a frame, exported px. */
  pivot: { x: number; y: number };
  /** How many rows (facings) the sheet has. */
  rows: number;
  /** The frames of one row. */
  rects: (row: number) => Rect[];
}

/** Where a kind of effect is drawn when its sheet does not say: area and cast effects on the ground, the rest sorted in among the things standing. */
const GROUND_KINDS = new Set(['area', 'cast']);

/** The effect a sheet describes, or null when it is not an effect sheet. */
export function effectSheetOf(asset: AssetFileMeta, atlas: Atlas): EffectSheet | null {
  const data = atlas.meta.data;
  if (data?.role !== 'vfx') return null;
  const meta: Partial<EffectMeta> = data.effect ?? {};
  const kind = meta.kind ?? 'burst';
  const frames = meta.frames ?? atlas.meta.frameCount ?? 1;
  const cache = new Map<number, Rect[]>();
  const scale = atlas.meta.scale ?? 1;
  const frameWidth = atlas.meta.frameWidth ?? 0;
  const frameHeight = atlas.meta.frameHeight ?? 0;
  return {
    id: meta.id ?? asset.subpath.split('/').pop()!.replace(/\.[^.]+$/, ''),
    asset,
    atlas,
    kind,
    frames,
    fps: meta.fps ?? atlas.meta.fps ?? 12,
    loop: meta.loop ?? false,
    layer: meta.layer ?? (GROUND_KINDS.has(kind) ? 'ground' : 'air'),
    height: meta.height ?? 0,
    size: meta.size ?? 0,
    events: meta.events ?? [],
    travel: meta.travel ? { speed: meta.travel.speed, range: meta.travel.range } : null,
    follows: meta.follows ?? null,
    scale,
    pivot: atlas.meta.pivot ? { x: atlas.meta.pivot.x, y: atlas.meta.pivot.y } : { x: frameWidth / 2, y: frameHeight / 2 },
    rows: Math.max(1, atlas.meta.directions?.length ?? 1),
    rects: (row) => {
      let rects = cache.get(row);
      if (!rects) cache.set(row, (rects = clipFrames(atlas, 'default', Math.min(row, Math.max(0, (atlas.meta.directions?.length ?? 1) - 1)))));
      return rects;
    },
  };
}

/** The sheet's row that faces nearest a heading (a screen angle, like the sheets' facings); the only row of a round effect. */
export const rowOfHeading = (sheet: EffectSheet, heading: number) => (sheet.rows > 1 ? Math.min(sheet.rows - 1, rowFor(sheet.atlas, heading)) : 0);

/** Whether a character cues effects at all: a character that does keeps the generic rings out of its way. */
export const hasCues = (character: Character | null) => !!character && Object.values(character.effects).some((cues) => cues.length > 0);

/** The cues of a clip that play on an event. */
export const cuesOn = (character: Character | null, clipKey: string, name: string): EffectCue[] => (character?.effects[clipKey] ?? []).filter((cue) => cue.on === name);

/** A playing effect. Positions are the effect's origin on the screen, in actor units (exported pixels). */
export interface Fx {
  sheet: EffectSheet;
  x: number;
  y: number;
  /** The sheet's row it shows. */
  row: number;
  /** Seconds since it began. */
  age: number;
  motion: 'stay' | 'follow' | 'fly';
  /**
   * Screen pixels its origin lies above the floor under it: the height of the socket it left from (the actor's floor point less
   * the socket's y), never the effect's own `height`. It is where the effect stands for depth, and for what blocks it.
   */
  lift: number;
  /** `follow`: the actor whose socket it tracks. */
  follow?: { actor: Actor; socket: string };
  /** A looping effect ends with the action it was cued in (or when the actor changes its base clip). */
  until?: { actor: Actor; act: Active | null; clip: Clip };
  /** `fly`: velocity in actor units per second, world units flown and the range they end at. */
  fly?: { vx: number; vy: number; flown: number; speed: number; range: number };
  /** The character that cued it: its camera sets how a depth distance reads on the screen. */
  character: Character | null;
  done: boolean;
}

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

/** Projectiles without a range fly this far (world units) before they end. */
const DEFAULT_RANGE = 150;

/**
 * How high an origin on an actor's socket is above the floor under it, on the screen: the socket's position with its height
 * dropped lands on the actor's floor point (contract §5 rule 9), so it is the distance down to the actor's feet.
 */
export const liftAt = (actor: Pick<Actor, 'y'>, origin: { y: number }) => Math.max(0, actor.y - origin.y);

const tiltFactor = (character: Character | null) => Math.sin(((character?.tilt ?? 48) * Math.PI) / 180);

/** The point the cue starts at: its socket (or the `spawn:<socket>` of its frame, else the centre) or the feet; null when there is none to be found. */
function originOf(event: ClipEvent, cue: EffectCue): { x: number; y: number } | null {
  const { actor, clip, row, frame, siblings } = event;
  const named = cue.at ?? siblings.find((n) => n.startsWith('spawn:'))?.slice('spawn:'.length) ?? 'center';
  if (named === 'feet') return { x: actor.x, y: actor.y };
  const point = socketPoint(actor, clip, row, frame, named) ?? socketPoint(actor, clip, row, frame, 'center');
  return point ? { x: point.x, y: point.y } : { x: actor.x, y: actor.y - 60 };
}

/**
 * The effects a clip's event cues, ready to play: `stay` where it started, `follow` its socket, `fly` along the facing the
 * action started with (`event.row`), at the sheet's travel speed, its depth part shrunk by the camera's tilt.
 * `missing` lists the cues whose sheets are not in the project: nothing to play for them.
 */
export function playCues(event: ClipEvent, character: Character | null, sheets: Map<string, EffectSheet>): { fx: Fx[]; missing: string[] } {
  const fx: Fx[] = [];
  const missing: string[] = [];
  for (const cue of cuesOn(character, event.clip.key, event.name)) {
    const sheet = sheets.get(cue.effect);
    if (!sheet) {
      missing.push(cue.effect);
      continue;
    }
    const origin = originOf(event, cue);
    if (!origin) continue;
    const motion = cue.motion ?? 'stay';
    const heading = facingOf(event.clip.atlas, event.row);
    const base: Fx = { sheet, x: origin.x, y: origin.y, row: 0, age: 0, motion, lift: liftAt(event.actor, origin), character, done: false };
    if (motion === 'fly' && sheet.travel) {
      const speed = sheet.travel.speed * sheet.scale;
      base.row = rowOfHeading(sheet, heading);
      base.fly = { vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed * tiltFactor(character), flown: 0, speed: sheet.travel.speed, range: sheet.travel.range ?? DEFAULT_RANGE };
    } else if (motion === 'follow') {
      base.follow = { actor: event.actor, socket: cue.at ?? event.siblings.find((n) => n.startsWith('spawn:'))?.slice('spawn:'.length) ?? 'center' };
      base.row = rowOfHeading(sheet, heading);
    } else {
      base.motion = motion === 'fly' ? 'stay' : motion;
      base.row = rowOfHeading(sheet, heading);
    }
    // A loop plays until the action it was cued in is over.
    if (sheet.loop && base.motion !== 'fly') base.until = { actor: event.actor, act: event.actor.act, clip: event.actor.clip };
    fx.push(base);
  }
  return { fx, missing };
}

/** The frame an effect shows at an age: a loop wraps, a one-shot holds its last until it is done. */
export const frameOfFx = (fx: Pick<Fx, 'sheet' | 'age'>) => {
  const frame = Math.floor(fx.age * fx.sheet.fps);
  return fx.sheet.loop ? frame % fx.sheet.frames : Math.min(frame, fx.sheet.frames - 1);
};

/** Where the effect stands on the floor, for sorting it among what stands: the point under its origin. */
export const floorY = (fx: Pick<Fx, 'y' | 'lift'>) => fx.y + fx.lift;

/** The effect that follows a projectile where it ended, played once at the point it ended at. */
function impactOf(fx: Fx, at: { x: number; y: number }, sheets: Map<string, EffectSheet>, character: Character | null): Fx | null {
  const next = fx.sheet.follows ? sheets.get(fx.sheet.follows) : undefined;
  if (!next) return null;
  const heading = fx.fly ? Math.atan2(fx.fly.vy / tiltFactor(character), fx.fly.vx) : 0;
  return { sheet: next, x: at.x, y: at.y, row: rowOfHeading(next, heading), age: 0, motion: 'stay', lift: fx.lift, character, done: false };
}

/**
 * Moves the effects on by `dt` seconds. A projectile flies along its heading until its range runs out, it leaves the view
 * or the floor stops it, and plays the effect it `follows` there; a following effect tracks its socket; a looping one ends
 * with the action it was cued in; a one-shot ends after its last frame. Returns the effects still playing.
 */
export function stepFx(effects: Fx[], dt: number, world: FxWorld): Fx[] {
  const alive: Fx[] = [];
  const spawned: Fx[] = [];
  for (const fx of effects) {
    const { character } = fx;
    fx.age += dt;
    if (fx.until) {
      const { actor, act, clip } = fx.until;
      const same = act ? actor.act === act : actor.act === null && actor.clip === clip;
      if (!same) fx.done = true;
    }
    if (fx.follow && !fx.done) {
      const { actor, socket } = fx.follow;
      if (socket === 'feet') [fx.x, fx.y] = [actor.x, actor.y];
      else {
        const now = shown(actor);
        const point = socketPoint(actor, now.clip, now.row, frameIndex(now.clip, now.time, now.loops), socket);
        if (point) [fx.x, fx.y] = [point.x, point.y];
      }
      fx.lift = liftAt(actor, fx);
    }
    if (fx.fly && !fx.done) {
      const step = { x: fx.fly.vx * dt, y: fx.fly.vy * dt };
      const to = { x: fx.x + step.x, y: fx.y + step.y };
      fx.fly.flown += fx.fly.speed * dt;
      const stop = world.blocked?.({ x: fx.x, y: fx.y + fx.lift }, { x: to.x, y: to.y + fx.lift });
      const outside = to.x < 0 || to.x > world.bounds.width || to.y + fx.lift < 0 || to.y + fx.lift > world.bounds.height;
      if (stop || outside || fx.fly.flown >= fx.fly.range) {
        const end = stop ? { x: stop.x, y: stop.y - fx.lift } : { x: Math.max(0, Math.min(world.bounds.width, to.x)), y: Math.max(-fx.lift, Math.min(world.bounds.height - fx.lift, to.y)) };
        const impact = impactOf(fx, end, world.sheets, character);
        if (impact) spawned.push(impact);
        fx.done = true;
      } else {
        fx.x = to.x;
        fx.y = to.y;
      }
    }
    if (!fx.sheet.loop && !fx.fly && fx.age * fx.sheet.fps >= fx.sheet.frames) fx.done = true;
    if (!fx.done) alive.push(fx);
  }
  return [...alive, ...spawned];
}
