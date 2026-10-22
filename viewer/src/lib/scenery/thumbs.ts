import { queryOptions } from '@tanstack/react-query';
import { createSceneRenderer, type SceneData, type ScenePieceInfo, type SceneRenderer, type SceneryCatalog } from '@core/volume';
import { trimCanvas, type Trimmed } from '../trim';
import { emptyScene, footprintOf } from './edit';
import { geometryOf, paintScene } from './render';

/** A small scene that shows one piece: a patch of floor, a run of wall (along the top border when walls stand on borders), a door between two wall posts, or the prop alone. */
export function thumbScene(catalog: SceneryCatalog, info: ScenePieceInfo): SceneData {
  if (info.group === 'floor') {
    const scene = emptyScene(catalog, 3, 3);
    return { ...scene, floor: scene.floor.map((line) => line.map(() => info.id)) };
  }
  if (info.group === 'wall' || info.group === 'fence') {
    const scene = emptyScene(catalog, 3, 1);
    return { ...scene, walls: scene.walls.map((line, row) => (row === 0 ? line.map(() => info.id) : line)) };
  }
  if (info.group === 'door') {
    // The door on the north edge of one cell, between the two posts of the wall it is made for.
    const wall = catalog.pieces.find((p) => info.joins?.includes(p.id)) ?? catalog.pieces.find((p) => p.group === 'wall');
    const scene = emptyScene(catalog, 1, 1);
    return { ...scene, walls: scene.walls.map((line, row) => (row === 0 && wall ? line.map(() => wall.id) : line)), props: [{ piece: info.id, col: 0, row: 0, edge: 'N' }] };
  }
  const [w, d] = footprintOf(info);
  return { ...emptyScene(catalog, w, d), props: [{ piece: info.id, col: 0, row: 0 }] };
}

const THUMB_SCALE = 2;
const renderers = new WeakMap<SceneryCatalog, SceneRenderer>();

/** One renderer per catalog for every thumbnail: a floor tile or a wall frame is drawn once and copied into the rest of its patch. */
const rendererOf = (catalog: SceneryCatalog) => {
  let renderer = renderers.get(catalog);
  if (!renderer) renderers.set(catalog, (renderer = createSceneRenderer(catalog)));
  return renderer;
};

/** Draws a piece with the engine and cuts the drawing to its pixels, or null when the piece draws nothing or throws. */
export function renderPieceThumb(catalog: SceneryCatalog, info: ScenePieceInfo): Trimmed | null {
  const scene = thumbScene(catalog, info);
  const canvas = document.createElement('canvas');
  if (paintScene(canvas, rendererOf(catalog), geometryOf(scene, catalog), scene, THUMB_SCALE) !== null) return null;
  return trimCanvas(canvas);
}

let queue: Promise<unknown> = Promise.resolve();
/** Runs thumbnails one per task: all of the palette at once would hold the page for as long as they take together. */
const inTurn = <T>(job: () => T): Promise<T> => {
  const run = queue.then(() => new Promise<void>((resolve) => setTimeout(resolve))).then(job);
  queue = run.catch(() => undefined);
  return run;
};

const keys = new WeakMap<SceneryCatalog, number>();
let counter = 0;
/** A stable number for each catalog object, to key what was drawn with it: a new catalog draws everything again. */
const keyOf = (catalog: SceneryCatalog) => {
  if (!keys.has(catalog)) keys.set(catalog, ++counter);
  return keys.get(catalog)!;
};

export const pieceThumbQuery = (catalog: SceneryCatalog, info: ScenePieceInfo) =>
  queryOptions({
    queryKey: ['scenery-thumb', keyOf(catalog), info.id],
    queryFn: () => inTurn(() => renderPieceThumb(catalog, info)),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
