/** What a character holds (manifest `wield`) and the clips that suit it (contract §4: `wields`, `usable`). */

import type { CharacterManifest, WieldHand } from './contract/character.js';

/** What a character holds in its main (right) and off (left) hand, when it was defined with an outfit. */
export const wieldOf = (character: { manifest: CharacterManifest | null }): { main?: WieldHand; off?: WieldHand } => character.manifest?.wield ?? {};

/**
 * The clips a character can play: the manifest marks `usable: false` the ones made for something it does not hold, and
 * they are never played even when their sheets are there. When that leaves none, every clip is kept.
 */
export function playableClips<C extends { key: string }>(clips: C[], manifest: CharacterManifest | null | undefined): C[] {
  const unusable = new Set((manifest?.clips ?? []).filter((c) => c.usable === false).map((c) => c.key));
  const playable = clips.filter((c) => !unusable.has(c.key));
  return playable.length > 0 ? playable : clips;
}
