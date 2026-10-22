/**
 * Cursor: three states drawn on one 28 × 28 cell with the hotspot (the point that clicks) at (3, 3)
 * in every state, so a game swaps images without moving the pointer.
 * - normal: a bone arrow;
 * - interact: the arrow burning with the soul ward's green, with a ward beside it (something here answers);
 * - attack: a sword pointing up-left, tip on the hotspot, blood-red guard and pommel.
 */

import { defineUiImage } from '@core';
import { Polygon, alpha, type Point } from '@core/draw';
import { RAMPS, UI_RAMPS, PALETTES, STROKES } from '../theme';
import { soulRune, line, type Tones } from './draw';

const HOTSPOT = { x: 3, y: 3 };
/** The arrow and the sword are drawn a little over their design size, so the contour is a smaller share of them. */
const GROW = 1.22;

/** The arrow's outline, tip on the hotspot. */
const ARROW: Point[] = [
  { x: 0, y: 0 },
  { x: 0, y: 15.2 },
  { x: 3.6, y: 11.8 },
  { x: 6.4, y: 17.6 },
  { x: 9.2, y: 16.4 },
  { x: 6.4, y: 10.6 },
  { x: 11.4, y: 10.6 },
].map((p) => ({ x: HOTSPOT.x + p.x * GROW, y: HOTSPOT.y + p.y * GROW }));

function arrow(c: CanvasRenderingContext2D, tones: Tones, glow = false): void {
  const shape = Polygon.fromPoints(ARROW);
  shape.draw(c, {
    fill: tones.base,
    celShade: { shade: tones.dark, lightPivot: 'topLeft', litScale: { x: 0.78, y: 0.8 } },
    stroke: STROKES.outline.with({ width: 0.9, position: 'outside' }),
    ...(glow ? { shadow: { color: alpha(PALETTES.soul, 0.8), x: 0, y: 0, blur: 3 } } : {}),
  });
  // A lit edge down the left of the arrow, the side the light finds.
  line(c, [{ x: HOTSPOT.x + 0.55, y: HOTSPOT.y + 1.8 }, { x: HOTSPOT.x + 0.55, y: HOTSPOT.y + 14.4 }], 0.8, tones.lit, 'butt');
}

/** The sword, built pointing down from the origin (tip) and turned to lie up-left on the hotspot. */
function sword(c: CanvasRenderingContext2D): void {
  const blade = RAMPS.iron;
  const steel = { lit: PALETTES.white, base: PALETTES.stoneLit, dark: PALETTES.ironLit };
  const blood = UI_RAMPS.blood;
  c.save();
  c.translate(HOTSPOT.x, HOTSPOT.y);
  c.rotate(-Math.PI / 4);
  c.scale(GROW, GROW);
  // Blade: a tapered point, 12.4 long, 3.4 wide at the guard, with a fuller.
  const bladeShape = Polygon.fromPoints([{ x: 0, y: 0 }, { x: 1.7, y: 3.2 }, { x: 1.7, y: 12.4 }, { x: -1.7, y: 12.4 }, { x: -1.7, y: 3.2 }]);
  bladeShape.draw(c, { fill: steel.base, celShade: { shade: steel.dark, lightPivot: 'left', litScale: { x: 0.62, y: 1 } }, stroke: STROKES.outline.with({ width: 0.9, position: 'outside' }) });
  line(c, [{ x: -0.5, y: 3.6 }, { x: -0.5, y: 11 }], 0.7, steel.lit, 'butt');
  line(c, [{ x: 0.35, y: 4 }, { x: 0.35, y: 11 }], 0.55, blade.dark, 'butt');
  // Guard: a blood-red crossbar.
  const guard = Polygon.fromPoints([{ x: -4.4, y: 12.4 }, { x: 4.4, y: 12.4 }, { x: 4.4, y: 14.6 }, { x: -4.4, y: 14.6 }]);
  guard.draw(c, { fill: blood.base, celShade: { shade: blood.dark, lightPivot: 'topLeft', litScale: { x: 0.8, y: 0.55 } }, stroke: STROKES.outline.with({ width: 0.9, position: 'outside' }) });
  // Grip and pommel.
  const grip = Polygon.fromPoints([{ x: -1.1, y: 14.6 }, { x: 1.1, y: 14.6 }, { x: 1.1, y: 18.6 }, { x: -1.1, y: 18.6 }]);
  grip.draw(c, { fill: RAMPS.leather.base, stroke: STROKES.outline.with({ width: 0.9, position: 'outside' }) });
  Polygon.circle(1.9, { cx: 0, cy: 19.9, segments: 14 }).draw(c, { fill: blood.base, celShade: { shade: blood.dark, lightPivot: 'topLeft', litScale: 0.7 }, stroke: STROKES.outline.with({ width: 0.9, position: 'outside' }) });
  c.restore();
}

export const cursor = defineUiImage({
  kind: 'cursor',
  width: 28,
  height: 28,
  states: ['normal', 'interact', 'attack'],
  pivot: HOTSPOT,
  data: { hotspot: HOTSPOT },
  draw(c, _b, state) {
    if (state === 'normal') arrow(c, RAMPS.bone);
    else if (state === 'interact') {
      arrow(c, RAMPS.soul, true);
      soulRune(c, 21.2, 20.4, 7.6, 1);
    } else sword(c);
  },
});
