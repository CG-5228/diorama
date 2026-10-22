import type { SceneData, ScenePieceInfo, SceneryCatalog, SpaceHeight } from '@core/volume';
import { clampAnchor, edgeOf, moveDoor, moveFigure, moveProp, moveWall, paintLine, pieceOf, removeMany, removeProp, sameEdge, type Cell, type Edge, type Selection } from './edit';

/**
 * What a drag does to the scene. A stroke is pure: `advance` returns the next one for a new cell, and `scene` is what
 * the canvas shows meanwhile; the canvas keeps the stroke in a ref and commits `resultOf` once, when the pointer is up.
 */
export type Stroke =
  /** On the walls layer with walls on borders, `last` and every cell are vertices; `height` is the wall's, left out for the piece's default. */
  | { kind: 'paint'; layer: 'floor' | 'walls'; id: string | null; height?: SpaceHeight; last: Cell; scene: SceneData }
  /** The eraser: takes away what is under the pointer, once for each cell (or vertex) it enters. `visited` names them. */
  | { kind: 'sweep'; visited: ReadonlySet<string>; scene: SceneData }
  /** `base` is the scene the drag started from; `scene` leaves the prop out once it has left its cell, so only its ghost moves. */
  | { kind: 'move'; index: number; offset: Cell; at: Cell; base: SceneData; scene: SceneData }
  /** A wall dragged from `from` to `at` (vertices on borders): it is moved in `scene` as it goes, so the run it joins redraws live. */
  | { kind: 'move-wall'; from: Cell; offset: Cell; at: Cell; base: SceneData; scene: SceneData }
  /** A scale figure dragged to `at`. */
  | { kind: 'move-figure'; index: number; offset: Cell; at: Cell; base: SceneData; scene: SceneData }
  /** A door dragged along the edges: it is moved in `scene` as it goes (the wall run it cuts redraws live). */
  | { kind: 'move-door'; index: number; at: Edge; base: SceneData; scene: SceneData };

/** Whether a stroke carries something from one place to another (a prop, a wall, a figure or a door). */
export const isMove = (stroke: Stroke): stroke is Extract<Stroke, { base: SceneData }> => stroke.kind === 'move' || stroke.kind === 'move-wall' || stroke.kind === 'move-figure' || stroke.kind === 'move-door';

/** Whether what is carried has left the place it was grabbed at. */
export const isCarrying = (stroke: Stroke | null) => !!stroke && isMove(stroke) && stroke.scene !== stroke.base;

export const same = (a: Cell | null, b: Cell | null) => a?.col === b?.col && a?.row === b?.row;

export function startPaint(scene: SceneData, layer: 'floor' | 'walls', id: string | null, cell: Cell, height?: SpaceHeight): Stroke {
  return { kind: 'paint', layer, id, ...(height !== undefined ? { height } : {}), last: cell, scene: paintLine(scene, layer, cell, cell, id, height) };
}

export const startSweep = (scene: SceneData): Stroke => ({ kind: 'sweep', visited: new Set(), scene });

/**
 * The sweep after the pointer visited some spots: each names its cell (`key`) and what is under the pointer there.
 * They go in one edit, so the scene changes once however many samples the pointer made since the last event. The
 * cells are remembered, so the canvas can leave the floor of a cell alone where a prop just went: a slow drag over a
 * prop takes the prop, not also the ground it stood on.
 */
export function sweepSpots(stroke: Extract<Stroke, { kind: 'sweep' }>, spots: { key: string; target: Selection }[]): Stroke {
  if (!spots.length) return stroke;
  const scene = removeMany(stroke.scene, spots.map((spot) => spot.target));
  return scene === stroke.scene ? stroke : { kind: 'sweep', visited: new Set([...stroke.visited, ...spots.map((spot) => spot.key)]), scene };
}

/** Drags the prop at `index`, grabbed at `cell`: it keeps the same offset to the pointer. */
export function startMove(scene: SceneData, index: number, cell: Cell): Stroke {
  const prop = scene.props[index];
  return { kind: 'move', index, offset: { col: cell.col - prop.col, row: cell.row - prop.row }, at: { col: prop.col, row: prop.row }, base: scene, scene };
}

/** Drags the wall at `from` (a vertex on borders), grabbed with the pointer at `pointer`. */
export function startMoveWall(scene: SceneData, from: Cell, pointer: Cell): Stroke {
  return { kind: 'move-wall', from, offset: { col: pointer.col - from.col, row: pointer.row - from.row }, at: from, base: scene, scene };
}

/** Drags the scale figure at `index`, grabbed with the pointer at `pointer`. */
export function startMoveFigure(scene: SceneData, index: number, pointer: Cell): Stroke {
  const figure = scene.figures![index];
  return { kind: 'move-figure', index, offset: { col: pointer.col - figure.col, row: pointer.row - figure.row }, at: { col: figure.col, row: figure.row }, base: scene, scene };
}

/** Drags the door at `index`. */
export function startMoveDoor(scene: SceneData, index: number): Stroke {
  return { kind: 'move-door', index, at: edgeOf(scene.props[index]), base: scene, scene };
}

/** The door stroke after the pointer reached an edge: the door is on it when it is free, else it stays where it was. The very same stroke when nothing changes. */
export function advanceDoor(stroke: Extract<Stroke, { kind: 'move-door' }>, edge: Edge, catalog: SceneryCatalog): Stroke {
  if (sameEdge(edge, stroke.at)) return stroke;
  const moved = moveDoor(stroke.base, catalog, stroke.index, edge);
  const home = sameEdge(edge, edgeOf(stroke.base.props[stroke.index]));
  return moved === stroke.base && !home ? stroke : { ...stroke, at: edge, scene: home ? stroke.base : moved };
}

/** The stroke after the pointer reached `cell`; the very same stroke when nothing changes. */
export function advance(stroke: Stroke, cell: Cell, catalog: SceneryCatalog): Stroke {
  switch (stroke.kind) {
    case 'paint':
      return same(stroke.last, cell) ? stroke : { ...stroke, last: cell, scene: paintLine(stroke.scene, stroke.layer, stroke.last, cell, stroke.id, stroke.height) };
    case 'sweep':
      // The eraser follows the pointer's own positions (by their picture), not cells: the canvas calls `sweepSpots`.
      return stroke;
    case 'move': {
      const prop = stroke.base.props[stroke.index];
      const info = pieceOf(catalog, prop.piece);
      if (!info) return stroke;
      const at = clampAnchor(stroke.base, info, { col: cell.col - stroke.offset.col, row: cell.row - stroke.offset.row }, prop.dir ?? 0);
      if (same(at, stroke.at)) return stroke;
      return { ...stroke, at, scene: same(at, prop) ? stroke.base : removeProp(stroke.base, stroke.index) };
    }
    case 'move-wall': {
      // Where the wall would stand; a place outside the grid or already taken leaves it where it was.
      const at = { col: cell.col - stroke.offset.col, row: cell.row - stroke.offset.row };
      if (same(at, stroke.at)) return stroke;
      const moved = same(at, stroke.from) ? stroke.base : moveWall(stroke.base, stroke.from, at);
      return moved === stroke.base && !same(at, stroke.from) ? stroke : { ...stroke, at, scene: moved };
    }
    case 'move-figure': {
      const at = { col: cell.col - stroke.offset.col, row: cell.row - stroke.offset.row };
      if (same(at, stroke.at)) return stroke;
      const origin = stroke.base.figures![stroke.index];
      const moved = same(at, origin) ? stroke.base : moveFigure(stroke.base, stroke.index, at);
      return moved === stroke.base && !same(at, origin) ? stroke : { ...stroke, at, scene: moved };
    }
    case 'move-door':
      // A door follows the pointer's edges (`advanceDoor`), not its cells.
      return stroke;
  }
}

/** The scene a stroke leaves behind when the pointer is released. */
export function resultOf(stroke: Stroke, catalog: SceneryCatalog): SceneData {
  return stroke.kind === 'move' ? moveProp(stroke.base, catalog, stroke.index, stroke.at) : stroke.scene;
}

/** What follows the pointer while a prop is dragged: the piece and where it would land. Null while it is still in its cell. */
export function draggedGhost(stroke: Stroke, catalog: SceneryCatalog): { kind: 'prop'; info: ScenePieceInfo; at: Cell; dir: number; variant: number | undefined } | null {
  if (stroke.kind !== 'move' || stroke.scene === stroke.base) return null;
  const prop = stroke.base.props[stroke.index];
  const info = pieceOf(catalog, prop.piece);
  return info ? { kind: 'prop', info, at: stroke.at, dir: prop.dir ?? 0, variant: prop.variant } : null;
}
