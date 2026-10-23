import assert from 'node:assert/strict';
import { buildLibrary, capPlacement, clipFrames, eventsByFrame, eventsOf, fillRect, layoutText, minimumSize, nineSlice, stretchFill, type Atlas } from '@diorama/runtime';
import { fixtureSheets } from './helpers';

console.log('🧪 Checking the interface sheets (nine-slice stretch, bars, bitmap font text, effect events)...\n');

const sheetFrame = { x: 10, y: 20, width: 48, height: 32 };
const insets = { left: 4, top: 3, right: 6, bottom: 5 };

// 1. A nine-slice keeps its corners and stretches the rest: nine parts, the corners at their own size.
assert.deepEqual(minimumSize(insets), { width: 11, height: 9 });
const parts = nineSlice(sheetFrame, insets, 2, 200, 120);
assert.equal(parts.length, 9);
const corner = parts[0];
assert.deepEqual([corner.sx, corner.sy, corner.sw, corner.sh, corner.dx, corner.dy, corner.dw, corner.dh], [10, 20, 8, 6, 0, 0, 8, 6], 'the top-left corner is its insets × scale, from the frame\'s corner');
const last = parts[8];
assert.deepEqual([last.dx + last.dw, last.dy + last.dh], [200, 120], 'the parts cover the whole destination');
assert.deepEqual([last.dw, last.dh], [12, 10], 'the bottom-right corner keeps its size');
const middle = parts[4];
assert.deepEqual([middle.dx, middle.dy, middle.dw, middle.dh], [8, 6, 200 - 8 - 12, 120 - 6 - 10], 'the middle takes what is left');
assert.deepEqual([middle.sx, middle.sw], [10 + 8, 48 - 8 - 12], 'and comes from the middle of the sheet');
// No gaps or overlaps along a row and a column.
for (const row of [0, 3, 6]) assert.equal(parts[row].dx + parts[row].dw, parts[row + 1].dx);
for (const column of [0, 1, 2]) assert.equal(parts[column].dy + parts[column].dh, parts[column + 3].dy);
// At the size it was drawn at, every part keeps its scale: the edges are not stretched.
const same = nineSlice(sheetFrame, insets, 2, 48, 32);
assert.ok(same.every((p) => p.sw === p.dw && p.sh === p.dh), 'at the source size nothing is stretched');
// A size under the insets is raised to them, and zero-area parts are left out.
const tiny = nineSlice(sheetFrame, insets, 2, 4, 4);
assert.deepEqual([tiny[0].dw, tiny.at(-1)!.dx + tiny.at(-1)!.dw], [8, 20], 'raised to the borders');
assert.equal(nineSlice({ x: 0, y: 0, width: 20, height: 20 }, { left: 5, top: 5, right: 5, bottom: 5 }, 2, 40, 40).length, 4, 'insets that use the whole frame leave no middle (and no edges) to draw: only the four corners');

// 2. A bar's fill is clipped to the value inside its fill box, growing the way it grows.
const box = { x: 2, y: 3, w: 40, h: 10 };
assert.deepEqual(fillRect(box, 0.5, 'right'), { x: 2, y: 3, w: 20, h: 10 });
assert.deepEqual(fillRect(box, 0.25, 'left'), { x: 2 + 30, y: 3, w: 10, h: 10 }, 'growing left, the fill is at the right end');
assert.deepEqual(fillRect({ x: 0, y: 0, w: 10, h: 40 }, 0.25, 'up'), { x: 0, y: 30, w: 10, h: 10 }, 'growing up, the fill is at the bottom');
assert.deepEqual(fillRect({ x: 0, y: 0, w: 10, h: 40 }, 0.75, 'down'), { x: 0, y: 0, w: 10, h: 30 });
assert.equal(fillRect(box, 0, 'right').w, 0);
assert.equal(fillRect(box, 2, 'right').w, 40, 'a value past the ends is held to them');
assert.equal(fillRect(box, -1, 'right').w, 0);
assert.deepEqual(stretchFill(box, 20, 0), { x: 2, y: 3, w: 60, h: 10 }, 'a longer bar has a longer fill box');
// The cap is moved back along `grows` by what is missing from the value, and clipped to the fill box.
assert.deepEqual(capPlacement(box, 1, 'right'), { dx: 0, dy: 0, clip: box }, 'at 100% it stays where it was drawn');
assert.deepEqual(capPlacement(box, 0.25, 'right').dx, -30, 'growing right, a quarter-full bar has its cap three quarters back from the full end');
assert.deepEqual(capPlacement(box, 0.25, 'left').dx, 30, 'growing left, it moves the other way');
assert.deepEqual(capPlacement({ x: 0, y: 0, w: 10, h: 40 }, 0.5, 'up'), { dx: 0, dy: 20, clip: { x: 0, y: 0, w: 10, h: 40 } });
assert.equal(capPlacement({ x: 0, y: 0, w: 10, h: 40 }, 0.5, 'down').dy, -20);
assert.equal(capPlacement(box, 0.01, 'right').dx, -39.6, 'at 1% only a sliver of its end stays inside the box');
assert.equal(capPlacement(box, 5, 'right').dx, 0, 'a value past the ends is held to them');
// The cap's frame is found by name: it comes last in the sheet ('back', 'fill', 'frame', 'cap').
assert.deepEqual(['back', 'fill', 'frame', 'cap'].indexOf('cap'), 3);

// 3. A bitmap font sets text with each glyph's advance: a narrow "1" takes less room.
const font = { chars: '0123456789+-%', cell: { w: 10, h: 12 }, baseline: 9, lineHeight: 14, spacing: 1, advances: { '0': 8, '1': 5, '2': 8, '-': 6, '+': 7 } as Record<string, number> };
const one = layoutText(font, '1');
assert.deepEqual(one.glyphs, [{ char: '1', index: 1, x: 0, y: 0 }]);
assert.deepEqual([one.width, one.height], [5, 12], 'a line is as wide as its advances (no spacing after the last)');
const text = layoutText(font, '-128');
assert.deepEqual(text.glyphs.map((g) => [g.char, g.x]), [['-', 0], ['1', 7], ['2', 13], ['8', 22]], 'the pen moves by the advance and the spacing; a glyph without an advance takes the whole cell');
assert.equal(text.width, 22 + 10);
// Unknown characters leave a gap, a newline goes down a line height.
assert.deepEqual(layoutText(font, '1 1').glyphs.map((g) => g.x), [0, 5 + 1 + 5 + 1], 'a space is half a cell');
const lines = layoutText(font, '12\n+4');
assert.deepEqual(lines.glyphs.map((g) => [g.char, g.x, g.y]), [['1', 0, 0], ['2', 6, 0], ['+', 0, 14], ['4', 8, 14]]);
assert.equal(lines.height, 14 + 12);
assert.equal(lines.width, 8 + 10, 'the widest line: "+4", the 4 with the whole cell');
assert.deepEqual(layoutText(font, ''), { glyphs: [], width: 0, height: 12 });

// 4. An effect sheet's events are the effect's own; a clip's keep theirs.
const effect: Atlas = { meta: { data: { role: 'vfx', effect: { id: 'hit', kind: 'impact', frames: 4, fps: 12, loop: false, layer: 'air', height: 0, size: 10, directions: 1, events: [{ frame: 1, name: 'hit' }, { frame: 3, name: 'fade' }] } } }, frames: {} };
assert.deepEqual(eventsOf(effect).map((e) => e.name), ['hit', 'fade']);
assert.deepEqual([...eventsByFrame(effect)], [[1, ['hit']], [3, ['fade']]]);
const clip: Atlas = { meta: { data: { events: [{ frame: 2, name: 'cancel' }] } }, frames: {} };
assert.deepEqual(eventsOf(clip), [{ frame: 2, name: 'cancel' }]);
assert.deepEqual(eventsOf(undefined), []);

// 5. The sample's interface sheets (cut from its export): a bar's layers and fill box, a font's glyphs.
const sample = new Map(fixtureSheets('ui').map((s) => [s.asset.path, s.atlas!]));
const bar = sample.get('ui/health-bar')!;
const barData = bar.meta.data!;
assert.deepEqual(barData.layers?.slice(0, 3), ['back', 'fill', 'frame'], 'a bar lists its layers in sheet order');
assert.deepEqual(fillRect(barData.fillBox!, 1, barData.grows ?? 'right'), barData.fillBox, 'full, the fill is its box');
assert.equal(clipFrames(bar, 'default', 0).length, barData.layers!.length, 'one frame per layer');
assert.deepEqual(clipFrames(bar, 'default', 0), barData.layers!.map((_, i) => bar.frames[`frame_${i}`]), 'the cells its export wrote, by name (`frame_<n>`)');
assert.ok(clipFrames(bar, 'default', 0).every((cell, i) => cell.y === 0 && cell.x === i * bar.meta.frameWidth!), 'side by side, one per layer');
const damage = sample.get('ui/damage-font')!.meta.data!.font!;
const set = layoutText(damage, '123');
assert.deepEqual(set.glyphs.map((g) => [g.char, g.index]), [['1', damage.chars.indexOf('1')], ['2', damage.chars.indexOf('2')], ['3', damage.chars.indexOf('3')]]);
assert.equal(set.height, damage.cell.h);
const panel = sample.get('ui/dialog-panel')!;
const panelInsets = panel.meta.data!.nineSlice!;
const scale = panel.meta.scale ?? 1;
const wide = nineSlice(clipFrames(panel, 'default', 0)[0], panelInsets, scale, 400 * scale, 120 * scale);
assert.equal(wide.length, 9, 'the dialog panel stretches in nine parts');
// What a game reads from the library: a portrait frame's window and a cursor's hotspot (and its states, one row each).
const ui = buildLibrary(fixtureSheets('ui')).ui;
assert.deepEqual([...ui.keys()].sort(), ['ui/cursor', 'ui/damage-font', 'ui/dialog-panel', 'ui/health-bar', 'ui/portrait-frame']);
const portrait = ui.get('ui/portrait-frame')!;
assert.deepEqual([portrait.kind, portrait.window, portrait.hotspot], ['portrait-frame', { x: 9, y: 9, w: 46, h: 54 }, null], 'where the portrait goes, logical px');
const cursor = ui.get('ui/cursor')!;
assert.deepEqual([cursor.kind, cursor.hotspot, cursor.window, cursor.states], ['cursor', { x: 3, y: 3 }, null, ['normal', 'interact', 'attack']]);
assert.deepEqual(cursor.atlas.meta.pivot?.logical, cursor.hotspot!, 'the pivot marks the hotspot too');
const directions = cursor.atlas.meta.directions!;
assert.deepEqual(cursor.states.map((_, row) => clipFrames(cursor.atlas, 'default', row)[0]), directions.map((d) => cursor.atlas.frames[`${d}_0`]), 'a state per row, its cell by name');
assert.equal(ui.get('ui/health-bar')!.cap?.width, 3);

console.log('✅ interface checks passed');
