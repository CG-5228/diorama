/**
 * @core/volume - Space profile
 *
 * How a project's game space is shaped, declared once: the projection, the grid, the scale of
 * everything against its characters, and where walls stand. The scenery engine, the kit and the
 * checks read it, so a project changes its proportions in one place instead of in every piece.
 * Genre presets give sensible starting numbers; every number can be overridden.
 *
 * The engine draws one projection today: a tilted top-down view (3/4, Zelda- or Hades-like) on a
 * rectangular grid. Isometric, side view, hex grids and height levels are on the roadmap; the
 * profile is where they will be chosen.
 */

import type { Camera } from './camera.js';
import { Grid } from './grid.js';
import type { StageObject } from './stage.js';
import { vec3, type Vec3 } from './vec3.js';

/** Sizes of a game space in world units, all measured against its characters. */
export interface SpaceScale {
  /** Height of a standing adult character: the reference everything is checked against. */
  character: number;
  /** Width of a grid cell (its depth follows from the camera so a cell is whole pixels on screen). */
  cell: number;
  /** Height of a full wall's top. */
  wall: number;
  /** Clear height of a doorway or gate. */
  door: number;
  /** Height of a fence, a railing or a low wall. */
  fence: number;
}

/** Where walls and fences stand: through the centre of their cells, or on the borders between cells. */
export type WallPlacement = 'center' | 'border';

/** A starting point for a kind of game. */
export interface SpacePreset {
  label: string;
  description: string;
  walls: WallPlacement;
  /** Sizes as multiples of the character's height. */
  ratios: Omit<SpaceScale, 'character'>;
}

/** Names of the genre presets. */
export type SpacePresetName = 'jrpg' | 'action-rpg' | 'tactics' | 'farm-sim' | 'dungeon-crawler';

/**
 * Genre presets: proportions that read right for each kind of game, as multiples of the
 * character's height. Pick the closest one when a project starts and override what differs.
 */
export const SPACE_PRESETS: Record<SpacePresetName, SpacePreset> = {
  jrpg: {
    label: 'JRPG',
    description: 'Towns, rooms and dungeons on a tile grid; a character is about two cells tall and one wide; walls stand taller than the party and enclose rooms on cell borders.',
    walls: 'border',
    ratios: { cell: 0.6, wall: 1.25, door: 1.15, fence: 0.55 },
  },
  'action-rpg': {
    label: 'Action RPG',
    description: 'Free movement and real-time combat over a grid; a character is about one and a half cells tall; walls stay near character height so the action behind them reads.',
    walls: 'border',
    ratios: { cell: 0.75, wall: 1, door: 1.1, fence: 0.5 },
  },
  tactics: {
    label: 'Tactics',
    description: 'Turn-based combat with one unit per cell; a cell is about as wide as a character is tall; walls and obstacles fill whole cells.',
    walls: 'center',
    ratios: { cell: 1, wall: 0.9, door: 1.1, fence: 0.45 },
  },
  'farm-sim': {
    label: 'Farm / life sim',
    description: 'A dense grid of crops and furniture; a character is about two cells tall; buildings rise well above the characters.',
    walls: 'border',
    ratios: { cell: 0.5, wall: 1.6, door: 1.2, fence: 0.5 },
  },
  'dungeon-crawler': {
    label: 'Dungeon crawler',
    description: 'Corridors one cell wide between solid walls that fill their cells; a character is a little taller than a cell.',
    walls: 'center',
    ratios: { cell: 0.8, wall: 1.1, door: 1.05, fence: 0.5 },
  },
};

/** A project's game space. */
export interface SpaceProfile {
  /** The projection the engine draws (only 'top-down' today). */
  projection: 'top-down';
  /** The preset it started from. */
  preset: SpacePresetName;
  camera: Camera;
  grid: Grid;
  walls: WallPlacement;
  scale: SpaceScale;
}

/** Options of `defineSpace`. */
export interface SpaceOptions {
  camera: Camera;
  /** Height of the project's standing adult character, in world units (what its skins are built at). */
  character: number;
  /** Genre preset to start from. Default 'jrpg'. */
  preset?: SpacePresetName;
  /** Overrides of the preset. */
  walls?: WallPlacement;
  scale?: Partial<Omit<SpaceScale, 'character'>>;
}

/**
 * Declares a project's game space from its camera, its character height and a genre preset.
 * The grid's cells are whole, even numbers of pixels on screen in both directions (so cell
 * centres and vertices land on whole pixels at every whole export scale); the cell's world width
 * is rounded to that.
 */
export function defineSpace(o: SpaceOptions): SpaceProfile {
  const presetName = o.preset ?? 'jrpg';
  const preset = SPACE_PRESETS[presetName];
  if (!preset) throw new Error(`space: unknown preset "${o.preset}" (presets: ${Object.keys(SPACE_PRESETS).join(', ')})`);
  if (!(o.character > 0)) throw new Error('space: the character height must be a positive number of world units');
  const c = o.character;
  const want = { cell: preset.ratios.cell * c, wall: preset.ratios.wall * c, door: preset.ratios.door * c, fence: preset.ratios.fence * c, ...o.scale };
  const even = (x: number) => Math.max(2, 2 * Math.round(x / 2));
  const sy = Math.sin((o.camera.tilt * Math.PI) / 180);
  const grid = Grid.fromScreen(o.camera, even(want.cell * o.camera.scale), even(want.cell * sy * o.camera.scale));
  return {
    projection: 'top-down',
    preset: presetName,
    camera: o.camera,
    grid,
    walls: o.walls ?? preset.walls,
    scale: { character: c, cell: grid.cell.x, wall: want.wall, door: want.door, fence: want.fence },
  };
}

/** Logical pixels on screen of something `height` world units tall standing on the floor. */
export function screenHeight(camera: Camera, height: number): number {
  return camera.project(vec3(0, 0, 0)).y - camera.project(vec3(0, 0, height)).y;
}

/** A height given in world units or as one of the profile's sizes. */
export type SpaceHeight = number | keyof SpaceScale;

/** World units of a height given as a number or as a size of the profile ('wall', 'door'...). */
export function heightOf(space: SpaceProfile | undefined, height: SpaceHeight): number | undefined {
  if (typeof height === 'number') return height;
  return space?.scale[height];
}

/** The profile in plain data, for atlases and editors: sizes in world units and in logical pixels on screen. */
export function spaceData(space: SpaceProfile) {
  const px = (h: number) => Math.round(screenHeight(space.camera, h) * 100) / 100;
  return {
    projection: space.projection,
    preset: space.preset,
    walls: space.walls,
    scale: space.scale,
    screen: { cell: space.grid.screen, character: px(space.scale.character), wall: px(space.scale.wall), door: px(space.scale.door), fence: px(space.scale.fence) },
  };
}

/**
 * A scale figure: a plain, translucent mannequin of the project's character height standing at
 * `at`, for judging proportions next to scenery (the scene painter, `scenery-test`). It is a
 * checking aid, not art: games never draw it.
 */
export function scaleFigure(object: StageObject, at: Vec3, height: number, o: { color?: string; ink?: string } = {}): void {
  const fill = o.color ?? 'rgba(120, 200, 255, 0.38)';
  const ink = o.ink ?? 'rgba(20, 40, 60, 0.85)';
  object.custom(vec3(at.x, at.y, 0), (c, cam) => {
    const foot = cam.project(vec3(at.x, at.y, 0));
    const top = cam.project(vec3(at.x, at.y, height));
    const tall = foot.y - top.y;
    const head = tall * 0.13;
    const body = tall * 0.17;
    c.save();
    c.lineWidth = Math.max(1, tall * 0.018);
    c.strokeStyle = ink;
    c.fillStyle = fill;
    // Feet shadow, body (a rounded column) and head: proportions of an adult at the profile's height.
    c.beginPath();
    c.ellipse(foot.x, foot.y, body * 1.2, body * 1.2 * Math.sin((cam.tilt * Math.PI) / 180), 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(0, 0, 0, 0.18)';
    c.fill();
    c.fillStyle = fill;
    const shoulders = top.y + head * 2.1;
    c.beginPath();
    c.moveTo(foot.x - body * 0.8, foot.y);
    c.lineTo(foot.x - body, shoulders + body * 0.6);
    c.quadraticCurveTo(foot.x - body, shoulders, foot.x, shoulders);
    c.quadraticCurveTo(foot.x + body, shoulders, foot.x + body, shoulders + body * 0.6);
    c.lineTo(foot.x + body * 0.8, foot.y);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(top.x, top.y + head, head, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
  });
}
