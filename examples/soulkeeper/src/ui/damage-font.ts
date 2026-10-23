/**
 * Damage font: '0123456789+-%!' as bold numerals drawn with @core/draw paths, a dark outline round a near-white
 * body with a lit rim and a shaded one. The body is white on purpose: a game tints it (multiplies by a colour:
 * red for damage, gold for a critical hit, grey for a miss) and the form and the outline stay. Healing has
 * its own font in soul green (`heal-font`), drawn from the same strokes.
 */

import { defineBitmapFont } from '@core';
import { drawGlyph, GLYPH, TINTABLE } from './glyphs';

export const damageFont = defineBitmapFont({
  chars: '0123456789+-%!',
  cell: { w: 20, h: 22 },
  baseline: GLYPH.baseline,
  lineHeight: 21,
  spacing: 1,
  draw(c, ch) {
    return drawGlyph(c, ch, TINTABLE);
  },
});
