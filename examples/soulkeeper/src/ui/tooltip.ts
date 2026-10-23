/**
 * Tooltip: the panel's frame made quiet: a thin slate band, a bone trim and four bone studs round a
 * darker parchment field (nine-slice, 9 px corners). No soul ward: the accent stays for what is active.
 */

import { defineNineSlice } from '@core';
import { lerpColor } from '@core/draw';
import { UI_RAMPS, PALETTES } from '../theme';
import { drawFrame, cornerStud } from './frames';

const CORNER = 9;
const FIELD = { lit: UI_RAMPS.parchment.base, base: UI_RAMPS.parchment.dark, dark: lerpColor(UI_RAMPS.parchment.dark, PALETTES.ink, 0.5) };

export const tooltip = defineNineSlice({
  kind: 'tooltip',
  width: 56,
  height: 36,
  insets: { left: CORNER, top: CORNER, right: CORNER, bottom: CORNER },
  draw(c, b) {
    drawFrame(c, b, { chamfer: 2, contour: 1.6, band: 4.4, field: FIELD });
    const at = 4.4;
    cornerStud(c, at, at);
    cornerStud(c, b.w - at, at);
    cornerStud(c, b.w - at, b.h - at);
    cornerStud(c, at, b.h - at);
  },
});
