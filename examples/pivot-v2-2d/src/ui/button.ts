/**
 * Button: a raised slate slab with a bone trim round a dark label face (nine-slice, 8 px corners).
 * Four states: normal; hover (a lit slab, the soul ward's green runs round the face); pressed (the
 * bevel inverts, the face sinks); disabled (flat, faded to the surface tones).
 */

import { defineNineSlice } from '@core';
import { alpha, lerpColor } from '@core/draw';
import { UI_RAMPS, RAMPS, PALETTES } from '../theme';
import { fillBox, inset, ring, slabPlate, type Tones } from './draw';

const CORNER = 8;
const CHAMFER = 2.4;

export const button = defineNineSlice({
  kind: 'button',
  width: 64,
  height: 24,
  insets: { left: CORNER, top: CORNER, right: CORNER, bottom: CORNER },
  states: ['normal', 'hover', 'pressed', 'disabled'],
  draw(c, b, state) {
    const slate = UI_RAMPS.slate;
    const face = (tone: string) => lerpColor(slate.base, slate.dark, tone === 'normal' ? 0.62 : 0.4);
    if (state === 'disabled') {
      // Flat and faded: the surface ramp, no catch-light, a dim trim.
      const dim: Tones = { lit: lerpColor(PALETTES.surfaceLit, PALETTES.stoneDark, 0.4), base: PALETTES.surfaceLit, dark: PALETTES.surface };
      const inner = slabPlate(c, b, dim, { contour: 2, chamfer: CHAMFER, bevel: 1, hi: dim.lit });
      ring(c, inner, 1, PALETTES.surface);
      fillBox(c, inset(inner, 1), lerpColor(PALETTES.surface, PALETTES.bg, 0.5));
      return;
    }
    const pressed = state === 'pressed';
    const hover = state === 'hover';
    const tones: Tones = pressed ? { lit: slate.base, base: lerpColor(slate.base, slate.dark, 0.5), dark: slate.dark } : slate;
    const inner = slabPlate(c, b, tones, {
      contour: 2,
      chamfer: CHAMFER,
      bevel: 1.3,
      raised: !pressed,
      hi: hover ? PALETTES.stoneLit : undefined,
      face: hover ? lerpColor(slate.lit, slate.base, 0.5) : tones.base,
    });
    // The trim, then the face the label is set on.
    const trim = hover ? PALETTES.soul : pressed ? RAMPS.bone.dark : lerpColor(RAMPS.bone.dark, RAMPS.bone.base, 0.2);
    ring(c, inner, 1.1, trim);
    const face0 = inset(inner, 1.1);
    const faceColor = pressed ? UI_RAMPS.parchment.dark : face(state);
    fillBox(c, face0, faceColor);
    if (!pressed) {
      // The face is a little domed: a lit line under the trim at the top, a shaded one at the foot.
      fillBox(c, { x: face0.x, y: face0.y, w: face0.w, h: 1.2 }, lerpColor(faceColor, hover ? PALETTES.white : slate.lit, hover ? 0.18 : 0.28));
      fillBox(c, { x: face0.x, y: face0.y + face0.h - 1.4, w: face0.w, h: 1.4 }, lerpColor(faceColor, PALETTES.ink, 0.35));
    }
    if (hover) ring(c, face0, 1.6, alpha(PALETTES.soul, 0.28));
    if (pressed) {
      // The face sinks: shadow under the top and left edges.
      fillBox(c, { x: face0.x, y: face0.y, w: face0.w, h: 1.6 }, alpha(PALETTES.ink, 0.45));
      fillBox(c, { x: face0.x, y: face0.y + 1.6, w: 1.6, h: face0.h - 1.6 }, alpha(PALETTES.ink, 0.45));
    }
  },
});
