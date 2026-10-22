/**
 * A small scenery kit built with the real engine, to develop the scene painter before a project ships its own
 * `src/scenery/catalog.ts`. It is only reachable with `?fixture=true` in the scenery tab. Delete it with that flag
 * once the projects' kits are in use.
 */

import { createRng } from '@core';
import { Polygon } from '@core/draw';
import { Camera, Frame3, Round, Solid, cornerMaskShape, defineSpace, emptyScene, EDGE, vec3, type SceneData, type ScenePiece, type SceneryCatalog, type VolumeStyle } from '@core/volume';

const tones = (lit: string, base: string, dark: string): VolumeStyle => ({ ramp: { lit, base, dark } });

const MATERIALS: Record<string, VolumeStyle> = {
  crypt: tones('#8a8799', '#535064', '#2b2935'),
  sandstone: tones('#e2cfa2', '#bfa876', '#7d6a45'),
  soil: tones('#6b5646', '#4a3b30', '#2f241d'),
  moss: tones('#8fb36b', '#5d8248', '#34502c'),
  timber: tones('#8a6a52', '#5c4333', '#352519'),
  iron: tones('#7e8794', '#4a515c', '#262a31'),
  ember: tones('#ffe9a8', '#f2a93b', '#b8531f'),
};

const camera = new Camera({ tilt: 48, heightBoost: 1.2, light: { azimuth: 140, elevation: 45, ambient: 0.35 }, contour: { width: 1.25, color: '#0d0b12' } });
/** The fixture's game space: a JRPG on a tile grid (walls on cell borders, three heights of wall), like the real kits. */
const SPACE = defineSpace({ camera, preset: 'jrpg', character: 80 });
const grid = SPACE.grid;

/** A floor: its material over the whole cell, or over the part of a dual-grid tile a transition covers, with a few pebbles. */
const floor = (role: string, accent: string): ScenePiece => ({ object, frame, grid: g, mask, seed, materials }) => {
  const w = g.cell.x;
  const d = g.cell.y;
  const origin = frame.origin;
  object.custom(origin, (c, cam) => {
    const project = (p: { x: number; y: number }) => cam.project(vec3(origin.x + p.x, origin.y + p.y, 0));
    (mask === 15 ? Polygon.rect(w, d) : cornerMaskShape(mask, w, d)).mapVertices(project).fill(c, materials[role].ramp.base);
    if (mask !== 15) return;
    // Details stay inside the cell, so the tile joins its neighbours.
    const rng = createRng(seed);
    for (let i = 0; i < 4; i++) {
      Polygon.circle(rng.float(0.5, 1.1), { cx: rng.float(-w * 0.38, w * 0.38), cy: rng.float(-d * 0.38, d * 0.38) }).mapVertices(project).fill(c, i % 2 ? materials[role].ramp.dark : materials[accent].ramp.lit);
    }
  });
};

/** A wall or fence: a post at the pivot (a vertex, on borders) and an arm towards every connected edge (N 1, E 2, S 4, W 8), as tall as the frame's height. */
const run = (role: string, thickness: number, fallback: number, postExtra = 0): ScenePiece => ({ object, grid: g, frame, mask, materials, height: tall }) => {
  const style = materials[role];
  const height = tall ?? fallback;
  const postHeight = height + postExtra;
  const o = frame.origin;
  const at = (x: number, y: number) => Frame3.facing(vec3(o.x + x, o.y + y, 0), 0);
  object.add(Solid.box(at(0, 0), thickness + 2, thickness + 2, postHeight), style);
  const w = g.cell.x;
  const d = g.cell.y;
  if (mask & EDGE.E) object.add(Solid.box(at(w / 4, 0), w / 2, thickness, height), style);
  if (mask & EDGE.W) object.add(Solid.box(at(-w / 4, 0), w / 2, thickness, height), style);
  if (mask & EDGE.N) object.add(Solid.box(at(0, -d / 4), thickness, d / 2, height), style);
  if (mask & EDGE.S) object.add(Solid.box(at(0, d / 4), thickness, d / 2, height), style);
};

const crate: ScenePiece = ({ object, frame, materials, variant }, options: { lid?: boolean }) => {
  const style = materials.wood;
  object.add(Solid.box(frame, 14, 14, 11 + variant * 2), style);
  if (options.lid ?? true) object.add(Solid.box(frame.moved(3, 0, 11 + variant * 2), 7, 14, 2), materials.metal ?? style);
};

const tombstone: ScenePiece = ({ object, frame, materials }) => {
  object.add(Solid.box(frame, 12, 6, 6), materials.stone);
  object.add(Solid.box(frame.moved(0, 0, 6), 8, 5, 16), materials.stone);
  object.add(Round.ellipsoid(frame.moved(0, 0, 22), 4, 2.5, 3), materials.stone);
};

const tree: ScenePiece = ({ object, frame, materials }, options: { size?: number }) => {
  const k = options.size ?? 1;
  object.add(Round.cylinder(frame, 3.5 * k, 22 * k), materials.wood);
  object.add(Round.ellipsoid(frame.moved(0, 0, 30 * k), 16 * k, 16 * k, 14 * k), materials.moss);
};

/**
 * A door on a cell edge, between the piers its wall run ends in: a lintel at the wall's height and a leaf that swings
 * open about a hinge at one end (state `open` rests turned square to the wall; the clips turn it there and back).
 */
const doorway: ScenePiece = ({ object, frame, grid: g, materials, yaw, state, clip }) => {
  const sideways = Math.abs(Math.cos(yaw)) > Math.abs(Math.sin(yaw)) + 1e-9;
  const span = sideways ? g.cell.y : g.cell.x;
  const gap = span - 10;
  const opening = SPACE.scale.door;
  object.add(Solid.box(frame.moved(0, 0, opening), 7, span, SPACE.scale.wall - opening), materials.stone);
  const turn = clip ? (clip.name === 'opening' ? clip.t : 1 - clip.t) : state === 'open' ? 1 : 0;
  const hinge = frame.moved(0, -gap / 2, 0).turned(-turn * 90);
  object.add(Solid.box(hinge.moved(0, gap / 2, 0), 2.5, gap, opening - 1), materials.wood);
  object.add(Solid.box(hinge.moved(0, gap / 2, opening * 0.45), 2.9, gap, 2), materials.metal);
};

/** An urn that breaks: whole, or in shards that fly out and settle (`break` runs from one to the other). */
const urn: ScenePiece = ({ object, frame, materials, state, clip }) => {
  const style = materials.soil;
  const t = clip ? clip.t : state === 'broken' ? 1 : 0;
  if (t < 0.3) {
    const swell = 1 + t * 0.25;
    object.add(Round.ellipsoid(frame.moved(0, 0, 7), 6 * swell, 6 * swell, 7), style);
    object.add(Round.cylinder(frame.moved(0, 0, 13), 3, 4), style);
    return;
  }
  for (let i = 0; i < 4; i++) {
    const angle = 0.6 + (i * Math.PI) / 2;
    const reach = 2 + 4 * Math.min(1, t);
    const lift = Math.max(0, Math.sin(Math.min(1, t * 1.3) * Math.PI) * 7 * (1 - t));
    object.add(Solid.box(frame.moved(Math.cos(angle) * reach, Math.sin(angle) * reach, lift).turned(i * 40), 4, 3, 2 + (i % 2)), style);
  }
};

/** A chest whose lid lifts and stands at the back when it opens. */
const chest: ScenePiece = ({ object, frame, materials, state, clip }) => {
  const open = clip ? (clip.name === 'opening' ? clip.t : 1 - clip.t) : state === 'open' ? 1 : 0;
  object.add(Solid.box(frame, 10, 15, 6), materials.wood);
  object.add(Solid.box(frame.moved(0, 0, 4), 10.4, 15.4, 1.4), materials.metal);
  if (open < 0.5) object.add(Solid.box(frame.moved(0, 0, 6 + open * 8), 10, 15, 3), materials.wood);
  else object.add(Solid.box(frame.moved(-5.5, 0, 6), 2.5, 15, 9), materials.wood);
};

/** An iron bowl on a stand with a flame that flickers: `flame` loops, and the last frame leads into the first. */
const brazier: ScenePiece = ({ object, frame, materials, clip }) => {
  object.add(Round.cylinder(frame, 2, 9), materials.metal);
  object.add(Round.cylinder(frame.moved(0, 0, 9), 6, 3), materials.metal);
  const t = clip ? clip.t : 0;
  const wave = Math.sin(t * Math.PI * 2);
  object.add(Round.ellipsoid(frame.moved(0, 0, 14 + wave), 3.4 - wave * 0.4, 3.4 - wave * 0.4, 5 + wave * 1.4), materials.flame);
  object.add(Round.ellipsoid(frame.moved(wave * 0.8, 0, 16 - wave), 1.8, 1.8, 3 - wave * 0.8), materials.flame);
};

const crack: ScenePiece = ({ object, frame, seed, materials }) => {
  const o = frame.origin;
  const rng = createRng(seed);
  object.custom(o, (c, cam) => {
    const project = (p: { x: number; y: number }) => cam.project(vec3(o.x + p.x, o.y + p.y, 0));
    Polygon.ellipse(rng.float(5, 8), rng.float(2, 3.5), { cx: rng.float(-3, 3), cy: rng.float(-2, 2) }).mapVertices(project).fill(c, materials.stone.ramp.dark);
  });
};

export const FIXTURE_SCENERY: SceneryCatalog = {
  materials: MATERIALS,
  defaultMaterials: { stone: 'crypt', mortar: 'soil', wood: 'timber', moss: 'moss', metal: 'iron', soil: 'soil', flame: 'ember' },
  grid,
  camera,
  space: SPACE,
  pieces: [
    { id: 'dirt', label: 'Terra', group: 'floor', piece: floor('soil', 'wood'), connect: 'corners', priority: 0, variants: 2, roles: ['soil'] },
    { id: 'flagstone', label: 'Lajes', group: 'floor', piece: floor('stone', 'mortar'), connect: 'corners', priority: 1, variants: 2, roles: ['stone', 'mortar'] },
    { id: 'grass', label: 'Grama', group: 'floor', piece: floor('moss', 'moss'), connect: 'corners', priority: 2, variants: 2, roles: ['moss'] },
    { id: 'crypt-wall', label: 'Muro da cripta', group: 'wall', piece: run('stone', 8, SPACE.scale.wall), connect: 'edges', heights: ['wall', 'fence'], roles: ['stone', 'mortar'] },
    { id: 'iron-fence', label: 'Grade de ferro', group: 'fence', piece: run('metal', 2.5, SPACE.scale.fence, 6), connect: 'edges', heights: ['fence', 'wall'], roles: ['metal'] },
    {
      id: 'crypt-door', label: 'Porta da cripta', group: 'door', piece: doorway, connect: 'none', directions: 4, joins: ['crypt-wall'], height: 'door', roles: ['stone', 'wood', 'metal'],
      states: ['closed', 'open'],
      clips: {
        opening: { frames: 6, fps: 12, from: 'closed', to: 'open', events: [{ frame: 3, name: 'open' }] },
        closing: { frames: 6, fps: 12, from: 'open', to: 'closed', events: [{ frame: 5, name: 'shut' }] },
      },
      nav: { passableIn: ['open'], interact: 'door' },
    },
    {
      id: 'crate', label: 'Caixote', group: 'prop', piece: crate, connect: 'none', directions: 4, variants: 3, roles: ['wood', 'metal'],
      options: [{ key: 'lid', label: 'Tampa', type: 'boolean', default: true }],
    },
    {
      id: 'urn', label: 'Urna', group: 'prop', piece: urn, connect: 'none', roles: ['soil'],
      states: ['whole', 'broken'],
      clips: { breaking: { frames: 6, fps: 12, from: 'whole', to: 'broken', events: [{ frame: 2, name: 'break' }] } },
      nav: { passableIn: ['broken'], interact: 'break', interactIn: ['whole'] },
    },
    {
      id: 'chest', label: 'Baú', group: 'prop', piece: chest, connect: 'none', directions: 4, roles: ['wood', 'metal'],
      states: ['closed', 'open'],
      clips: { opening: { frames: 6, fps: 10, from: 'closed', to: 'open', events: [{ frame: 3, name: 'open' }] } },
      nav: { interact: 'chest', interactIn: ['closed'] },
    },
    { id: 'brazier', label: 'Braseiro', group: 'prop', piece: brazier, connect: 'none', roles: ['metal', 'flame'], clips: { flame: { frames: 8, fps: 10, loop: true } } },
    { id: 'tombstone', label: 'Lápide', group: 'prop', piece: tombstone, connect: 'none', roles: ['stone'] },
    {
      id: 'dead-tree', label: 'Árvore seca', group: 'prop', piece: tree, connect: 'none', footprint: [2, 2], roles: ['wood', 'moss'],
      options: [{ key: 'size', label: 'Tamanho', type: 'number', default: 1, min: 0.7, max: 1.4, step: 0.05 }],
    },
    { id: 'crack', label: 'Rachadura', group: 'decal', piece: crack, connect: 'none', variants: 2, roles: ['stone'] },
  ],
};

const cells = (rows: string[], key: Record<string, string>) => rows.map((row) => [...row].map((ch) => key[ch] ?? null));

/** Walls on cell borders are vertices: `run` paints a straight run of them, from one vertex to another. */
const walls = (scene: SceneData, runs: { from: [number, number]; to: [number, number]; piece: string; height?: 'fence' }[]): SceneData => {
  const grid = scene.walls.map((line) => [...line]);
  for (const { from, to, piece, height } of runs) {
    for (let col = Math.min(from[0], to[0]); col <= Math.max(from[0], to[0]); col++) {
      for (let row = Math.min(from[1], to[1]); row <= Math.max(from[1], to[1]); row++) grid[row][col] = height ? { piece, height } : piece;
    }
  }
  return { ...scene, walls: grid };
};

/** A graveyard corner: flagstones and grass on dirt, a wall along the back and the left, a low wall step, an iron fence, props and a scale figure. */
export const FIXTURE_SCENE: SceneData = {
  ...walls(emptyScene(FIXTURE_SCENERY, 12, 9), [
    { from: [0, 0], to: [12, 0], piece: 'crypt-wall' },
    { from: [0, 0], to: [0, 9], piece: 'crypt-wall' },
    { from: [0, 9], to: [4, 9], piece: 'crypt-wall', height: 'fence' },
    { from: [12, 0], to: [12, 4], piece: 'crypt-wall' },
    { from: [12, 4], to: [12, 7], piece: 'iron-fence' },
  ]),
  floor: cells(
    ['dddddddddddd', 'dffffffffddd', 'dffffffffddd', 'dffffffgggdd', 'dffffffgggdd', 'dddddfffgggd', 'dddddfffdddd', 'dddddfffdddd', 'dddddddddddd'],
    { d: 'dirt', f: 'flagstone', g: 'grass' },
  ),
  props: [
    { piece: 'tombstone', col: 3, row: 3 },
    { piece: 'tombstone', col: 5, row: 3 },
    { piece: 'crate', col: 8, row: 2, dir: 1 },
    { piece: 'dead-tree', col: 9, row: 4 },
    { piece: 'crack', col: 4, row: 6 },
    { piece: 'crypt-door', col: 5, row: 0, edge: 'N' },
    { piece: 'crypt-door', col: 0, row: 4, edge: 'W', state: 'open' },
    { piece: 'chest', col: 2, row: 2 },
    { piece: 'brazier', col: 10, row: 2 },
    { piece: 'urn', col: 6, row: 7 },
  ],
  figures: [{ col: 6, row: 5 }],
};
