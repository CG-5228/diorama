/**
 * The producer and the consumer agree on the contract: the engine's types for what it writes into atlases (`@core/rig`'s
 * manifest, clips and cues and the item an icon describes, `@core/volume`'s navigation, the effect fields it copies from an
 * `EffectInfo` and its space profile) can be assigned to the runtime's types for what it reads; and the other way, every field
 * the runtime's types name is one the engine's types still name, for the types listed in `Checks` (top-level fields, plus the
 * manifest's camera and controls, a clip's wields and the navigation's doors and interactables), so a rename on either side
 * fails there. The scene's layout items, effect sheets and item icons are written without a named type, so the exported
 * files check those.
 *
 * The type half is checked twice: by `npx tsc --noEmit -p .` (this file is in tsconfig.json `include`), and by this test,
 * which compiles itself below, because tsx strips types and `npm test` would pass a broken check otherwise. Every
 * `Expect<...>` must compile, and every `// @ts-expect-error` must still be an error.
 */

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { CharacterManifest as ProducedManifest, EffectCue as ProducedCue, ItemIconData, ManifestClip as ProducedClip, SocketTable } from '../../core/rig/index.js';
import type { Insets as ProducedInsets, UiBox as ProducedBox } from '../../core/ui.js';
import type { EffectInfo, PieceClip, PieceNav, SceneNavigation as ProducedNavigation, NavCell as ProducedCell, spaceData } from '../../core/volume/index.js';
import { EDGE as PRODUCED_EDGE } from '../../core/volume/index.js';
import { CONTRACT, EDGE, buildLibrary, manifestOf, type AtlasSockets, type CharacterManifest, type EffectCue, type EffectMeta, type Insets, type ItemMeta, type ManifestClip, type NavCell, type PieceClipData, type PieceNavData, type SceneLayoutItem, type SceneNavigation, type SpaceData, type UiBox } from '@diorama/runtime';
import { fixtureSheets } from './helpers';

/** Compile-time assertions: `Expect<Assignable<A, B>>` fails to compile unless a value of type A can be used as a B. */
type Assignable<A, B> = [A] extends [B] ? true : false;
/**
 * `Expect<Named<Produced, Runtime>>` fails unless every field the runtime reads is one the producer names. Assignable alone
 * passes when core renames or drops a field the runtime marks optional, since a missing optional field still fits.
 */
type Named<Produced, Runtime> = [Exclude<keyof Runtime, keyof Produced>] extends [never] ? true : false;
type Expect<T extends true> = T;

export type Checks = [
  Expect<Assignable<ProducedManifest, CharacterManifest>>,
  Expect<Assignable<ProducedClip, ManifestClip>>,
  Expect<Assignable<ProducedCue, EffectCue>>,
  Expect<Assignable<ProducedNavigation, SceneNavigation>>,
  Expect<Assignable<ProducedCell, NavCell>>,
  Expect<Assignable<ProducedManifest['controls'], CharacterManifest['controls']>>,
  Expect<Assignable<ProducedManifest['effects'], NonNullable<CharacterManifest['effects']>>>,
  // `defineEffectAsset` copies these from the effect's info into `meta.data.effect` (`core/volume/effects.ts`).
  Expect<Assignable<Pick<EffectInfo, 'id' | 'label' | 'kind' | 'frames' | 'size' | 'follows'>, Pick<EffectMeta, 'id' | 'label' | 'kind' | 'frames' | 'size' | 'follows'>>>,
  Expect<Assignable<NonNullable<EffectInfo['layer']>, EffectMeta['layer']>>,
  Expect<Assignable<NonNullable<EffectInfo['directions']>, EffectMeta['directions']>>,
  Expect<Assignable<NonNullable<EffectInfo['events']>, NonNullable<EffectMeta['events']>>>,
  Expect<Assignable<NonNullable<EffectInfo['travel']>, NonNullable<EffectMeta['travel']>>>,
  Expect<Assignable<ReturnType<typeof spaceData>, SpaceData>>,
  // `defineItemIcon` writes this as `meta.data.item` (`core/rig/items.ts`).
  Expect<Assignable<ItemIconData, ItemMeta>>,
  // The other direction: every field the runtime reads is still written under that name.
  Expect<Named<ProducedManifest, CharacterManifest>>,
  Expect<Named<NonNullable<ProducedManifest['camera']>, NonNullable<CharacterManifest['camera']>>>,
  Expect<Named<ProducedManifest['controls'], CharacterManifest['controls']>>,
  Expect<Named<ProducedClip, ManifestClip>>,
  Expect<Named<ProducedCue, EffectCue>>,
  Expect<Named<ProducedNavigation, SceneNavigation>>,
  Expect<Named<ItemIconData, ItemMeta>>,
  Expect<Named<NonNullable<ProducedClip['wields']>, NonNullable<ManifestClip['wields']>>>,
  Expect<Named<ProducedNavigation['doors'][number], SceneNavigation['doors'][number]>>,
  Expect<Named<ProducedNavigation['interactables'][number], SceneNavigation['interactables'][number]>>,
  Expect<Named<ReturnType<typeof spaceData>, SpaceData>>,
  // A clip's socket table (`meta.data.sockets`), a UI sheet's insets and boxes (`core/ui.ts`), and a scenery piece's nav and
  // clips (the exporter adds each clip's `sheet`), both ways.
  Expect<Assignable<SocketTable, AtlasSockets>>,
  Expect<Named<SocketTable, AtlasSockets>>,
  Expect<Assignable<ProducedInsets, Insets>>,
  Expect<Named<ProducedInsets, Insets>>,
  Expect<Assignable<ProducedBox, UiBox>>,
  Expect<Named<ProducedBox, UiBox>>,
  Expect<Assignable<PieceNav, PieceNavData>>,
  Expect<Named<PieceNav, PieceNavData>>,
  Expect<Assignable<PieceClip, PieceClipData>>,
  Expect<Named<PieceClip, Omit<PieceClipData, 'sheet'>>>,
];

// The check bites: a type the runtime cannot read is refused.
// @ts-expect-error a manifest without clips is not one the runtime can play
export type Refused = Expect<Assignable<Omit<ProducedManifest, 'clips'>, CharacterManifest>>;
// @ts-expect-error the export writes an item's gear part as the part's id: a type that reads an object refuses it
export type RefusedItem = Expect<Assignable<ItemIconData, { gear?: { part: string } }>>;
// @ts-expect-error a producer that drops a field the runtime reads (here the optional `pivot`) is caught, though it is still assignable
export type RefusedRename = Expect<Named<Omit<ProducedManifest, 'pivot'>, CharacterManifest>>;

console.log('🧪 Checking that the engine\'s contract types fit the runtime\'s (manifest, clips, cues, navigation, effects, space, items, sockets, UI, scenery pieces) and the exported files read...\n');

// tsx strips types: compile this file with the repository's tsconfig, so the checks above fail `npm test` too.
const self = fileURLToPath(import.meta.url);
const config = ts.getParsedCommandLineOfConfigFile(resolve('tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => assert.fail(ts.flattenDiagnosticMessageText(d.messageText, ' ')) })!;
const typeErrors = ts.getPreEmitDiagnostics(ts.createProgram([self], config.options)).filter((d) => d.file && resolve(d.file.fileName) === self);
assert.deepEqual(typeErrors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' ')), [], 'the contract type checks compile');

// The constants agree too.
assert.deepEqual(EDGE, PRODUCED_EDGE, 'the edge bits of `navigation.walls`');
assert.equal(CONTRACT, 1);

// What the sample's export wrote reads as the runtime's types.
const sheets = fixtureSheets('characters', 'scenes');
for (const sheet of sheets.filter((s) => s.kind === 'character')) {
  const manifest = manifestOf(sheet.atlas!);
  assert.ok(manifest, `${sheet.asset.path} carries its manifest`);
  assert.ok(manifest.clips.every((c) => typeof c.key === 'string' && typeof c.groundSpeed === 'number' && Array.isArray(c.events)), `${sheet.asset.path}: every clip has a key, a ground speed and events`);
  assert.ok(manifest.controls.move.every((key) => manifest.clips.some((c) => c.key === key)), `${sheet.asset.path}: the controls name its clips`);
}
const scene = sheets.find((s) => s.asset.path === 'scenes/crypt-entrance')!.atlas!.meta.data!;
const navigation = scene.navigation!;
assert.equal(navigation.cost.length, navigation.rows);
assert.equal(navigation.posts.length, navigation.rows + 1, 'posts are the vertices');
// The layout items have the fields (and the types) of `SceneLayoutItem`, and nothing it does not name.
const NUMBERS = ['frame', 'row', 'dir', 'mask', 'variant', 'x', 'y'] as const satisfies readonly (keyof SceneLayoutItem)[];
const OPTIONAL = ['state', 'edge', 'options'] as const satisfies readonly (keyof SceneLayoutItem)[];
assert.ok(scene.layout!.length > 10);
for (const item of scene.layout!) {
  assert.ok(typeof item.piece === 'string' && typeof item.pass === 'string', `a layout item names its piece and pass: ${JSON.stringify(item)}`);
  for (const key of NUMBERS) assert.equal(typeof item[key], 'number', `${item.piece}.${key}`);
  assert.deepEqual(Object.keys(item).filter((k) => !['piece', 'pass', ...NUMBERS, ...OPTIONAL].includes(k)), [], `${item.piece}: no field the type leaves out`);
  if (item.edge !== undefined) assert.ok(item.edge === 'N' || item.edge === 'W');
}
// The effect sheets' `meta.data.effect` reads as `EffectMeta`.
const EFFECT_FIELDS: Record<keyof EffectMeta, 'string' | 'number' | 'boolean' | 'object'> = {
  id: 'string', label: 'string', kind: 'string', frames: 'number', fps: 'number', loop: 'boolean', layer: 'string', height: 'number', size: 'number', directions: 'number', events: 'object', travel: 'object', follows: 'string', followsSheet: 'string',
};
const effects = fixtureSheets('vfx');
assert.ok(effects.length >= 5);
for (const sheet of effects) {
  const effect = sheet.atlas!.meta.data!.effect!;
  for (const [key, value] of Object.entries(effect)) assert.equal(typeof value, EFFECT_FIELDS[key as keyof EffectMeta], `${sheet.asset.path}: effect.${key}`);
  assert.ok(effect.layer === 'ground' || effect.layer === 'air');
}
// The icons' `meta.data.item` reads as `ItemMeta`: the gear part is its id, and the part's equipment slot comes with it.
const ITEM_FIELDS: Record<keyof ItemMeta, 'string' | 'number'> = {
  id: 'string', label: 'string', kind: 'string', rarity: 'string', rarityLabel: 'string', rarityColor: 'string', stack: 'number', description: 'string', gear: 'string', equip: 'string',
};
const icons = fixtureSheets('icons');
assert.equal(icons.length, 3);
for (const sheet of icons) {
  for (const [key, value] of Object.entries(sheet.atlas!.meta.data!.item!)) assert.equal(typeof value, ITEM_FIELDS[key as keyof ItemMeta], `${sheet.asset.path}: item.${key}`);
}
const items = buildLibrary(icons).icons;
assert.deepEqual([items.get('round-shield')?.item.gear, items.get('round-shield')?.item.equip], ['round-shield', 'shield'], 'a shield equips its part in the shield slot');
assert.deepEqual([items.get('tunic')?.item.gear, items.get('tunic')?.item.equip], ['tunic', undefined], 'a part without an equipment slot');
assert.equal(items.get('soul-potion')?.item.gear, undefined, 'a consumable equips nothing');

console.log('✅ contract checks passed');
