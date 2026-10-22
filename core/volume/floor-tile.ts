/**
 * @core/volume - Floor tiles
 *
 * The mechanics every floor of a scenery kit needs, whatever its art: the region a dual-grid tile
 * covers for its corner mask, an edge roughened inside the tile that crosses the border straight
 * (so neighbouring tiles meet), the same edge in every floor (so a lower floor running on under a
 * higher one lies exactly under it), a bevel that follows the light, the safe area for details
 * and even placement, so a field neither seams nor prints a lattice. A floor piece calls
 * `floorTile(ctx, { paint })` and paints its material over `t.region`; see guide 04 §3.1.
 */

import { Path, Polygon, StrokeStyle, type Point, type Shape } from '../draw/index.js';
import { createRng, type Rng } from '../random.js';
import type { Camera } from './camera.js';
import { cornerMaskShape } from './grid.js';
import type { PieceContext } from './scenery.js';
import { vec3 } from './vec3.js';

/** What a floor piece paints with: the tile on screen, its covered region, its edge and helpers. */
export interface FloorTile {
  c: CanvasRenderingContext2D;
  cam: Camera;
  /** Screen position of the tile's centre and its size in logical pixels (the grid's cell, e.g. 32 × 24). */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Corner mask (15 = a whole tile) and variant of this frame. */
  mask: number;
  variant: number;
  /** True for a whole tile: nothing to transition. */
  full: boolean;
  /** The area the material covers, on screen, with its edge roughened inside the tile. */
  region: Shape;
  /** The roughened edge of the region as polylines on screen: only the part inside the tile, never the straight cut along its border. */
  edge: Point[][];
  /** The frame's generator (`ctx.seed` and the floor's `salt`). */
  rng: Rng;
  /**
   * Strokes the region's edge inside the region, by how each stretch faces the light: `lit` where it
   * faces the light, `dark` where it faces away. A raised floor (flagstones, a gravel bed) catches
   * the light on its far edges and shows its side on the near ones; a `recessed` one (water, a
   * pit) is the other way round. Widths are the visible widths; nothing is drawn along the border.
   */
  bevelEdge(o: { lit: string; dark: string; litWidth: number; darkWidth: number; recessed?: boolean }): void;
  /** Runs `fn` clipped to the covered region (the engine already clips the whole tile to itself). */
  inRegion(fn: () => void): void;
  /** Tile-local position (origin at the centre, y down) on screen. */
  at(lx: number, ly: number): Point;
  /** A tile-local rectangle `margin` inside the border: where details may sit without crossing into a neighbour. */
  safe(margin: number): { x0: number; x1: number; y0: number; y1: number };
  /**
   * `n` tile-local points spread evenly over the whole tile, one to a cell of a jittered grid: unlike
   * plain random points they neither clump nor leave a gutter by the border, so a repeated detail
   * reads as an even texture instead of a cluster in every tile.
   */
  spread(n: number): Point[];
  /**
   * Moves a tile-local point so something `rx` × `ry` across (plus `pad`) lies wholly inside the tile:
   * big things end up inside, small ones keep their place near the border.
   */
  fit(p: Point, rx: number, ry?: number, pad?: number): Point;
}

/** How a kit's floors roughen their transitions. Every floor of a kit must use the same values. */
export interface FloorEdge {
  /** Amplitude (px) of the roughened edge. Default 1.7; 0 for a straight rounded edge. */
  rough: number;
  /** Distance (px) from the border over which the roughness fades to the exact cut. Default 4. */
  fade: number;
  /** A transition grows its region by this much, so antialiasing never lets a lower floor's edge show through. Default 0.7. */
  grow: number;
  /** Seed of the edge waves: one per kit, never per floor, variant or place. */
  seed: number;
}

/** Default edge of `floorTile`. */
export const FLOOR_EDGE: FloorEdge = { rough: 1.7, fade: 4, grow: 0.7, seed: 0x6e0c5 };

/** Options of `floorTile`. */
export interface FloorTileOptions {
  /** Paints the material over `t.region` and its details. */
  paint: (t: FloorTile) => void;
  /** Mixed into the frame's seed, so two floors with the same seed still differ. */
  salt?: number;
  /** The kit's edge (same for every floor of the kit). */
  edge?: Partial<FloorEdge>;
  /** Line used by `bevelEdge` (its color and width are replaced). Default: a clean round line. */
  line?: StrokeStyle;
}

const smoothstep = (t: number) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

/**
 * The covered region of a transition tile with its edge roughened; the cut along the tile border
 * stays exact. It depends on the mask and the tile-local position only, so the same mask has the
 * same edge in every floor.
 */
function roughRegion(mask: number, w: number, h: number, e: FloorEdge): Shape {
  const base = cornerMaskShape(mask, w, h);
  if (mask === 15 || e.rough <= 0) return base;
  // Two layers of smooth waves per axis, fading to nothing at the border: where two tiles meet,
  // the edge crosses the border at the same place, straight.
  const rng = createRng(e.seed);
  const wave = () => ({ kx: rng.float(0.45, 0.9) * (rng.boolean() ? 1 : -1), ky: rng.float(0.45, 0.9) * (rng.boolean() ? 1 : -1), p: rng.float(0, Math.PI * 2) });
  const ax = [wave(), wave()];
  const ay = [wave(), wave()];
  const sample = (waves: { kx: number; ky: number; p: number }[], x: number, y: number) => (Math.sin(waves[0].kx * x + waves[0].ky * y + waves[0].p) + 0.5 * Math.sin(waves[1].kx * x + waves[1].ky * y + waves[1].p)) / 1.5;
  return base.subdivide(1.2).mapVertices(p => {
    const win = smoothstep(Math.min(w / 2 - Math.abs(p.x), h / 2 - Math.abs(p.y)) / e.fade);
    if (win <= 0) return undefined;
    return { x: p.x + e.rough * win * sample(ax, p.x, p.y), y: p.y + e.rough * win * sample(ay, p.x, p.y) };
  });
}

/** A stretch of a region's edge and which side is outside: +1 when the ring runs clockwise on screen, -1 otherwise. */
interface EdgeRun {
  points: Point[];
  winding: 1 | -1;
}

/** The polylines of a region's contour that lie inside the tile (the cut along the border is left out). */
function edgeRuns(region: Shape, cx: number, cy: number, w: number, h: number): EdgeRun[] {
  const onBorder = (p: Point) => Math.abs(Math.abs(p.x - cx) - w / 2) < 0.02 || Math.abs(Math.abs(p.y - cy) - h / 2) < 0.02;
  const runs: EdgeRun[] = [];
  for (const r of region.regions) {
    [r.outer, ...r.holes].forEach((ring, k) => {
      const n = ring.length;
      if (n < 3) return;
      let area = 0;
      for (let i = 0; i < n; i++) area += ring[i].x * ring[(i + 1) % n].y - ring[(i + 1) % n].x * ring[i].y;
      // A hole's outside is the other way round.
      const winding: 1 | -1 = (area > 0) === (k === 0) ? 1 : -1;
      const start = ring.findIndex(onBorder);
      if (start < 0) {
        runs.push({ points: [...ring, ring[0]], winding });
        return;
      }
      let run: Point[] = [];
      for (let i = 1; i <= n; i++) {
        const prev = ring[(start + i - 1) % n];
        const p = ring[(start + i) % n];
        if (!onBorder(p)) {
          if (run.length === 0) run.push(prev);
          run.push(p);
        } else if (run.length) {
          run.push(p);
          runs.push({ points: run, winding });
          run = [];
        }
      }
    });
  }
  return runs;
}

/**
 * Paints one floor frame: a whole tile (mask 15) or a dual-grid transition. Everything is painted
 * in screen pixels around the projected origin; the engine clips the tile to itself. `paint` draws
 * the material over `t.region` and its details; what it draws outside the region (tufts, a slab's
 * side) stays inside the tile and close to the edge, because it shows wherever this floor runs on
 * under a higher one.
 *
 * Rules every floor of a kit follows (guide 04 §3.1):
 * - a whole tile paints the same along its border in every variant (half mortar lines, or nothing
 *   but the base tone), and its details sit inside it;
 * - a frame draws one tile, never one place: the look of a field comes from 4–6 variants, with
 *   large features soft and spread over the tile (`t.spread`, `t.fit`);
 * - every floor uses the same `edge`, so coinciding edges of two floors lie exactly on each other.
 */
export function floorTile(ctx: PieceContext, o: FloorTileOptions): void {
  const { w, h } = ctx.grid.screen;
  const e: FloorEdge = { ...FLOOR_EDGE, ...o.edge };
  const origin = ctx.frame.origin;
  const line = o.line ?? new StrokeStyle({ width: 1, color: '#000', renderer: 'clean', join: 'round' });
  ctx.object.custom(vec3(origin.x, origin.y, 0), (c, cam) => {
    const rng = createRng((ctx.seed ^ (o.salt ?? 0)) >>> 0);
    const centre = cam.project(origin);
    const cx = Math.round(centre.x * 1e6) / 1e6;
    const cy = Math.round(centre.y * 1e6) / 1e6;
    const full = ctx.mask === 15;
    const rough = roughRegion(ctx.mask, w, h, e).translate(cx, cy);
    const runs = full ? [] : edgeRuns(rough, cx, cy, w, h);
    const region = full ? rough : rough.clone().offset(e.grow);
    const t: FloorTile = {
      c,
      cam,
      cx,
      cy,
      w,
      h,
      mask: ctx.mask,
      variant: ctx.variant,
      full,
      region,
      edge: runs.map(r => r.points),
      rng,
      bevelEdge: b => {
        const l = cam.lightOnScreen;
        const sign = b.recessed ? -1 : 1;
        t.inRegion(() => {
          for (const run of runs) {
            for (let i = 0; i + 1 < run.points.length; i++) {
              const a = run.points[i];
              const z = run.points[i + 1];
              const len = Math.hypot(z.x - a.x, z.y - a.y);
              if (len < 1e-6) continue;
              // Outward normal of this stretch, and how much it faces the light.
              const nx = ((z.y - a.y) / len) * run.winding;
              const ny = (-(z.x - a.x) / len) * run.winding;
              const facing = (nx * l.x + ny * l.y) * sign;
              if (facing > 0.25) new Path([a, z]).stroke(c, line.with({ color: b.lit, width: b.litWidth * 2 }));
              else if (facing < -0.25) new Path([a, z]).stroke(c, line.with({ color: b.dark, width: b.darkWidth * 2 }));
            }
          }
        });
      },
      inRegion: fn => (full ? fn() : region.clip(c, fn)),
      at: (lx, ly) => ({ x: cx + lx, y: cy + ly }),
      safe: m => ({ x0: -w / 2 + m, x1: w / 2 - m, y0: -h / 2 + m, y1: h / 2 - m }),
      spread: n => {
        const cols = Math.max(1, Math.round(Math.sqrt((n * w) / h)));
        const rows = Math.max(1, Math.ceil(n / cols));
        return rng.shuffle(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, n).map(i => ({
          x: -w / 2 + (((i % cols) + rng.random()) * w) / cols,
          y: -h / 2 + ((Math.floor(i / cols) + rng.random()) * h) / rows,
        }));
      },
      fit: (p, rx, ry = rx, pad = 0.5) => {
        const x = Math.max(0, w / 2 - rx - pad);
        const y = Math.max(0, h / 2 - ry - pad);
        return { x: Math.max(-x, Math.min(x, p.x)), y: Math.max(-y, Math.min(y, p.y)) };
      },
    };
    o.paint(t);
  });
}

/** An irregular blob (a stain, a pebble, a puddle) from an ellipse roughened by noise, for floor details. */
export function floorBlob(cx: number, cy: number, rx: number, ry: number, seed: number, rotation = 0, rough = 0.25): Shape {
  return Polygon.ellipse(rx, ry, { cx, cy, rotation, segments: 14 }).displace({ amplitude: Math.min(rx, ry) * rough, frequency: 18, seed, densify: 3 });
}
