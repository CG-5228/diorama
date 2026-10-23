/**
 * Floor and screen. The runtime keeps positions as floor points in world units (logical px; with a scene, the origin is the
 * centre of cell (0, 0), like its navigation). A projection turns them into screen pixels: across the screen a world unit
 * is `kx × scale` px, in depth `ky × scale` px (contract §5.2: depth shrinks by the camera's tilt), and something lifted
 * above its floor point is drawn that many logical px higher.
 */

import type { Atlas, Vec2 } from './contract/atlas.js';

/** How the floor (world units) is drawn on a screen (px). */
export interface Projection {
  /** Screen px per logical px: the sheets' export scale when they are drawn at their own size. */
  scale: number;
  /** Logical px of one world unit across the screen and in depth: `grid.screen.w / grid.cell.x` (1) and `sin(tilt)`. */
  kx: number;
  ky: number;
  /** Where the floor's origin is on the screen, px. */
  origin: Vec2;
}

/** How much a camera tilted by `tilt` degrees shrinks depth on the screen: `sin(tilt)` (contract §5.2). */
export const tiltFactor = (tilt: number) => Math.sin((tilt * Math.PI) / 180);

/**
 * The projection of a scene sheet's floor, with its picture's top-left corner at screen (0, 0): its grid, where cell
 * (0, 0)'s centre lies in the picture (logical px; both `meta.data`) and its export scale (`meta.scale`). Without a
 * scene, a character's own camera: its tilt and export scale, with the floor's origin at screen (0, 0).
 */
export function projectionOf(scene: Atlas | null, fallback: { tilt: number; scale: number }): Projection {
  if (!scene) return { scale: fallback.scale, kx: 1, ky: tiltFactor(fallback.tilt), origin: { x: 0, y: 0 } };
  const { grid, origin } = scene.meta.data ?? {};
  if (!grid || !origin) throw new Error('projectionOf: a scene sheet has its grid and origin in meta.data');
  const scale = scene.meta.scale ?? 1;
  return { scale, kx: grid.screen.w / grid.cell.x, ky: grid.screen.h / grid.cell.y, origin: { x: origin.x * scale, y: origin.y * scale } };
}

/** A floor point (world units) on the screen (px), drawn `lift` logical px above the floor. */
export const toScreen = (p: Projection, floor: Vec2, lift = 0): Vec2 => ({
  x: p.origin.x + floor.x * p.kx * p.scale,
  y: p.origin.y + (floor.y * p.ky - lift) * p.scale,
});

/** The floor point (world units) under a screen point (px) that lies on the floor. */
export const toFloor = (p: Projection, screen: Vec2): Vec2 => ({
  x: (screen.x - p.origin.x) / (p.scale * p.kx),
  y: (screen.y - p.origin.y) / (p.scale * p.ky),
});
