/**
 * Diorama Core - Interface assets
 *
 * The pieces of a game's HUD and menus as sheets a game engine stretches and composes, drawn with
 * `@core/draw` in the project's style:
 * - nine-slice panels, buttons and slots (`defineNineSlice`): corners stay, edges and middle stretch;
 *   one row per state (normal, hover, pressed, disabled…);
 * - bars (`defineBar`): back, fill and frame as three frames (and a cap for the fill's cut edge), the
 *   fill clipped to a value by the game;
 * - bitmap fonts (`defineBitmapFont`): one glyph per frame with its advance, for damage numbers and
 *   short labels, with no font file to ship;
 * - plain images (`defineUiImage`): cursors, portrait frames, ornaments, in states.
 * Every atlas says `role: 'ui'` and its `kind`. Guide 06 of `@core/volume`.
 */

import { defineAsset, type AssetDefinition } from './asset.js';

/** A box in logical pixels. */
export interface UiBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The fixed borders of a nine-slice image, in logical pixels. */
export interface Insets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Options of `defineNineSlice`. */
export interface NineSliceOptions {
  /** What it is for: 'panel', 'button', 'slot', 'tooltip', 'frame' or the project's own. */
  kind: string;
  /** Logical size it is drawn at (a game stretches it to any size larger than the insets). */
  width: number;
  height: number;
  /** Borders that never stretch: the corners and the edges' thickness. */
  insets: Insets;
  /** States, one row each (default ['normal']): 'normal', 'hover', 'pressed', 'disabled', 'selected'. */
  states?: string[];
  /** Draws the image in a state into `box` (the whole cell). */
  draw: (c: CanvasRenderingContext2D, box: UiBox, state: string) => void;
  scale?: number;
  data?: Record<string, unknown>;
}

/**
 * A nine-slice image (panel, button, slot): drawn once per state, with the insets a game engine
 * stretches it by (Phaser `NineSlice`, Godot `NinePatchRect`). Draw corners and edges so that the
 * edges can repeat or stretch and the middle can fill any size: no feature may cross an inset line
 * except along its edge.
 */
export function defineNineSlice(o: NineSliceOptions): AssetDefinition {
  const states = o.states ?? ['normal'];
  if (o.insets.left + o.insets.right >= o.width || o.insets.top + o.insets.bottom >= o.height) throw new Error(`ui: the insets of "${o.kind}" leave no middle to stretch`);
  return defineAsset({
    width: o.width,
    height: o.height,
    scale: o.scale ?? 2,
    directions: states.length,
    data: { role: 'ui', kind: o.kind, nineSlice: o.insets, states, ...o.data },
    render({ ctx, direction = 0 }) {
      o.draw(ctx, { x: 0, y: 0, w: o.width, h: o.height }, states[direction]);
    },
  });
}

/** The layers of a bar: back, fill, the optional cap at the fill's end, frame (drawn in that order). */
export type BarLayer = 'back' | 'fill' | 'cap' | 'frame';

/** Options of `defineBar`. */
export interface BarOptions {
  /** What it measures ('health', 'mana', 'soul', 'xp', 'cooldown'): carried in the atlas. */
  measure?: string;
  width: number;
  height: number;
  /** Borders that never stretch when a game makes the bar longer. */
  insets: Insets;
  /** The box the fill occupies at full value, inside the frame. */
  fillBox: UiBox;
  /** Which way the fill grows. Default 'right'. */
  grows?: 'right' | 'left' | 'up' | 'down';
  /**
   * A cap: the bright edge where the fill ends, drawn as a fourth frame at the full end of `fillBox`
   * (as at 100%) within `width` logical px of it. A game moves it with the fill's end and clips it to
   * `fillBox`, so a bar at any value shows its cut edge.
   */
  cap?: { width: number };
  draw: (c: CanvasRenderingContext2D, box: UiBox, layer: BarLayer) => void;
  scale?: number;
  data?: Record<string, unknown>;
}

/**
 * A bar as frames a game composes: the back, the fill clipped to the value along `grows` inside
 * `fillBox`, the cap (if any) moved to where the fill ends, then the frame over them. Frames follow
 * `layers` in the atlas ('back', 'fill', 'frame', then 'cap'), which also carries the insets and the
 * fill box, so a game can stretch the bar.
 */
export function defineBar(o: BarOptions): AssetDefinition {
  const layers: BarLayer[] = o.cap ? ['back', 'fill', 'frame', 'cap'] : ['back', 'fill', 'frame'];
  return defineAsset({
    width: o.width,
    height: o.height,
    scale: o.scale ?? 2,
    frames: layers.length,
    data: { role: 'ui', kind: 'bar', measure: o.measure ?? 'value', layers, nineSlice: o.insets, fillBox: o.fillBox, grows: o.grows ?? 'right', ...(o.cap ? { cap: o.cap } : {}), ...o.data },
    render({ ctx, frameIndex = 0 }) {
      o.draw(ctx, { x: 0, y: 0, w: o.width, h: o.height }, layers[frameIndex]);
    },
  });
}

/** Options of `defineBitmapFont`. */
export interface BitmapFontOptions {
  /** The characters, in frame order ('0123456789+-%' for damage numbers). */
  chars: string;
  /** Logical size of one glyph cell. */
  cell: { w: number; h: number };
  /** Distance from the cell's top to the baseline. */
  baseline: number;
  /** Draws one glyph into its cell and returns its advance (how far the pen moves after it). */
  draw: (c: CanvasRenderingContext2D, char: string, box: UiBox) => number;
  /** Extra space between glyphs. Default 1. */
  spacing?: number;
  /** Distance between lines. Default the cell's height. */
  lineHeight?: number;
  scale?: number;
}

/**
 * A bitmap font: one glyph per frame, drawn by the project (with `@core/draw` paths, in its style), with each
 * glyph's advance, the baseline and the line height in the atlas (`font`), so a game sets text with
 * it without a font file. Advances are measured while drawing, so a narrow '1' takes less room.
 * Setting text: draw each glyph's cell with its left edge at the pen, then move the pen by the
 * glyph's advance plus `spacing`. Ink may run past the advance (an outline): `spacing` keeps
 * neighbours apart.
 */
export function defineBitmapFont(o: BitmapFontOptions): AssetDefinition {
  const chars = [...o.chars];
  if (new Set(chars).size !== chars.length) throw new Error('ui: a bitmap font lists a character twice');
  const advances: Record<string, number> = {};
  return defineAsset({
    width: o.cell.w,
    height: o.cell.h,
    scale: o.scale ?? 2,
    frames: chars.length,
    data: {
      role: 'ui',
      kind: 'font',
      get font() {
        return { chars: o.chars, cell: o.cell, baseline: o.baseline, lineHeight: o.lineHeight ?? o.cell.h, spacing: o.spacing ?? 1, advances: { ...advances } };
      },
    },
    render({ ctx, frameIndex = 0 }) {
      const ch = chars[frameIndex];
      advances[ch] = Math.round(o.draw(ctx, ch, { x: 0, y: 0, w: o.cell.w, h: o.cell.h }) * 100) / 100;
    },
  });
}

/** Options of `defineUiImage`. */
export interface UiImageOptions {
  /** What it is: 'cursor', 'portrait-frame', 'ornament', 'icon-frame' or the project's own. */
  kind: string;
  width: number;
  height: number;
  /** States, one row each (default ['normal']). */
  states?: string[];
  /** Where the image's point is (a cursor's hotspot), in logical pixels. */
  pivot?: { x: number; y: number };
  draw: (c: CanvasRenderingContext2D, box: UiBox, state: string) => void;
  scale?: number;
  data?: Record<string, unknown>;
}

/** A plain interface image in states (a cursor with its hotspot, a portrait frame, an ornament). */
export function defineUiImage(o: UiImageOptions): AssetDefinition {
  const states = o.states ?? ['normal'];
  return defineAsset({
    width: o.width,
    height: o.height,
    scale: o.scale ?? 2,
    directions: states.length,
    ...(o.pivot ? { pivot: o.pivot } : {}),
    data: { role: 'ui', kind: o.kind, states, ...o.data },
    render({ ctx, direction = 0 }) {
      o.draw(ctx, { x: 0, y: 0, w: o.width, h: o.height }, states[direction]);
    },
  });
}
