/**
 * Reading exported sheets: what each one is (by `meta.data.role`, with the fallbacks of contract §6 for older atlases) and
 * which other sheets it needs. A host fetches the JSON, calls `readSheet`, and fetches `dependenciesOf` next.
 */

import type { Atlas, AtlasData } from './contract/atlas.js';
import type { CharacterManifest } from './contract/character.js';
import { CONTRACT } from './contract/version.js';

/** A sheet's place in the assets, from the assets root and without extension: 'characters/guard/idle'. */
export type SheetPath = string;

/** What the host knows a sheet by: its path, and where its image is when it loads it from a url. Hosts may add their own fields. */
export interface SheetRef {
  path: SheetPath;
  url?: string;
}

/**
 * What a sheet is to a player:
 * - `character`: a clip of a character (a manifest, a skeleton or `role: 'character'`);
 * - `effect`: a visual effect (`role: 'vfx'`), played on cues;
 * - `ui` and `icon`: interface pieces and item icons, which are not placed on a scene;
 * - `sprite`: anything else that plays as it is (a prop, a piece of scenery, a scene's picture, an image without an atlas);
 * - `grid`: a grid or compact sheet, which has no playback order.
 */
export type SheetKind = 'character' | 'effect' | 'ui' | 'icon' | 'sprite' | 'grid';

/** A sheet as read: the host's handle on it, its atlas and what it is. */
export interface Sheet<A extends SheetRef = SheetRef> {
  asset: A;
  /** Null for an image exported without an atlas. */
  atlas: Atlas | null;
  kind: SheetKind;
  /** The picture's size in exported px. */
  size: { width: number; height: number };
  /** What could be read only in part (a newer contract than this runtime's). */
  warnings: string[];
}

/** A file that is not an atlas the runtime can read: the message names its path. */
export class ContractError extends Error {
  constructor(
    readonly path: SheetPath,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'ContractError';
  }
}

/** The folder of a sheet path ('characters/guard'), '' at the root. */
export const dirnameOf = (path: SheetPath) => {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
};

/** The file name of a sheet path, without its folder: 'idle'. */
export const basenameOf = (path: SheetPath) => path.slice(path.lastIndexOf('/') + 1);

/** A sheet named by another: a path from the assets root when it has a `/`, else a sibling of the sheet that names it (as scenery pieces name their state and clip sheets). */
export const sheetNamed = (from: SheetPath, name: string): SheetPath => (name.includes('/') ? name : [dirnameOf(from), name].filter(Boolean).join('/'));

const refOf = <A extends SheetRef>(ref: A | SheetPath): A => (typeof ref === 'string' ? ({ path: ref } as A) : ref);

/** The manifest of a character sheet. A gear item names its wearer as plain text: that is not a manifest. */
export const manifestOf = (atlas: Atlas): CharacterManifest | undefined => {
  const character = atlas.meta.data?.character;
  return typeof character === 'object' ? character : undefined;
};

/** Whether a sheet plays (`strip` or `directions`): grid and compact sheets have no playback order. */
export const isAnimated = (atlas: Atlas) => atlas.meta.mode === 'strip' || atlas.meta.mode === 'directions';

/** A gear item (a helm, a shield) is something to place on the scene, never a character, whoever wears it in its sheet. */
export const isCharacter = (atlas: Atlas) =>
  atlas.meta.data?.role !== 'gear' && (atlas.meta.data?.role === 'character' || atlas.meta.data?.skeleton !== undefined || manifestOf(atlas) !== undefined);

function kindOf(atlas: Atlas): SheetKind {
  const role = atlas.meta.data?.role;
  if (role === 'vfx') return 'effect';
  if (role === 'icon') return 'icon';
  if (role === 'ui') return 'ui';
  if (!isAnimated(atlas)) return 'grid';
  return isCharacter(atlas) ? 'character' : 'sprite';
}

/**
 * Reads an exported atlas JSON. Throws a `ContractError` naming the path when it is not an atlas (not an object, or no
 * `meta` object). Cells that are not listed by name (no `frames`, or `frames` in another shape, such as the array of
 * other packers) are taken from the grid of `frameWidth` × `frameHeight`, with a warning when `frames` was there.
 */
export function readSheet<A extends SheetRef = SheetRef>(ref: A | SheetPath, json: unknown): Sheet<A> {
  const asset = refOf(ref);
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new ContractError(asset.path, 'an atlas is a JSON object with `meta` and `frames`');
  const { meta, frames } = json as { meta?: unknown; frames?: unknown };
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new ContractError(asset.path, 'the atlas has no `meta` object');
  const named = !!frames && typeof frames === 'object' && !Array.isArray(frames);
  const atlas = (named ? json : { ...json, frames: {} }) as Atlas;
  const warnings: string[] = [];
  if (frames !== undefined && !named) warnings.push(`${asset.path}: \`frames\` is not an object of cells by name: the cells are taken from the grid`);
  const contract = atlas.meta.data?.contract;
  if (typeof contract === 'number' && contract > CONTRACT) warnings.push(`${asset.path}: written for contract ${contract}, read as contract ${CONTRACT}`);
  return { asset, atlas, kind: kindOf(atlas), size: { width: atlas.meta.width ?? 0, height: atlas.meta.height ?? 0 }, warnings };
}

/** An image exported without an atlas: one frame, played as a sprite. */
export function imageSheet<A extends SheetRef = SheetRef>(ref: A | SheetPath, size: { width: number; height: number }): Sheet<A> {
  return { asset: refOf(ref), atlas: null, kind: 'sprite', size, warnings: [] };
}

/**
 * What to fetch next for a sheet to play:
 * - a character's other clips (the manifest's keys, siblings of the sheet) and the effects it cues (`vfx/<id>`);
 * - an effect's `follows` (`followsSheet`, or `vfx/<follows>`);
 * - a piece of scenery's state and clip sheets (siblings unless they name a path).
 * Paths are listed once, in that order, never the sheet itself. A scene names its pieces by id only; their sheets come with C2.
 */
export function dependenciesOf(sheet: Sheet): SheetPath[] {
  const out = new Set<SheetPath>();
  const atlas = sheet.atlas;
  const path = sheet.asset.path;
  if (!atlas) return [];
  const data: AtlasData = atlas.meta.data ?? {};
  const manifest = manifestOf(atlas);
  if (sheet.kind === 'character' && manifest) {
    for (const clip of manifest.clips) out.add(sheetNamed(path, clip.key));
    for (const cues of Object.values(manifest.effects ?? {})) for (const cue of cues) out.add(`vfx/${cue.effect}`);
  }
  if (sheet.kind === 'effect') {
    const effect = data.effect;
    if (effect?.followsSheet) out.add(effect.followsSheet);
    else if (effect?.follows) out.add(`vfx/${effect.follows}`);
  }
  for (const name of Object.values(data.stateSheets ?? {})) out.add(sheetNamed(path, name));
  for (const clip of Object.values(data.clips ?? {})) if (clip.sheet) out.add(sheetNamed(path, clip.sheet));
  out.delete(path);
  return [...out];
}
