/**
 * Dialog panel: a dark slate frame with a bone trim and soul-ward corner plates round a dark
 * parchment field (nine-slice, 14 px corners). Dialog boxes, menus and windows.
 */

import { defineNineSlice } from '@core';
import { UI_RAMPS } from '../theme';
import { drawFrame, wardPlate, PANEL_CHAMFER } from './frames';

const CORNER = 14;

export const dialogPanel = defineNineSlice({
  kind: 'panel',
  width: 96,
  height: 72,
  insets: { left: CORNER, top: CORNER, right: CORNER, bottom: CORNER },
  draw(c, b) {
    drawFrame(c, b, { chamfer: PANEL_CHAMFER, contour: 2, band: 6.6, field: UI_RAMPS.parchment });
    wardPlate(c, { x: 0, y: 0, w: CORNER, h: CORNER }, 'tl');
    wardPlate(c, { x: b.w - CORNER, y: 0, w: CORNER, h: CORNER }, 'tr');
    wardPlate(c, { x: b.w - CORNER, y: b.h - CORNER, w: CORNER, h: CORNER }, 'br');
    wardPlate(c, { x: 0, y: b.h - CORNER, w: CORNER, h: CORNER }, 'bl');
  },
});
