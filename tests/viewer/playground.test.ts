import assert from 'node:assert/strict';
import { buildRows, listEntries, matches, pushRecent, RECENT_LIMIT, type Entry } from '../../viewer/src/lib/playground/catalog';
import type { Atlas, AtlasSockets, CharacterManifest } from '../../viewer/src/lib/atlas';
import { advance, canStart, newActor, reset, rowFor, startClip, stepPlayer, type ClipEvent } from '../../viewer/src/lib/playground/actor';
import { socketPoint, spawnFromEvent, stepEffects, type Effect } from '../../viewer/src/lib/playground/effects';
import { buildLibrary } from '../../viewer/src/lib/playground/library';
import type { AssetFileMeta } from '../../viewer/src/lib/types';

console.log('🧪 Checking the playground (palette search, folders, recents; atlas contract: controls, priority, cancel, hold, events, sockets, travel)...\n');

const entry = (key: string, name: string, group: string, kind: Entry['kind'] = 'animated') =>
  ({ key, name, group, kind, subtitle: '', cover: {}, armed: {} }) as unknown as Entry;

const entries = [
  entry('c:guard', 'guard', 'characters', 'character'),
  entry('c:wolf', 'wolf', 'characters', 'character'),
  entry('s:tomb', 'tombstone', 'props', 'still'),
  entry('s:chest', 'reliquary', 'props', 'still'),
  entry('s:fire', 'torch10', 'fx'),
  entry('s:fire2', 'torch2', 'fx'),
];

// Every word must match "group/name", in any order, ignoring case.
assert.ok(matches(entries[0], 'GUA'));
assert.ok(matches(entries[0], 'characters guard'));
assert.ok(!matches(entries[0], 'guard props'));
assert.ok(matches(entries[0], ''));

const base = { query: '', filter: 'all' as const, collapsed: new Set<string>(), recent: [] as string[] };
const labels = (rows: ReturnType<typeof buildRows>) => rows.map((r) => (r.type === 'header' ? `# ${r.label} ${r.count}` : r.entry.name));

// One header per folder, folders and names sorted naturally (torch2 before torch10).
assert.deepEqual(labels(buildRows(entries, base)), ['# characters 2', 'guard', 'wolf', '# fx 2', 'torch2', 'torch10', '# props 2', 'reliquary', 'tombstone']);

// Kind filter.
assert.deepEqual(labels(buildRows(entries, { ...base, filter: 'character' })), ['# characters 2', 'guard', 'wolf']);
assert.deepEqual(labels(buildRows(entries, { ...base, filter: 'object' })).filter((l) => !l.startsWith('#')), ['torch2', 'torch10', 'reliquary', 'tombstone']);

// A collapsed folder keeps its header and count but hides its entries, until a search opens every folder.
const collapsed = new Set(['fx']);
assert.deepEqual(labels(buildRows(entries, { ...base, collapsed })), ['# characters 2', 'guard', 'wolf', '# fx 2', '# props 2', 'reliquary', 'tombstone']);
assert.deepEqual(labels(buildRows(entries, { ...base, collapsed, query: 'torch' })), ['# fx 2', 'torch2', 'torch10']);

// Recents come first, only when not searching, and skip entries a filter hides.
assert.deepEqual(labels(buildRows(entries, { ...base, recent: ['s:tomb', 'c:wolf', 'gone'] })).slice(0, 3), ['# Recentes 2', 'tombstone', 'wolf']);
assert.ok(!labels(buildRows(entries, { ...base, recent: ['s:tomb'], query: 'wolf' })).includes('# Recentes 1'));
assert.ok(!labels(buildRows(entries, { ...base, recent: ['s:tomb'], filter: 'character' })).some((l) => l.startsWith('# Recentes')));

// Recents: newest first, no repeats, bounded.
assert.deepEqual(pushRecent(['b', 'a', 'c'], 'a'), ['a', 'b', 'c']);
assert.equal(pushRecent(Array.from({ length: 20 }, (_, i) => `k${i}`), 'new').length, RECENT_LIMIT);

// ---- The atlas contract (docs/guides/rig/04-atlas-contract.md): library, controls and playing rules ----

const DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
const facings = DIRS.map((_, d) => Math.PI / 2 + (d * 2 * Math.PI) / 8);

function asset(folder: string, key: string): AssetFileMeta {
  return { project: 'p', root: 'projects', subpath: `${folder}/${key}.png`, filename: `${key}.png`, format: 'png', size: 1, mtime: 1, url: `/${folder}/${key}.png`, width: 800, height: 800, atlas: `${folder}/${key}.json`, sheet: null, sourceMtime: null, engine: 'volume', atlasInfo: null };
}

interface ClipSpec {
  key: string;
  action: string;
  clipKind: 'idle' | 'locomotion' | 'action';
  frames: number;
  fps?: number;
  loop?: boolean;
  hold?: boolean;
  groundSpeed?: number;
  events?: Array<{ frame: number; name: string }>;
  tags?: string[];
  /** Cell width in exported px; the anchor sits in the middle of it. */
  frameWidth?: number;
  travel?: number[];
  sockets?: AtlasSockets;
}

function sheet(spec: ClipSpec, manifest?: CharacterManifest): Atlas {
  return {
    meta: {
      mode: 'directions', frameCount: spec.frames, directions: DIRS, directionFacings: facings, pivot: { x: (spec.frameWidth ?? 100) / 2, y: 90 },
      frameWidth: spec.frameWidth ?? 100, frameHeight: 100, fps: spec.fps ?? 10, scale: 2,
      data: {
        role: 'character', skeleton: 'humanoid', key: spec.key, action: spec.action, clipKind: spec.clipKind, loop: spec.loop ?? spec.clipKind !== 'action',
        hold: spec.hold ?? false, tags: spec.tags, groundSpeed: spec.groundSpeed ?? 0, events: spec.events ?? [], travel: spec.travel, sockets: spec.sockets,
        ...(manifest ? { character: manifest } : {}),
      },
    },
    frames: {},
  };
}

const specs: ClipSpec[] = [
  { key: 'idle', action: 'idle', clipKind: 'idle', frames: 4 },
  { key: 'walk', action: 'walk', clipKind: 'locomotion', frames: 8, groundSpeed: 40 },
  { key: 'run', action: 'run', clipKind: 'locomotion', frames: 8, groundSpeed: 80 },
  { key: 'slash', action: 'attack', clipKind: 'action', frames: 10, events: [{ frame: 3, name: 'hit' }, { frame: 5, name: 'cancel' }], travel: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20] },
  { key: 'howl', action: 'skill', clipKind: 'action', frames: 10, events: [{ frame: 2, name: 'cast' }, { frame: 6, name: 'release' }, { frame: 6, name: 'spawn:mouth' }], sockets: { names: ['head', 'center', 'mouth'], frames: { S_6: [[0, 0, 1], [0, 0, 1], [10, 20, 1]] } } },
  { key: 'dodge', action: 'dodge', clipKind: 'action', frames: 6 },
  { key: 'hit', action: 'hit', clipKind: 'action', frames: 4 },
  { key: 'death', action: 'death', clipKind: 'action', frames: 6, hold: true },
];
const manifest: CharacterManifest = {
  name: 'mage', skeleton: 'humanoid', scale: 2, camera: { tilt: 30, heightBoost: 1.2 }, directions: DIRS, sockets: ['head', 'center', 'mouth'],
  clips: [], warnings: ['arm length differs between skins'],
  controls: { idle: 'idle', move: ['walk', 'run'], actions: { skill: ['howl'], hit: ['hit'], attack: ['slash'], death: ['death'], dodge: ['dodge'] } },
};

const assets = specs.map((c) => asset('characters/mage', c.key));
const withManifest = new Map(specs.map((c) => [`characters/mage/${c.key}.png`, sheet(c, manifest)]));
const library = buildLibrary(assets, withManifest);
assert.equal(library.characters.length, 1);
const mage = library.characters[0];
assert.equal(mage.name, 'mage');
assert.equal(mage.idle?.key, 'idle');
assert.deepEqual(mage.locomotion.map((c) => c.key), ['walk', 'run']);
// Numbered actions: attack first, then skill, then the rest, whatever order the manifest lists them in. Hit and death keep their own keys.
assert.deepEqual(mage.actions.map((c) => c.key), ['slash', 'howl', 'dodge']);
assert.equal(mage.hit?.key, 'hit');
assert.equal(mage.death?.key, 'death');
assert.deepEqual(mage.warnings, ['arm length differs between skins']);
assert.equal(mage.locomotion[1].speed, 160, 'groundSpeed is in logical px: multiply by scale');
assert.equal(mage.actions[0].cancelFrame, 5);
assert.deepEqual(mage.actions[0].travel?.slice(0, 3), [0, 4, 8], 'travel is scaled to exported px');

// A clip the manifest marks unusable (made for what the character does not hold) is not played, even when its sheet exists.
const holding: CharacterManifest = { ...manifest, clips: [{ key: 'slash', usable: false, wields: { main: ['blade'] } } as unknown as CharacterManifest['clips'][number]], controls: { ...manifest.controls, actions: { ...manifest.controls.actions, attack: [] } } };
const holder = buildLibrary(assets, new Map(specs.map((c) => [`characters/mage/${c.key}.png`, sheet(c, holding)]))).characters[0];
assert.ok(!holder.clips.some((c) => c.key === 'slash'), 'not among its clips');
assert.deepEqual(holder.actions.map((c) => c.key), ['howl', 'dodge'], 'nor among its actions');
assert.equal(holder.clips.length, specs.length - 1, 'the rest are untouched');
// Older atlases (no manifest, no action): classify from clipKind / groundSpeed / loop, never from names.
const old = new Map(specs.slice(0, 4).map((c) => [`characters/mage/${c.key}.png`, (() => { const a = sheet(c); delete a.meta.data!.action; delete a.meta.data!.key; return a; })()]));
const legacy = buildLibrary(assets.slice(0, 4), old).characters[0];
assert.equal(legacy.idle?.key, 'idle');
assert.deepEqual(legacy.locomotion.map((c) => c.key), ['walk', 'run']);
assert.deepEqual(legacy.actions.map((c) => c.key), ['slash']);
assert.equal(legacy.hit, null);
assert.equal(mage.tilt, 30, 'the camera tilt comes from the manifest');
assert.equal(legacy.tilt, 48, 'without a manifest the tilt is 48');
// A gear item names its wearer as text (`character: 'guard'`): it is an object to place, not a character, and not a crash.
const gearAtlas = (() => { const a = sheet({ key: 'helm', action: 'idle', clipKind: 'idle', frames: 1 }); a.meta.data = { role: 'gear', part: 'helm', label: 'Elmo', group: 'head', character: 'guard' }; return a; })();
const withGear = buildLibrary([...assets, asset('gear', 'helm')], new Map([...withManifest, ['gear/helm.png', gearAtlas]]));
assert.deepEqual(withGear.characters.map((c) => c.name), ['mage'], 'the item does not join a character');
assert.deepEqual(withGear.sprites.map((s) => s.id), ['gear/helm.png'], 'it is a sprite');
assert.equal(listEntries(withGear).find((e) => e.key === 'sprite:gear/helm.png')?.name, 'Elmo', 'named by its label');
const props = buildLibrary([asset('props', 'chest')], new Map([['props/chest.png', (() => { const a = sheet(specs[0]); a.meta.data = { role: 'prop' }; return a; })()]]));
assert.equal(props.characters.length, 0, 'a prop is not a character');
assert.equal(props.sprites.length, 1);

// Facing: the row nearest to the heading (screen angles: x right, y down; S looks at the camera).
const atlasS = sheet(specs[0]);
assert.equal(rowFor(atlasS, Math.PI / 2), 0, 'down is S');
assert.equal(rowFor(atlasS, Math.PI), 2, 'left is W');
assert.equal(rowFor(atlasS, 0), 6, 'right is E');
assert.equal(rowFor(atlasS, -Math.PI / 2), 4, 'up is N');

// Playing rules.
const events: string[] = [];
// `start` and `end` are the beginning and the end of an action, not events of its sheet: effects are cued on them (tested with the effects below).
const emit = (e: ClipEvent) => e.name !== 'start' && e.name !== 'end' && events.push(`${e.clip.key}:${e.frame}:${e.name}`);
const tick = (actor: ReturnType<typeof newActor>, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.01) advance(actor, 0.01, emit);
};
const spawn = () => newActor(1, mage.idle!, 100, 200, mage);
const slash = mage.actions[0];
const howl = mage.actions[1];

// 3. priority + 4. interruption: an action is replaced from its cancel event on, hit and death interrupt anything.
let a = spawn();
assert.ok(startClip(a, slash, emit));
assert.ok(!canStart(a, howl), 'an action cannot be replaced before its cancel event');
tick(a, 0.55); // frame 5 at 10 fps
assert.ok(canStart(a, howl), 'from the cancel event on it can');
assert.ok(canStart(a, mage.hit!), 'hit interrupts');
assert.ok(startClip(a, mage.hit!, emit));
assert.ok(!canStart(a, slash), 'an attack never interrupts a hit');
assert.ok(canStart(a, mage.death!), 'death interrupts a hit');
assert.ok(startClip(a, mage.death!, emit));
assert.ok(!canStart(a, mage.hit!), 'nothing follows death');

// 5. a hold clip freezes on its last frame until reset.
tick(a, 1);
assert.ok(a.held && a.act === null, 'death ends held');
assert.ok(!canStart(a, slash));
reset(a);
assert.ok(a.held === null && canStart(a, slash), 'reset brings it back');

// 5. a normal action returns to idle.
a = spawn();
startClip(a, mage.actions[2], emit); // dodge, no cancel
tick(a, 1);
assert.equal(a.act, null);

// 6. events, in frame order, once each; `release` comes with the `spawn:<socket>` of its frame.
events.length = 0;
a = spawn();
startClip(a, slash, emit);
tick(a, 1.1);
assert.deepEqual(events, ['slash:3:hit', 'slash:5:cancel']);
events.length = 0;
a = spawn();
const effects: Effect[] = [];
const collect = (e: ClipEvent) => spawnFromEvent(e, effects);
startClip(a, howl, collect);
for (let t = 0; t < 1.1; t += 0.01) advance(a, 0.01, collect);
const projectile = effects.find((e) => e.type === 'projectile');
assert.ok(projectile && projectile.type === 'projectile');
// 8. socket = cell origin + [x, y] × scale: (100 - 50 + 10×2, 200 - 90 + 20×2)
assert.deepEqual([Math.round(projectile!.x), Math.round(projectile!.y)], [70, 150]);
assert.equal(projectile!.behind, false, 'd > 0 is drawn in front of the body');
assert.deepEqual(socketPoint(a, howl, 0, 6, 'mouth'), { x: 70, y: 150, depth: 1 });
// The shot ends where its range runs out (150 logical px = 300 exported px at scale 2, facing S) and a ring marks the spot.
const shot: Effect[] = [{ ...projectile! }];
let flying = shot;
for (let t = 0; t < 1.3; t += 0.01) flying = stepEffects(flying, 0.01);
assert.ok(flying.every((e) => e.type === 'ring') && flying.length === 1, 'the projectile is replaced by a ring when its range ends');
assert.ok(Math.abs(flying[0].y - (projectile!.y + 300)) < 8, 'it flew 300 px along its facing');
// Leaving the scene ends it early, with the ring inside the edge.
const edge = stepEffects([{ ...projectile! }], 0.5, { width: 500, height: 200 });
assert.equal(edge.length, 1);
assert.deepEqual([edge[0].type, edge[0].y], ['ring', 200]);
assert.equal(socketPoint(a, howl, 0, 6, 'tail'), null);
assert.ok(effects.some((e) => e.type === 'ring'), 'cast shows a ring');

// An area skill draws its own rings in the sheet: `release` adds no projectile on top of them.
const roarSpecs: ClipSpec[] = [
  { key: 'idle', action: 'idle', clipKind: 'idle', frames: 4 },
  { key: 'roar', action: 'skill', clipKind: 'action', frames: 10, tags: ['aoe'], events: [{ frame: 2, name: 'cast' }, { frame: 5, name: 'release' }, { frame: 5, name: 'spawn:mouth' }] },
];
const roarLibrary = buildLibrary(
  roarSpecs.map((c) => asset('characters/beast', c.key)),
  new Map(roarSpecs.map((c) => [`characters/beast/${c.key}.png`, sheet(c)])),
);
const roar = roarLibrary.characters[0].actions[0];
assert.deepEqual(roar.tags, ['aoe']);
const roarEffects: Effect[] = [];
const roarActor = newActor(2, roarLibrary.characters[0].idle!, 100, 200, roarLibrary.characters[0]);
startClip(roarActor, roar, (e) => spawnFromEvent(e, roarEffects));
for (let t = 0; t < 1.1; t += 0.01) advance(roarActor, 0.01, (e) => spawnFromEvent(e, roarEffects));
assert.equal(roarEffects.length, 0, 'an aoe skill adds no projectile and no ring: its sheet draws them');

// A blow lands just past the weapon's tip, so a long body (a wolf) does not get the ring in the middle of its back.
const swordSpecs: ClipSpec[] = [
  { key: 'idle', action: 'idle', clipKind: 'idle', frames: 4 },
  { key: 'stab', action: 'attack', clipKind: 'action', frames: 6, events: [{ frame: 2, name: 'hit' }], sockets: { names: ['hand', 'tip'], frames: { S_2: [[10, 20, 1], [30, 40, 1]] } } },
];
const swordLibrary = buildLibrary(
  swordSpecs.map((c) => asset('characters/knight', c.key)),
  new Map(swordSpecs.map((c) => [`characters/knight/${c.key}.png`, sheet(c)])),
);
const knight = swordLibrary.characters[0];
const swordEffects: Effect[] = [];
const swordActor = newActor(3, knight.idle!, 100, 200, knight);
startClip(swordActor, knight.actions[0], (e) => spawnFromEvent(e, swordEffects));
for (let t = 0; t < 1; t += 0.01) advance(swordActor, 0.01, (e) => spawnFromEvent(e, swordEffects));
const blow = swordEffects.find((e) => e.type === 'ring' && e.tone === 'hit');
assert.ok(blow, 'hit shows a ring');
// tip (30, 40) × scale 2 from the cell origin (100 - 50, 200 - 90), plus 12 px along the facing (S = down)
assert.deepEqual([Math.round(blow!.x), Math.round(blow!.y)], [100 - 50 + 60, 200 - 90 + 80 + 12]);

// The looping base clip fires its own events (`step:<leg>`) in order, lap after lap, so the HUD can show them.
const strideSpecs: ClipSpec[] = [
  { key: 'idle', action: 'idle', clipKind: 'idle', frames: 4 },
  { key: 'walk', action: 'walk', clipKind: 'locomotion', frames: 8, groundSpeed: 40, events: [{ frame: 0, name: 'step:legL' }, { frame: 4, name: 'step:legR' }] },
];
const strideLibrary = buildLibrary(
  strideSpecs.map((c) => asset('characters/ghoul', c.key)),
  new Map(strideSpecs.map((c) => [`characters/ghoul/${c.key}.png`, sheet(c)])),
);
const ghoul = strideLibrary.characters[0];
const steps: string[] = [];
const walker = newActor(4, ghoul.locomotion[0], 100, 200, ghoul);
for (let t = 0; t < 1.55; t += 0.01) advance(walker, 0.01, (e) => steps.push(`${e.name}@${e.frame}`));
assert.deepEqual(steps, ['step:legL@0', 'step:legR@4', 'step:legL@0', 'step:legR@4'], 'two laps of an 8-frame clip at 10 fps');
assert.equal(walker.lastEvent?.name, 'step:legR');

// The scene keeps a sprite's own width inside its sides: a wide cell stops further from the edge than a narrow one.
const wideSpecs: ClipSpec[] = [
  { key: 'idle', action: 'idle', clipKind: 'idle', frames: 4, frameWidth: 224 },
  { key: 'amble', action: 'walk', clipKind: 'locomotion', frames: 8, groundSpeed: 40, frameWidth: 224 },
];
const wideLibrary = buildLibrary(
  wideSpecs.map((c) => asset('characters/wolf', c.key)),
  new Map(wideSpecs.map((c) => [`characters/wolf/${c.key}.png`, sheet(c)])),
);
const narrow = newActor(5, ghoul.idle!, 150, 200, ghoul);
const wide = newActor(6, wideLibrary.characters[0].idle!, 150, 200, wideLibrary.characters[0]);
for (const actor of [narrow, wide]) {
  for (let t = 0; t < 3; t += 0.01) stepPlayer(actor, { dx: -1, dy: 0, run: false }, 0.01, { width: 5000, height: 5000 }, () => {});
}
assert.equal(narrow.x, 60, 'a 100 px cell keeps the minimum room');
assert.equal(wide.x, 112, 'a 224 px cell keeps half of itself inside the scene');

// 7. root motion: the sprite covers the clip's travel along the facing it started with (S = down), whatever the input does.
a = spawn();
a.row = 0;
startClip(a, slash, emit);
tick(a, 1.2);
assert.equal(Math.round(a.x), 100);
assert.equal(Math.round(a.y), 200 + 20, 'travel 20 logical units × scale 2, squashed by sin(30°) = 0.5 going down the screen');

// 2. moving: at groundSpeed × scale along the input, Shift takes the fastest gait.
a = spawn();
for (let t = 0; t < 1; t += 0.01) stepPlayer(a, { dx: 1, dy: 0, run: false }, 0.01, { width: 5000, height: 5000 }, emit);
assert.equal(a.clip.key, 'walk');
assert.ok(Math.abs(a.x - 100 - 80) < 1, 'walk covers 40 × 2 px in a second');
assert.equal(a.row, 6, 'facing east');
a = spawn();
for (let t = 0; t < 1; t += 0.01) stepPlayer(a, { dx: 0, dy: -1, run: true }, 0.01, { width: 5000, height: 5000 }, emit);
assert.equal(a.clip.key, 'run');
assert.ok(Math.abs(200 - a.y - 80) < 1, 'run covers 80 × 2 px in a second, squashed by sin(30°) = 0.5 going up the screen');
// The facing follows the input's angle, the screen velocity follows the camera: down-right is SE, and its vertical part is halved.
a = spawn();
for (let t = 0; t < 1; t += 0.01) stepPlayer(a, { dx: 1, dy: 1, run: false }, 0.01, { width: 5000, height: 5000 }, emit);
assert.equal(a.row, 7, 'facing south-east');
assert.ok(Math.abs(a.x - 100 - 80 / Math.SQRT2) < 1);
assert.ok(Math.abs(a.y - 200 - (80 / Math.SQRT2) * 0.5) < 1);
// Moving cancels an action only from its cancel event on.
a = spawn();
startClip(a, slash, emit);
stepPlayer(a, { dx: 1, dy: 0, run: false }, 0.01, { width: 5000, height: 5000 }, emit);
assert.ok(a.act, 'still attacking before cancel');
tick(a, 0.6);
a.act ??= null;
startClip(a, slash, emit);
tick(a, 0.55);
stepPlayer(a, { dx: 1, dy: 0, run: false }, 0.01, { width: 5000, height: 5000 }, emit);
assert.equal(a.act, null, 'walking cancels the attack after its cancel event');

console.log('✅ playground palette + atlas contract checks passed');
