import { Stage, layoutScene, scaleFigure, vec3, type SceneData, type SceneNavigation, type ScenePieceInfo, type SceneRenderer, type SceneryCatalog, type SpaceHeight } from '@core/volume';
import { doorAt, emptyScene, fits, footprintOf, pieceOf, type Cell, type Edge } from './edit';
import { drawNavigation } from './nav-draw';
import { cellBox, edgeLine, sizeCanvas, type Geometry } from './render';

/**
 * A piece standing at a cell before it is placed, or being carried: drawn from the renderer's cache, so it costs one
 * copy. A wall is placed on a vertex when the catalog's walls stand on borders, on a cell otherwise.
 */
export type Ghost =
  | { kind: 'prop'; info: ScenePieceInfo; at: Cell; dir: number; variant: number | undefined; state?: string }
  | { kind: 'wall'; info: ScenePieceInfo; at: Cell; height?: SpaceHeight }
  /** A door on an edge, turned to its other side when `flip`. */
  | { kind: 'door'; info: ScenePieceInfo; edge: Edge; flip: boolean; state?: string };

/** A block of cells, outlined. */
export interface Footprint {
  at: Cell;
  across: number;
  deep: number;
}

/**
 * Something outlined on the canvas: the cells it stands in, a rim around its picture (device px), the vertex a wall
 * stands on, or the box a scale figure fills (logical px). A mark shows whatever of these it has.
 */
export interface Mark {
  footprint?: Footprint;
  sprite?: { image: CanvasImageSource; left: number; top: number };
  vertex?: Cell;
  /** The edge a door stands on. */
  edge?: Edge;
  box?: { x: number; y: number; width: number; height: number };
}

export interface OverlayView {
  geo: Geometry;
  scale: number;
  catalog: SceneryCatalog;
  renderer: SceneRenderer;
  /** The scene on screen: its size gives the grid, its materials tint the ghost. */
  scene: SceneData;
  grid: boolean;
  /** What is selected: amber. */
  selection: Mark | null;
  /** The cell under the pointer, outlined; red for the eraser. */
  hover: Cell | null;
  erasing: boolean;
  /** With the select tool, what is under the pointer (by its picture): white, it can be selected. */
  hoverMark: Mark | null;
  /** The vertex a wall would be painted on, when walls stand on borders: marked with a dot. */
  hoverVertex: Cell | null;
  /** The edge a door would be put on: outlined, red when it already has one. */
  hoverEdge: Edge | null;
  /** What characters can do on the scene (the toggle in the toolbar), drawn over the cells. */
  navigation: SceneNavigation | null;
  /** The cell a scale figure would stand in: drawn translucent, as a mannequin of the profile's character height. */
  figure: Cell | null;
  ghost: Ghost | null;
}

/** The cells a placement covers. */
export function footprintOfProp(catalog: SceneryCatalog, prop: SceneData['props'][number]): Footprint {
  const info = pieceOf(catalog, prop.piece);
  const [across, deep] = info ? footprintOf(info, prop.dir ?? 0) : [1, 1];
  return { at: { col: prop.col, row: prop.row }, across, deep };
}

/** The placement a door ghost would become: what `placeDoor` stores, so the ghost is the picture the placed door gets. */
function doorPlacement(ghost: Extract<Ghost, { kind: 'door' }>) {
  const n = ghost.info.directions ?? 1;
  const dir = ghost.flip && n > 1 ? (ghost.edge.edge === 'N' ? n / 2 : n / 4) : undefined;
  return { piece: ghost.info.id, col: ghost.edge.col, row: ghost.edge.row, edge: ghost.edge.edge, ...(dir !== undefined ? { dir } : {}), ...(ghost.state !== undefined ? { state: ghost.state } : {}) };
}

/** Draws the light layer over the scene: the grid, what is selected, the cell or piece under the pointer. */
export function drawOverlay(canvas: HTMLCanvasElement, view: OverlayView) {
  const { geo, scale, scene } = view;
  sizeCanvas(canvas, geo, scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const line = 1 / scale;
  const sceneBox = cellBox(geo, { col: 0, row: 0 }, scene.cols, scene.rows);
  if (view.grid) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = line;
    ctx.beginPath();
    for (let c = 0; c <= scene.cols; c++) {
      ctx.moveTo(sceneBox.x + c * geo.cell.w, sceneBox.y);
      ctx.lineTo(sceneBox.x + c * geo.cell.w, sceneBox.y + sceneBox.height);
    }
    for (let r = 0; r <= scene.rows; r++) {
      ctx.moveTo(sceneBox.x, sceneBox.y + r * geo.cell.h);
      ctx.lineTo(sceneBox.x + sceneBox.width, sceneBox.y + r * geo.cell.h);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = line * 1.5;
  ctx.strokeRect(sceneBox.x, sceneBox.y, sceneBox.width, sceneBox.height);

  if (view.navigation) drawNavigation(ctx, view.navigation, geo, line);

  const edgeStroke = (e: Edge, color: string, width: number) => {
    const { x1, y1, x2, y2 } = edgeLine(geo, e);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.lineWidth = line * (width + 2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = line * width;
    ctx.stroke();
  };
  const outline = ({ at, across, deep }: Footprint, color: string, fill: string) => {
    const b = cellBox(geo, at, across, deep);
    ctx.fillStyle = fill;
    ctx.fillRect(b.x, b.y, b.width, b.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = line * 2;
    ctx.strokeRect(b.x + line, b.y + line, b.width - line * 2, b.height - line * 2);
  };
  const mark = (m: Mark, color: string, fill: string, strong: boolean) => {
    if (m.footprint) outline(m.footprint, color, fill);
    if (m.box) {
      ctx.strokeStyle = color;
      ctx.lineWidth = line * 2;
      ctx.strokeRect(m.box.x, m.box.y, m.box.width, m.box.height);
    }
    if (m.vertex) {
      const at = cellBox(geo, m.vertex);
      ctx.beginPath();
      ctx.arc(at.x, at.y, geo.cell.w * (strong ? 0.14 : 0.1), 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = line * (strong ? 3.5 : 2.5);
      ctx.stroke();
    }
    if (m.edge) edgeStroke(m.edge, color, strong ? 4 : 3);
    if (m.sprite) drawRim(ctx, m.sprite, color, scale);
  };
  if (view.hoverMark) mark(view.hoverMark, view.erasing ? '#ef4444' : 'rgba(255, 255, 255, 0.9)', view.erasing ? 'rgba(239, 68, 68, 0.16)' : 'rgba(255, 255, 255, 0.1)', false);
  if (view.selection) mark(view.selection, '#f2a93b', 'rgba(242, 169, 59, 0.14)', true);
  if (view.hover && view.hover.col >= 0 && view.hover.row >= 0 && view.hover.col < scene.cols && view.hover.row < scene.rows) {
    if (view.erasing) outline({ at: view.hover, across: 1, deep: 1 }, '#ef4444', 'rgba(239, 68, 68, 0.18)');
    else outline({ at: view.hover, across: 1, deep: 1 }, '#ffffff', 'rgba(255, 255, 255, 0.12)');
  }
  if (view.hoverVertex) {
    const at = cellBox(geo, view.hoverVertex);
    ctx.beginPath();
    ctx.arc(at.x, at.y, geo.cell.w * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = view.erasing ? '#ef4444' : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.lineWidth = line * 1.5;
    ctx.stroke();
  }
  if (view.hoverEdge) edgeStroke(view.hoverEdge, view.erasing || doorAt(scene, view.hoverEdge) >= 0 ? '#ef4444' : '#ffffff', 4);
  if (view.figure) {
    outline({ at: view.figure, across: 1, deep: 1 }, '#ffffff', 'rgba(255, 255, 255, 0.12)');
    drawFigure(ctx, view, view.figure);
  }
  if (view.ghost) {
    if (view.ghost.kind === 'door') {
      const { edge } = view.ghost;
      if (doorAt(scene, edge) < 0) edgeStroke(edge, '#ffffff', 4);
    }
    if (view.ghost.kind === 'prop') {
      const { info, at, dir } = view.ghost;
      const [across, deep] = footprintOf(info, dir);
      outline({ at, across, deep }, fits(scene, info, at, dir) ? '#ffffff' : '#ef4444', 'rgba(255, 255, 255, 0.12)');
    }
    drawGhostImage(ctx, view, view.ghost);
  }
}

const rims = new WeakMap<object, Map<string, HTMLCanvasElement>>();

/**
 * A glow around a picture's silhouette, in a colour: the picture drawn with a shadow, then taken out again so only the
 * rim is left. Made once per picture, colour and scale (the renderer's frames are cached objects) and copied after.
 */
function rimOf(image: CanvasImageSource & { width: number; height: number }, color: string, blur: number): { canvas: HTMLCanvasElement; pad: number } {
  const pad = Math.ceil(blur * 2);
  const key = `${color}|${blur}`;
  let byColor = rims.get(image);
  if (!byColor) rims.set(image, (byColor = new Map()));
  let canvas = byColor.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = image.width + pad * 2;
    canvas.height = image.height + pad * 2;
    const g = canvas.getContext('2d');
    if (g) {
      g.shadowColor = color;
      g.shadowBlur = blur;
      // Three passes pile the glow up into a rim that reads on dark and on light art.
      for (let pass = 0; pass < 3; pass++) g.drawImage(image, pad, pad);
      g.shadowColor = 'transparent';
      g.globalCompositeOperation = 'destination-out';
      g.drawImage(image, pad, pad);
    }
    byColor.set(key, canvas);
  }
  return { canvas, pad };
}

function drawRim(ctx: CanvasRenderingContext2D, sprite: NonNullable<Mark['sprite']>, color: string, scale: number) {
  const { canvas, pad } = rimOf(sprite.image as CanvasImageSource & { width: number; height: number }, color, Math.max(4, scale * 2.5));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(canvas, sprite.left - pad, sprite.top - pad);
  ctx.restore();
}

/** A scale figure in a cell, drawn like the engine draws the scene's figures (the context carries the scale). */
function drawFigure(ctx: CanvasRenderingContext2D, { geo, catalog }: OverlayView, cell: Cell) {
  if (!catalog.space) return;
  const camera = catalog.camera.at(catalog.camera.at(geo.origin).project(catalog.grid.center(cell.col, cell.row)));
  const stage = new Stage(camera);
  scaleFigure(stage.object({ at: vec3(0, 0, 0) }), vec3(0, 0, 0), catalog.space.scale.character);
  stage.draw(ctx);
}

/** Where a placement's picture lies, in CSS px of the canvas: what a popover over the prop is anchored to. Null until the renderer has its frame at this scale. */
export function propBox(view: Pick<OverlayView, 'geo' | 'scale' | 'catalog' | 'renderer' | 'scene'>, zoom: number, prop: SceneData['props'][number]): { x: number; y: number; width: number; height: number } | null {
  try {
    const item = layoutScene({ ...emptyScene(view.catalog, view.scene.cols, view.scene.rows), props: [prop] }, view.catalog).at(-1);
    if (!item) return null;
    const frame = view.renderer.frame(item, view.scene.materials);
    const pivot = view.catalog.camera.at(view.geo.origin).project(item.at);
    // Device px to CSS px: the canvas is drawn at `scale` and shown at `zoom`.
    const k = zoom / view.scale;
    return { x: (pivot.x * view.scale - frame.x) * k, y: (pivot.y * view.scale - frame.y) * k, width: frame.image.width * k, height: frame.image.height * k };
  } catch {
    return null;
  }
}

/**
 * The ghost's frame comes from the renderer, where the scene's own drawing left it: the same image `draw` copies once the
 * piece is placed. A piece that fails to draw is left as an outline; placing it shows the error.
 */
function drawGhostImage(ctx: CanvasRenderingContext2D, { geo, scale, catalog, renderer, scene }: OverlayView, ghost: Ghost) {
  try {
    // The piece alone, on a scene of the same size: layoutScene needs a valid scene to place it.
    const alone = emptyScene(catalog, scene.cols, scene.rows);
    const placed =
      ghost.kind === 'door'
        ? { ...alone, props: [doorPlacement(ghost)] }
        : ghost.kind === 'prop'
        ? { ...alone, props: [{ piece: ghost.info.id, col: ghost.at.col, row: ghost.at.row, ...(ghost.dir ? { dir: ghost.dir } : {}), ...(ghost.variant !== undefined ? { variant: ghost.variant } : {}), ...(ghost.state !== undefined ? { state: ghost.state } : {}) }] }
        : { ...alone, walls: alone.walls.map((line, row) => (row === ghost.at.row ? line.map((cell, col) => (col === ghost.at.col ? (ghost.height === undefined ? ghost.info.id : { piece: ghost.info.id, height: ghost.height }) : cell)) : line)) };
    const item = layoutScene(placed, catalog).at(-1);
    if (!item) return;
    const frame = renderer.frame(item, scene.materials);
    const pivot = catalog.camera.at(geo.origin).project(item.at);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.7;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(frame.image as CanvasImageSource, Math.round(pivot.x * scale - frame.x), Math.round(pivot.y * scale - frame.y));
    ctx.restore();
  } catch {
    // Left as an outline.
  }
}
