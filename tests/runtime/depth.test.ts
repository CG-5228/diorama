import assert from 'node:assert/strict';
import { createRng, depthKey } from '@diorama/runtime';
import { fixtureSheets } from './helpers';

console.log('🧪 Checking the depth order (standing items, actors and air effects by the floor point under them) and the seeded generator...\n');

interface Item {
  name: string;
  kind: 'standing' | 'actor' | 'fx';
  y: number;
  order: number;
}

/**
 * The viewer's Playground draw loop (viewer/src/components/playground/scene.tsx): the actors and the air effects sorted by
 * y (actors first at equal y, a stable sort), merged into the standing items in layout order, each standing item drawn
 * after everything strictly above it.
 */
function playgroundOrder(standing: Item[], actors: Item[], fx: Item[]): string[] {
  const sorted = [...actors, ...fx].sort((a, b) => a.y - b.y);
  const out: string[] = [];
  let next = 0;
  for (const item of standing) {
    while (next < sorted.length && sorted[next].y < item.y) out.push(sorted[next++].name);
    out.push(item.name);
  }
  while (next < sorted.length) out.push(sorted[next++].name);
  return out;
}

const byKey = (items: Item[]) => [...items].sort((a, b) => depthKey(a.y, a.kind, a.order) - depthKey(b.y, b.kind, b.order)).map((i) => i.name);

// 1. The rules at one y: a standing item first, then the actor, then the air effect; standing items keep their layout order.
assert.ok(depthKey(100, 'standing') < depthKey(100, 'actor'));
assert.ok(depthKey(100, 'actor') < depthKey(100, 'fx'));
assert.ok(depthKey(100, 'standing', 0) < depthKey(100, 'standing', 1));
assert.ok(depthKey(100, 'fx', 9) < depthKey(100.25, 'standing'), 'further down the screen is in front, whatever the kind');
assert.ok(depthKey(-40, 'actor') < depthKey(-39, 'standing'), 'above the top of the screen too');
assert.equal(depthKey(100, 'actor'), depthKey(100.03, 'actor'), 'y is rounded to sixteenths of a pixel: these two are level');
assert.ok(depthKey(100, 'standing') < depthKey(100.03, 'actor') && depthKey(100.03, 'standing') < depthKey(100, 'actor'), 'on one level the kind decides, whichever y is lower');
assert.ok(depthKey(100.04, 'standing') > depthKey(100.03, 'fx'), 'it is a grid, not a tolerance: 0.01 px apart can be two levels (100.03 rounds down, 100.04 up)');
assert.ok(Number.isSafeInteger(depthKey(1e5, 'fx', 65535)), 'one exact number: a renderer can take it as its depth');

// 2. The same order as the Playground's loop, on random scenes (floor points on a quarter-pixel grid).
const rng = createRng(2026);
for (let scene = 0; scene < 200; scene++) {
  const y = () => Math.round(rng() * 40) / 4;
  const standing = Array.from({ length: 12 }, (_, i) => ({ name: `s${i}`, kind: 'standing' as const, y: y(), order: i })).sort((a, b) => a.y - b.y).map((s, i) => ({ ...s, order: i }));
  const actors = Array.from({ length: 4 }, (_, i) => ({ name: `a${i}`, kind: 'actor' as const, y: y(), order: i }));
  const fx = Array.from({ length: 4 }, (_, i) => ({ name: `f${i}`, kind: 'fx' as const, y: y(), order: i }));
  assert.deepEqual(byKey([...standing, ...actors, ...fx]), playgroundOrder(standing, actors, fx), `scene ${scene}`);
}

// 3. The crypt entrance's standing items (its layout, `pass: 'object'`), in the order the scene lists them, keep it.
const layout = fixtureSheets('scenes/crypt-entrance')[0].atlas!.meta.data!.layout!;
const standing = layout.filter((item) => item.pass === 'object').map((item, order) => ({ name: `${item.piece}#${order}`, kind: 'standing' as const, y: item.y * 2, order }));
assert.ok(standing.length > 20);
assert.deepEqual(byKey(standing), standing.map((s) => s.name), 'the layout is already in depth order');
const guard = { name: 'guard', kind: 'actor' as const, y: standing[10].y, order: 0 };
const order = byKey([...standing, guard]);
assert.equal(order.indexOf('guard'), order.indexOf(standing[10].name) + 1 + standing.slice(11).filter((s) => s.y === standing[10].y).length, 'an actor level with a piece is drawn after it (and after the pieces at its y)');

// 4. The seeded generator: the same seed, the same draws (Mulberry32, as `@core`'s createRng).
const a = createRng(7);
const b = createRng(7);
const draws = Array.from({ length: 5 }, () => a());
assert.deepEqual(draws, Array.from({ length: 5 }, () => b()));
assert.ok(draws.every((d) => d >= 0 && d < 1));
assert.notDeepEqual(draws, Array.from({ length: 5 }, createRng(8)));
assert.equal(createRng(1)(), 0.6270739405881613, 'the first draw of seed 1');

console.log('✅ depth and random checks passed');
