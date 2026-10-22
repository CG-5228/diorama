/**
 * @core/rig - What a character holds, and the clips made for it
 *
 * A character's attacks are made for what it holds: a slash swings a blade, a reap a scythe, a
 * shield bash needs a shield. Held parts say their class (`PartInfo.wield`) and clips say the classes
 * they are made for (`CharacterClip.wields`), so:
 * - `wieldOf`: what an outfit holds in the main (right) and off (left) hand;
 * - `checkWield`: which clips suit it, which do not, and what is wrong (an attack for a blade on a
 *   character holding a scythe, a second sword no clip swings);
 * - `weaponSockets`: the sockets of the held items (a blade's `tip`), so effects follow the weapon
 *   the character holds, not the one it was first drawn with.
 * `defineCharacter({ outfit })` applies all three. Guide 05 of `@core/rig`.
 */

import type { CharacterClip, ClipWields, SocketFn } from './character.js';
import { isHandSlot, type GearCatalog, type OutfitData } from './gear.js';
import type { SkeletonSpec } from './skeleton.js';

/** A held part of an outfit. */
export interface Wielded {
  /** Its index in the outfit's pieces. */
  index: number;
  part: string;
  class: string;
  hands: 1 | 2;
  side: -1 | 1;
}

/** What an outfit holds: the main hand is the right one, the off hand the left. */
export function wieldOf(outfit: OutfitData, catalog: GearCatalog): { main?: Wielded; off?: Wielded } {
  const out: { main?: Wielded; off?: Wielded } = {};
  outfit.pieces.forEach((p, index) => {
    const info = catalog.parts.find(x => x.id === p.part);
    if (!info?.wield || !isHandSlot(p.slot)) return;
    const side = p.side ?? 1;
    const held: Wielded = { index, part: p.part, class: info.wield.class, hands: info.wield.hands ?? 1, side };
    if (side > 0) out.main ??= held;
    else out.off ??= held;
  });
  return out;
}

/** The `wields` of a clip entry (none for a bare clip). */
export const wieldsOf = (entry: CharacterClip): ClipWields | undefined => ('drive' in entry ? undefined : entry.wields);

/** The class a clip needs on one hand, as words ('a blade or a staff', 'an empty hand'). */
const describe = (classes: string[]) => classes.map(c => (c === 'unarmed' ? 'an empty hand' : `a ${c}`)).join(' or ');

/** What `checkWield` finds. */
export interface WieldCheck {
  main?: Wielded;
  off?: Wielded;
  /** Clips made for what the character holds, or for nothing in particular. */
  usable: string[];
  /** Clips made for something else, with what they need. */
  unusable: { key: string; needs: string }[];
  warnings: string[];
}

/**
 * Checks a character's clips against what its outfit holds. A clip suits it when each hand it names
 * (`wields.main`, `wields.off`) holds one of the classes listed there ('unarmed' for an empty hand);
 * a clip without `wields` suits anything. Warns when the character has attacks but none for the
 * weapon in its main hand, when a clip does not suit what it holds, and when the off hand holds an
 * item that only makes sense swung (`offHand: 'swing'`) and no clip swings it.
 */
export function checkWield(clips: Record<string, CharacterClip>, outfit: OutfitData, catalog: GearCatalog): WieldCheck {
  const { main, off } = wieldOf(outfit, catalog);
  const have = { main: main?.class ?? 'unarmed', off: off?.class ?? 'unarmed' };
  const usable: string[] = [];
  const unusable: WieldCheck['unusable'] = [];
  const warnings: string[] = [];
  for (const [key, entry] of Object.entries(clips)) {
    const w = wieldsOf(entry);
    const needs: string[] = [];
    if (w?.main?.length && !w.main.includes(have.main)) needs.push(`${describe(w.main)} in the main hand`);
    if (w?.off?.length && !w.off.includes(have.off)) needs.push(`${describe(w.off)} in the off hand`);
    if (needs.length) unusable.push({ key, needs: needs.join(' and ') });
    else usable.push(key);
  }
  const armed = Object.entries(clips).filter(([, e]) => wieldsOf(e)?.main?.length);
  if (main && armed.length && !armed.some(([, e]) => wieldsOf(e)!.main!.includes(main.class))) {
    const made = [...new Set(armed.flatMap(([, e]) => wieldsOf(e)!.main!))];
    warnings.push(`no clip is made for a ${main.class} in the main hand ("${main.part}"): its attacks are made for ${describe(made)}`);
  }
  for (const u of unusable) warnings.push(`clip "${u.key}" is made for ${u.needs}, and the character holds ${main ? `a ${main.class} ("${main.part}")` : 'nothing'} in the main hand${off ? ` and a ${off.class} ("${off.part}") in the off hand` : ''}`);
  if (off && off.hands === 1) {
    const info = catalog.parts.find(x => x.id === off.part)!;
    const swung = Object.values(clips).some(e => wieldsOf(e)?.off?.includes(off.class));
    if ((info.wield!.offHand ?? 'swing') === 'swing' && !swung) warnings.push(`the off hand holds a ${off.class} ("${off.part}") that no clip swings: it stays still at rest (give it clips made for two weapons, or hold it in the main hand)`);
  }
  return { main, off, usable, unusable, warnings };
}

/**
 * The sockets of the items an outfit holds, as character sockets: the main hand's under their own
 * names (a blade's `tip`), the off hand's as `off-<name>`. Options left out take the part's defaults.
 */
export function weaponSockets(outfit: OutfitData, catalog: GearCatalog, skeleton: SkeletonSpec): Record<string, SocketFn> {
  const out: Record<string, SocketFn> = {};
  const { main, off } = wieldOf(outfit, catalog);
  for (const held of [main, off]) {
    if (!held) continue;
    const info = catalog.parts.find(x => x.id === held.part)!;
    const piece = outfit.pieces[held.index];
    const options = { ...Object.fromEntries((info.options ?? []).map(o => [o.key, o.default])), ...piece.options };
    for (const [name, fn] of Object.entries(info.wield!.sockets ?? {})) out[held === main ? name : `off-${name}`] = pose => fn(pose, skeleton, { side: held.side, options });
  }
  return out;
}
