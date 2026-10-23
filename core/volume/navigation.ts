/**
 * @core/volume - Scene navigation
 *
 * Where characters can go in a scene, as data a game (and the viewer's playground) reads: the cost
 * of entering each cell, the cell edges walls and closed doors block, the doors and the things to
 * interact with. Built from the scene and the pieces' `nav` (guide 05) and exported with every scene;
 * moving on it (a step, a path, collision) is the players' part: `@diorama/runtime`.
 */

import { EDGE } from './grid.js';
import { cellPiece, footprintOf, wallGridSize, wallPlacement, type SceneData, type ScenePieceInfo, type SceneryCatalog } from './scenery.js';

/** A cell of the grid. */
export interface NavCell {
  col: number;
  row: number;
}

/** Where characters can go in a scene. */
export interface SceneNavigation {
  cols: number;
  rows: number;
  /** Cost of entering each cell, `cost[row][col]`: 1 for plain ground, more for slow ground, 0 when it cannot be entered. */
  cost: number[][];
  /** Edges of each cell that cannot be crossed, `walls[row][col]`: N 1, E 2, S 4, W 8 (walls on borders, closed doors). */
  walls: number[][];
  /** Doors (on cell edges): the prop index in the scene, where, the state, and whether they let characters through now. */
  doors: { index: number; piece: string; col: number; row: number; edge: 'N' | 'W'; state?: string; open: boolean }[];
  /** Things to use (`nav.interact` of their piece, in a state of its `interactIn`): chests, levers, breakables, doors. `cells` are the cells a character uses them from. */
  interactables: { index: number; piece: string; kind: string; col: number; row: number; state?: string; cells: NavCell[] }[];
  /**
   * Walls on borders: the vertices where a blocking wall stands, `posts[row][col]` for the vertex at the
   * top-left corner of cell (col, row), (rows + 1) × (cols + 1): piers and lone pillars a body cannot walk
   * through even where no edge is closed (`moveIn` of `@diorama/runtime` keeps clear of them).
   */
  posts: boolean[][];
}

const find = (catalog: SceneryCatalog, id: string) => catalog.pieces.find(p => p.id === id);

/** Whether a piece can be used in a state (its `nav.interact`, limited by `nav.interactIn`). */
const usable = (info: ScenePieceInfo, state?: string) => !!info.nav?.interact && (!info.nav.interactIn || info.nav.interactIn.includes(state ?? info.states?.[0] ?? ''));

/** Whether a piece stops movement in a state (its `nav`, or the group's default). */
export function pieceBlocks(info: ScenePieceInfo, state?: string): boolean {
  const s = state ?? info.states?.[0];
  if (s !== undefined && info.nav?.passableIn?.includes(s)) return false;
  return info.nav?.blocks ?? (info.group !== 'floor' && info.group !== 'decal');
}

/**
 * The navigation of a scene:
 * - a cell without floor, or with a floor that blocks (deep water), cannot be entered; other
 *   floors cost their `nav.cost` (default 1);
 * - props that block (all by default, decals never) close the cells of their turned footprint,
 *   unless their state is passable (an urn once broken);
 * - walls on borders close the cell edges they run along; walls at cell centres close their cells;
 * - doors close their edge until their state is passable ('open').
 * `open` overrides door states by prop index (a game's live state).
 */
export function sceneNavigation(scene: SceneData, catalog: SceneryCatalog, o: { open?: Record<number, boolean> } = {}): SceneNavigation {
  const { cols, rows } = scene;
  const cost = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const id = scene.floor[r]?.[c];
      if (!id) return 0;
      const info = find(catalog, id);
      return !info || info.nav?.blocks ? 0 : (info.nav?.cost ?? 1);
    }),
  );
  const walls = Array.from({ length: rows }, () => Array(cols).fill(0) as number[]);
  const block = (c: number, r: number, bit: number) => {
    if (r >= 0 && r < rows && c >= 0 && c < cols) walls[r][c] |= bit;
  };
  // An edge between vertices (c, r) and (c + 1, r) runs between cells (c, r - 1) and (c, r); one between (c, r)
  // and (c, r + 1) runs between cells (c - 1, r) and (c, r).
  const blockH = (c: number, r: number) => (block(c, r - 1, EDGE.S), block(c, r, EDGE.N));
  const blockV = (c: number, r: number) => (block(c - 1, r, EDGE.E), block(c, r, EDGE.W));
  const doors: SceneNavigation['doors'] = [];
  const cuts = new Set<string>();
  scene.props.forEach((p, index) => {
    const info = find(catalog, p.piece);
    if (info?.group !== 'door') return;
    const open = o.open?.[index] ?? !pieceBlocks(info, p.state);
    doors.push({ index, piece: p.piece, col: p.col, row: p.row, edge: p.edge ?? 'N', state: p.state ?? info.states?.[0], open });
    cuts.add(p.edge === 'W' ? `${p.col},${p.row},V` : `${p.col},${p.row},H`);
    if (!open) (p.edge === 'W' ? blockV : blockH)(p.col, p.row);
  });
  const size = wallGridSize(catalog, cols, rows);
  const wallAt = (c: number, r: number) => (r >= 0 && r < size.rows && c >= 0 && c < size.cols ? cellPiece(scene.walls[r]?.[c]) : null);
  const blocking = (id: string | null) => !!id && pieceBlocks(find(catalog, id)!);
  const posts = Array.from({ length: rows + 1 }, () => Array(cols + 1).fill(false) as boolean[]);
  if (wallPlacement(catalog) === 'border') {
    for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) posts[r][c] = blocking(wallAt(c, r));
    for (let r = 0; r < size.rows; r++) for (let c = 0; c < size.cols; c++) {
      const id = wallAt(c, r);
      if (!blocking(id)) continue;
      const info = find(catalog, id!)!;
      const joins = (other: string | null) => !!other && (other === id || (info.joins ?? []).includes(other) || (find(catalog, other)!.joins ?? []).includes(id!));
      if (joins(wallAt(c + 1, r)) && blocking(wallAt(c + 1, r)) && !cuts.has(`${c},${r},H`)) blockH(c, r);
      if (joins(wallAt(c, r + 1)) && blocking(wallAt(c, r + 1)) && !cuts.has(`${c},${r},V`)) blockV(c, r);
    }
  } else {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (blocking(wallAt(c, r))) cost[r][c] = 0;
  }
  const interactables: SceneNavigation['interactables'] = [];
  scene.props.forEach((p, index) => {
    const info = find(catalog, p.piece);
    if (!info || info.group === 'door' || info.group === 'decal') return;
    const [w, d] = footprintOf(info, p.dir ?? 0);
    const cells: NavCell[] = [];
    for (let r = p.row; r < p.row + d; r++) for (let c = p.col; c < p.col + w; c++) cells.push({ col: c, row: r });
    if (pieceBlocks(info, p.state)) for (const cell of cells) if (cost[cell.row]?.[cell.col] !== undefined) cost[cell.row][cell.col] = 0;
    if (usable(info, p.state)) interactables.push({ index, piece: p.piece, kind: info.nav!.interact!, col: p.col, row: p.row, state: p.state ?? info.states?.[0], cells: neighbours(cells, cols, rows) });
  });
  for (const door of doors) {
    const info = find(catalog, door.piece)!;
    if (!usable(info, door.state)) continue;
    const sides = door.edge === 'N' ? [{ col: door.col, row: door.row - 1 }, { col: door.col, row: door.row }] : [{ col: door.col - 1, row: door.row }, { col: door.col, row: door.row }];
    interactables.push({ index: door.index, piece: door.piece, kind: info.nav!.interact!, col: door.col, row: door.row, state: door.state, cells: sides.filter(s => s.col >= 0 && s.row >= 0 && s.col < cols && s.row < rows) });
  }
  return { cols, rows, cost, walls, doors, interactables, posts };
}

/** The cells around a block of cells (4-neighbours), inside the scene: where a character stands to use what is on it. */
function neighbours(cells: NavCell[], cols: number, rows: number): NavCell[] {
  const inside = new Set(cells.map(c => `${c.col},${c.row}`));
  const out = new Map<string, NavCell>();
  for (const c of cells) for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const n = { col: c.col + dx, row: c.row + dy };
    const key = `${n.col},${n.row}`;
    if (!inside.has(key) && n.col >= 0 && n.row >= 0 && n.col < cols && n.row < rows) out.set(key, n);
  }
  return [...out.values()];
}
