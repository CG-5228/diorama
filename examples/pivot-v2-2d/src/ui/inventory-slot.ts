/**
 * Inventory slot: the bare well in a slate frame (nine-slice, 9 px corners). States: empty, hover
 * (bone light), selected (the soul ward's green). At its native size the well holds an item icon
 * (48 px, `slotSize`); `data.content` is the margin round the well for a game that sizes its own.
 */

import { defineNineSlice } from '@core';
import { drawSlot, slotSize, type SlotLook } from './slots';

const CORNER = 9;
const LOOK: SlotLook = { contour: 1.6, chamfer: 1.6, band: 2.6 };
const { size, data } = slotSize(LOOK);

export const inventorySlot = defineNineSlice({
  kind: 'slot',
  width: size,
  height: size,
  insets: { left: CORNER, top: CORNER, right: CORNER, bottom: CORNER },
  states: ['empty', 'hover', 'selected'],
  data,
  draw(c, b, state) {
    drawSlot(c, b, state as 'empty', LOOK);
  },
});
