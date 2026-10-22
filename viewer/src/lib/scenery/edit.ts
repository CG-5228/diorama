import { cellPiece, emptyScene, footprintOf, wallGridSize, type SceneCell, type ScenePieceInfo, type SceneData, type ScenePlacement, type SceneryCatalog, type SpaceHeight } from '@core/volume';

/** Pure edits of a scene: every function returns a new scene, or the very same one when nothing changed. */

// The engine decides what a facing covers, what a wall cell holds and how big an empty scene is: the editor asks it, so both always agree.
export { cellPiece, emptyScene, footprintOf };

export type Layer = 'floor' | 'walls' | 'props';
/** What the eraser takes away: one layer (the props layer includes scale figures), or whatever is on top under the pointer. */
export type EraseLayer = Layer | 'all';
export interface Cell {
  col: number;
  row: number;
}

export const MIN_SIZE = 1;
export const MAX_SIZE = 64;

export const clampSize = (n: number) => Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(n) || MIN_SIZE));

const blank = (cols: number, rows: number): null[][] => Array.from({ length: rows }, () => Array<null>(cols).fill(null));

export const inside = (scene: SceneData, { col, row }: Cell) => col >= 0 && row >= 0 && col < scene.cols && row < scene.rows;

/**
 * Whether the scene's walls stand on the borders between cells: its wall grid is then one larger each way, and entry
 * `walls[row][col]` is the vertex at the top-left corner of cell (col, row). Read from the scene itself, so every edit
 * agrees with the data it is given (a scene saved for another profile is the validator's to report).
 */
export const wallsOnBorders = (scene: SceneData) => scene.walls.length > scene.rows;

/** Size of a layer's grid: the cells, or for walls on borders the vertices. */
const gridOf = (scene: SceneData, layer: 'floor' | 'walls') => (layer === 'walls' ? { cols: scene.walls[0]?.length ?? 0, rows: scene.walls.length } : { cols: scene.cols, rows: scene.rows });

/** Whether a cell (or, for walls on borders, a vertex) lies in the layer's grid. */
export function insideLayer(scene: SceneData, layer: 'floor' | 'walls', { col, row }: Cell): boolean {
  const size = gridOf(scene, layer);
  return col >= 0 && row >= 0 && col < size.cols && row < size.rows;
}

const indexes = new WeakMap<SceneryCatalog, Map<string, ScenePieceInfo>>();

/** A piece by id: looked up in a map built once per catalog, since a drag asks for it at every pointer move. */
export function pieceOf(catalog: SceneryCatalog, id: string): ScenePieceInfo | undefined {
  let index = indexes.get(catalog);
  if (!index) indexes.set(catalog, (index = new Map(catalog.pieces.map((p) => [p.id, p]))));
  return index.get(id);
}

/**
 * What a wall cell holds when `piece` is painted at `height`: the plain id for the default height, an object that names
 * the height otherwise. A cell that already holds the piece keeps its variant and options.
 */
function wallEntry(current: SceneCell | null, piece: string, height: SpaceHeight | undefined): SceneCell {
  const own = typeof current === 'object' && current && current.piece === piece ? current : null;
  if (!own) return height === undefined ? piece : { piece, height };
  const { height: _old, ...rest } = own;
  const next = height === undefined ? rest : { ...rest, height };
  return Object.keys(next).length === 1 ? piece : next;
}

/**
 * Paints one cell of the floor, or one cell (one vertex, on borders) of the walls layer; `null` erases it. A wall is
 * painted at `height`, one of its piece's `heights`; leave it out for the piece's default height.
 */
export function paint(scene: SceneData, layer: 'floor' | 'walls', at: Cell, id: string | null, height?: SpaceHeight): SceneData {
  if (!insideLayer(scene, layer, at)) return scene;
  const current = scene[layer][at.row][at.col];
  // Nothing to do when the cell already holds it (a wall also at the same height).
  const there = id !== null && current !== null && cellPiece(current) === id && (layer === 'floor' || (typeof current === 'object' ? current.height : undefined) === height);
  if (id === null ? current === null : there) return scene;
  const entry = id === null ? null : layer === 'walls' ? wallEntry(current as SceneCell | null, id, height) : id;
  return { ...scene, [layer]: scene[layer].map((line, r) => (r === at.row ? line.map((cell, c) => (c === at.col ? entry : cell)) : line)) };
}

/** The cells on the straight line between two cells, ends included: a fast stroke leaves no gaps. */
export function lineBetween(from: Cell, to: Cell): Cell[] {
  const cells: Cell[] = [];
  let { col, row } = from;
  const dc = Math.abs(to.col - col);
  const dr = -Math.abs(to.row - row);
  const sc = col < to.col ? 1 : -1;
  const sr = row < to.row ? 1 : -1;
  let error = dc + dr;
  for (;;) {
    cells.push({ col, row });
    if (col === to.col && row === to.row) return cells;
    const doubled = 2 * error;
    if (doubled >= dr) {
      error += dr;
      col += sc;
    }
    if (doubled <= dc) {
      error += dc;
      row += sr;
    }
  }
}

/**
 * The vertices from one vertex to another, ends included, each joined to the next along a cell border: a diagonal
 * step goes through a corner vertex, so a stroke of walls is one connected run and never a string of loose posts.
 */
export function vertexPath(from: Cell, to: Cell): Cell[] {
  const sc = Math.sign(to.col - from.col);
  const sr = Math.sign(to.row - from.row);
  const nc = Math.abs(to.col - from.col);
  const nr = Math.abs(to.row - from.row);
  const path: Cell[] = [{ ...from }];
  let { col, row } = from;
  // Walk along the straight line, one cell border at a time; where it would cut a corner, take the corner.
  for (let ic = 0, ir = 0; ic < nc || ir < nr; ) {
    const side = (1 + 2 * ic) * nr - (1 + 2 * ir) * nc;
    if (side === 0) {
      col += sc;
      path.push({ col, row });
      row += sr;
      ic++;
      ir++;
    } else if (side < 0) {
      col += sc;
      ic++;
    } else {
      row += sr;
      ir++;
    }
    path.push({ col, row });
  }
  return path;
}

/** The cells a stroke from one cell (vertex) to another covers on a layer: a connected run of vertices for walls on borders, a straight line otherwise. */
export const pathBetween = (scene: SceneData, layer: Layer, from: Cell, to: Cell): Cell[] => (layer === 'walls' && wallsOnBorders(scene) ? vertexPath(from, to) : lineBetween(from, to));

export function paintLine(scene: SceneData, layer: 'floor' | 'walls', from: Cell, to: Cell, id: string | null, height?: SpaceHeight): SceneData {
  return pathBetween(scene, layer, from, to).reduce((next, cell) => paint(next, layer, cell, id, height), scene);
}

/** Fills the region of equal cells around `at` (4-connected). */
export function fill(scene: SceneData, layer: 'floor' | 'walls', at: Cell, id: string | null): SceneData {
  if (!inside(scene, at)) return scene;
  const target = cellPiece(scene[layer][at.row][at.col]);
  if (target === id) return scene;
  const grid = scene[layer].map((line) => [...line]);
  const stack = [at];
  while (stack.length) {
    const { col, row } = stack.pop()!;
    if (col < 0 || row < 0 || col >= scene.cols || row >= scene.rows || cellPiece(grid[row][col]) !== target) continue;
    grid[row][col] = id;
    stack.push({ col: col + 1, row }, { col: col - 1, row }, { col, row: row + 1 }, { col, row: row - 1 });
  }
  return { ...scene, [layer]: grid };
}

/** Whether a piece's footprint (facing `dir`) with its top-left corner at `at` lies inside the scene. */
export function fits(scene: SceneData, info: ScenePieceInfo, at: Cell, dir = 0): boolean {
  const [w, d] = footprintOf(info, dir);
  return at.col >= 0 && at.row >= 0 && at.col + w <= scene.cols && at.row + d <= scene.rows;
}

/** A top-left cell pulled back so the footprint (facing `dir`) stays inside the scene. */
export function clampAnchor(scene: SceneData, info: ScenePieceInfo, at: Cell, dir = 0): Cell {
  const [w, d] = footprintOf(info, dir);
  return { col: Math.max(0, Math.min(scene.cols - w, at.col)), row: Math.max(0, Math.min(scene.rows - d, at.row)) };
}

/** The top-left cell for a footprint centred on a cell, pulled back inside the scene. */
export function anchorFor(scene: SceneData, info: ScenePieceInfo, centre: Cell, dir = 0): Cell {
  const [w, d] = footprintOf(info, dir);
  return clampAnchor(scene, info, { col: centre.col - Math.floor((w - 1) / 2), row: centre.row - Math.floor((d - 1) / 2) }, dir);
}

/**
 * Places a prop or decal with its top-left cell at `at`. A variant is stored when one is given (index 0 included): a
 * placement without one gets the look the engine picks from its position, which is what "automatic" means.
 */
export function placeProp(scene: SceneData, info: ScenePieceInfo, at: Cell, extra: { dir?: number; variant?: number; state?: string } = {}): SceneData {
  if (!fits(scene, info, at, extra.dir ?? 0)) return scene;
  const placement: ScenePlacement = { piece: info.id, col: at.col, row: at.row, ...(extra.dir ? { dir: extra.dir } : {}), ...(extra.variant !== undefined ? { variant: extra.variant } : {}), ...stateEntry(info, extra.state) };
  return { ...scene, props: [...scene.props, placement] };
}

/** The `state` entry of a placement: none for the piece's default (its first state) or one it does not have. */
const stateEntry = (info: ScenePieceInfo, state: string | undefined): { state?: string } => (state !== undefined && state !== info.states?.[0] && info.states?.includes(state) ? { state } : {});

/**
 * An edge of a cell, where a door stands: 'N' is the north edge of cell (col, row), 'W' its west edge. `col` may be
 * `cols` for a west edge and `row` `rows` for a north edge, on the scene's outer border.
 */
export interface Edge {
  col: number;
  row: number;
  edge: 'N' | 'W';
}

export const sameEdge = (a: Edge | null | undefined, b: Edge | null | undefined) => !!a && !!b && a.col === b.col && a.row === b.row && a.edge === b.edge;

/** Doors are the placements on an edge. */
export const isDoor = (placement: ScenePlacement) => placement.edge !== undefined;

/** The edge a door placement stands on. */
export const edgeOf = (door: ScenePlacement): Edge => ({ col: door.col, row: door.row, edge: door.edge ?? 'N' });

/** Whether an edge lies on the scene (the outer border included). */
export const edgeInside = (scene: SceneData, e: Edge) => (e.edge === 'N' ? e.col >= 0 && e.col < scene.cols && e.row >= 0 && e.row <= scene.rows : e.col >= 0 && e.col <= scene.cols && e.row >= 0 && e.row < scene.rows);

/** The door on an edge: its index among the placements, or -1. */
export const doorAt = (scene: SceneData, e: Edge) => scene.props.findIndex((p) => isDoor(p) && sameEdge(edgeOf(p), e));

/** The facing a door is turned to when it is flipped to its other side: north on a north edge, west on a west one (none for a piece with one facing). */
function flippedDir(info: ScenePieceInfo, edge: 'N' | 'W'): number | undefined {
  const n = info.directions ?? 1;
  return n < 2 ? undefined : edge === 'N' ? n / 2 : n / 4;
}

/** Whether a door is turned to its other side: the engine's default faces across the edge (south for a north edge, east for a west one). */
export const isFlipped = (info: ScenePieceInfo, door: ScenePlacement) => door.dir !== undefined && door.dir === flippedDir(info, door.edge ?? 'N');

/** Whether a door piece has two sides to turn between. */
export const canFlip = (info: ScenePieceInfo) => flippedDir(info, 'N') !== undefined;

/** Puts a door on an edge; refused (same scene) where the edge is outside the scene or already has a door. */
export function placeDoor(scene: SceneData, info: ScenePieceInfo, e: Edge, extra: { flip?: boolean; state?: string; variant?: number } = {}): SceneData {
  if (!edgeInside(scene, e) || doorAt(scene, e) >= 0) return scene;
  const dir = extra.flip ? flippedDir(info, e.edge) : undefined;
  const placement: ScenePlacement = { piece: info.id, col: e.col, row: e.row, edge: e.edge, ...(dir !== undefined ? { dir } : {}), ...(extra.variant !== undefined ? { variant: extra.variant } : {}), ...stateEntry(info, extra.state) };
  return { ...scene, props: [...scene.props, placement] };
}

/** Moves a door to another edge, keeping the side it faces; refused (same scene) where the edge is outside the scene or taken. */
export function moveDoor(scene: SceneData, catalog: SceneryCatalog, index: number, e: Edge): SceneData {
  const door = scene.props[index];
  const info = door && isDoor(door) ? pieceOf(catalog, door.piece) : undefined;
  if (!door || !info || sameEdge(edgeOf(door), e) || !edgeInside(scene, e) || doorAt(scene, e) >= 0) return scene;
  const { dir: _dir, ...rest } = door;
  const dir = isFlipped(info, door) ? flippedDir(info, e.edge) : undefined;
  return replaceProp(scene, index, { ...rest, ...e, ...(dir !== undefined ? { dir } : {}) });
}

/** Turns a door to its other side. */
export function flipDoor(scene: SceneData, catalog: SceneryCatalog, index: number): SceneData {
  const door = scene.props[index];
  const info = door && isDoor(door) ? pieceOf(catalog, door.piece) : undefined;
  if (!door || !info || !canFlip(info)) return scene;
  const { dir: _dir, ...rest } = door;
  const dir = isFlipped(info, door) ? undefined : flippedDir(info, door.edge ?? 'N');
  return replaceProp(scene, index, dir !== undefined ? { ...rest, dir } : rest);
}

/** Sets the resting state of a placement (a door, a chest, an urn); the piece's first state is the default and is not stored. */
export function setState(scene: SceneData, catalog: SceneryCatalog, index: number, state: string | undefined): SceneData {
  const prop = scene.props[index];
  const info = prop && pieceOf(catalog, prop.piece);
  if (!prop || !info?.states || (state !== undefined && !info.states.includes(state))) return scene;
  const { state: _old, ...rest } = prop;
  return replaceProp(scene, index, { ...rest, ...stateEntry(info, state) });
}

/** Placements covering a cell, the one drawn last (on top) first. Doors stand on edges, not in cells: they are found by their picture. */
export function propsAt(scene: SceneData, catalog: SceneryCatalog, at: Cell): number[] {
  const hits: number[] = [];
  scene.props.forEach((p, i) => {
    if (isDoor(p)) return;
    const info = pieceOf(catalog, p.piece);
    const [w, d] = info ? footprintOf(info, p.dir ?? 0) : [1, 1];
    if (at.col >= p.col && at.col < p.col + w && at.row >= p.row && at.row < p.row + d) hits.push(i);
  });
  return hits.reverse();
}

function replaceProp(scene: SceneData, index: number, next: ScenePlacement): SceneData {
  return { ...scene, props: scene.props.map((p, i) => (i === index ? next : p)) };
}

/** Moves a placement so its top-left corner is at `at`; refused (same scene) when it would not fit. */
export function moveProp(scene: SceneData, catalog: SceneryCatalog, index: number, at: Cell): SceneData {
  const prop = scene.props[index];
  const info = prop && pieceOf(catalog, prop.piece);
  if (!info || isDoor(prop) || !fits(scene, info, at, prop.dir ?? 0) || (prop.col === at.col && prop.row === at.row)) return scene;
  return replaceProp(scene, index, { ...prop, ...at });
}

/** Turns a placement to the next (1) or previous (-1) of its piece's facings. */
export function rotateProp(scene: SceneData, catalog: SceneryCatalog, index: number, delta: 1 | -1): SceneData {
  const prop = scene.props[index];
  const info = prop && pieceOf(catalog, prop.piece);
  const count = info?.directions ?? 1;
  if (prop && isDoor(prop)) return flipDoor(scene, catalog, index);
  if (!prop || count <= 1) return scene;
  return setDirection(scene, catalog, index, (((prop.dir ?? 0) + delta) % count + count) % count);
}

/** Sets the facing of a placement; 0 (facing the camera) is the default and is not stored. */
export function setDirection(scene: SceneData, catalog: SceneryCatalog, index: number, dir: number): SceneData {
  const prop = scene.props[index];
  const info = prop && pieceOf(catalog, prop.piece);
  // Turning to face W or E turns the footprint: refused where the turned one would not fit.
  if (!prop || !info || isDoor(prop) || dir < 0 || dir >= (info.directions ?? 1) || dir === (prop.dir ?? 0) || !fits(scene, info, prop, dir)) return scene;
  const { dir: _old, ...rest } = prop;
  return replaceProp(scene, index, dir ? { ...rest, dir } : rest);
}

/** Chooses the look of a placement; `undefined` leaves it to the engine, which picks one from the position. */
export function setVariant(scene: SceneData, index: number, variant: number | undefined): SceneData {
  const { variant: _old, ...rest } = scene.props[index];
  return replaceProp(scene, index, variant !== undefined ? { ...rest, variant } : rest);
}

/** Sets an option of one placement; a value equal to the piece's default is dropped. */
export function setPropOption(scene: SceneData, index: number, key: string, value: unknown, defaultValue: unknown): SceneData {
  const prop = scene.props[index];
  const { [key]: _old, ...rest } = prop.options ?? {};
  const options = value === defaultValue ? rest : { ...rest, [key]: value };
  const { options: _options, ...bare } = prop;
  return replaceProp(scene, index, Object.keys(options).length ? { ...bare, options } : bare);
}

/** Copies a placement one cell to the right (or below, or in its place when there is no room); the copy is the last placement. A door is not copied: an edge holds one. */
export function duplicateProp(scene: SceneData, catalog: SceneryCatalog, index: number): SceneData {
  const prop = scene.props[index];
  const info = prop && pieceOf(catalog, prop.piece);
  if (!prop || !info || isDoor(prop)) return scene;
  const dir = prop.dir ?? 0;
  const [w, d] = footprintOf(info, dir);
  const beside = [{ col: prop.col + w, row: prop.row }, { col: prop.col, row: prop.row + d }].find((at) => fits(scene, info, at, dir));
  const at = beside ?? { col: prop.col, row: prop.row };
  return { ...scene, props: [...scene.props, { ...prop, ...at }] };
}

export function removeProp(scene: SceneData, index: number): SceneData {
  return index < 0 || index >= scene.props.length ? scene : { ...scene, props: scene.props.filter((_, i) => i !== index) };
}

/** What a click with the eyedropper finds: the top-most thing at a cell among the visible layers. A wall carries its height when it is not the piece's default. */
export type Picked = { kind: 'prop'; index: number } | { kind: 'wall'; id: string; height?: SpaceHeight } | { kind: 'floor'; id: string };

/**
 * The top-most thing at `at` among the visible layers. Walls on borders are found by `wall`, the vertex the pointer is
 * near (or null when it is near none); with walls through cell centres it is the cell itself.
 */
export function pickAt(
  scene: SceneData,
  catalog: SceneryCatalog,
  at: Cell,
  visible: Record<Layer, boolean> = { floor: true, walls: true, props: true },
  wall: Cell | null = at,
): Picked | null {
  // A wall is tall: its picture reaches above the scene, so a wall can be picked from a cell that is outside it.
  const within = inside(scene, at);
  const [prop] = visible.props && within ? propsAt(scene, catalog, at) : [];
  if (prop !== undefined) return { kind: 'prop', index: prop };
  const entry = visible.walls && wall && insideLayer(scene, 'walls', wall) ? scene.walls[wall.row][wall.col] : null;
  const id = cellPiece(entry);
  if (id) return { kind: 'wall', id, ...(typeof entry === 'object' && entry?.height !== undefined ? { height: entry.height } : {}) };
  const floor = within ? cellPiece(scene.floor[at.row][at.col]) : null;
  return floor && visible.floor ? { kind: 'floor', id: floor } : null;
}

/** A layer cut or padded with empty cells to a size, from its top-left corner. */
const crop = <T>(layer: (T | null)[][], cols: number, rows: number) => Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => layer[row]?.[col] ?? null));

/**
 * Changes the size of the scene, keeping the top-left corner; placements and figures that no longer fit are dropped.
 * The walls grid follows the catalog's placement (one larger each way on borders).
 */
export function resize(scene: SceneData, catalog: SceneryCatalog, cols: number, rows: number): SceneData {
  const c = clampSize(cols);
  const r = clampSize(rows);
  if (c === scene.cols && r === scene.rows) return scene;
  const w = wallGridSize(catalog, c, r);
  const next: SceneData = { ...scene, cols: c, rows: r, floor: crop(scene.floor, c, r), walls: crop(scene.walls, w.cols, w.rows) };
  const props = scene.props.filter((p) => {
    const info = pieceOf(catalog, p.piece);
    return isDoor(p) ? edgeInside(next, edgeOf(p)) : !info || fits(next, info, p, p.dir ?? 0);
  });
  const { figures, ...bare } = next;
  const kept = (figures ?? []).filter((f) => inside(next, f));
  return { ...bare, props, ...(kept.length ? { figures: kept } : {}) };
}

/** Puts a scale figure on a cell, or takes the one that stands there away. */
export function toggleFigure(scene: SceneData, at: Cell): SceneData {
  if (!inside(scene, at)) return scene;
  const { figures = [], ...bare } = scene;
  const there = figures.some((f) => f.col === at.col && f.row === at.row);
  const next = there ? figures.filter((f) => f.col !== at.col || f.row !== at.row) : [...figures, { col: at.col, row: at.row }];
  return next.length ? { ...bare, figures: next } : bare;
}

/** Sets which theme material plays a role for the whole scene; `undefined` takes the override out. */
export function setSceneMaterial(scene: SceneData, role: string, name: string | undefined): SceneData {
  const { [role]: _old, ...rest } = scene.materials ?? {};
  const materials = name ? { ...rest, [role]: name } : rest;
  const { materials: _materials, ...bare } = scene;
  return Object.keys(materials).length ? { ...bare, materials } : bare;
}

/** Roles the pieces used in the scene read, in the order they appear: the ones a material can be chosen for. */
export function rolesInScene(scene: SceneData, catalog: SceneryCatalog): string[] {
  const used = new Set<string>([...scene.floor.flat(), ...scene.walls.flat()].map(cellPiece).concat(scene.props.map((p) => p.piece)).filter((id): id is string => !!id));
  const roles = new Set<string>();
  for (const info of catalog.pieces) if (used.has(info.id)) info.roles.forEach((role) => roles.add(role));
  return [...roles];
}

/** The scene with some layers hidden, for drawing; the original is untouched. */
export function withLayers(scene: SceneData, visible: Record<Layer, boolean>): SceneData {
  if (visible.floor && visible.walls && visible.props) return scene;
  const walls = gridOf(scene, 'walls');
  return { ...scene, floor: visible.floor ? scene.floor : blank(scene.cols, scene.rows), walls: visible.walls ? scene.walls : blank(walls.cols, walls.rows), props: visible.props ? scene.props : [] };
}

/** What is selected in the scene: a prop or decal (its index among the placements), a wall (its cell, or vertex on borders), a scale figure (its index) or a floor cell. */
export type Selection = { kind: 'prop'; index: number } | { kind: 'wall'; at: Cell } | { kind: 'figure'; index: number } | { kind: 'floor'; at: Cell };

/** The selection if it still points at something: undo, an erase or a resize can leave it pointing at nothing. */
export function validSelection(scene: SceneData, selection: Selection | null): Selection | null {
  if (!selection) return null;
  switch (selection.kind) {
    case 'prop':
      return selection.index < scene.props.length ? selection : null;
    case 'figure':
      return selection.index < (scene.figures?.length ?? 0) ? selection : null;
    case 'wall':
      return insideLayer(scene, 'walls', selection.at) && scene.walls[selection.at.row][selection.at.col] !== null ? selection : null;
    case 'floor':
      return inside(scene, selection.at) && scene.floor[selection.at.row][selection.at.col] !== null ? selection : null;
  }
}

/** A wall cell as an object, whether it is stored as an id or as one: its piece, variant, height and options. */
export type WallLook = { piece: string; variant?: number; height?: SpaceHeight; options?: Record<string, unknown> };

export function wallAt(scene: SceneData, at: Cell): WallLook | null {
  if (!insideLayer(scene, 'walls', at)) return null;
  const entry = scene.walls[at.row][at.col];
  return entry === null ? null : typeof entry === 'string' ? { piece: entry } : entry;
}

/** Changes a wall cell's look; the cell goes back to a plain id when nothing but the piece is left. */
function changeWall(scene: SceneData, at: Cell, change: (look: WallLook) => WallLook): SceneData {
  const look = wallAt(scene, at);
  if (!look) return scene;
  const next = change(look);
  const entry: SceneCell = Object.keys(next).length === 1 ? next.piece : next;
  return { ...scene, walls: scene.walls.map((line, r) => (r === at.row ? line.map((cell, c) => (c === at.col ? entry : cell)) : line)) };
}

/** Sets the height of the wall at a cell; `undefined` is the piece's default. */
export function setWallHeight(scene: SceneData, at: Cell, height: SpaceHeight | undefined): SceneData {
  return changeWall(scene, at, ({ height: _old, ...rest }) => (height === undefined ? rest : { ...rest, height }));
}

/** Chooses the look of the wall at a cell; `undefined` leaves it to the engine, which picks one from the position. */
export function setWallVariant(scene: SceneData, at: Cell, variant: number | undefined): SceneData {
  return changeWall(scene, at, ({ variant: _old, ...rest }) => (variant === undefined ? rest : { ...rest, variant }));
}

/** Sets an option of the wall at a cell; a value equal to the piece's default is dropped. */
export function setWallOption(scene: SceneData, at: Cell, key: string, value: unknown, defaultValue: unknown): SceneData {
  return changeWall(scene, at, ({ options, ...rest }) => {
    const { [key]: _old, ...others } = options ?? {};
    const next = value === defaultValue ? others : { ...others, [key]: value };
    return Object.keys(next).length ? { ...rest, options: next } : rest;
  });
}

export const removeFigure = (scene: SceneData, index: number): SceneData => {
  const { figures = [], ...bare } = scene;
  const next = figures.filter((_, i) => i !== index);
  return index < 0 || index >= figures.length ? scene : next.length ? { ...bare, figures: next } : bare;
};

/** Moves a scale figure to another cell of the scene (not onto another figure). */
export function moveFigure(scene: SceneData, index: number, at: Cell): SceneData {
  const figures = scene.figures ?? [];
  const figure = figures[index];
  if (!figure || !inside(scene, at) || (figure.col === at.col && figure.row === at.row) || figures.some((f) => f.col === at.col && f.row === at.row)) return scene;
  return { ...scene, figures: figures.map((f, i) => (i === index ? { col: at.col, row: at.row } : f)) };
}

/** Moves the wall at a cell (or vertex) to an empty one, with its height, look and options; refused (same scene) where the target is outside or taken. */
export function moveWall(scene: SceneData, from: Cell, to: Cell): SceneData {
  const entry = insideLayer(scene, 'walls', from) ? scene.walls[from.row][from.col] : null;
  if (!entry || !insideLayer(scene, 'walls', to) || (from.col === to.col && from.row === to.row) || scene.walls[to.row][to.col] !== null) return scene;
  return { ...scene, walls: scene.walls.map((line, r) => line.map((cell, c) => (r === from.row && c === from.col ? null : r === to.row && c === to.col ? entry : cell))) };
}

/** Takes what is selected out of the scene (a floor cell is emptied). */
export function removeSelected(scene: SceneData, selection: Selection): SceneData {
  switch (selection.kind) {
    case 'prop':
      return removeProp(scene, selection.index);
    case 'figure':
      return removeFigure(scene, selection.index);
    case 'wall':
      return paint(scene, 'walls', selection.at, null);
    case 'floor':
      return paint(scene, 'floor', selection.at, null);
  }
}

/**
 * Takes several things out at once. Placements and figures are numbered, so they go from the last to the first: the
 * numbers of the ones still to go are then still right.
 */
export function removeMany(scene: SceneData, targets: Selection[]): SceneData {
  const byIndex = (kind: 'prop' | 'figure') => targets.flatMap((t) => (t.kind === kind ? [t.index] : [])).sort((a, b) => b - a);
  const ordered: Selection[] = [
    ...byIndex('prop').map((index): Selection => ({ kind: 'prop', index })),
    ...byIndex('figure').map((index): Selection => ({ kind: 'figure', index })),
    ...targets.filter((t) => t.kind === 'wall' || t.kind === 'floor'),
  ];
  return ordered.reduce(removeSelected, scene);
}

/** Pushes what is selected one step: props, walls and figures move; a floor cell stays. */
export function nudgeSelected(scene: SceneData, catalog: SceneryCatalog, selection: Selection, by: Cell): SceneData {
  if (selection.kind === 'prop') {
    const prop = scene.props[selection.index];
    if (prop && isDoor(prop)) return moveDoor(scene, catalog, selection.index, { ...edgeOf(prop), col: prop.col + by.col, row: prop.row + by.row });
    return prop ? moveProp(scene, catalog, selection.index, { col: prop.col + by.col, row: prop.row + by.row }) : scene;
  }
  if (selection.kind === 'wall') return moveWall(scene, selection.at, { col: selection.at.col + by.col, row: selection.at.row + by.row });
  if (selection.kind !== 'figure') return scene;
  const figure = scene.figures?.[selection.index];
  return figure ? moveFigure(scene, selection.index, { col: figure.col + by.col, row: figure.row + by.row }) : scene;
}

export const countCells = (layer: unknown[][]) => layer.reduce((sum: number, line) => sum + line.filter(Boolean).length, 0);
