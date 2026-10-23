import assert from 'node:assert/strict';
import { liftAt, rowOfHeading, toScreen, type CharacterManifest, type EffectCue } from '@diorama/runtime';
import { advance, newActor, startClip, type Actor, type ClipEvent } from '../../viewer/src/lib/playground/actor';
import { buildLibrary } from '../../viewer/src/lib/playground/library';
import { effectSheetOf, floorY, playCues, stepFx, type EffectSheet, type Fx, type FxWorld } from '../../viewer/src/lib/playground/vfx';
import type { AssetFileMeta } from '../../viewer/src/lib/types';
import { viewOfFx } from '../../viewer/src/lib/playground/view';
import { DIRS, clipSheet as sheetOf, effectAtlas } from '../runtime/helpers';

console.log('🧪 Checking effects in the playground\'s view (the runtime\'s cues in actor units: sockets, flight shrunk by the tilt, lift, the view\'s edge, the floor)...\n');

// The rules of cues, follow, loops and projectiles are the runtime's (tests/runtime/effects.test.ts): this checks the view.

const asset = (folder: string, key: string): AssetFileMeta => ({ project: 'p', root: 'projects', subpath: `${folder}/${key}.png`, filename: `${key}.png`, format: 'png', size: 1, mtime: 1, url: `/${folder}/${key}.png`, width: 800, height: 800, atlas: `${folder}/${key}.json`, sheet: null, sourceMtime: null, engine: 'volume', atlasInfo: null });

const sheets = new Map<string, EffectSheet>();
for (const [id, effect, rows] of [
  ['soul-bolt', { kind: 'projectile', frames: 4, loop: true, height: 12, size: 10, directions: 8, travel: { speed: 100, range: 120 }, follows: 'impact' }, 8],
  ['impact', { kind: 'impact', frames: 5, events: [{ frame: 1, name: 'hit' }] }, 1],
  ['aura', { kind: 'aura', frames: 4, loop: true, size: 16 }, 1],
] as const) {
  const sheet = effectSheetOf(asset('vfx', id), effectAtlas(id, effect, rows))!;
  sheets.set(sheet.id, sheet);
}
assert.equal(sheets.get('soul-bolt')!.asset.url, '/vfx/soul-bolt.png', 'a sheet keeps the asset its image loads from');

const sockets = { S_6: [[0, 0, 1], [10, 20, 1], [30, 40, 1], [5, 5, 1]], S_0: [[0, 0, 1], [10, 20, 1], [30, 40, 1], [5, 5, 1]] };
const clipSheet = (key: string, action: string, events: { frame: number; name: string }[], manifest: CharacterManifest) =>
  sheetOf({ key, action, clipKind: action === 'idle' ? 'idle' : 'action', frames: 10, events, sockets: { names: ['head', 'center', 'tip', 'hand'], frames: sockets as never } }, manifest);
const cues: Record<string, EffectCue[]> = {
  cast: [{ on: 'release', effect: 'soul-bolt', motion: 'fly' }, { on: 'hit', effect: 'ghost' }],
  charge: [{ on: 'start', effect: 'aura', motion: 'follow', at: 'hand' }],
};
const manifest: CharacterManifest = { name: 'mage', scale: 2, camera: { tilt: 30, heightBoost: 1.2 }, directions: DIRS, sockets: [], clips: [], effects: cues, controls: { idle: 'idle', move: [], actions: { skill: ['cast'], interact: ['charge'] } } };
const specs: [string, string, { frame: number; name: string }[]][] = [['idle', 'idle', []], ['cast', 'skill', [{ frame: 6, name: 'release' }, { frame: 6, name: 'spawn:tip' }, { frame: 7, name: 'hit' }]], ['charge', 'interact', []]];
const library = buildLibrary(specs.map(([key]) => asset('characters/mage', key)), new Map(specs.map(([key, action, events]) => [`characters/mage/${key}.png`, clipSheet(key, action, events, manifest)])));
const mage = library.characters[0];
const clip = (key: string) => mage.clips.find((c) => c.key === key)!;

const played: { name: string; missing: string[] }[] = [];
const emitFor = (into: Fx[]) => (e: ClipEvent) => {
  const r = playCues(e, e.actor.character, sheets);
  into.push(...r.fx);
  played.push({ name: `${e.clip.key}:${e.name}`, missing: r.missing });
};
const actor = (): Actor => newActor(1, mage.idle!, 200, 300, mage);

// The projectile leaves the tip socket: [30, 40] logical px × scale 2 from the cell's top-left, relative to the pivot (50, 90).
const caster = actor();
const live: Fx[] = [];
startClip(caster, clip('cast'), emitFor(live));
for (let t = 0; t < 0.75; t += 0.01) advance(caster, 0.01, emitFor(live));
const flying = live.find((f) => f.sheet.id === 'soul-bolt')!;
assert.deepEqual([flying.x, flying.y], [200 - 50 + 60, 300 - 90 + 80], 'at the socket, in actor units');
assert.equal(flying.lift, 300 - flying.y, 'its height above the floor: down to the actor\'s feet');
assert.equal(flying.lift, liftAt({ y: 300 }, flying));
assert.equal(floorY(flying), 300, 'the floor under it is the actor\'s floor point: that is where it is sorted');
const speedPx = 100 * 2;
assert.ok(Math.abs(flying.fly!.vx) < 1e-6 && Math.abs(flying.fly!.vy - speedPx * Math.sin((30 * Math.PI) / 180)) < 1e-6, `on the screen its depth shrinks by sin(tilt) of the character: vy = ${flying.fly!.vy}`);
assert.equal(flying.fx.lift * 2, flying.lift, 'the runtime keeps it on the floor, at the same height');
assert.deepEqual(played.filter((p) => p.missing.length).map((p) => [p.name, p.missing]), [['cast:hit', ['ghost']]], 'a cue whose sheet is not in the project is reported');

// A following effect tracks its socket as the actor is moved in the view.
const channeler = actor();
const auras: Fx[] = [];
startClip(channeler, clip('charge'), emitFor(auras));
channeler.x += 40;
const held = stepFx(auras, 0.05, { sheets, bounds: { width: 1000, height: 1000 } });
assert.equal(held[0].x, 240 - 50 + 10, 'it follows the hand socket');
assert.equal(held[0].lift, channeler.y - held[0].y, 'and its height above the floor follows the socket too');
assert.equal(held[0], stepFx(held, 0.01, { sheets, bounds: { width: 1000, height: 1000 } })[0], 'one view object per effect');

// A projectile moved in the view keeps its height (the scene moving under it), and ends at the view's edge, inside it.
const shot = (): Fx => {
  const fx: Fx[] = [];
  const shooter = actor();
  startClip(shooter, clip('cast'), emitFor(fx));
  for (let t = 0; t < 0.75; t += 0.01) advance(shooter, 0.01, emitFor(fx));
  return fx.find((f) => f.sheet.id === 'soul-bolt')!;
};
const moved = shot();
moved.x = 100;
moved.y = 100;
assert.deepEqual([moved.x, moved.y, floorY(moved)], [100, 100, 100 + flying.lift]);
const edge: FxWorld = { sheets, bounds: { width: 1000, height: 140 } };
let out = [moved];
for (let i = 0; i < 100 && out[0]?.sheet.id === 'soul-bolt'; i++) out = stepFx(out, 0.05, edge);
assert.equal(out[0].sheet.id, 'impact');
assert.equal(floorY(out[0]), 140, 'its floor point on the view\'s bottom edge, exactly');
// The scene's floor stops it (actor units in and out): the impact plays at the last free floor point, at the same height.
const walled = shot();
walled.y = 100;
const wall: FxWorld = { sheets, bounds: { width: 1000, height: 1000 }, blocked: (from, to) => (to.y > 150 ? { x: to.x, y: 150 } : null) };
let stopped = [walled];
for (let i = 0; i < 100 && stopped[0]?.sheet.id === 'soul-bolt'; i++) stopped = stepFx(stopped, 0.05, wall);
assert.equal(stopped[0].sheet.id, 'impact');
assert.ok(Math.abs(stopped[0].y - (150 - flying.lift)) < 1e-9 && Math.abs(stopped[0].x - walled.x) < 1e-9, 'the origin is above the floor point it stopped at');

// An effect on its actor's floor point sorts at the actor's very y (the stable sort then draws the actor first and the
// effect over it): here at half pixels, through the sample's 48° camera, where a round trip through the floor would come
// back an ulp off. A following effect keeps that tie as the actor is moved.
const tilted = buildLibrary(specs.map(([key]) => asset('characters/mage', key)), new Map(specs.map(([key, action, events]) => [`characters/mage/${key}.png`, clipSheet(key, action, events, { ...manifest, camera: { tilt: 48, heightBoost: 1.2 } })]))).characters[0];
const tiltedClip = (key: string) => tilted.clips.find((c) => c.key === key)!;
const halfway = newActor(3, tilted.idle!, 300.5, 192.5, tilted);
const tied: Fx[] = [];
startClip(halfway, tiltedClip('cast'), emitFor(tied));
for (let t = 0; t < 0.75; t += 0.01) advance(halfway, 0.01, emitFor(tied));
const tiedBolt = tied.find((f) => f.sheet.id === 'soul-bolt')!;
assert.equal(floorY(tiedBolt), halfway.y, 'the projectile leaves at its caster\'s depth, exactly');
assert.equal(tiedBolt.y + tiedBolt.lift, 192.5, 'and at the socket above the feet');
const hand: Fx[] = [];
const holder = newActor(4, tilted.idle!, 300.5, 192.5, tilted);
startClip(holder, tiltedClip('charge'), emitFor(hand));
assert.equal(floorY(hand[0]), holder.y);
holder.y = 377.5;
const followed = stepFx(hand, 0.05, { sheets, bounds: { width: 1000, height: 1000 } });
assert.equal(floorY(followed[0]), 377.5, 'the aura follows to the actor\'s new depth, exactly');

// The view sorts an effect where it draws it, at y + lift, as the playground always did: its origin on the socket as the
// view draws the frame (the actor less the pivot, plus the socket × scale), its lift down to the feet. Near the top of the
// view that sum can come back an ulp off the actor's y, and the draw order follows it, as it did before the runtime.
const high = newActor(5, tilted.idle!, 300.5, 24.439429389051828, tilted);
const top: Fx[] = [];
startClip(high, tiltedClip('charge'), emitFor(top));
assert.deepEqual([top[0].y, top[0].lift], [high.y - 90 + 5 * 2, high.y - (high.y - 90 + 5 * 2)], 'on the hand socket as the frame is drawn');
assert.equal(floorY(top[0]), top[0].y + top[0].lift);
assert.ok(floorY(top[0]) < high.y, `an ulp above the feet (${floorY(top[0])} < ${high.y}): the stable sort draws the aura behind its actor, as before`);
const stillTop = stepFx(top, 0.05, { sheets, bounds: { width: 1000, height: 1000 } });
assert.equal(floorY(stillTop[0]), floorY(top[0]), 'and keeps it while it follows the hand');

// The view draws an effect sheet at its own export scale, so a projectile exported at scale 1 for a character at scale 2
// crosses the view at 100 × 1 px a second (its depth part shrunk by the tilt), and ends after the same time, at its range.
const lowRes = effectAtlas('soul-bolt', { kind: 'projectile', frames: 4, loop: true, height: 12, size: 10, directions: 8, travel: { speed: 100, range: 120 }, follows: 'impact' }, 8);
lowRes.meta.scale = 1;
const ownScale = new Map(sheets).set('soul-bolt', effectSheetOf(asset('vfx', 'soul-bolt'), lowRes)!);
const slowShots: Fx[] = [];
const slowCaster = actor();
startClip(slowCaster, clip('cast'), (e) => slowShots.push(...playCues(e, e.actor.character, ownScale).fx));
for (let t = 0; t < 0.75; t += 0.01) advance(slowCaster, 0.01, (e) => slowShots.push(...playCues(e, e.actor.character, ownScale).fx));
const slow = slowShots.find((f) => f.sheet.id === 'soul-bolt')!;
assert.ok(Math.abs(slow.fly!.vy - 100 * 1 * Math.sin((30 * Math.PI) / 180)) < 1e-9 && Math.abs(slow.fly!.vx) < 1e-9, `at its own sheet's scale: vy = ${slow.fly!.vy}`);
let slowFlight = [slow];
let slowSteps = 0;
for (; slowSteps < 200 && slowFlight[0]?.sheet.id === 'soul-bolt'; slowSteps++) slowFlight = stepFx(slowFlight, 0.01, { sheets: ownScale, bounds: { width: 5000, height: 5000 } });
assert.ok(Math.abs(slowSteps * 0.01 - 1.2) < 0.011, `it flies for range / speed seconds (${slowSteps} steps)`);

// A projectile's impact faces the way the projectile crossed the view, read from its velocity in actor units with the
// depth part grown back by the tilt, as the playground always read it. A shot exactly between two of the impact's rows
// (NE, onto an impact with four rows: S, W, N, E) shows E, as it did before the runtime; the floor velocity's own last bit
// would show N.
const fourWay = new Map(sheets)
  .set('soul-bolt', effectSheetOf(asset('vfx', 'soul-bolt'), effectAtlas('soul-bolt', { kind: 'projectile', frames: 4, loop: true, directions: 8, travel: { speed: 260, range: 120 }, follows: 'splash' }, 8))!)
  .set('splash', effectSheetOf(asset('vfx', 'splash'), effectAtlas('splash', { kind: 'impact', frames: 5 }, 4))!);
const aimed: Fx[] = [];
const aimedEmit = (e: ClipEvent) => aimed.push(...playCues(e, e.actor.character, fourWay).fx);
const northEast = newActor(6, tilted.idle!, 300, 400, tilted, DIRS.indexOf('NE'));
startClip(northEast, tiltedClip('cast'), aimedEmit);
for (let t = 0; t < 0.75; t += 0.01) advance(northEast, 0.01, aimedEmit);
let crossing = aimed.filter((f) => f.sheet.id === 'soul-bolt');
const crossingVelocity = crossing[0].fly!;
for (let i = 0; i < 100 && crossing[0]?.sheet.id === 'soul-bolt'; i++) crossing = stepFx(crossing, 0.01, { sheets: fourWay, bounds: { width: 5000, height: 5000 } });
assert.equal(crossing[0].sheet.id, 'splash');
assert.equal(crossing[0].row, rowOfHeading(fourWay.get('splash')!, Math.atan2(crossingVelocity.vy / Math.sin((48 * Math.PI) / 180), crossingVelocity.vx)), 'the heading it crossed the view with');
assert.equal(crossing[0].row, 3, 'E, the row it always showed');
// Through a 30° camera the tilt decides the row: a NE shot onto an impact with sixteen rows shows the row of its heading
// with the depth grown back, not the one its shrunk velocity on the screen points at (at 48° the two agree).
const sixteenWay = new Map(fourWay).set('splash', effectSheetOf(asset('vfx', 'splash'), effectAtlas('splash', { kind: 'impact', frames: 5 }, 16))!);
const steep: Fx[] = [];
const steepEmit = (e: ClipEvent) => steep.push(...playCues(e, e.actor.character, sixteenWay).fx);
const steepShooter = newActor(9, mage.idle!, 300, 400, mage, DIRS.indexOf('NE'));
startClip(steepShooter, clip('cast'), steepEmit);
for (let t = 0; t < 0.75; t += 0.01) advance(steepShooter, 0.01, steepEmit);
let steepFlight = steep.filter((f) => f.sheet.id === 'soul-bolt');
const steepVelocity = steepFlight[0].fly!;
for (let i = 0; i < 100 && steepFlight[0]?.sheet.id === 'soul-bolt'; i++) steepFlight = stepFx(steepFlight, 0.01, { sheets: sixteenWay, bounds: { width: 5000, height: 5000 } });
const splash16 = sixteenWay.get('splash')!;
assert.equal(steepFlight[0].sheet.id, 'splash');
assert.equal(steepFlight[0].row, rowOfHeading(splash16, Math.atan2(steepVelocity.vy / Math.sin((30 * Math.PI) / 180), steepVelocity.vx)), 'the heading with the depth grown back by the tilt');
assert.notEqual(steepFlight[0].row, rowOfHeading(splash16, Math.atan2(steepVelocity.vy, steepVelocity.vx)), 'not the shrunk heading on the screen: here the two differ');

// The view places effects with its own pixel arithmetic, kept from before the runtime so the Playground's frames do not
// change, while the runtime keeps each effect's floor point and lift (what a game draws from). The two must agree: through
// both cameras, at whole, half and quarter pixels, and with effect sheets at the character's scale or at their own (a bolt
// at 1 and its impact at 3 under a character at 2), every effect a cast and a channel play (the bolt in flight, its impact
// at the range, the aura following the hand) projects from the runtime's floor point to where the view draws it.
const bigImpact = effectAtlas('impact', { kind: 'impact', frames: 5, events: [{ frame: 1, name: 'hit' }] }, 1);
bigImpact.meta.scale = 3;
const mixedScales = new Map(sheets).set('soul-bolt', effectSheetOf(asset('vfx', 'soul-bolt'), lowRes)!).set('impact', effectSheetOf(asset('vfx', 'impact'), bigImpact)!);
const seen = new Set<string>();
let compared = 0;
for (const effectSheets of [sheets, mixedScales]) for (const who of [mage, tilted]) {
  const pick = (key: string) => who.clips.find((c) => c.key === key)!;
  for (const [x, y] of [[200, 300], [300.5, 192.5], [611.25, 47.75]]) {
    const fresh: Fx[] = [];
    const emit = (e: ClipEvent) => fresh.push(...playCues(e, e.actor.character, effectSheets).fx);
    const caster = newActor(7, who.idle!, x, y, who);
    const channel = newActor(8, who.idle!, x + 80, y, who);
    startClip(caster, pick('cast'), emit);
    startClip(channel, pick('charge'), emit);
    let effects: Fx[] = [];
    for (let step = 0; step < 250; step++) {
      advance(caster, 0.01, emit);
      advance(channel, 0.01, emit);
      effects = stepFx([...effects, ...fresh.splice(0)], 0.01, { sheets: effectSheets, bounds: { width: 2000, height: 2000 } });
      for (const f of effects) {
        const view = viewOfFx(f.fx);
        const origin = toScreen(view, f.fx.pos, f.fx.lift);
        const floor = toScreen(view, f.fx.pos);
        assert.ok(Math.abs(origin.x - f.x) < 1e-6 && Math.abs(origin.y - f.y) < 1e-6, `${f.sheet.id} (scale ${f.sheet.scale}) at (${x}, ${y}), step ${step}: the runtime puts it at (${origin.x}, ${origin.y}), the view draws it at (${f.x}, ${f.y})`);
        assert.ok(Math.abs(floor.y - floorY(f)) < 1e-6, `${f.sheet.id} at (${x}, ${y}), step ${step}: sorted on the runtime's floor point`);
        seen.add(f.sheet.id);
        compared++;
      }
    }
  }
}
assert.deepEqual([...seen].sort(), ['aura', 'impact', 'soul-bolt'], 'a projectile, its impact and a following effect were compared');
assert.ok(compared > 1000, `${compared} effect positions compared`);

console.log('✅ effects in the view checks passed');
