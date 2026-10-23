/**
 * Numerals of the HUD's bitmap fonts, drawn with @core/draw paths: each glyph is a few strokes (a path
 * with a round cap, the thickness of a brush) united into one shape, outlined by the same strokes a
 * little wider, and lit from the upper left in three tones. One set of strokes serves every font
 * (damage in a tintable near-white, healing in soul green); a font only changes the tones.
 *
 * Glyph coordinates: the centre line of the strokes lives in a box W wide and H tall (x right, y
 * down from the top of the digit); the brush's half width is added around it.
 */

import { Path, lerpColor, type Point, type Shape } from '@core/draw';
import { PALETTES } from '../theme';

/** Glyph metrics (logical px). */
export const GLYPH = {
  /** Width and height of the box the centre lines of a digit live in. */
  W: 7.8,
  H: 11.4,
  /** Brush thickness of the strokes. */
  stroke: 3,
  /** Dark outline round the glyph. */
  outline: 1.3,
  /** Distance from the left of the glyph's ink to its cell's left edge (room for the outline). */
  bearing: 1.7,
  /** Gap added to the ink width to make the advance. */
  gap: 1.7,
  /** Distance from the cell's top to the baseline. */
  baseline: 19,
};

const RAD = Math.PI / 180;

/** Points along an ellipse arc (degrees: 0 right, 90 down, 180 left, 270 up on screen), `n` per full turn. */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, bulge = 2): Point[] {
  const steps = Math.max(6, Math.ceil((Math.abs(to - from) / 360) * 40));
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (from + ((to - from) * i) / steps) * RAD;
    const ca = Math.cos(a), sa = Math.sin(a);
    // A superellipse (bulge 2 is the ellipse): above 2 the curve squares up like a bold numeral's bowl.
    pts.push({ x: cx + rx * Math.sign(ca) * Math.abs(ca) ** (2 / bulge), y: cy + ry * Math.sign(sa) * Math.abs(sa) ** (2 / bulge) });
  }
  return pts;
}

/** Points along a quadratic curve. */
function quad(p0: Point, c: Point, p1: Point, steps = 14): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    pts.push({ x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y });
  }
  return pts;
}

const P = (x: number, y: number): Point => ({ x, y });

/** One stroke of a glyph: its centre line, closed or open, and its thickness (default the brush's). */
interface Stroke {
  pts: Point[];
  closed?: boolean;
  width?: number;
  /** Thickness at the start and the end, for a tapered stroke. */
  taper?: [number, number];
}

/** The recipes are drawn on a 7 × 10.4 box and scaled to the glyph box. */
const W = 7;
const H = 10.4;

/** The stroke recipes of every glyph of the font. */
function strokesOf(ch: string): Stroke[] {
  const s = GLYPH.stroke;
  switch (ch) {
    case '0':
      return [{ pts: arc(W / 2, H / 2, W / 2, H / 2, 0, 360, 2.5).slice(0, -1), closed: true }];
    case '1':
      return [{ pts: [P(0.2, 2.8), P(3.4, 0.1)] }, { pts: [P(3.4, 0.1), P(3.4, H)] }];
    case '2':
      return [{ pts: [...arc(W / 2, 3.0, W / 2, 3.0, 195, 385, 2.2), ...quad(P(6.6, 4.6), P(5.4, 7.2), P(0.1, H - 0.05), 10), P(W, H - 0.05)] }];
    case '3':
      return [
        { pts: arc(3.3, 2.75, 3.1, 2.75, 205, 450, 2.2) },
        { pts: arc(3.4, 7.55, 3.6, 2.85, 270, 520, 2.2) },
        { pts: [P(1.9, 5.15), P(3.5, 5.15)] },
      ];
    case '4':
      return [{ pts: [P(4.7, 0.1), P(0.1, 7.1), P(W + 0.1, 7.1)] }, { pts: [P(4.7, 0.1), P(4.7, H)] }];
    case '5':
      return [
        { pts: [P(6.2, 0.1), P(1.0, 0.1), P(0.5, 4.5)] },
        { pts: arc(3.45, 6.95, 3.55, 3.45, 238, 520, 2.2) },
      ];
    case '6':
      return [{ pts: arc(3.5, 6.9, 3.5, 3.5, 0, 360, 2.3).slice(0, -1), closed: true }, { pts: quad(P(0.05, 6.9), P(-0.1, 1.2), P(5.7, 0.1), 16) }];
    case '7':
      return [{ pts: [P(0.1, 0.1), P(W - 0.1, 0.1), P(2.5, H)] }];
    case '8':
      return [
        { pts: arc(3.5, 2.8, 2.95, 2.8, 0, 360, 2.2).slice(0, -1), closed: true },
        { pts: arc(3.5, 7.35, 3.5, 3.05, 0, 360, 2.2).slice(0, -1), closed: true },
      ];
    case '9':
      // A six turned a half turn about the centre of the box.
      return strokesOf('6').map((st) => ({ ...st, pts: st.pts.map((p) => P(W - p.x, H - p.y)) }));
    case '+':
      return [{ pts: [P(0.7, 5.2), P(6.3, 5.2)] }, { pts: [P(3.5, 2.3), P(3.5, 8.1)] }];
    case '-':
      return [{ pts: [P(0.9, 5.2), P(6.1, 5.2)] }];
    case '%':
      return [
        { pts: arc(2.4, 2.5, 1.9, 1.9, 0, 360, 2).slice(0, -1), closed: true, width: 2.4 },
        { pts: arc(W + 1.9, H - 2.5, 1.9, 1.9, 0, 360, 2).slice(0, -1), closed: true, width: 2.4 },
        { pts: [P(W + 1.6, 0.5), P(1.3, H - 0.5)], width: 2.5 },
      ];
    case '!':
      return [{ pts: [P(0, 0.1), P(0, 5.4)], taper: [s + 0.6, s - 0.6] }, { pts: [P(0, H - 0.05), P(0, H - 0.05)], width: s + 0.2 }];
    default:
      return [];
  }
}

/** The glyph's body: its strokes united, `grow` wider all round (the outline). */
function glyphShape(ch: string, grow = 0): Shape | undefined {
  const sx = GLYPH.W / W, sy = GLYPH.H / H;
  const parts = strokesOf(ch).map((st) => {
    const path = new Path(st.pts.map((p) => P(p.x * sx, p.y * sy)), st.closed ?? false);
    const width = st.taper ? { start: st.taper[0] + 2 * grow, end: st.taper[1] + 2 * grow } : (st.width ?? GLYPH.stroke) + 2 * grow;
    return path.toShape({ width, cap: 'round' });
  });
  if (!parts.length) return undefined;
  return parts.length === 1 ? parts[0] : parts[0].union(parts.slice(1));
}

/** Tones of a font: the three of the glyph (lit upper left rim, base, shaded lower right rim) and its outline. */
export interface FontTones {
  lit: string;
  base: string;
  dark: string;
  outline: string;
}

/** A near-white that a game can tint (multiply) to any colour and keep the form: a lit rim, a pale base, a lavender shade. */
export const TINTABLE: FontTones = {
  lit: PALETTES.white,
  base: lerpColor(PALETTES.white, PALETTES.fleshLit, 0.5),
  dark: lerpColor(PALETTES.fleshLit, PALETTES.flesh, 0.45),
  outline: PALETTES.robeDark,
};

/**
 * Draws glyph `ch` into its cell, ink starting at the bearing, resting on the baseline, and returns
 * its advance (the ink's width and a gap).
 */
export function drawGlyph(c: CanvasRenderingContext2D, ch: string, tones: FontTones): number {
  const body = glyphShape(ch);
  const rim = glyphShape(ch, GLYPH.outline);
  if (!body || !rim) return GLYPH.W + GLYPH.stroke + GLYPH.gap;
  const half = GLYPH.stroke / 2;
  const b = body.bounds;
  // Left of the ink at the bearing; the bottom of the digit's box on the baseline.
  const dx = GLYPH.bearing + GLYPH.outline - b.minX;
  const dy = GLYPH.baseline - half - GLYPH.H;
  const at = (g: Shape, ox = 0, oy = 0): Shape => g.clone().translate(dx + ox, dy + oy);
  const dark = at(body);
  at(rim).fill(c, tones.outline);
  dark.fill(c, tones.dark);
  // Light from the upper left: everything but a rim at the lower right is lit, everything but a rim at the upper left is base.
  const k = 0.85;
  at(body).clip(c, () => {
    at(body, -k, -k).clip(c, () => {
      at(body, -k, -k).fill(c, tones.lit);
    });
  });
  at(body).clip(c, () => {
    at(body, k, k).clip(c, () => {
      at(body, -k, -k).fill(c, tones.base);
    });
  });
  return b.width + GLYPH.gap;
}
