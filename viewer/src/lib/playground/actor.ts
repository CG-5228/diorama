import type { Atlas } from '../atlas';
import { DEFAULT_TILT, type Character, type Clip } from './library';

/** An action in progress. It remembers the facing it started with: root motion follows that, not the input. */
export interface Active {
  clip: Clip;
  time: number;
  row: number;
  /** Root motion already applied, in exported px along the facing. */
  travelled: number;
  /** The last frame whose events were fired. */
  fired: number;
}

export interface LastEvent {
  name: string;
  clip: string;
  frame: number;
}

/** One thing standing on the scene. Position is the anchor, in exported pixels. */
export interface Actor {
  id: number;
  /** The looping clip shown when no action plays: idle, or the gait being walked. */
  clip: Clip;
  x: number;
  y: number;
  /** Direction row of the sheet. */
  row: number;
  /** Seconds into the base clip. */
  time: number;
  act: Active | null;
  /** A `hold` clip that finished: it stays on its last frame until the actor is reset. */
  held: Active | null;
  character: Character | null;
  lastEvent: LastEvent | null;
  /** The base clip whose events (`step:<leg>`) were last fired, and how many of its frames went by since it started. */
  baseClip: Clip | null;
  baseFired: number;
}

export interface Input {
  dx: number;
  dy: number;
  run: boolean;
}

export interface ClipEvent {
  actor: Actor;
  clip: Clip;
  row: number;
  frame: number;
  name: string;
  /** Every event name of the same frame: `release` comes with the `spawn:<socket>` that says where. */
  siblings: string[];
}

export type Emit = (event: ClipEvent) => void;

const TAU = Math.PI * 2;
/** Exported pixels kept between the anchor and the side edges of the scene. */
const EDGE = 60;
/** Room kept between the anchor and the scene's side edges: what the sprite sticks out of its anchor, at most a third of the scene. */
function sideRoom(clip: Clip, bounds: Bounds) {
  const { frameWidth = 0, pivot } = clip.atlas.meta;
  const anchor = pivot?.x ?? frameWidth / 2;
  const cap = bounds.width / 3;
  return { left: Math.min(Math.max(EDGE, anchor), cap), right: Math.min(Math.max(EDGE, frameWidth - anchor), cap) };
}

const clampX = (x: number, clip: Clip, bounds: Bounds) => {
  const { left, right } = sideRoom(clip, bounds);
  return Math.max(left, Math.min(bounds.width - right, x));
};

/**
 * How much a ground distance shrinks along the screen's vertical (contract §5.2): moving across the screen keeps its
 * length, moving up or down it is multiplied by the sine of the camera tilt, so planted feet stay planted.
 */
const squash = (actor: Actor) => Math.sin(((actor.character?.tilt ?? DEFAULT_TILT) * Math.PI) / 180);

const angleBetween = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/**
 * The direction row that faces a heading. Headings are screen angles (x right, y down), which is how the
 * sheets store facing: row 0 (S) looks at the camera, π/2, and every next row turns clockwise on screen.
 */
export function rowFor(atlas: Atlas, heading: number): number {
  const facings = atlas.meta.directionFacings ?? [];
  let best = 0;
  facings.forEach((facing, row) => {
    if (angleBetween(facing % TAU, heading) < angleBetween(facings[best] % TAU, heading)) best = row;
  });
  return best;
}

/** The heading a row faces, as a screen angle. */
export const facingOf = (atlas: Atlas, row: number) => atlas.meta.directionFacings?.[row] ?? Math.PI / 2;

export function frameIndex(clip: Clip, time: number, loops: boolean): number {
  const frame = Math.floor(time * clip.fps);
  return loops ? frame % clip.frameCount : Math.min(frame, clip.frameCount - 1);
}

/** death beats hit beats every other action; locomotion and idle are not actions at all. */
export const priorityOf = (clip: Clip) => (clip.kind === 'death' ? 4 : clip.kind === 'hit' ? 3 : 2);

const cancellable = (act: Active) => act.clip.cancelFrame !== null && Math.floor(act.time * act.clip.fps) >= act.clip.cancelFrame;

/** What is being drawn for an actor right now. */
export function shown(actor: Actor) {
  const act = actor.held ?? actor.act;
  if (act) return { clip: act.clip, row: act.row, time: actor.held ? act.clip.frameCount / act.clip.fps : act.time, loops: false };
  return { clip: actor.clip, row: actor.row, time: actor.time, loops: true };
}

/** The frame an actor is showing right now, and where its anchor sits inside that frame. */
export function currentFrame(actor: Actor) {
  const { clip, row, time, loops } = shown(actor);
  const rects = clip.rects(row);
  const index = frameIndex(clip, time, loops);
  const rect = rects[index] ?? rects[0];
  const pivot = clip.atlas.meta.pivot ?? { x: rect.width / 2, y: rect.height };
  return { clip, rect, pivot, row, index };
}

export function newActor(id: number, clip: Clip, x: number, y: number, character: Character | null = null, row = 0): Actor {
  return { id, clip, x, y, row, time: 0, act: null, held: null, character, lastEvent: null, baseClip: null, baseFired: -1 };
}

/**
 * Whether a clip may start now. Death and hit interrupt anything (a hit cannot follow death); any other action
 * only replaces a lower or equal one from its `cancel` event on, or once it has ended. A held clip is final.
 */
export function canStart(actor: Actor, clip: Clip): boolean {
  if (actor.held) return false;
  const current = actor.act;
  if (!current) return true;
  if (clip.kind === 'death') return current.clip.kind !== 'death';
  if (clip.kind === 'hit') return current.clip.kind !== 'death';
  return priorityOf(clip) >= priorityOf(current.clip) && cancellable(current);
}

export function startClip(actor: Actor, clip: Clip | null | undefined, emit: Emit): boolean {
  if (!clip || !canStart(actor, clip)) return false;
  actor.act = { clip, time: 0, row: actor.row, travelled: 0, fired: -1 };
  // `start` is not an event of the sheet: it is the moment the action begins, which effects can be cued on.
  emit({ actor, clip, row: actor.act.row, frame: 0, name: 'start', siblings: [] });
  fire(actor, actor.act, emit);
  return true;
}

/** Back to idle: forgets the action, the frozen clip and the facing of the last event. */
export function reset(actor: Actor) {
  actor.act = null;
  actor.held = null;
  actor.time = 0;
  actor.lastEvent = null;
  actor.baseClip = null;
  const idle = actor.character?.idle;
  if (idle) actor.clip = idle;
}

/** Fires the events of every frame reached since the last call. */
function fire(actor: Actor, act: Active, emit: Emit) {
  const reached = Math.min(Math.floor(act.time * act.clip.fps), act.clip.frameCount - 1);
  for (let frame = act.fired + 1; frame <= reached; frame++) {
    const names = act.clip.events.filter((e) => e.frame === frame).map((e) => e.name);
    for (const name of names) {
      actor.lastEvent = { name, clip: act.clip.key, frame };
      emit({ actor, clip: act.clip, row: act.row, frame, name, siblings: names });
    }
  }
  act.fired = reached;
}

/** Root motion: the distance this action has covered by now, along the facing it started with. */
function travel(actor: Actor, act: Active, bounds: Bounds) {
  const { travel: path, fps, frameCount } = act.clip;
  if (!path) return;
  const f = Math.min(act.time * fps, frameCount);
  const i = Math.floor(f);
  const covered = path[i] + ((path[Math.min(i + 1, frameCount)] ?? path[i]) - path[i]) * (f - i);
  const heading = facingOf(act.clip.atlas, act.row);
  place(actor, bounds, clampX(actor.x + Math.cos(heading) * (covered - act.travelled), act.clip, bounds), Math.max(0, Math.min(bounds.height, actor.y + Math.sin(heading) * squash(actor) * (covered - act.travelled))));
  act.travelled = covered;
}

export interface Bounds {
  width: number;
  height: number;
  /** What the floor allows of a step from one point to another (a scene's walls and closed doors): the point it ends at. */
  constrain?: (from: { x: number; y: number }, to: { x: number; y: number }) => { x: number; y: number };
}

const NO_BOUNDS: Bounds = { width: Infinity, height: Infinity };

/** Moves an actor to where it wants to be, as far as the floor lets it. */
function place(actor: Actor, bounds: Bounds, x: number, y: number) {
  const to = bounds.constrain ? bounds.constrain({ x: actor.x, y: actor.y }, { x, y }) : { x, y };
  actor.x = to.x;
  actor.y = to.y;
}

/** Fires the events (`step:<leg>`) of the looping base clip for every frame that went by, wrapping around its end. */
function fireBase(actor: Actor, emit: Emit) {
  const clip = actor.clip;
  if (actor.baseClip !== clip) {
    actor.baseClip = clip;
    actor.baseFired = -1;
  }
  const total = Math.floor(actor.time * clip.fps);
  if (total < actor.baseFired) actor.baseFired = -1;
  // After a long pause (a background tab) do not replay more than one lap of the clip.
  for (let f = Math.max(actor.baseFired + 1, total - clip.frameCount + 1); f <= total; f++) {
    const frame = f % clip.frameCount;
    const names = clip.events.filter((e) => e.frame === frame).map((e) => e.name);
    for (const name of names) {
      actor.lastEvent = { name, clip: clip.key, frame };
      emit({ actor, clip, row: actor.row, frame, name, siblings: names });
    }
  }
  actor.baseFired = total;
}

/** Moves the clocks forward: events, root motion, and the end of an action (back to idle, or frozen when it holds). */
export function advance(actor: Actor, dt: number, emit: Emit = () => {}, bounds: Bounds = NO_BOUNDS) {
  if (actor.held) return;
  actor.time += dt;
  const act = actor.act;
  if (!act) {
    fireBase(actor, emit);
    return;
  }
  act.time += dt;
  travel(actor, act, bounds);
  fire(actor, act, emit);
  if (act.time * act.clip.fps >= act.clip.frameCount) {
    emit({ actor, clip: act.clip, row: act.row, frame: act.clip.frameCount - 1, name: 'end', siblings: [] });
    if (act.clip.hold) actor.held = act;
    actor.act = null;
    actor.time = 0;
  }
}

/** Moves the player at exactly the speed its clip was authored for, so the feet do not slide. */
export function stepPlayer(actor: Actor, input: Input, dt: number, bounds: Bounds, emit: Emit) {
  const character = actor.character;
  if (!character || actor.held) return;
  const wantsToMove = (input.dx !== 0 || input.dy !== 0) && character.locomotion.length > 0;

  // Moving cancels an action once its `cancel` event has passed, never before.
  if (actor.act && wantsToMove && cancellable(actor.act)) {
    actor.act = null;
    actor.time = 0;
  }
  if (!actor.act) {
    let next = character.idle ?? character.locomotion[0] ?? character.actions[0] ?? actor.clip;
    if (wantsToMove) {
      const length = Math.hypot(input.dx, input.dy);
      const gait = input.run ? character.locomotion.at(-1)! : character.locomotion[0];
      place(actor, bounds, clampX(actor.x + (input.dx / length) * gait.speed * dt, gait, bounds), Math.max(0, Math.min(bounds.height, actor.y + ((input.dy / length) * gait.speed * dt) * squash(actor))));
      actor.row = rowFor(gait.atlas, Math.atan2(input.dy, input.dx));
      next = gait;
    }
    if (next !== actor.clip) {
      actor.clip = next;
      actor.time = 0;
    }
  }
  advance(actor, dt, emit, bounds);
}

export interface HudInfo {
  character: string;
  clip: string;
  kind: string;
  state: 'idle' | 'moving' | 'action' | 'hold';
  frame: number;
  frames: number;
  /** The direction row being shown (S, SE, W...). */
  direction: string;
  event: string | null;
  /** A scene stands behind the actors. */
  world: boolean;
  /** The last thing a piece of the scene did (a door's `open`), as `name · piece f3`; null with no scene or before any. */
  scene: string | null;
  /** What the E key does from where the character stands ("Abrir porta"); null when there is nothing in reach. */
  use: string | null;
}

export function hudOf(actor: Actor, moving: boolean): Omit<HudInfo, 'world' | 'scene' | 'use'> {
  const { clip, row, time, loops } = shown(actor);
  const state = actor.held ? 'hold' : actor.act ? 'action' : moving ? 'moving' : 'idle';
  const last = actor.lastEvent;
  return {
    character: actor.character?.name ?? clip.key,
    clip: clip.key,
    kind: clip.kind,
    state,
    frame: frameIndex(clip, time, loops),
    direction: clip.atlas.meta.directions?.[row] ?? 'S',
    frames: clip.frameCount,
    event: last ? `${last.name} · ${last.clip} f${last.frame}` : null,
  };
}
