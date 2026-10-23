/**
 * Helpers to write a scene as picture-maps: every row of a map is a string, every character a cell,
 * and a legend says which piece a character is. Sets stay readable as the plan they draw.
 *
 * Floors: the topmost floor of each cell (the lowest floor lies under every floored cell by itself).
 * Walls: the space profile (`../space.ts`) puts walls on cell BORDERS, so a wall map is one row and one column larger than
 * the floor map, `(rows + 1) × (cols + 1)`: a character is the VERTEX at the top-left corner of cell (col, row), where four
 * cells meet, and a run of walls goes from vertex to vertex along cell edges. Picture it laid over the floor map with every
 * wall character on a corner between cells; a room of N × M cells is enclosed by walls on rows 0 and M and columns 0 and N,
 * and the floor ends exactly under them. An empty vertex in a run is a doorway (one empty vertex: the opening between the
 * two end piers is about 1.6 cells; two: about 2.6). A wall id per vertex; `withCells` then gives single vertices a look of
 * their own.
 * Props: `{ piece, col, row, dir?, variant?, options? }` placed by hand (a prop's `col`/`row` is the cell
 * of its footprint's top-left corner).
 */

import type { SceneCell, SceneData, ScenePlacement } from '@core/volume';

/**
 * Rows of a map: one string per row, one character per cell (or per vertex, in a wall map); `legend` maps a character to a piece id
 * (anything else is empty). A wall legend may map a character to a `SceneCell` (`{ piece, height: 'fence' }` for a low wall).
 */
export function readMap<T extends SceneCell = string>(rows: string[], legend: Record<string, T>): (T | null)[][] {
  return rows.map(r => Array.from(r, ch => legend[ch] ?? null));
}

/**
 * A copy of a wall map with some vertices replaced: `[col, row, cell]` (the vertex at the top-left corner of cell (col, row)),
 * where a cell is a piece id or `{ piece, variant, height, options }` to choose that vertex's look and height (a broken top, a
 * fallen block, a low wall). The vertex must hold a wall or fence already: a look does not change what connects to what.
 * Note that a vertex draws a pier and half an arm towards each connected edge, so its look shows on both halves.
 */
export function withCells(map: (SceneCell | null)[][], edits: [col: number, row: number, cell: SceneCell][]): (SceneCell | null)[][] {
  const out = map.map(r => [...r]);
  for (const [col, row, cell] of edits) {
    if (!out[row]?.[col]) throw new Error(`scene: no wall at vertex (${col}, ${row}) to give a look`);
    out[row][col] = cell;
  }
  return out;
}

/**
 * A scene from a floor map and a wall map and its props. The floor map is `rows × cols` cells; the wall map is the
 * vertices, `(rows + 1) × (cols + 1)` (see the top of this file).
 */
export function sceneOf(o: { floor: (string | null)[][]; walls?: (SceneCell | null)[][]; props: ScenePlacement[]; materials?: Record<string, string>; options?: Record<string, Record<string, unknown>>; figures?: { col: number; row: number }[] }): SceneData {
  const rows = o.floor.length;
  const cols = o.floor[0].length;
  const walls = o.walls ?? Array.from({ length: rows + 1 }, () => Array<SceneCell | null>(cols + 1).fill(null));
  if (o.floor.some(r => r.length !== cols)) throw new Error('scene: every row of the floor map must have the same length');
  if (walls.length !== rows + 1 || walls.some(r => r.length !== cols + 1)) throw new Error(`scene: the wall map is the vertices, ${rows + 1} rows of ${cols + 1} (one more each way than the ${rows} × ${cols} floor), not ${walls.length} rows of ${walls[0]?.length}`);
  return { cols, rows, floor: o.floor, walls, props: o.props, ...(o.materials ? { materials: o.materials } : {}), ...(o.options ? { options: o.options } : {}), ...(o.figures ? { figures: o.figures } : {}) };
}
