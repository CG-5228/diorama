/**
 * Heal font: the damage font's numerals in soul green, for healing and soul gains ('+12', '+5%'). The same
 * strokes, a dark teal outline, a lit rim in the soul's pale core and a shade in its dark tone. Already
 * coloured: a game does not tint it.
 */

import { defineBitmapFont } from '@core';
import { lerpColor } from '@core/draw';
import { RAMPS, PALETTES } from '../theme';
import { drawGlyph, GLYPH, type FontTones } from './glyphs';

const SOUL: FontTones = {
  lit: RAMPS.soul.lit,
  base: RAMPS.soul.base,
  dark: lerpColor(RAMPS.soul.base, RAMPS.soul.dark, 0.6),
  outline: lerpColor(RAMPS.soul.dark, PALETTES.ink, 0.62),
};

export const healFont = defineBitmapFont({
  chars: '0123456789+-%!',
  cell: { w: 20, h: 22 },
  baseline: GLYPH.baseline,
  lineHeight: 21,
  spacing: 1,
  draw(c, ch) {
    return drawGlyph(c, ch, SOUL);
  },
});
