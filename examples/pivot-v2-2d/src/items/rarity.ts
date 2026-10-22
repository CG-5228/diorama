/**
 * Rarity tiers and the slot art of the item icons (guide 06 of @core/volume): the dark ground with a soft glow of the
 * tier's color under the item, and the thin bevelled frame over it, with a small gem in the corner of the two top tiers.
 * Both are drawn with `@core/draw` in the icon's logical pixels (48 × 48 by default) and take every color from the theme.
 *
 * Tiers are metals, as the rest of the game's palette is: iron grey, bone, steel blue and a dusk violet; only the legendary
 * burns soul green, so the accent keeps marking what is important. The item keeps its own colors, the tier lives here only.
 *
 * Light comes from the upper left, as everywhere: the frame's top and left edges catch it and its bottom and right edges
 * sit in shade, so the slot reads as a raised border round a sunken ground.
 */

import { Polygon, StrokeStyle, alpha, lerpColor } from '@core/draw';
import type { IconBox, ItemInfo, Rarity } from '@core/rig';
import { PALETTES, STROKES } from '../theme';

/** The tiers, from the plainest up. Labels are the game's UI copy (pt-BR). */
export const RARITIES: Record<string, Rarity> = {
  common: { label: 'Comum', color: PALETTES.ironLit },
  uncommon: { label: 'Incomum', color: PALETTES.bone },
  rare: { label: 'Raro', color: PALETTES.steelBlue },
  epic: { label: 'Épico', color: PALETTES.violet },
  legendary: { label: 'Lendário', color: PALETTES.soul },
};

/** The tiers that carry a gem in the frame's corner. */
const GEMMED = new Set(['epic', 'legendary']);

/** The slot's corner radius: small, so the frame reads as a bevelled plate and not a button. */
const CORNER = 3.2;

const rect = (box: IconBox, inset: number, radius = CORNER) =>
  Polygon.rect(box.w - inset * 2, box.h - inset * 2, { cx: box.x + box.w / 2, cy: box.y + box.h / 2, radius: Math.max(0.5, radius - inset * 0.6) });

/** A line of the frame: ink-based strokes take the theme's detail stroke, round-joined. */
const line = (color: string, width: number): StrokeStyle => STROKES.detail.with({ color, width });

/** The key of the tier an item is drawn with, for the gem: the catalog's rarities are looked up by color. */
const tierOf = (rarity: Rarity): string => Object.keys(RARITIES).find(k => RARITIES[k].color === rarity.color) ?? 'common';

/**
 * The slot's ground: a dark violet gradient (lighter at the top, where the light falls), a soft glow of the tier's color a
 * little above the middle, and a darker corner at the bottom right. Nothing here goes below the ink's luminance, so the
 * ground never counts as line.
 */
export function slotBackground(c: CanvasRenderingContext2D, box: IconBox, rarity: Rarity, _item: ItemInfo): void {
  const slot = rect(box, 0);
  const ground = slot.createGradient(c, { type: 'linear', direction: 'vertical', stops: [[0, lerpColor(PALETTES.surface, PALETTES.surfaceLit, 0.5)], [1, lerpColor(PALETTES.bg, PALETTES.surface, 0.55)]] });
  slot.fill(c, ground);
  slot.clip(c, () => {
    // The glow: strong enough to tint the whole slot, soft enough that the item stays the brightest thing in it. The gradients
    // are given their centre and radius, so they end at nothing exactly on their circle's edge (no visible rim).
    const radial = (cx: number, cy: number, r: number, stops: [number, string][]) => {
      const disc = Polygon.circle(r, { cx, cy });
      disc.fill(c, disc.createGradient(c, { type: 'radial', center: { x: cx, y: cy }, r1: 0, r2: r, stops }));
    };
    radial(box.x + box.w * 0.5, box.y + box.h * 0.5, box.w * 0.72, [[0, alpha(rarity.color, 0.4)], [0.5, alpha(rarity.color, 0.17)], [1, alpha(rarity.color, 0)]]);
    // Shade towards the lower right, away from the light.
    radial(box.x + box.w * 1.05, box.y + box.h * 1.1, box.w * 0.95, [[0, alpha(PALETTES.bg, 0.5)], [1, alpha(PALETTES.bg, 0)]]);
  });
}

/**
 * The frame: an ink line outside, a band of the tier's color with a lit edge at the top and left and a dark edge at the
 * bottom and right (a bevel), and a thin dark line inside against the ground. The two top tiers add a small gem on the
 * top left corner, over the band: violet for epic, soul green with a halo for legendary.
 */
export function rarityFrame(c: CanvasRenderingContext2D, box: IconBox, rarity: Rarity, _item: ItemInfo): void {
  const lit = lerpColor(rarity.color, PALETTES.white, 0.5);
  const dark = lerpColor(rarity.color, PALETTES.ink, 0.55);
  // Ink outside, the band, the bevel, the inner line.
  rect(box, 0.5).stroke(c, line(PALETTES.ink, 1));
  rect(box, 1.8).stroke(c, line(rarity.color, 1.7));
  const upperLeft = Polygon.fromPoints([{ x: box.x - 1, y: box.y - 1 }, { x: box.x + box.w * 1.05, y: box.y - 1 }, { x: box.x - 1, y: box.y + box.h * 1.05 }]);
  const lowerRight = Polygon.fromPoints([{ x: box.x + box.w + 1, y: box.y + box.h + 1 }, { x: box.x - box.w * 0.05, y: box.y + box.h + 1 }, { x: box.x + box.w + 1, y: box.y - box.h * 0.05 }]);
  upperLeft.clip(c, () => rect(box, 1.25).stroke(c, line(lit, 0.7)));
  lowerRight.clip(c, () => rect(box, 2.35).stroke(c, line(dark, 0.7)));
  rect(box, 2.95).stroke(c, line(alpha(PALETTES.ink, 0.6), 0.7));
  const tier = tierOf(rarity);
  if (GEMMED.has(tier)) gem(c, box, rarity, tier === 'legendary');
}

/** The corner gem: a faceted diamond with an ink edge, a lit upper left facet and a pale spark; legendary also glows. */
function gem(c: CanvasRenderingContext2D, box: IconBox, rarity: Rarity, glow: boolean): void {
  const at = { x: box.x + 5, y: box.y + 5 };
  const body = Polygon.diamond(7.2, 8.4, { cx: at.x, cy: at.y });
  body.draw(c, {
    fill: rarity.color,
    celShade: { shade: lerpColor(rarity.color, PALETTES.ink, 0.5), lightPivot: 'topLeft', litScale: { x: 0.8, y: 0.85 } },
    stroke: line(PALETTES.ink, 0.9),
    ...(glow ? { shadow: { color: alpha(rarity.color, 0.85), x: 0, y: 0, blur: 4 } } : {}),
  });
  Polygon.diamond(2.4, 3, { cx: at.x - 0.9, cy: at.y - 1.3 }).fill(c, lerpColor(rarity.color, PALETTES.white, 0.8));
}
