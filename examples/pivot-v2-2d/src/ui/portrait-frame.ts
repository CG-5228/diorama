/**
 * Portrait frame: a slate frame with a bone trim round a window (cut clear, so a portrait shows
 * through), a bone keystone with the soul ward on top and bone studs in the corners. 64 × 72, the
 * window 46 × 54 at (9, 9) (also in the atlas as `data.window`, where a game puts the portrait).
 */

import { defineUiImage } from '@core';
import { alpha } from '@core/draw';
import { UI_RAMPS, RAMPS, PALETTES } from '../theme';
import { fillBox, inset, ring, slabPlate, cutBox, soulRune, stud, INK } from './draw';

const WINDOW = { x: 9, y: 9, w: 46, h: 54 };

export const portraitFrame = defineUiImage({
  kind: 'portrait-frame',
  width: 64,
  height: 72,
  data: { window: WINDOW },
  draw(c, b) {
    const slate = UI_RAMPS.slate;
    slabPlate(c, b, slate, { contour: 1.6, chamfer: 3, bevel: 1.3, hi: RAMPS.stone.lit });
    // Groove, bone trim, the ink round the window, and the window itself cut clear.
    ring(c, inset(WINDOW, -3.4), 1, slate.dark);
    ring(c, inset(WINDOW, -2.4), 1.3, RAMPS.bone.dark);
    fillBox(c, inset(WINDOW, -0.9), INK, 2.6);
    cutBox(c, WINDOW, 2.4);
    // The window's own shade: a faint inner shadow on the portrait under the top and left.
    fillBox(c, { x: WINDOW.x + 2, y: WINDOW.y, w: WINDOW.w - 4, h: 1.2 }, alpha(INK, 0.4));
    // Studs in the corners of the slate.
    for (const [x, y] of [[4.6, 4.6], [b.w - 4.6, 4.6], [b.w - 4.6, b.h - 4.6], [4.6, b.h - 4.6]]) stud(c, x, y, 1.9, RAMPS.bone);
    // Keystone: bone slab over the top edge with the ward in a dark socket.
    const key = { x: b.w / 2 - 12, y: 0, w: 24, h: 15 };
    const inner = slabPlate(c, key, RAMPS.bone, { contour: 1.5, chamfer: [2.4, 2.4, 0, 0], bevel: 1.1, hi: PALETTES.boneLit });
    const socket = inset(inner, 1.4);
    fillBox(c, socket, UI_RAMPS.parchment.dark, 1.2);
    soulRune(c, socket.x + socket.w / 2, socket.y + socket.h / 2 + 0.2, Math.min(socket.h * 0.9, 9), 1);
  },
});
