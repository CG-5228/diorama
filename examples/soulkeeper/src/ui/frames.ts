/**
 * Frames of the HUD: the dark slate band with a bone trim round a dark parchment field, shared by
 * the dialog panel, the tooltip and the portrait frame. The corner plates carry the soul ward.
 *
 * A nine-slice frame is built so that its edges never change along their length (only bands and
 * lines, drawn across the whole box) and everything that is not a band lives inside a corner cell:
 * the plates fill the whole inset square, nothing crosses an inset line except along its edge.
 */

import type { UiBox } from '@core';
import { RAMPS, UI_RAMPS, PALETTES } from '../theme';
import { fillBox, inset, slabPlate, ring, recess, soulRune, stud, INK } from './draw';

/** The chamfer of the panel's silhouette, which its corner plates repeat so the outline runs unbroken. */
export const PANEL_CHAMFER = 3;

/** The parts of a frame, from the outside in: contour, slate band, groove, bone trim, field. */
export interface FrameLook {
  /** Chamfer of the silhouette. */
  chamfer: number;
  /** Slate band thickness inside the contour (bevel included). */
  band: number;
  /** Ink contour. */
  contour: number;
  /** Field tones (the dark parchment). */
  field: { lit: string; base: string; dark: string };
}

/**
 * The frame band and the field of a box: no corners yet. Returns the box of the field.
 */
export function drawFrame(c: CanvasRenderingContext2D, b: UiBox, look: FrameLook): UiBox {
  const { chamfer, band, contour, field } = look;
  const slate = UI_RAMPS.slate;
  // Contour + slate band with its bevel (light from the upper left).
  slabPlate(c, b, slate, { contour, chamfer, bevel: 1.3, hi: RAMPS.stone.lit });
  // The groove between the slate and the bone trim, then the trim, then the field.
  const grooveAt = inset(b, contour + band - 2.3);
  ring(c, grooveAt, 1, slate.dark);
  const trimAt = inset(grooveAt, 1);
  ring(c, trimAt, 1.3, RAMPS.bone.dark);
  const fieldBox = inset(trimAt, 1.3);
  fillBox(c, fieldBox, field.base);
  recess(c, fieldBox, field.dark, field.lit, 2.2, 1);
  return fieldBox;
}

/**
 * A corner plate of the dialog panel: a bone slab with a dark socket and the soul ward in it. It
 * fills its whole corner cell `b` (the inset square); only the outer corner is cut.
 */
export function wardPlate(c: CanvasRenderingContext2D, b: UiBox, corner: 'tl' | 'tr' | 'br' | 'bl', ward = 1): void {
  const k = PANEL_CHAMFER;
  const cut: [number, number, number, number] = corner === 'tl' ? [k, 0, 0, 0] : corner === 'tr' ? [0, k, 0, 0] : corner === 'br' ? [0, 0, k, 0] : [0, 0, 0, k];
  const inner = slabPlate(c, b, RAMPS.bone, { contour: 1.5, chamfer: cut, bevel: 1.1, hi: PALETTES.boneLit });
  // The socket: a dark diamond-cut recess so the ward reads on the bone.
  const socket = inset(inner, 1.5);
  fillBox(c, socket, UI_RAMPS.parchment.dark, 1.4);
  recess(c, socket, INK, undefined, 1.1, 0);
  soulRune(c, socket.x + socket.w / 2, socket.y + socket.h / 2 + 0.2, Math.min(socket.w, socket.h) * 0.72, ward);
}

/** A small bone stud for the corners of quiet frames (the tooltip's). */
export function cornerStud(c: CanvasRenderingContext2D, cx: number, cy: number): void {
  stud(c, cx, cy, 1.9, RAMPS.bone);
}

