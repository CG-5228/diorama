import { heightsOf, masksOf, vec3, type SceneItem, type ScenePieceInfo, type SceneRenderer, type SceneryCatalog } from '@core/volume';

/** The edge masks that make a straight run, its ends and a lone post: what a wall painted along a line needs. */
const RUN_MASKS = [10, 5, 0, 2, 8, 1, 4];

/**
 * The frames a piece is most likely to be drawn as the first time it is used, at its default height and options: a
 * floor's whole tile (its transitions wait until floors meet), the masks of a straight run for a wall or fence, every
 * facing of a prop or decal, per variant. A frame is a canvas at the drawing scale, so the cache holds what is used and
 * a little more, not everything a piece could ever be.
 */
export function framesOf(info: ScenePieceInfo, catalog: SceneryCatalog): SceneItem[] {
  const variants = Array.from({ length: info.variants ?? 1 }, (_, i) => i);
  const options = Object.fromEntries((info.options ?? []).map((o) => [o.key, o.default]));
  const frame = (mask: number, variant: number, dir: number, sheetRow: number, pass: SceneItem['pass'], height?: number): SceneItem => ({
    piece: info.id,
    group: info.group,
    col: 0,
    row: 0,
    at: vec3(0, 0, 0),
    mask,
    variant,
    dir,
    sheetRow,
    ...(height !== undefined ? { height } : {}),
    frame: 0,
    pass,
    options,
  });
  if (info.group === 'floor') return variants.map((variant) => frame(15, variant, 0, 0, 'floor'));
  if (info.group === 'wall' || info.group === 'fence') {
    const height = heightsOf(info, catalog)[0];
    return RUN_MASKS.filter((mask) => masksOf(info.connect).includes(mask)).flatMap((mask) => variants.map((variant) => frame(mask, variant, 0, 0, 'object', height)));
  }
  const facings = Array.from({ length: info.directions ?? 1 }, (_, i) => i);
  return facings.flatMap((dir) => variants.map((variant) => frame(0, variant, dir, dir, info.group === 'decal' ? 'decal' : 'object'))).slice(0, 32);
}

type Idle = { timeRemaining: () => number };

/** Milliseconds of drawing one idle callback may take even when the browser says it has less: a frame is a frame, and a busy page may offer few idle periods. */
const BUDGET = 8;

const whenIdle = (fn: (idle: Idle) => void): number =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 2000 }) : window.setTimeout(() => fn({ timeRemaining: () => 12 }), 32);

/**
 * Draws frames into the renderer's cache while the browser is idle, a few at a time, so the first stroke with a piece
 * finds them there instead of drawing them under the pointer (a floor's transitions can cost most of a second). Waits
 * until `ready` (the renderer stands at the scale the canvas draws at) and, while the user is working, `quiet`: warming
 * never competes with a stroke. Returns what stops it.
 */
export function warm(renderer: SceneRenderer, items: (SceneItem & { clip?: { name: string; frame: number } })[], materials: Record<string, string> | undefined, ready: () => boolean, quiet: () => boolean): () => void {
  let next = 0;
  let stopped = false;
  let timer = 0;
  const step = (idle: Idle) => {
    if (stopped) return;
    if (!ready() || !quiet()) {
      timer = window.setTimeout(() => whenIdle(step), 400);
      return;
    }
    const started = performance.now();
    // As long as the idle period or the budget lasts, at least one frame per callback.
    const allowed = Math.max(BUDGET, idle.timeRemaining() - 6);
    try {
      do renderer.frame(items[next++], materials);
      while (next < items.length && performance.now() - started < allowed);
    } catch {
      // A piece that fails to draw is reported by the drawing itself.
      return;
    }
    if (next < items.length) whenIdle(step);
  };
  whenIdle(step);
  return () => {
    stopped = true;
    window.clearTimeout(timer);
  };
}
