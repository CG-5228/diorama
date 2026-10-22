/**
 * Bars of the HUD (health, soul): a game draws the back, the fill clipped to the value, the cap, then the frame.
 *
 * The frame is a slate bar with a bone plate on the left holding a gem (a drop of blood, a soul's
 * flame) and a window cut through it (`cutBox`) for the back and the fill to show in. Along its
 * length nothing changes, so a game may stretch it by the insets (left plate 16, right end 6) and
 * the back and the fill stretch with it. The fill is flat along its whole length: the bright edge
 * where it ends is its own frame, the `cap` (`CAP_WIDTH` wide, at the full end of the window), which a game
 * moves to where the fill ends and clips to the window, so a bar at 3% is a sliver of bright edge over
 * the fill's own shading and not a plain cut.
 */

import { defineBar } from '@core';
import { alpha, lerpColor } from '@core/draw';
import type { UiBox } from '@core';
import { UI_RAMPS, RAMPS, PALETTES } from '../theme';
import { fillBox, inset, slabPlate, recess, cutBox, teardrop, INK, type Tones } from './draw';

export const BAR = {
  width: 128,
  height: 18,
  /** The window: where the back shows and the fill is drawn. */
  well: { x: 16, y: 4, w: 108, h: 10 } as UiBox,
  insets: { left: 16, top: 6, right: 6, bottom: 6 },
};

/** The cap's width in logical px: the bright edge of the fill's end, a few pixels so even a sliver of fill shows it. */
export const CAP_WIDTH = 3;

type Gem = 'drop' | 'flame';

/** The plate on the left of the frame: bone with a dark socket and the gem of what the bar measures. */
function gemPlate(c: CanvasRenderingContext2D, gem: Gem, tones: Tones): void {
  const plate: UiBox = { x: 0, y: 0, w: BAR.insets.left, h: BAR.height };
  const inner = slabPlate(c, plate, RAMPS.bone, { contour: 1.6, chamfer: [2, 0, 0, 2], bevel: 1.1, hi: PALETTES.boneLit });
  // Socket: a dark disc the gem sits in.
  const cx = inner.x + inner.w / 2 - 0.2, cy = inner.y + inner.h / 2 + 0.2;
  const r = Math.min(inner.w, inner.h) / 2 - 0.6;
  c.save();
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fillStyle = INK;
  c.fill();
  c.restore();
  c.save();
  c.beginPath();
  c.arc(cx, cy, r - 0.9, 0, Math.PI * 2);
  c.fillStyle = UI_RAMPS.parchment.dark;
  c.fill();
  c.restore();
  if (gem === 'drop') {
    const g = teardrop(cx, cy + 1.1, 2.7, 1.9);
    g.draw(c, { fill: tones.base, celShade: { shade: tones.dark, lightPivot: 'topLeft', litScale: 0.72 }, stroke: { width: 0.7, color: INK } });
    c.save();
    c.beginPath();
    c.arc(cx - 1, cy + 0.6, 0.65, 0, Math.PI * 2);
    c.fillStyle = PALETTES.white;
    c.globalAlpha = 0.85;
    c.fill();
    c.restore();
  } else {
    const g = teardrop(cx, cy + 1.2, 2.5, 2.1);
    g.draw(c, { fill: tones.base, celShade: { shade: tones.dark, lightPivot: 'bottom', litScale: 0.7 }, shadow: { color: alpha(tones.base, 0.9), x: 0, y: 0, blur: 2.6 } });
    teardrop(cx, cy + 1.6, 1.2, 1.6).fill(c, tones.lit);
  }
}

/** The fill's body over a box: a lit rim over the body, a core shadow and a dark foot under it. Flat along its length. */
function paintFill(c: CanvasRenderingContext2D, b: UiBox, fill: Tones): void {
  fillBox(c, b, fill.base);
  fillBox(c, { x: b.x, y: b.y, w: b.w, h: 1.5 }, fill.lit);
  fillBox(c, { x: b.x, y: b.y + 0.3, w: b.w, h: 0.6 }, lerpColor(fill.lit, PALETTES.white, 0.55));
  fillBox(c, { x: b.x, y: b.y + b.h - 3.6, w: b.w, h: 1.2 }, lerpColor(fill.base, fill.dark, 0.5));
  fillBox(c, { x: b.x, y: b.y + b.h - 2.4, w: b.w, h: 2.4 }, fill.dark);
}

/**
 * The cap: the last `CAP_WIDTH` px of the fill with its bright edge, drawn at the full end of the window. It carries the fill's
 * own rim and foot, so where it covers a whole sliver of fill that sliver is still a shaded fill and not a flat bar; the edge
 * is palest at the very end and falls off over the rest of the cap, with the foot kept a step darker so it stays a volume.
 */
function paintCap(c: CanvasRenderingContext2D, W: UiBox, fill: Tones): void {
  const x0 = W.x + W.w - CAP_WIDTH;
  paintFill(c, { x: x0, y: W.y, w: CAP_WIDTH, h: W.h }, fill);
  const e = lerpColor(fill.lit, PALETTES.white, 0.35);
  const pale = lerpColor(e, PALETTES.white, 0.6);
  const rim = 1.5;
  const foot = 2.4;
  // The edge: bands falling off towards the fill, each as high as the fill, the last one only warming it. Each has its own rim
  // (where the light catches it), body and foot, the foot only lifted a little towards the edge's light.
  const bands: { x: number; w: number; rim: string; body: string; foot: string }[] = [
    { x: W.x + W.w - 0.9, w: 0.9, rim: PALETTES.white, body: pale, foot: lerpColor(fill.dark, e, 0.5) },
    { x: W.x + W.w - 1.8, w: 0.9, rim: lerpColor(fill.lit, PALETTES.white, 0.6), body: e, foot: lerpColor(fill.dark, e, 0.2) },
    { x: x0, w: CAP_WIDTH - 1.8, rim: fill.lit, body: lerpColor(fill.base, e, 0.4), foot: fill.dark },
  ];
  for (const b of bands) {
    fillBox(c, { x: b.x, y: W.y, w: b.w, h: rim }, b.rim);
    fillBox(c, { x: b.x, y: W.y + rim, w: b.w, h: W.h - rim - foot }, b.body);
    fillBox(c, { x: b.x, y: W.y + W.h - foot, w: b.w, h: foot }, b.foot);
  }
}

export interface BarLook {
  measure: string;
  fill: Tones;
  gem: Gem;
}

export function defineBarLook(look: BarLook) {
  const { fill, gem } = look;
  const W = BAR.well;
  return defineBar({
    measure: look.measure,
    width: BAR.width,
    height: BAR.height,
    insets: BAR.insets,
    fillBox: W,
    grows: 'right',
    cap: { width: CAP_WIDTH },
    draw(c, b, layer) {
      if (layer === 'back') {
        // The empty well: dark, deeper under the top edge, running a little under the frame.
        // Its left end runs under the gem plate, so the shade of its left edge is hidden and nothing crosses the inset.
        const back: UiBox = { x: W.x - 5, y: W.y - 1, w: W.w + 6, h: W.h + 2 };
        fillBox(c, back, UI_RAMPS.parchment.dark);
        recess(c, back, alpha(INK, 0.75), alpha(PALETTES.boneDark, 0.16), 2.4, 1);
        return;
      }
      if (layer === 'fill') {
        // Flat along the whole length: the edge where it ends is the cap's.
        paintFill(c, W, fill);
        return;
      }
      if (layer === 'cap') {
        paintCap(c, W, fill);
        return;
      }
      // Frame: ink, slate with its bevel, the gem plate, the window cut through.
      const body: UiBox = { x: 0, y: 0, w: b.w, h: b.h };
      slabPlate(c, body, UI_RAMPS.slate, { contour: 1.6, chamfer: 2, bevel: 1.2, hi: RAMPS.stone.lit });
      // The window's edge: ink all round, then cut it out.
      fillBox(c, inset(W, -1.1), INK);
      cutBox(c, W);
      // Inside the window: the frame's upper edge shades what is under it.
      fillBox(c, { x: W.x, y: W.y, w: W.w, h: 0.9 }, alpha(INK, 0.55));
      gemPlate(c, gem, fill);
    },
  });
}
