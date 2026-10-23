import { ContractError, buildLibrary as buildRuntimeLibrary, imageSheet, readSheet, type Character as RuntimeCharacter, type Clip as RuntimeClip, type Sheet } from '@diorama/runtime';
import type { Atlas } from '../atlas';
import { stripExtension } from '../format';
import type { AssetFileMeta } from '../types';
import { sheetRef, type AssetRef } from './view';
import type { EffectSheet } from './vfx';

/**
 * What the playground can put on its scene, read only from exported assets by `@diorama/runtime` (following
 * docs/guides/rig/04-atlas-contract.md): a character is a set of clips that share a manifest (or, for older atlases, a
 * folder, skeleton and pivot); everything else is a sprite. Meaning never comes from file names.
 */

export type Clip = RuntimeClip<AssetRef>;
export type Character = RuntimeCharacter<AssetRef>;

export interface Sprite {
  id: string;
  name: string;
  clip: Clip;
}

/** What a click on the scene puts down. `key` identifies the entry in the palette. */
export type Armed =
  | { key: string; type: 'sprite'; clip: Clip; row: number }
  | { key: string; type: 'character'; character: Character };

export interface Library {
  characters: Character[];
  sprites: Sprite[];
  /** The project's visual effects by id: the sheets characters cue on their events. */
  effects: Map<string, EffectSheet>;
}

/** The project's exported assets and the atlases read so far (by asset subpath), as the runtime's library. */
export function buildLibrary(assets: AssetFileMeta[], atlases: Map<string, Atlas>): Library {
  const sheets: Sheet<AssetRef>[] = [];
  for (const asset of assets) {
    const atlas = asset.atlas ? atlases.get(asset.subpath) : undefined;
    // An atlas that is not loaded (yet, or at all) leaves its asset out, and so does one that is not an atlas at all.
    if (asset.atlas && !atlas) continue;
    try {
      sheets.push(atlas ? readSheet(sheetRef(asset), atlas) : imageSheet(sheetRef(asset), { width: asset.width ?? 0, height: asset.height ?? 0 }));
    } catch (error) {
      if (!(error instanceof ContractError)) throw error;
    }
  }
  const library = buildRuntimeLibrary(sheets);
  return {
    characters: library.characters,
    sprites: library.sprites.map((clip) => ({ id: clip.asset.subpath, name: stripExtension(clip.asset.subpath), clip })),
    effects: library.effects,
  };
}
