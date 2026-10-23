/**
 * Ability slot: a slate frame with bone corner brackets round a dark well for the ability's icon
 * (nine-slice, 12 px corners). States: normal, hover (bone light), selected (the soul ward's green),
 * disabled (faded to the surface tones). At its native size the well holds a 48 px icon
 * (`slotSize`); `data.content` is the margin round the well for a game that sizes its own.
 */

import { defineNineSlice } from '@core';
import { drawSlot, slotSize, type SlotLook } from './slots';

const CORNER = 12;
const LOOK: SlotLook = { contour: 2, chamfer: 2, band: 3.4, brackets: { len: 8, thick: 2.6 } };
const { size, data } = slotSize(LOOK);

export const abilitySlot = defineNineSlice({
  kind: 'slot',
  width: size,
  height: size,
  insets: { left: CORNER, top: CORNER, right: CORNER, bottom: CORNER },
  states: ['normal', 'hover', 'selected', 'disabled'],
  data,
  draw(c, b, state) {
    drawSlot(c, b, state as 'normal', LOOK);
  },
});
