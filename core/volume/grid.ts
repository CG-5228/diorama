/**
 * @core/volume - Grid and connection masks
 *
 * Scenery sits on a grid of cells on the floor. The camera tilts the floor, so a square world
 * cell projects to a fractional height; tiles must instead be a whole number of pixels or they
 * leave seams when a game lays them out. A `Grid` is therefore defined by the screen size of a
 * cell's top face and derives the world depth from the camera.
 *
 * Connectable pieces pick their drawing from a mask of their neighbours:
 * - edges (walls, fences, paths): N = 1, E = 2, S = 4, W = 8, the neighbours sharing an edge;
 * - corners (floor transitions on a dual grid): NW = 1, NE = 2, SE = 4, SW = 8, the four cells
 *   around a grid vertex that are covered by the material.
 * N is away from the camera (up the screen), S towards it.
 */

import { Polygon, type Shape } from '../draw/index.js';
import type { Camera } from './camera.js';
import { vec3, type Vec3 } from './vec3.js';

/** Edge bits of an edge mask. */
export const EDGE = { N: 1, E: 2, S: 4, W: 8 } as const;
/** Corner bits of a corner mask. */
export const CORNER = { NW: 1, NE: 2, SE: 4, SW: 8 } as const;

/** A floor grid with cells a whole number of pixels on screen. */
export class Grid {
  /** Logical pixels of a cell's top face on screen. */
  readonly screen: { w: number; h: number };
  /** World size of a cell: x across the screen, y in depth (towards the camera). */
  readonly cell: { x: number; y: number };

  private constructor(screen: { w: number; h: number }, cell: { x: number; y: number }) {
    this.screen = screen;
    this.cell = cell;
  }

  /**
   * A grid whose cells are `w` × `h` logical pixels on screen with this camera (e.g. 32 × 24):
   * world width `w`, world depth `h / sin(tilt)`. Export at a whole scale and the tiles stay
   * exact pixels.
   */
  static fromScreen(camera: Camera, w: number, h: number): Grid {
    const sy = Math.sin((camera.tilt * Math.PI) / 180);
    return new Grid({ w, h }, { x: w / camera.scale, y: h / sy / camera.scale });
  }

  /** World position of the centre of cell (col, row) on the floor, with cell (0, 0) centred on the origin. */
  center(col: number, row: number): Vec3 {
    return vec3(col * this.cell.x, row * this.cell.y, 0);
  }

  /** World position of the vertex between cells, at the top-left corner of cell (col, row). */
  vertex(col: number, row: number): Vec3 {
    return vec3((col - 0.5) * this.cell.x, (row - 0.5) * this.cell.y, 0);
  }
}

/** Edge mask of a cell from a predicate over cells (true where a connecting piece stands). */
export function edgeMask(at: (col: number, row: number) => boolean, col: number, row: number): number {
  return (at(col, row - 1) ? EDGE.N : 0) | (at(col + 1, row) ? EDGE.E : 0) | (at(col, row + 1) ? EDGE.S : 0) | (at(col - 1, row) ? EDGE.W : 0);
}

/**
 * Corner mask of the vertex at the top-left corner of cell (col, row): which of the four cells
 * around it are covered (true).
 */
export function cornerMask(covered: (col: number, row: number) => boolean, col: number, row: number): number {
  return (covered(col - 1, row - 1) ? CORNER.NW : 0) | (covered(col, row - 1) ? CORNER.NE : 0) | (covered(col, row) ? CORNER.SE : 0) | (covered(col - 1, row) ? CORNER.SW : 0);
}

const shapeCache = new Map<string, Shape>();

/**
 * The region of a dual-grid tile covered by a material, for a corner mask: the covered quarters
 * joined with rounded inner corners, in tile-local coordinates (x right, y towards the camera,
 * origin at the tile centre, size `w` × `d`). Where the region meets the tile's edges it is cut
 * straight, so neighbouring tiles join without seams. Computed once per mask and size.
 */
export function cornerMaskShape(mask: number, w: number, d: number, round = 0.32): Shape {
  const key = `${mask}:${w}:${d}:${round}`;
  const hit = shapeCache.get(key);
  if (hit) return hit.clone();
  const m = Math.max(w, d);
  const quarters: Shape[] = [];
  // Each covered quarter is grown past the tile's outer edges, so rounding only bites inside.
  const quarter = (sx: number, sy: number) => Polygon.rect(w / 2 + m, d / 2 + m, { cx: sx * (w / 2 + m) / 2, cy: sy * (d / 2 + m) / 2 });
  if (mask & CORNER.NW) quarters.push(quarter(-1, -1));
  if (mask & CORNER.NE) quarters.push(quarter(1, -1));
  if (mask & CORNER.SE) quarters.push(quarter(1, 1));
  if (mask & CORNER.SW) quarters.push(quarter(-1, 1));
  const tile = Polygon.rect(w, d);
  let region: Shape;
  if (quarters.length === 0) region = Polygon.rect(0.001, 0.001);
  else if (quarters.length === 4) region = tile;
  else {
    const union = quarters.length === 1 ? quarters[0] : quarters[0].union(quarters.slice(1));
    region = union.roundCorners(Math.min(w, d) * round).intersect(tile);
  }
  shapeCache.set(key, region);
  return region.clone();
}
