/**
 * @core/rig - Gear assets
 *
 * `defineGearAsset` exports one part of a project's gear catalog on its own, in every facing, at
 * the place it is worn on a character (the character itself is not drawn). The sheet shares the
 * character's cell and pivot, so it lines up with the character's sheets; it is what the viewer
 * lists, what an inventory or shop can show, and what the customizer uses as a thumbnail.
 */

import { defineAsset, type AssetDefinition } from '../asset.js';
import { drawCharacterFrame } from './character.js';
import { outfitFromData, partKind, type GearCatalog, type OutfitCharacterInfo, type OutfitData, type Slot } from './gear.js';
import { idle as idleClip } from './clips.js';

/** Options of `defineGearAsset`. */
export interface GearAssetOptions {
  catalog: GearCatalog;
  /** The character whose pose, cell and camera hold the part. */
  character: OutfitCharacterInfo;
  /** The part's id in the catalog. */
  part: string;
  /** Slot and side. Default: where the character's outfit wears this part, else the part's first slot, right side. */
  slot?: Slot;
  side?: -1 | 1;
  /** Option overrides (default: the outfit's, else the catalog defaults). */
  options?: Record<string, unknown>;
  /** Material overrides by role → material name (default: the outfit's). */
  materials?: Record<string, string>;
  /** Clip key of the character whose first frame poses the part. Default 'idle' (or the first clip). */
  clip?: string;
  /** Facings (default 8). */
  directions?: number;
  scale?: number;
}

/**
 * Defines a sheet of one gear part alone: directions × 1 frame, posed on the character at the
 * clip's first frame. Add-ons (a crest) are drawn with the piece they rest on. The atlas JSON
 * says `role: 'gear'` with the part's id, label, group, kind, equipment slot, slot and side.
 */
export function defineGearAsset(o: GearAssetOptions): AssetDefinition {
  const info = o.catalog.parts.find(p => p.id === o.part);
  if (!info) throw new Error(`gear asset: unknown part "${o.part}" (catalog has ${o.catalog.parts.map(p => p.id).join(', ')})`);
  const outfit = o.character.outfit;
  const index = outfit.pieces.findIndex(p => p.part === o.part);
  const worn = index >= 0 ? outfit.pieces[index] : undefined;
  // The piece itself, and the chain of pieces it rests on.
  const chain: OutfitData['pieces'] = [];
  let host = worn?.on;
  while (host) {
    const h = outfit.pieces.find(p => p.id === host);
    if (!h) break;
    chain.unshift(h);
    host = h.on;
  }
  const piece: OutfitData['pieces'][number] = {
    part: o.part,
    slot: o.slot ?? worn?.slot ?? info.slots[0],
    side: o.side ?? worn?.side ?? 1,
    options: { ...worn?.options, ...o.options },
    materials: { ...worn?.materials, ...o.materials },
    ...(worn?.on ? { on: worn.on } : {}),
  };
  const skin = outfitFromData({ materials: outfit.materials, pieces: [...chain, piece] }, o.catalog);
  const clips = o.character.clips;
  const key = o.clip ?? ('idle' in clips ? 'idle' : Object.keys(clips)[0]);
  const entry = clips[key];
  const clip = entry ? ('drive' in entry ? entry : entry.clip) : idleClip(o.character.skeleton);
  return defineAsset({
    width: o.character.width,
    height: o.character.height,
    scale: o.scale ?? 2,
    directions: o.directions ?? 8,
    pivot: o.character.pivot,
    data: { role: 'gear', part: info.id, label: info.label, group: info.group, kind: partKind(info), ...(info.equip ? { equip: info.equip } : {}), slot: piece.slot, side: piece.side, character: o.character.id },
    render({ ctx, facing = Math.PI / 2 }) {
      drawCharacterFrame(ctx, { skeleton: o.character.skeleton, clip, skin, camera: o.character.camera, pivot: o.character.pivot }, 0, facing);
    },
  });
}
