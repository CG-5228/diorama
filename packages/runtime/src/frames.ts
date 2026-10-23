/** The cells of a sheet in playback order, the facing rows, and which frame a clock shows. */

import type { Atlas, AtlasEvent, Rect } from './contract/atlas.js';
import type { SheetPath } from './read.js';

const TAU = Math.PI * 2;

/** The clips a sheet's atlas names (`meta.animations`), or 'default' for the one it is. */
export function clipNames(atlas: Atlas): string[] {
  const names = Object.keys(atlas.meta.animations ?? {});
  return names.length ? names : ['default'];
}

/** The frame rectangles of one clip facing one direction, in playback order. */
export function clipFrames(atlas: Atlas, clip: string, directionIndex: number): Rect[] {
  const { meta, frames } = atlas;
  const indices = meta.animations?.[clip] ?? Array.from({ length: meta.frameCount ?? 1 }, (_, i) => i);
  const directions = meta.directions ?? [];
  const frameWidth = meta.frameWidth ?? 0;
  const frameHeight = meta.frameHeight ?? 0;
  return indices.map((index) => {
    const key = directions.length > 1 ? `${directions[directionIndex]}_${index}` : `frame_${index}`;
    return (
      frames[key] ?? {
        x: index * frameWidth,
        y: directionIndex * frameHeight,
        width: frameWidth,
        height: frameHeight,
      }
    );
  });
}

/** The events a sheet declares: a clip's own, or an effect's (`meta.data.effect.events`). */
export const eventsOf = (atlas: Atlas | undefined): AtlasEvent[] => atlas?.meta.data?.events ?? atlas?.meta.data?.effect?.events ?? [];

/** Events keyed by frame index, so the timeline and the current frame can look them up directly. */
export function eventsByFrame(atlas: Atlas | undefined): Map<number, string[]> {
  const byFrame = new Map<number, string[]>();
  for (const event of eventsOf(atlas)) {
    byFrame.set(event.frame, [...(byFrame.get(event.frame) ?? []), event.name]);
  }
  return byFrame;
}

/**
 * A cell to draw: where it is on its sheet (exported px) and, for a packed sheet whose frames are trimmed, where the
 * trimmed frame sits in its untrimmed cell (`ox`, `oy`) and the cell's size. The pivot is in the untrimmed cell.
 */
export interface Frame {
  sheet: SheetPath;
  x: number;
  y: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  cellW: number;
  cellH: number;
}

/** A cell of a sheet as a frame to draw: a packed sheet's trim (`ox`, `oy`, `cellW`, `cellH`), else the whole cell. */
export function frameOf(sheet: SheetPath, rect: Rect): Frame {
  const cut = rect as Rect & { ox?: number; oy?: number; cellW?: number; cellH?: number };
  return { sheet, x: rect.x, y: rect.y, w: rect.width, h: rect.height, ox: cut.ox ?? 0, oy: cut.oy ?? 0, cellW: cut.cellW ?? rect.width, cellH: cut.cellH ?? rect.height };
}

/** The frames of one facing row of a sheet, trim-aware: a raw sheet's frames are their whole cells. */
export function framesOf(sheet: { asset: { path: SheetPath }; rects: (row: number) => Rect[] }, row: number): Frame[] {
  return sheet.rects(row).map((rect) => frameOf(sheet.asset.path, rect));
}

const angleBetween = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/**
 * The direction row that faces a heading. Headings are world yaws on the floor, which are screen angles (x right, y down):
 * row 0 (S) looks at the camera, π/2, and every next row turns clockwise (`meta.directionFacings`, or the facings themselves).
 */
export function rowFor(of: Atlas | readonly number[], heading: number): number {
  const facings = Array.isArray(of) ? of : ((of as Atlas).meta.directionFacings ?? []);
  let best = 0;
  facings.forEach((facing, row) => {
    if (angleBetween(facing % TAU, heading) < angleBetween(facings[best] % TAU, heading)) best = row;
  });
  return best;
}

/**
 * The unit vector of a heading on the floor, exact on the axes: the facings are multiples of π/4 as floats, and
 * `Math.sin(2π)` is 2.4e-16, not 0, so a projectile sent east would creep up the screen and off its row's line.
 */
export function directionOf(heading: number): { x: number; y: number } {
  const exact = (n: number) => (Math.abs(n) < 1e-12 ? 0 : n);
  return { x: exact(Math.cos(heading)), y: exact(Math.sin(heading)) };
}

/** The heading a row faces. */
export const facingOf = (of: Atlas | readonly number[], row: number): number => (Array.isArray(of) ? of : (of as Atlas).meta.directionFacings)?.[row] ?? Math.PI / 2;

/** The frame a clip shows at a time: a loop wraps, anything else holds its last frame. */
export function frameIndex(clip: { fps: number; frameCount: number }, time: number, loops: boolean): number {
  const frame = Math.floor(time * clip.fps);
  return loops ? frame % clip.frameCount : Math.min(frame, clip.frameCount - 1);
}
