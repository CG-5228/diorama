import { footprintOf, layoutScene, sceneNavigation, type Grid, type SceneData, type SceneItem, type ScenePieceInfo, type SceneNavigation, type SceneryCatalog } from '@core/volume';
import { BODY_RADIUS as RUNTIME_BODY_RADIUS, flightStop as stopOnFloor, moveIn } from '@diorama/runtime';

/** The scale the scene is drawn at: the sheets' export scale, so a scene and a character share one pixel size. */
export const WORLD_SCALE = 2;

/** World units a character's body reaches from its feet: it stops this far short of a wall (the runtime's `BODY_RADIUS`). */
export const BODY_RADIUS = RUNTIME_BODY_RADIUS;

/** The scene's pieces by id. */
const pieceIn = (catalog: SceneryCatalog, id: string): ScenePieceInfo | undefined => catalog.pieces.find((p) => p.id === id);

/**
 * How the scene's floor maps onto a view: `origin` is where cell (0, 0)'s centre lies in the scene's drawing (logical
 * px), and `kx`, `ky` the logical px of one world unit across the screen and in depth. Characters and scenery share the
 * view in *actor units* (exported pixels, what the playground moves its actors in): the drawing's top-left corner is at `at`.
 */
export interface Mapping {
  origin: { x: number; y: number };
  kx: number;
  ky: number;
  /** Where the scene's drawing starts, in actor units. */
  at: { x: number; y: number };
}

export const mappingOf = (catalog: SceneryCatalog, origin: { x: number; y: number }, at: { x: number; y: number }): Mapping => ({
  origin,
  kx: catalog.grid.screen.w / catalog.grid.cell.x,
  ky: catalog.grid.screen.h / catalog.grid.cell.y,
  at,
});

/** A point of the view (actor units) on the floor, in world units (cell (0, 0) centred on the origin). */
export const toWorld = (m: Mapping, p: { x: number; y: number }) => ({
  x: ((p.x - m.at.x) / WORLD_SCALE - m.origin.x) / m.kx,
  y: ((p.y - m.at.y) / WORLD_SCALE - m.origin.y) / m.ky,
});

/** A point of the floor (world units) in the view (actor units). */
export const toView = (m: Mapping, w: { x: number; y: number }) => ({
  x: m.at.x + (m.origin.x + w.x * m.kx) * WORLD_SCALE,
  y: m.at.y + (m.origin.y + w.y * m.ky) * WORLD_SCALE,
});

/** A thing standing on the scene (a wall, fence, door or prop), as the drawing lays it out. */
export interface Standing {
  item: SceneItem;
  /** The placement it comes from; none for a wall or fence. */
  index?: number;
  /** Where its pivot lies in the scene's drawing (logical px). */
  screen: { x: number; y: number };
}

/** An animation of a placement in progress. */
export interface Play {
  index: number;
  clip: string;
  /** Seconds since it started. */
  time: number;
  /** The last frame whose events were fired. */
  fired: number;
}

/** What a piece's clip fired: the moment a game reacts to. */
export interface LiveEvent {
  index: number;
  piece: string;
  clip: string;
  frame: number;
  name: string;
}

/** The scene as it is being played: resting states that change, animations in progress, and the navigation they give. */
export interface Live {
  catalog: SceneryCatalog;
  /** The scene with the states of now. */
  scene: SceneData;
  standing: Standing[];
  nav: SceneNavigation;
  plays: Play[];
  /** Doors that let characters through before their clip is over (from its `open` event on). */
  open: Record<number, boolean>;
  /** The last thing a clip fired, for the HUD. */
  last: (LiveEvent & { at: number }) | null;
}

const keyOf = (piece: string, col: number, row: number, edge?: string) => `${piece}@${col},${row}${edge ? `,${edge}` : ''}`;

/** The standing things of a scene laid out for drawing, each knowing its placement (matched in order where several share a piece and a place). */
export function standingOf(scene: SceneData, catalog: SceneryCatalog, project: (at: SceneItem['at']) => { x: number; y: number }): Standing[] {
  const waiting = new Map<string, number[]>();
  scene.props.forEach((p, index) => {
    const key = keyOf(p.piece, p.col, p.row, p.edge);
    waiting.set(key, [...(waiting.get(key) ?? []), index]);
  });
  const out: Standing[] = [];
  for (const item of layoutScene(scene, catalog)) {
    if (item.pass !== 'object') continue;
    const wall = item.group === 'wall' || item.group === 'fence';
    const index = wall ? undefined : waiting.get(keyOf(item.piece, item.col, item.row, item.edge))?.shift();
    if (!wall && index === undefined) continue;
    out.push({ item, ...(index !== undefined ? { index } : {}), screen: project(item.at) });
  }
  return out;
}

/** Starts playing a scene: its resting states, no animation running, and its navigation. */
export function startLive(scene: SceneData, catalog: SceneryCatalog, project: (at: SceneItem['at']) => { x: number; y: number }): Live {
  return { catalog, scene, standing: standingOf(scene, catalog, project), nav: sceneNavigation(scene, catalog), plays: [], open: {}, last: null };
}

/** The state a placement rests in now. */
export const stateOf = (live: Live, index: number): string | undefined => live.scene.props[index]?.state ?? pieceIn(live.catalog, live.scene.props[index]?.piece ?? '')?.states?.[0];

/**
 * The transition that takes a piece out of a state, found by what it does and not by its name: the clip that starts
 * in that state (`from`) and ends in another (`to`). Where several leave a state, the one that leads to the next
 * state of the piece (the one after it in `states`, the first after the last) wins; else the first. Null when the piece cannot change from there.
 */
export function transitionFrom(info: ScenePieceInfo, state: string | undefined): string | null {
  const clips = Object.entries(info.clips ?? {}).filter(([, clip]) => !clip.loop && clip.to !== undefined && clip.from === state);
  if (!clips.length) return null;
  const states = info.states ?? [];
  const next = state === undefined ? undefined : states[(states.indexOf(state) + 1) % states.length];
  return (clips.find(([, clip]) => clip.to === next) ?? clips[0])[0];
}

/** The state a transition leads to. */
export const transitionTarget = (info: ScenePieceInfo, clip: string): string | undefined => info.clips?.[clip]?.to;

/** The loop a piece plays in a state (a flame, a flicker): always, for as long as it rests there. Null for a piece that does not loop. */
export function loopOf(info: ScenePieceInfo, state: string | undefined): string | null {
  const loop = Object.entries(info.clips ?? {}).find(([, clip]) => clip.loop && (clip.from === undefined || clip.from === state));
  return loop ? loop[0] : null;
}

/** Whether a placement is playing a transition. */
export const playing = (live: Live, index: number) => live.plays.some((p) => p.index === index);

/** Starts an animation of a placement; refused (false) while it is already playing one, or when the piece has no such clip from its state. */
export function play(live: Live, index: number, clip: string, emit?: (event: LiveEvent) => void): boolean {
  const prop = live.scene.props[index];
  const info = prop && pieceIn(live.catalog, prop.piece);
  const data = info?.clips?.[clip];
  if (!prop || !info || !data || playing(live, index) || data.loop || data.from !== stateOf(live, index)) return false;
  live.plays.push({ index, clip, time: 0, fired: -1 });
  fireEvents(live, live.plays.at(-1)!, data.fps ?? 10, data.frames, info, emit ?? null);
  return true;
}

function fireEvents(live: Live, run: Play, fps: number, frames: number, info: ScenePieceInfo, emit: ((event: LiveEvent) => void) | null) {
  const reached = Math.min(Math.floor(run.time * fps), frames - 1);
  const clip = info.clips![run.clip];
  for (let frame = run.fired + 1; frame <= reached; frame++) {
    for (const event of clip.events ?? []) {
      if (event.frame !== frame) continue;
      const fired: LiveEvent = { index: run.index, piece: info.id, clip: run.clip, frame, name: event.name };
      live.last = { ...fired, at: performance.now() };
      emit?.(fired);
      // A door lets characters through from its `open` event, before the leaf has finished.
      if (event.name === 'open' && info.group === 'door') {
        live.open[run.index] = true;
        live.nav = sceneNavigation(live.scene, live.catalog, { open: live.open });
      }
    }
  }
  run.fired = reached;
}

/** Puts a placement in a state: the scene, what stands on it and the navigation follow. */
function rest(live: Live, index: number, state: string, project: (at: SceneItem['at']) => { x: number; y: number }) {
  live.scene = { ...live.scene, props: live.scene.props.map((p, i) => (i === index ? { ...p, state } : p)) };
  delete live.open[index];
  live.standing = standingOf(live.scene, live.catalog, project);
  live.nav = sceneNavigation(live.scene, live.catalog, { open: live.open });
}

/**
 * Moves the animations on by `dt` seconds: events fire as their frames pass, and a transition that ends leaves its
 * piece resting in the state it leads to (a door open, an urn broken) and the navigation is made again. Returns whether
 * the standing things changed, so the frames cached for them are looked up again.
 */
export function stepLive(live: Live, dt: number, project: (at: SceneItem['at']) => { x: number; y: number }, emit?: (event: LiveEvent) => void): boolean {
  let changed = false;
  for (const run of [...live.plays]) {
    const info = pieceIn(live.catalog, live.scene.props[run.index]?.piece ?? '');
    const clip = info?.clips?.[run.clip];
    if (!info || !clip) {
      live.plays = live.plays.filter((p) => p !== run);
      continue;
    }
    run.time += dt;
    const fps = clip.fps ?? 10;
    fireEvents(live, run, fps, clip.frames, info, emit ?? null);
    if (run.time * fps >= clip.frames) {
      live.plays = live.plays.filter((p) => p !== run);
      if (clip.to !== undefined) {
        rest(live, run.index, clip.to, project);
        changed = true;
      }
    }
  }
  return changed;
}

/** The frame of a standing thing to draw now: its clip's frame while one plays or loops (`now` in seconds), its resting frame otherwise. */
export function drawnItem(live: Live, standing: Standing, now: number): SceneItem & { clip?: { name: string; frame: number } } {
  const index = standing.index;
  if (index === undefined) return standing.item;
  const info = pieceIn(live.catalog, standing.item.piece);
  const run = live.plays.find((p) => p.index === index);
  if (run) {
    const clip = info?.clips?.[run.clip];
    return clip ? { ...standing.item, clip: { name: run.clip, frame: Math.min(Math.floor(run.time * (clip.fps ?? 10)), clip.frames - 1) } } : standing.item;
  }
  const loop = info && loopOf(info, standing.item.state);
  const clip = loop ? info!.clips![loop] : undefined;
  return loop && clip ? { ...standing.item, clip: { name: loop, frame: Math.floor(now * (clip.fps ?? 10)) % clip.frames } } : standing.item;
}

/** Whether a standing thing animates (a loop, or a clip in progress), so its frame is not the same one for two frames in a row. */
export const animated = (live: Live, standing: Standing) => {
  if (standing.index === undefined) return false;
  const info = pieceIn(live.catalog, standing.item.piece);
  return playing(live, standing.index) || (!!info && loopOf(info, standing.item.state) !== null);
};

/** A thing to use, in the order a character would reach for it: the nearest of those whose use-cells hold the character. */
export interface Usable {
  index: number;
  piece: string;
  kind: string;
  state?: string;
  /** The clip using it plays, and the state it leads to. */
  clip: string;
  to?: string;
  /** Distance from the character to it (world units). */
  distance: number;
}

/**
 * What a character standing at `at` (world units) can use from where it stands: the things whose use-cells hold its cell
 * (`interactables`), that can change from their state (a closed door, a closed chest, a lever) and are not busy, nearest
 * first. Things to break are not used: they are hit.
 */
export function usableFrom(live: Live, grid: Grid, at: { x: number; y: number }): Usable[] {
  const col = Math.round(at.x / grid.cell.x);
  const row = Math.round(at.y / grid.cell.y);
  const out: Usable[] = [];
  for (const thing of live.nav.interactables) {
    if (thing.kind === 'break' || playing(live, thing.index) || !thing.cells.some((c) => c.col === col && c.row === row)) continue;
    const info = pieceIn(live.catalog, thing.piece);
    const clip = info && transitionFrom(info, stateOf(live, thing.index));
    const standing = live.standing.find((s) => s.index === thing.index);
    if (!info || !clip || !standing) continue;
    const pivot = standing.item.at;
    const to = transitionTarget(info, clip);
    out.push({ index: thing.index, piece: thing.piece, kind: thing.kind, ...(thing.state !== undefined ? { state: thing.state } : {}), clip, ...(to !== undefined ? { to } : {}), distance: Math.hypot(pivot.x - at.x, pivot.y - at.y) });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

/** Uses the nearest thing the character can reach: starts its clip. Null when there is nothing to use. */
export function use(live: Live, grid: Grid, at: { x: number; y: number }, emit?: (event: LiveEvent) => void): Usable | null {
  for (const thing of usableFrom(live, grid, at)) if (play(live, thing.index, thing.clip, emit)) return thing;
  return null;
}

/**
 * The things to break a blow lands on: a blow struck from `from` (world units) towards `heading` (a screen angle,
 * like the sheets' facings) reaches a point a little way ahead; everything that breaks (`nav.interact: 'break'`, in a
 * state it can break from) whose cells that point is within half a cell of is hit, and plays its clip.
 */
export function strike(live: Live, grid: Grid, mapping: Pick<Mapping, 'kx' | 'ky'>, from: { x: number; y: number }, heading: number, emit?: (event: LiveEvent) => void): number[] {
  // A direction on the screen is a longer or shorter one on the floor: depth is squashed by the tilt.
  const dx = Math.cos(heading) / mapping.kx;
  const dy = Math.sin(heading) / mapping.ky;
  const length = Math.hypot(dx, dy) || 1;
  const reach = grid.cell.x * 1.1;
  const point = { x: from.x + (dx / length) * reach, y: from.y + (dy / length) * reach };
  const hit: number[] = [];
  for (const thing of live.nav.interactables) {
    if (thing.kind !== 'break' || playing(live, thing.index)) continue;
    const info = pieceIn(live.catalog, thing.piece);
    const clip = info && transitionFrom(info, stateOf(live, thing.index));
    if (!info || !clip) continue;
    const dir = live.scene.props[thing.index]?.dir ?? 0;
    const [across, deep] = footprintOf(info, dir);
    // The rectangle of the thing's cells on the floor.
    const left = (thing.col - 0.5) * grid.cell.x;
    const top = (thing.row - 0.5) * grid.cell.y;
    const nearX = Math.max(left, Math.min(left + across * grid.cell.x, point.x));
    const nearY = Math.max(top, Math.min(top + deep * grid.cell.y, point.y));
    if (Math.hypot(point.x - nearX, point.y - nearY) <= grid.cell.x * 0.5 && play(live, thing.index, clip, emit)) hit.push(thing.index);
  }
  return hit;
}

/** Moves a point of the view (actor units) by a step, as far as the floor lets it: it slides along walls and stops a body's width short of them. */
export function constrain(live: Live, grid: Grid, mapping: Mapping, from: { x: number; y: number }, to: { x: number; y: number }, radius = BODY_RADIUS): { x: number; y: number } {
  const a = toWorld(mapping, from);
  const b = toWorld(mapping, to);
  return toView(mapping, moveIn(live.nav, grid, a, { x: b.x - a.x, y: b.y - a.y }, radius));
}

/** Where a character can start: the centre of the enterable cell nearest to the middle of the scene (world units). */
export function spawnPoint(live: Live, grid: Grid): { x: number; y: number } {
  const { cols, rows, cost } = live.nav;
  let best = { col: 0, row: 0 };
  let nearest = Infinity;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!(cost[row][col] > 0)) continue;
      const distance = Math.hypot(col - (cols - 1) / 2, row - (rows - 1) / 2);
      if (distance < nearest) (nearest = distance), (best = { col, row });
    }
  }
  return { x: best.col * grid.cell.x, y: best.row * grid.cell.y };
}

/** Whether the floor under a point (world units) can be entered. */
export function standable(live: Live, grid: Grid, at: { x: number; y: number }): boolean {
  const col = Math.round(at.x / grid.cell.x);
  const row = Math.round(at.y / grid.cell.y);
  return live.nav.cost[row]?.[col] > 0;
}

/**
 * Every frame the clips of the scene's things can show, loops first (they play from the start): to have them drawn
 * into the renderer's cache in idle time, so a door's first opening does not draw its frames under the player's eyes.
 */
export function clipFrames(live: Live): (SceneItem & { clip: { name: string; frame: number } })[] {
  const loops: (SceneItem & { clip: { name: string; frame: number } })[] = [];
  const moves: (SceneItem & { clip: { name: string; frame: number } })[] = [];
  const seen = new Set<string>();
  for (const standing of live.standing) {
    const info = pieceIn(live.catalog, standing.item.piece);
    if (standing.index === undefined || !info?.clips) continue;
    for (const [name, clip] of Object.entries(info.clips)) {
      // One piece in one state is one set of frames, however many places it stands in.
      const key = `${standing.item.piece}|${standing.item.variant}|${standing.item.dir}|${name}|${JSON.stringify(standing.item.options)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (let frame = 0; frame < clip.frames; frame++) (clip.loop ? loops : moves).push({ ...standing.item, state: clip.from ?? standing.item.state, clip: { name, frame } });
    }
  }
  return [...loops, ...moves];
}

/**
 * Where something that flies along a path on the floor is stopped (view points, actor units): the last point it can
 * reach before a cell that cannot be entered, a wall or a shut door, or null when the way is clear (the runtime's
 * `flightStop`, on the floor).
 */
export function flightStop(live: Live, grid: Grid, mapping: Mapping, from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } | null {
  const stop = stopOnFloor(live.nav, grid, toWorld(mapping, from), toWorld(mapping, to));
  return stop && toView(mapping, stop);
}
