import { layoutScene, screenHeight, type SceneData, type SceneRenderer, type SceneryCatalog } from '@core/volume';
import type { Cell } from './edit';
import type { Geometry } from './render';

/** What a picture on the canvas is: a placed prop or decal (its index among the placements), or a wall or fence (its cell, or its vertex on borders). */
export type Target = { kind: 'prop'; index: number } | { kind: 'wall'; at: Cell };

/** A picture on the canvas: what it is and where it lies, in device px. */
export interface Sprite {
  target: Target;
  /** The frame itself, to outline its silhouette. */
  image: CanvasImageSource;
  context: CanvasRenderingContext2D;
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Pixels fainter than this are not the object: a ground glow or a soft shadow is not something to grab. */
const SOLID = 40;

/**
 * The pictures of a scene's props, decals, walls and fences, from the first drawn to the last, so the last one that has
 * a pixel under the pointer is the one on top. Laid out like the drawing (`layoutScene`) and read from the renderer's
 * cache: the frames are the ones already on screen, so the renderer must stand at this scale.
 */
export function spritesOf(scene: SceneData, catalog: SceneryCatalog, renderer: SceneRenderer, geo: Geometry, scale: number): Sprite[] {
  const base = catalog.camera.at(geo.origin);
  // Placements that share a piece and a place are drawn in the order they were placed.
  const waiting = new Map<string, number[]>();
  const keyOf = (piece: string, col: number, row: number, edge?: string) => `${piece}@${col},${row}${edge ? `,${edge}` : ''}`;
  scene.props.forEach((p, index) => {
    const key = keyOf(p.piece, p.col, p.row, p.edge);
    waiting.set(key, [...(waiting.get(key) ?? []), index]);
  });
  const sprites: Sprite[] = [];
  for (const item of layoutScene(scene, catalog)) {
    if (item.pass === 'floor') continue;
    const wall = item.group === 'wall' || item.group === 'fence';
    const index = wall ? undefined : waiting.get(keyOf(item.piece, item.col, item.row, item.edge))?.shift();
    if (!wall && index === undefined) continue;
    const frame = renderer.frame(item, scene.materials);
    const at = base.project(item.at);
    const context = frame.image.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (!context) continue;
    sprites.push({
      target: wall ? { kind: 'wall', at: { col: item.col, row: item.row } } : { kind: 'prop', index: index! },
      image: frame.image as CanvasImageSource,
      context,
      left: Math.round(at.x * scale - frame.x),
      top: Math.round(at.y * scale - frame.y),
      width: frame.image.width,
      height: frame.image.height,
    });
  }
  return sprites;
}

/**
 * What has a solid pixel under a point of the drawing (logical px), the top-most one among the kinds allowed;
 * undefined when the point is on none. Picking by the picture is how a prop is grabbed where it is seen, not where its cells are.
 */
export function spriteAt(sprites: Sprite[], scale: number, x: number, y: number, allow: { prop: boolean; wall: boolean } = { prop: true, wall: true }): Target | undefined {
  const dx = Math.floor(x * scale);
  const dy = Math.floor(y * scale);
  for (let i = sprites.length - 1; i >= 0; i--) {
    const s = sprites[i];
    if (!allow[s.target.kind]) continue;
    const px = dx - s.left;
    const py = dy - s.top;
    if (px < 0 || py < 0 || px >= s.width || py >= s.height) continue;
    if (s.context.getImageData(px, py, 1, 1).data[3] >= SOLID) return s.target;
  }
  return undefined;
}

/** Whether two targets are the same thing. */
export const sameTarget = (a: Target, b: Target) => (a.kind === 'prop' ? b.kind === 'prop' && a.index === b.index : b.kind === 'wall' && a.at.col === b.at.col && a.at.row === b.at.row);

/** The sprite of a target, if it is on screen. */
export const spriteOf = (sprites: Sprite[], target: Target) => sprites.find((s) => sameTarget(s.target, target));

/** Where a scale figure stands on the drawing, in logical px: the mannequin's height, and about a third of it across (the engine draws it as a rounded column and a head). Null without a space profile. */
export function figureBox(catalog: SceneryCatalog, geo: Geometry, figure: { col: number; row: number }): { x: number; y: number; width: number; height: number } | null {
  if (!catalog.space) return null;
  const foot = catalog.camera.at(geo.origin).project(catalog.grid.center(figure.col, figure.row));
  const tall = screenHeight(catalog.camera, catalog.space.scale.character);
  const body = tall * 0.17;
  return { x: foot.x - body, y: foot.y - tall, width: body * 2, height: tall };
}

/** The scale figure under a point of the drawing (logical px), the one standing nearest the camera when several overlap; undefined when none. */
export function figureAt(scene: SceneData, catalog: SceneryCatalog, geo: Geometry, x: number, y: number): number | undefined {
  const figures = scene.figures ?? [];
  let found: number | undefined;
  figures.forEach((figure, index) => {
    const box = figureBox(catalog, geo, figure);
    if (!box || x < box.x || x > box.x + box.width || y < box.y || y > box.y + box.height) return;
    if (found === undefined || figure.row >= figures[found].row) found = index;
  });
  return found;
}
