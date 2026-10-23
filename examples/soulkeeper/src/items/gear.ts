/**
 * The loot made of the gear kit (`../gear/catalog.ts`): each part drawn as a character wears it, body hidden, fitted into
 * the icon. A part that rests on another (a crest on its helm) brings that host along, so the icon shows what a player
 * would find. The view (`facing`) is picked per item: a coat from the front, a helm with both horns showing, a pauldron with its lames.
 * Ids are the part's own where one part is one item.
 */

import type { ItemInfo } from '@core/rig';

export const GEAR_ITEMS: ItemInfo[] = [
  { id: 'horned-helm', label: 'Horned helm', kind: 'armor', rarity: 'uncommon', facing: 1.57, gear: { part: 'horned-helm', character: 'guard' }, description: 'Dark iron and two horns. Whoever wears it hears the ossuary breathe.' },
  { id: 'helm-crest', label: "Captain's helm", kind: 'armor', rarity: 'rare', facing: 2.0, gear: { part: 'helm-crest', character: 'captain' }, description: 'Polished steel, a gilded crest and a crimson horsehair plume.' },
  { id: 'fire-crown', label: 'Fire crown', kind: 'armor', rarity: 'epic', facing: 1.57, gear: { part: 'fire-crown', character: 'malvek', options: { size: 1.8 } }, description: 'Soul flames that no one lights and nothing puts out.' },
  { id: 'lamed-pauldron', label: 'Lamed pauldron', kind: 'armor', rarity: 'uncommon', facing: 2.9, gear: { part: 'lamed-pauldron', character: 'guard' }, description: 'Overlapping iron plates and a spike for anyone who comes too close.' },
  { id: 'gilded-pauldron', label: 'Gilded pauldron', kind: 'armor', rarity: 'rare', facing: 2.9, gear: { part: 'lamed-pauldron', character: 'captain' }, description: "Three brass plates over steel, a captain's pride." },
  { id: 'skull-pauldron', label: 'Skull pauldron', kind: 'armor', rarity: 'rare', facing: 1.9, gear: { part: 'skull-pauldron', character: 'malvek', materials: { hollow: 'soul' } }, description: "A bone skull on an iron plate, watching over its wearer's shoulder." },
  { id: 'rib-breastplate', label: 'Rib breastplate', kind: 'armor', rarity: 'rare', facing: 1.75, gear: { part: 'rib-breastplate', character: 'malvek', materials: { hollow: 'soul' } }, description: 'Bone ribs lashed over the coat. No one asks whose they were.' },
  { id: 'long-coat', label: 'Crimson long coat', kind: 'armor', rarity: 'epic', facing: 1.75, gear: { part: 'long-coat', character: 'captain' }, description: 'Long, open at the front, dyed crimson and frayed at the hem from walking among the graves.' },
  { id: 'grimoire', label: 'Chained grimoire', kind: 'accessory', rarity: 'rare', facing: 2.1, gear: { part: 'grimoire', character: 'malvek' }, description: 'Chained to the belt so that it cannot wander off.' },
  { id: 'notched-sword', label: 'Notched sword', kind: 'weapon', rarity: 'uncommon', gear: { part: 'notched-sword', character: 'guard' }, description: 'A notch in the blade and soul runes along the edge.' },
  { id: 'captain-blade', label: "Captain's blade", kind: 'weapon', rarity: 'rare', gear: { part: 'notched-sword', character: 'captain', options: { length: 32 } }, description: "Longer than the guard's, with a gilded crossguard and pommel." },
  // The scythe is drawn with the soul lantern hung from its hook (the part that rests on the scythe): it is how Malvek carries it, and
  // the lantern is the icon's one saturated color. The scythe lies along a diagonal through the `malvek-scythe` loot character.
  { id: 'reaper-scythe', label: "Reaper's scythe", kind: 'weapon', rarity: 'epic', gear: { part: 'soul-lantern', character: 'malvek-scythe' }, description: 'Iron bands on the haft, a blade that reaps what has no body and a soul lantern hanging from the hook.' },
];
