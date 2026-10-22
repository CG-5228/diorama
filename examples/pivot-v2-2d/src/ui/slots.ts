/**
 * Slots of the HUD: a dark well (where an icon is set) inside a slate frame. The ability slot adds
 * bone brackets in its corners; the inventory slot is the bare well. A selected slot burns with the
 * soul ward's green (the accent marks what is active), a hovered one catches bone light.
 */

import { alpha, lerpColor } from '@core/draw';
import type { UiBox } from '@core';
import { UI_RAMPS, RAMPS, PALETTES } from '../theme';
import { fillBox, inset, ring, slabPlate, recess, bracket, INK, type Tones } from './draw';

export type SlotState = 'normal' | 'empty' | 'hover' | 'selected' | 'disabled';

/** Tones of a slot's frame in a state. */
function frameTones(state: SlotState): { tones: Tones; hi?: string } {
  if (state === 'disabled') return { tones: RAMPS.surface };
  if (state === 'hover') return { tones: UI_RAMPS.slate, hi: PALETTES.stoneLit };
  return { tones: UI_RAMPS.slate };
}

/** The item kit's icon (`items/catalog.ts`: 48 logical px, its own ground and frame): the well of a slot at its native size holds one. */
export const ICON_SIZE = 48;

/** Margin between a slot's edge and its well at rest: contour, slate band, the rim and the well's own inset. */
export const wellMargin = (look: SlotLook): number => Math.round((look.contour + look.band + 0.8 + 0.9) * 10) / 10;

/** A slot's native size and the atlas data a game sizes its own slots by: `content` is the margin round the well, so a slot for an icon is `icon + left + right` wide. */
export function slotSize(look: SlotLook): { size: number; data: { content: { left: number; top: number; right: number; bottom: number } } } {
  const m = Math.ceil(wellMargin(look));
  return { size: ICON_SIZE + 2 * m, data: { content: { left: m, top: m, right: m, bottom: m } } };
}

export interface SlotLook {
  contour: number;
  chamfer: number;
  /** Slate band thickness inside the contour (bevel included). */
  band: number;
  /** Bone brackets in the corners (length, thickness), or none. */
  brackets?: { len: number; thick: number };
}

/**
 * Draws a slot: contour, slate frame, the well, and the state's marks. Returns the well's box (the
 * square an icon goes in).
 */
export function drawSlot(c: CanvasRenderingContext2D, b: UiBox, state: SlotState, look: SlotLook): UiBox {
  const { tones, hi } = frameTones(state);
  const dead = state === 'disabled';
  slabPlate(c, b, tones, { contour: look.contour, chamfer: look.chamfer, bevel: 1.2, hi });
  const wellOuter = inset(b, look.contour + look.band);
  // A rim round the well: bone trim, lit on hover, soul green when selected.
  const rim = state === 'selected' ? PALETTES.soul : state === 'hover' ? RAMPS.bone.base : dead ? lerpColor(PALETTES.surfaceLit, PALETTES.surface, 0.3) : lerpColor(RAMPS.bone.dark, UI_RAMPS.slate.dark, 0.35);
  fillBox(c, wellOuter, INK);
  const rimBox = inset(wellOuter, 0.8);
  fillBox(c, rimBox, rim);
  const well = inset(rimBox, state === 'selected' ? 1.3 : 0.9);
  fillBox(c, well, dead ? RAMPS.surface.dark : UI_RAMPS.parchment.dark);
  recess(c, well, alpha(INK, dead ? 0.35 : 0.7), dead ? undefined : alpha(PALETTES.boneDark, 0.18), 2, 1);
  if (state === 'selected') {
    // The soul light the slot gives off, just inside its frame.
    ring(c, inset(b, look.contour), 1.2, alpha(PALETTES.soul, 0.22));
    ring(c, wellOuter, 1.2, alpha(PALETTES.soul, 0.3));
  }
  if (look.brackets) {
    const { len, thick } = look.brackets;
    const m = look.contour + 0.2;
    const bt: Tones = state === 'selected' ? RAMPS.soul : state === 'hover' ? { lit: PALETTES.white, base: PALETTES.boneLit, dark: RAMPS.bone.base } : dead ? { lit: RAMPS.surface.lit, base: lerpColor(RAMPS.surface.lit, RAMPS.surface.base, 0.5), dark: RAMPS.surface.base } : RAMPS.bone;
    bracket(c, m, m, 'tl', len, thick, bt);
    bracket(c, b.w - m, m, 'tr', len, thick, bt);
    bracket(c, b.w - m, b.h - m, 'br', len, thick, bt);
    bracket(c, m, b.h - m, 'bl', len, thick, bt);
  }
  return well;
}
