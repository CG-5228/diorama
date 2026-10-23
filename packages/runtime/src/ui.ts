import type { Rect } from './contract/atlas.js';
import type { FontMeta, Insets, UiBox } from './contract/ui.js';

/** What an interface sheet gives a game, as pure geometry (core/ui.ts): how a nine-slice stretches, how a bar fills, how a bitmap font sets text. */

/** A part of a nine-slice: where it comes from on the sheet and where it goes (both in pixels). */
export interface SlicePart {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/** The smallest size (logical px) a nine-slice can be drawn at: the borders that never stretch, and one pixel of middle. */
export const minimumSize = (insets: Insets) => ({ width: insets.left + insets.right + 1, height: insets.top + insets.bottom + 1 });

/**
 * The parts of a nine-slice drawn at a size: the corners keep their size, the edges stretch along their length and the middle
 * both ways. `src` is the frame on the sheet (px), the insets are logical px (× `scale` to sheet px), and `width`, `height`
 * are the size to draw at, in the same px as the sheet. A size under the insets is raised to them. Parts with no area are left out.
 */
export function nineSlice(src: Rect, insets: Insets, scale: number, width: number, height: number): SlicePart[] {
  const l = insets.left * scale;
  const r = insets.right * scale;
  const t = insets.top * scale;
  const b = insets.bottom * scale;
  const w = Math.max(width, l + r);
  const h = Math.max(height, t + b);
  const columns = [
    { sx: 0, sw: l, dx: 0, dw: l },
    { sx: l, sw: src.width - l - r, dx: l, dw: w - l - r },
    { sx: src.width - r, sw: r, dx: w - r, dw: r },
  ];
  const rows = [
    { sy: 0, sh: t, dy: 0, dh: t },
    { sy: t, sh: src.height - t - b, dy: t, dh: h - t - b },
    { sy: src.height - b, sh: b, dy: h - b, dh: b },
  ];
  const parts: SlicePart[] = [];
  for (const row of rows) {
    for (const column of columns) {
      if (column.sw <= 0 || row.sh <= 0 || column.dw <= 0 || row.dh <= 0) continue;
      parts.push({ sx: src.x + column.sx, sy: src.y + row.sy, sw: column.sw, sh: row.sh, dx: column.dx, dy: row.dy, dw: column.dw, dh: row.dh });
    }
  }
  return parts;
}

/** The part of a bar's fill box a value fills (0 to 1), growing the way the bar grows. */
export function fillRect(box: UiBox, value: number, grows: 'right' | 'left' | 'up' | 'down'): UiBox {
  const v = Math.max(0, Math.min(1, value));
  switch (grows) {
    case 'right':
      return { x: box.x, y: box.y, w: box.w * v, h: box.h };
    case 'left':
      return { x: box.x + box.w * (1 - v), y: box.y, w: box.w * v, h: box.h };
    case 'up':
      return { x: box.x, y: box.y + box.h * (1 - v), w: box.w, h: box.h * v };
    case 'down':
      return { x: box.x, y: box.y, w: box.w, h: box.h * v };
  }
}

/**
 * Where a bar's cap goes. The cap is a frame drawn the size of the bar with its bright edge at the full end of the fill box (as
 * at 100%); a game moves it back along `grows` by what is missing from the value, so it sits where the fill ends, and clips it
 * to the fill box so nothing of it shows outside. Offsets are in logical px; `clip` is the fill box.
 */
export function capPlacement(box: UiBox, value: number, grows: 'right' | 'left' | 'up' | 'down'): { dx: number; dy: number; clip: UiBox } {
  const missing = 1 - Math.max(0, Math.min(1, value));
  switch (grows) {
    case 'right':
      return { dx: 0 - box.w * missing, dy: 0, clip: box };
    case 'left':
      return { dx: box.w * missing, dy: 0, clip: box };
    case 'up':
      return { dx: 0, dy: box.h * missing, clip: box };
    case 'down':
      return { dx: 0, dy: 0 - box.h * missing, clip: box };
  }
}

/** A bar made longer (or taller) than its sheet: its fill box grows by the same amount, so the fill still reaches the end of the frame. */
export const stretchFill = (box: UiBox, extraW: number, extraH: number): UiBox => ({ ...box, w: box.w + extraW, h: box.h + extraH });

/** A glyph set on a line: the character, its frame on the font sheet, and where its cell goes (logical px from the text's top-left). */
export interface GlyphPlace {
  char: string;
  /** The frame of the glyph: its place in `chars`. */
  index: number;
  x: number;
  y: number;
}

/**
 * Sets text with a bitmap font the way a game does: each glyph's cell at the pen, the pen moving by that glyph's advance
 * (a narrow "1" takes less room) and the font's spacing; a newline goes down a line height. A character the font does not
 * have leaves a gap as wide as a space (or half a cell). Sizes are in logical px.
 */
export function layoutText(font: FontMeta, text: string): { glyphs: GlyphPlace[]; width: number; height: number } {
  const chars = [...font.chars];
  const glyphs: GlyphPlace[] = [];
  let x = 0;
  let y = 0;
  let width = 0;
  for (const char of text) {
    if (char === '\n') {
      width = Math.max(width, x - font.spacing);
      x = 0;
      y += font.lineHeight;
      continue;
    }
    const index = chars.indexOf(char);
    if (index >= 0) {
      glyphs.push({ char, index, x, y });
      x += (font.advances[char] ?? font.cell.w) + font.spacing;
    } else {
      x += (font.advances[' '] ?? Math.round(font.cell.w / 2)) + font.spacing;
    }
  }
  width = Math.max(width, x - font.spacing, 0);
  return { glyphs, width, height: y + font.cell.h };
}
