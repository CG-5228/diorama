/**
 * Moving on a scene's navigation (`meta.data.navigation` of a scene sheet, guide 05 of `@core/volume` §3): a step on the
 * grid, a path, the cell a floor point stands in, free movement that slides along walls, and where something flying is
 * stopped. Floor points are world units, cell (0, 0) centred on the origin.
 */

import type { Vec2 } from './contract/atlas.js';
import { EDGE, type Grid, type NavCell, type SceneNavigation } from './contract/scene.js';

const STEPS: [number, number, number, number][] = [[0, -1, EDGE.N, EDGE.S], [1, 0, EDGE.E, EDGE.W], [0, 1, EDGE.S, EDGE.N], [-1, 0, EDGE.W, EDGE.E]];

/** Whether a character can step from a cell to a 4-neighbour: the target can be entered and no wall or closed door stands between. */
export function canStep(nav: SceneNavigation, from: NavCell, to: NavCell): boolean {
  const step = STEPS.find(([dx, dy]) => from.col + dx === to.col && from.row + dy === to.row);
  if (!step) return false;
  if (!(nav.cost[to.row]?.[to.col] > 0)) return false;
  return !(nav.walls[from.row]?.[from.col] & step[2]) && !(nav.walls[to.row]?.[to.col] & step[3]);
}

/** The cheapest 4-neighbour path from one cell to another (A*), both ends included, or null. */
export function findPath(nav: SceneNavigation, from: NavCell, to: NavCell): NavCell[] | null {
  const key = (c: NavCell) => c.row * nav.cols + c.col;
  if (!(nav.cost[to.row]?.[to.col] > 0)) return null;
  const goal = key(to);
  const g = new Map<number, number>([[key(from), 0]]);
  const came = new Map<number, number>();
  const open: { k: number; f: number }[] = [{ k: key(from), f: 0 }];
  const h = (c: NavCell) => Math.abs(c.col - to.col) + Math.abs(c.row - to.row);
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const { k } = open.shift()!;
    if (k === goal) {
      const path: NavCell[] = [];
      for (let at: number | undefined = k; at !== undefined; at = came.get(at)) path.unshift({ col: at % nav.cols, row: Math.floor(at / nav.cols) });
      return path;
    }
    const cur = { col: k % nav.cols, row: Math.floor(k / nav.cols) };
    for (const [dx, dy] of STEPS) {
      const next = { col: cur.col + dx, row: cur.row + dy };
      if (!canStep(nav, cur, next)) continue;
      const cost = g.get(k)! + nav.cost[next.row][next.col];
      const nk = key(next);
      if (cost < (g.get(nk) ?? Infinity)) {
        g.set(nk, cost);
        came.set(nk, k);
        open.push({ k: nk, f: cost + h(next) });
      }
    }
  }
  return null;
}

/** The cell a point of the floor (world units, cell (0, 0) centred on the origin) stands in. */
export function cellAt(grid: Grid, p: Vec2): NavCell {
  return { col: Math.round(p.x / grid.cell.x), row: Math.round(p.y / grid.cell.y) };
}

/**
 * Moves a character standing at `p` (world units on the floor) by `delta`, with a body of `radius`,
 * sliding along what blocks: each axis moves on its own and stops `radius` short of an edge it cannot
 * cross (a wall, a closed door, a cell that cannot be entered), and the body is pushed clear of the
 * posts of walls on borders (piers, pillars; `postRadius`, default a fifth of a cell). Long moves are
 * taken in steps of at most half a cell, so nothing is tunnelled through. For free movement in the
 * playground and in games; grid games step with `canStep` instead.
 */
export function moveIn(nav: SceneNavigation, grid: Grid, p: Vec2, delta: Vec2, radius: number, postRadius = grid.cell.x * 0.2): Vec2 {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x) / (grid.cell.x / 2), Math.abs(delta.y) / (grid.cell.y / 2))));
  let at = { x: p.x, y: p.y };
  for (let i = 0; i < steps; i++) at = step(nav, grid, at, { x: delta.x / steps, y: delta.y / steps }, radius, postRadius);
  return at;
}

/** One move of at most half a cell (see `moveIn`). */
function step(nav: SceneNavigation, grid: Grid, p: Vec2, delta: Vec2, radius: number, postRadius: number): Vec2 {
  const cw = grid.cell.x;
  const ch = grid.cell.y;
  let { x, y } = p;
  const from = cellAt(grid, { x, y });
  // Across the screen.
  if (delta.x) {
    const nx = x + delta.x;
    const edge = delta.x > 0 ? (from.col + 0.5) * cw : (from.col - 0.5) * cw;
    const reach = nx + Math.sign(delta.x) * radius;
    const crossing = delta.x > 0 ? reach > edge : reach < edge;
    const target = { col: from.col + Math.sign(delta.x), row: from.row };
    x = crossing && !canStep(nav, from, target) ? edge - Math.sign(delta.x) * (radius + 1e-6) : nx;
    if (Math.sign(delta.x) * (x - p.x) < 0) x = p.x;
  }
  // In depth, from where the first move ended.
  const mid = cellAt(grid, { x, y });
  if (delta.y) {
    const ny = y + delta.y;
    const edge = delta.y > 0 ? (mid.row + 0.5) * ch : (mid.row - 0.5) * ch;
    const reach = ny + Math.sign(delta.y) * radius;
    const crossing = delta.y > 0 ? reach > edge : reach < edge;
    const target = { col: mid.col, row: mid.row + Math.sign(delta.y) };
    y = crossing && !canStep(nav, mid, target) ? edge - Math.sign(delta.y) * (radius + 1e-6) : ny;
    if (Math.sign(delta.y) * (y - p.y) < 0) y = p.y;
  }
  // Keep clear of the posts at the corners of the cell the body ends in.
  const end = cellAt(grid, { x, y });
  for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const vc = end.col + dc;
    const vr = end.row + dr;
    if (!nav.posts?.[vr]?.[vc]) continue;
    const vx = (vc - 0.5) * cw;
    const vy = (vr - 0.5) * ch;
    const dx = x - vx;
    const dy = y - vy;
    const d = Math.hypot(dx, dy);
    const clear = radius + postRadius;
    if (d >= clear) continue;
    if (d < 1e-9) {
      x = p.x;
      y = p.y;
      continue;
    }
    x = vx + (dx / d) * clear;
    y = vy + (dy / d) * clear;
  }
  return { x, y };
}

/**
 * Where something that flies along the floor from `from` to `to` (world units) is stopped: the last point it reaches
 * before a cell that cannot be entered, a wall or a shut door, or null when the way is clear. The path is followed in
 * steps of a fifth of a cell, and a step across a corner needs one of its two ways round to be open.
 */
export function flightStop(nav: SceneNavigation, grid: Grid, from: Vec2, to: Vec2): Vec2 | null {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (grid.cell.x * 0.2)));
  let before = from;
  let cell = cellAt(grid, from);
  for (let i = 1; i <= steps; i++) {
    const point = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    const next = cellAt(grid, point);
    if (next.col !== cell.col || next.row !== cell.row) {
      const sideways = { col: next.col, row: cell.row };
      const along = { col: cell.col, row: next.row };
      const open =
        next.col !== cell.col && next.row !== cell.row
          ? (canStep(nav, cell, sideways) && canStep(nav, sideways, next)) || (canStep(nav, cell, along) && canStep(nav, along, next))
          : canStep(nav, cell, next);
      if (!open) return { x: before.x, y: before.y };
      cell = next;
    }
    before = point;
  }
  return null;
}
