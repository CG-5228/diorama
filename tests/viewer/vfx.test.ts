import assert from 'node:assert/strict';
import type { Atlas, CharacterManifest, EffectCue } from '../../viewer/src/lib/atlas';
import { advance, newActor, startClip, type Actor, type ClipEvent } from '../../viewer/src/lib/playground/actor';
import { buildLibrary } from '../../viewer/src/lib/playground/library';
import { cuesOn, effectSheetOf, floorY, frameOfFx, hasCues, liftAt, playCues, rowOfHeading, stepFx, type EffectSheet, type Fx, type FxWorld } from '../../viewer/src/lib/playground/vfx';
import type { AssetFileMeta } from '../../viewer/src/lib/types';

console.log('🧪 Checking effects in the playground (cues on events, stay / follow / fly, layers, what stops a projectile)...\n');

const DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
const facings = DIRS.map((_, d) => Math.PI / 2 + (d * 2 * Math.PI) / 8);

const asset = (folder: string, key: string): AssetFileMeta => ({ project: 'p', root: 'projects', subpath: `${folder}/${key}.png`, filename: `${key}.png`, format: 'png', size: 1, mtime: 1, url: `/${folder}/${key}.png`, width: 800, height: 800, atlas: `${folder}/${key}.json`, sheet: null, sourceMtime: null, engine: 'volume', atlasInfo: null });

/** An effect sheet: frames across, rows down, pivoted on its origin. */
function vfx(id: string, effect: Record<string, unknown>, rows = 1): { asset: AssetFileMeta; atlas: Atlas } {
  const frames = Number(effect.frames ?? 4);
  const names = rows === 8 ? DIRS : rows === 1 ? [] : Array.from({ length: rows }, (_, i) => `D${i}`);
  const atlas: Atlas = {
    meta: {
      mode: rows > 1 ? 'directions' : 'strip', frameCount: frames, ...(rows > 1 ? { directions: names, directionFacings: rows === 8 ? facings : names.map((_, i) => Math.PI / 2 + (i * 2 * Math.PI) / rows) } : {}),
      pivot: { x: 32, y: 32 }, frameWidth: 64, frameHeight: 64, fps: Number(effect.fps ?? 12), scale: 2,
      data: { role: 'vfx', effect: { id, kind: 'burst', frames, fps: 12, loop: false, height: 0, size: 20, directions: rows, ...effect } },
    },
    frames: {},
  };
  return { asset: asset('vfx', id), atlas };
}

const sheets = new Map<string, EffectSheet>();
const add = (id: string, effect: Record<string, unknown>, rows = 1) => {
  const made = vfx(id, effect, rows);
  const sheet = effectSheetOf(made.asset, made.atlas)!;
  sheets.set(sheet.id, sheet);
  return sheet;
};
const bolt = add('soul-bolt', { kind: 'projectile', frames: 4, loop: true, height: 12, size: 10, directions: 8, travel: { speed: 100, range: 120 }, follows: 'impact' }, 8);
const impact = add('impact', { kind: 'impact', frames: 5, fps: 10, events: [{ frame: 1, name: 'hit' }] });
const circle = add('cast-circle', { kind: 'cast', frames: 6, loop: false, size: 30 });
const aura = add('aura', { kind: 'aura', frames: 4, loop: true, size: 16 });
const trail = add('trail', { kind: 'trail', frames: 3, loop: true, height: 6, size: 8 });

// 1. A sheet says what the effect is; what it leaves out gets the kind's defaults.
assert.deepEqual([bolt.kind, bolt.loop, bolt.layer, bolt.rows, bolt.travel], ['projectile', true, 'air', 8, { speed: 100, range: 120 }]);
assert.equal(circle.layer, 'ground', 'a cast circle lies on the ground');
assert.equal(impact.rows, 1);
assert.deepEqual(impact.events, [{ frame: 1, name: 'hit' }]);
const bare = effectSheetOf(asset('vfx', 'spark'), { meta: { mode: 'strip', frameCount: 3, frameWidth: 40, frameHeight: 40, data: { role: 'vfx', effect: { id: 'spark', kind: 'area', frames: 3 } } }, frames: {} })!;
assert.deepEqual([bare.layer, bare.fps, bare.loop, bare.height, bare.pivot], ['ground', 12, false, 0, { x: 20, y: 20 }], 'an area is on the ground; the rest by default; the pivot is the middle of a frame without one');
assert.equal(effectSheetOf(asset('props', 'chest'), { meta: { data: { role: 'prop' } }, frames: {} }), null, 'only effect sheets are effects');
assert.equal(bolt.rects(0).length, 4, 'the frames of a row');
assert.equal(bolt.rects(3).length, 4);
// The row that faces a heading: eight rows by their facings, one row for a round effect.
assert.equal(rowOfHeading(bolt, Math.PI / 2), 0);
assert.equal(rowOfHeading(bolt, 0), 6, 'right is E');
assert.equal(rowOfHeading(bolt, -Math.PI / 2), 4, 'up is N');
assert.equal(rowOfHeading(impact, 1.2), 0);
// The frame it shows: a loop wraps, a one-shot holds its last.
assert.equal(frameOfFx({ sheet: bolt, age: 0.5 }), Math.floor(0.5 * 12) % 4);
assert.equal(frameOfFx({ sheet: impact, age: 100 }), 4);

// 2. A character cues effects on its clips' events (manifest `effects`).
const DIRS8 = DIRS;
const clipSheet = (key: string, action: string, events: { frame: number; name: string }[], extra: Record<string, unknown> = {}, sockets?: Record<string, number[][]>): Atlas => ({
  meta: {
    mode: 'directions', frameCount: 10, directions: DIRS8, directionFacings: facings, pivot: { x: 50, y: 90 }, frameWidth: 100, frameHeight: 100, fps: 10, scale: 2,
    data: { role: 'character', skeleton: 'humanoid', key, action, clipKind: action === 'idle' ? 'idle' : 'action', loop: action === 'idle', events, ...(sockets ? { sockets: { names: ['head', 'center', 'tip', 'hand'], frames: sockets } } : {}), ...extra },
  },
  frames: {},
});
const cues: Record<string, EffectCue[]> = {
  cast: [{ on: 'release', effect: 'soul-bolt', motion: 'fly' }, { on: 'start', effect: 'cast-circle', at: 'feet' }, { on: 'end', effect: 'impact', at: 'center' }],
  slash: [{ on: 'hit', effect: 'impact', at: 'tip' }],
  charge: [{ on: 'start', effect: 'aura', motion: 'follow', at: 'hand' }, { on: 'hit', effect: 'ghost' }],
  guard: [{ on: 'start', effect: 'trail', motion: 'stay' }],
};
const manifest: CharacterManifest = {
  name: 'mage', scale: 2, camera: { tilt: 30, heightBoost: 1.2 }, directions: DIRS8, sockets: ['head', 'center', 'tip', 'hand'], clips: [], effects: cues,
  controls: { idle: 'idle', move: [], actions: { skill: ['cast'], attack: ['slash'], interact: ['charge', 'guard'] } },
};
// Sockets by "<DIR>_<frame>": [x, y, depth] in logical px from the cell's top-left.
const sockets = { S_6: [[0, 0, 1], [10, 20, 1], [30, 40, 1], [5, 5, 1]], S_3: [[0, 0, 1], [10, 20, 1], [30, 40, 1], [5, 5, 1]], S_0: [[0, 0, 1], [10, 20, 1], [30, 40, 1], [5, 5, 1]], W_6: [[0, 0, 1], [11, 21, 1], [31, 41, 1], [5, 5, 1]], E_6: [[0, 0, 1], [11, 21, 1], [31, 41, 1], [5, 5, 1]] };
const specs: [string, string, { frame: number; name: string }[], Record<string, number[][]> | undefined][] = [
  ['idle', 'idle', [], undefined],
  ['cast', 'skill', [{ frame: 6, name: 'release' }, { frame: 6, name: 'spawn:tip' }], sockets],
  ['slash', 'attack', [{ frame: 3, name: 'hit' }], sockets],
  ['charge', 'interact', [{ frame: 3, name: 'hit' }], sockets],
  ['guard', 'interact', [], sockets],
];
const library = buildLibrary(specs.map(([key]) => asset('characters/mage', key)), new Map(specs.map(([key, action, events, s]) => [`characters/mage/${key}.png`, clipSheet(key, action, events, { character: manifest }, s)])));
const mage = library.characters[0];
assert.deepEqual(Object.keys(mage.effects).sort(), ['cast', 'charge', 'guard', 'slash'], 'the cues come from the manifest, by clip key');
assert.equal(mage.boost, 1.2);
assert.equal(hasCues(mage), true);
assert.equal(hasCues({ ...mage, effects: {} }), false, 'a character without cues keeps the generic rings');
assert.equal(hasCues(null), false);
assert.deepEqual(cuesOn(mage, 'cast', 'release').map((c) => c.effect), ['soul-bolt']);
assert.deepEqual(cuesOn(mage, 'cast', 'start').map((c) => c.effect), ['cast-circle']);
assert.deepEqual(cuesOn(mage, 'slash', 'release'), [], 'a cue plays on its own clip and event only');
assert.deepEqual(cuesOn(null, 'cast', 'release'), []);
// The effect sheets are in the library: the project's `vfx` role, and never a sprite to place.
const withEffects = buildLibrary([...specs.map(([key]) => asset('characters/mage', key)), asset('vfx', 'soul-bolt'), asset('icons', 'potion'), asset('ui', 'panel')], new Map([
  ...specs.map(([key, action, events, s]) => [`characters/mage/${key}.png`, clipSheet(key, action, events, { character: manifest }, s)] as const),
  ['vfx/soul-bolt.png', vfx('soul-bolt', { kind: 'projectile', frames: 4, loop: true }).atlas],
  ['icons/potion.png', { meta: { mode: 'strip', frameCount: 1, data: { role: 'icon', item: { id: 'potion' } } }, frames: {} } as Atlas],
  ['ui/panel.png', { meta: { mode: 'strip', frameCount: 1, data: { role: 'ui', kind: 'panel' } }, frames: {} } as Atlas],
]));
assert.deepEqual([...withEffects.effects.keys()], ['soul-bolt']);
assert.equal(withEffects.sprites.length, 0, 'effects, icons and interface pieces are not placed on the scene');

// 3. Playing the cues of an event: the actor starts a clip and its events reach `playCues`.
const actor = (): Actor => newActor(1, mage.idle!, 200, 300, mage);
const cast = mage.actions.find((c) => c.key === 'cast')!;
const slash = mage.actions.find((c) => c.key === 'slash')!;
const charge = mage.actions.find((c) => c.key === 'charge')!;
const played: { name: string; fx: Fx[]; missing: string[] }[] = [];
const emitFor = (who: Actor, into: Fx[] = []) => (e: ClipEvent) => {
  const r = playCues(e, who.character, sheets);
  into.push(...r.fx);
  played.push({ name: `${e.clip.key}:${e.name}`, fx: r.fx, missing: r.missing });
};

// `start` cues a ground circle at the feet; `release` a projectile that flies, leaving from the `spawn:` socket of its frame.
const caster = actor();
const live: Fx[] = [];
assert.ok(startClip(caster, cast, emitFor(caster, live)));
assert.deepEqual(live.map((f) => [f.sheet.id, f.motion, f.x, f.y]), [['cast-circle', 'stay', 200, 300]], 'at feet: the pivot on the floor');
for (let t = 0; t < 1.1; t += 0.01) advance(caster, 0.01, emitFor(caster, live));
const flying = live.find((f) => f.sheet.id === 'soul-bolt')!;
assert.ok(flying, 'release cues the projectile');
assert.equal(flying.motion, 'fly');
// The tip socket at frame 6 facing S: [30, 40] logical px × scale 2 from the cell's top-left, relative to the pivot (50, 90).
assert.deepEqual([flying.x, flying.y], [200 - 50 + 60, 300 - 90 + 80], 'it starts at the socket named by `spawn:tip`');
assert.equal(flying.row, 0, 'facing S, it shows the S row');
const speedPx = bolt.travel!.speed * bolt.scale;
assert.ok(Math.abs(flying.fly!.vx) < 1e-6 && Math.abs(flying.fly!.vy - speedPx * Math.sin((30 * Math.PI) / 180)) < 1e-6, `it flies at the sheet's speed, its depth shrunk by sin(tilt) of the character: vy = ${flying.fly!.vy}`);
assert.equal(flying.lift, 300 - flying.y, 'it floats above the floor by the height of the socket it left from (the actor stands at y 300), not by the effect\'s own height');
assert.equal(flying.lift, liftAt({ y: 300 }, flying));
assert.notEqual(flying.lift, bolt.height, 'the sheet\'s height only says where its floor marks go');
assert.equal(floorY(flying), 300, 'the floor under it is the actor\'s floor point: that is where it is sorted');
// `end` of the clip cues an impact at the centre.
assert.ok(live.some((f) => f.sheet.id === 'impact' && f.motion === 'stay'), 'end of the action');
// The same cue facing east flies east: the action's facing is the one it started with.
const east = actor();
east.row = 6;
const eastFx: Fx[] = [];
startClip(east, cast, emitFor(east, eastFx));
for (let t = 0; t < 0.7; t += 0.01) advance(east, 0.01, emitFor(east, eastFx));
const eastBolt = eastFx.find((f) => f.sheet.id === 'soul-bolt')!;
assert.equal(eastBolt.row, 6);
assert.ok(eastBolt.fly!.vx > 0 && Math.abs(eastBolt.fly!.vy) < 1e-6);
assert.ok(Math.abs(eastBolt.fly!.vx - speedPx) < 1e-6, 'across the screen the speed is the full speed');

// `stay` at a socket, once, at the frame of the event: the weapon's tip.
const striker = actor();
const struck: Fx[] = [];
startClip(striker, slash, emitFor(striker, struck));
for (let t = 0; t < 0.5; t += 0.01) advance(striker, 0.01, emitFor(striker, struck));
assert.deepEqual(struck.map((f) => [f.sheet.id, f.motion, f.x, f.y]), [['impact', 'stay', 200 - 50 + 60, 300 - 90 + 80]], 'hit: at the tip, where the blow lands');
// A cue whose effect is not in the project is reported, nothing is played for it (the scene then draws the generic one).
const charger = actor();
const missingFx: Fx[] = [];
played.length = 0;
startClip(charger, charge, emitFor(charger, missingFx));
for (let t = 0; t < 0.5; t += 0.01) advance(charger, 0.01, emitFor(charger, missingFx));
assert.deepEqual(played.filter((p) => p.missing.length).map((p) => [p.name, p.missing]), [['charge:hit', ['ghost']]]);

// 4. A one-shot ends after its last frame; a loop lasts as long as the action it was cued in.
let playing: Fx[] = [{ ...live.find((f) => f.sheet.id === 'cast-circle')!, age: 0 }];
const world: FxWorld = { sheets, bounds: { width: 1000, height: 1000 } };
for (let t = 0; t < 0.45; t += 0.05) playing = stepFx(playing, 0.05, world);
assert.equal(playing.length, 1, 'six frames at 12 fps last half a second');
for (let t = 0; t < 0.2; t += 0.05) playing = stepFx(playing, 0.05, world);
assert.equal(playing.length, 0);
// A looping aura follows the socket of the action, and ends with it.
const channeler = actor();
const auras: Fx[] = [];
startClip(channeler, charge, emitFor(channeler, auras));
const auraFx = auras.find((f) => f.sheet.id === 'aura')!;
assert.equal(auraFx.motion, 'follow');
assert.ok(auraFx.until, 'a loop knows the action it lives in');
let held = [auraFx];
channeler.x += 40;
held = stepFx(held, 0.05, world);
assert.equal(held.length, 1, 'still in the action');
assert.equal(held[0].x, 240 - 50 + 10, 'it follows the hand socket as the actor moves');
assert.equal(held[0].lift, channeler.y - held[0].y, 'and its height above the floor follows the socket too');
for (let t = 0; t < 1.2; t += 0.05) {
  advance(channeler, 0.05, emitFor(channeler, []));
  held = stepFx(held, 0.05, world);
}
assert.equal(channeler.act, null, 'the action is over');
assert.equal(held.length, 0, 'and so is the aura');
// `stay` loop cued in an action ends with it too.
const guard = mage.actions.find((c) => c.key === 'guard')!;
const guardian = actor();
const trails: Fx[] = [];
startClip(guardian, guard, emitFor(guardian, trails));
let kept = trails.filter((f) => f.sheet.id === 'trail');
assert.equal(kept.length, 1);
kept = stepFx(kept, 0.1, world);
assert.equal(kept.length, 1);
for (let t = 0; t < 1.2; t += 0.05) {
  advance(guardian, 0.05, emitFor(guardian, []));
  kept = stepFx(kept, 0.05, world);
}
assert.equal(kept.length, 0);

// 5. A projectile flies until its range runs out, then plays the effect it follows where it ended.
const fresh = (): Fx => ({ ...flying, x: 100, y: 100, age: 0, fly: { ...flying.fly!, flown: 0 }, done: false });
let shots = [fresh()];
let steps = 0;
while (shots.length === 1 && shots[0].sheet.id === 'soul-bolt' && steps < 400) {
  shots = stepFx(shots, 0.02, world);
  steps++;
}
assert.equal(shots.length, 1);
assert.equal(shots[0].sheet.id, 'impact', 'the impact plays where it ended');
assert.ok(Math.abs(steps * 0.02 * bolt.travel!.speed - bolt.travel!.range!) < bolt.travel!.speed * 0.02 + 1e-9, `it flew its range (${steps} steps)`);
assert.ok(Math.abs(shots[0].y - (100 + flying.fly!.vy * steps * 0.02)) < flying.fly!.vy * 0.02 + 1e-6, 'at the end of its path');
assert.equal(shots[0].motion, 'stay');
// A projectile with nothing to follow just ends.
const lone = add('lone-bolt', { kind: 'projectile', frames: 2, loop: true, travel: { speed: 200, range: 40 } }, 8);
const lonely: Fx = { ...fresh(), sheet: lone, fly: { vx: 0, vy: 200, flown: 0, speed: 200, range: 40 } };
let after = [lonely];
for (let i = 0; i < 20 && after.length; i++) after = stepFx(after, 0.05, world);
assert.equal(after.length, 0);
// It ends where the scene's floor stops it, and the impact plays at the last free point (the floor point, not the origin).
const stopAt = { x: 100, y: 150 };
let blocked = [fresh()];
const wall: FxWorld = { ...world, blocked: (from, to) => (to.y > 150 ? { x: stopAt.x, y: stopAt.y } : null) };
for (let i = 0; i < 100 && blocked[0]?.sheet.id === 'soul-bolt'; i++) blocked = stepFx(blocked, 0.05, wall);
assert.equal(blocked[0].sheet.id, 'impact', 'a wall ends the flight and plays the impact');
assert.equal(blocked[0].x, 100);
assert.ok(Math.abs(blocked[0].y - (150 - flying.lift)) < 1e-9, 'the origin is above the floor point it stopped at');
// A projectile that leaves the view ends at its edge.
const edge: FxWorld = { ...world, bounds: { width: 1000, height: 140 } };
let out = [fresh()];
for (let i = 0; i < 100 && out[0]?.sheet.id === 'soul-bolt'; i++) out = stepFx(out, 0.05, edge);
assert.equal(out[0].sheet.id, 'impact');
assert.ok(out[0].y + out[0].lift <= 140 + 1e-6, 'inside the view');

console.log('✅ effect checks passed');
