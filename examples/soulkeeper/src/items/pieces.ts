/**
 * The pieces of their own (guide 06 §2), by item: consumables, keys, materials, currency, relics, and the garments and armor whose
 * gear part is only a shell round a body. Each one is built from `@core/volume` parts in its own file and given its tier, stack and
 * pose here. Poses lie a long item diagonally (a key's bit to the upper right), stand a tall one up (the greave) and tip a flat
 * one towards the viewer; the icon then fits whatever the item draws.
 *
 * An item that stands for a part of the gear kit (round shield, greave, bracer, leg wraps, belt, skull buckle, pouch, tunic,
 * tabard, high collar, baldric) also carries `gear: { part }`: the piece draws the icon, the part says what it equips, and the
 * atlas carries both `gear` and `equip`.
 */

import type { ItemInfo } from '@core/rig';
import { reliquaryAmulet } from './amulet';
import { bracer, greave, legWraps, roundShield } from './armor';
import { baldric, highCollar, tabard, tunic } from './cloth';
import { graveCoin } from './coin';
import { soulPotion } from './flask';
import { boneKey, cryptKey } from './keys';
import { ancientScroll } from './scroll';
import { soulShard } from './shard';
import { necromancersTome } from './tome';
import { belt, pouch, skullBelt } from './worn';

export const PIECE_ITEMS: ItemInfo[] = [
  { id: 'soul-potion', label: 'Soul potion', kind: 'consumable', rarity: 'uncommon', stack: 10, piece: soulPotion, roles: ['glass', 'crystal', 'cork', 'leather', 'bone'], description: 'Liquid soul in a corked flask. It restores the life of whoever drinks it, and the silence of whoever lost it.' },
  { id: 'bone-key', label: 'Bone key', kind: 'key', rarity: 'common', stack: 1, piece: boneKey, pose: { turn: 180, tip: 20 }, roles: ['bone', 'boneLimb', 'leather', 'crystal'], description: 'Carved from a long bone. It opens the doors the living forgot.' },
  { id: 'crypt-key', label: 'Crypt key', kind: 'key', rarity: 'rare', stack: 1, piece: cryptKey, pose: { turn: 180, tip: 30 }, roles: ['steel', 'brass', 'crystal'], description: 'Cold steel, brass and a soul gem in the bow. Only the crypt door knows it.' },
  { id: 'ancient-scroll', label: 'Ancient scroll', kind: 'consumable', rarity: 'uncommon', stack: 5, piece: ancientScroll, pose: { turn: 180, tip: 12 }, roles: ['parchment', 'cork', 'leather', 'clothAccent', 'glow'], description: 'Brittle vellum written in soul runes. Read aloud, it wears away.' },
  { id: 'soul-shard', label: 'Soul shard', kind: 'material', rarity: 'common', stack: 99, piece: soulShard, roles: ['crystal', 'stone'], description: 'A sliver of crystallized soul. Warm to the touch, even in the coldest crypt.' },
  { id: 'grave-coin', label: 'Grave coin', kind: 'currency', rarity: 'common', stack: 999, piece: graveCoin, roles: ['brass'], description: 'Blackened brass with a skull on the reverse. It pays for the crossing, and little else.' },
  { id: 'reliquary-amulet', label: 'Reliquary amulet', kind: 'accessory', rarity: 'epic', stack: 1, piece: reliquaryAmulet, facing: Math.PI / 2 + 0.5, roles: ['brass', 'steel', 'hollow', 'crystal'], description: 'A tiny reliquary shaped like a coffin, with a splinter of soul behind the glass.' },
  { id: 'necromancers-tome', label: "Necromancer's tome", kind: 'relic', rarity: 'legendary', stack: 1, piece: necromancersTome, facing: Math.PI / 2 + 0.55, pose: { tip: 38 }, roles: ['cloth', 'brass', 'parchment', 'leather', 'clothAccent', 'glow', 'hollow'], description: 'The book that is still writing. Its eye follows whoever opens it, and remembers the name of every soul it has read.' },
  { id: 'round-shield', label: 'Round shield', kind: 'shield', rarity: 'uncommon', stack: 1, piece: roundShield, gear: { part: 'round-shield' }, pose: { tip: -50 }, roles: ['planks', 'iron', 'clothAccent'], description: 'Wooden planks, an iron rim and a painted crimson band.' },
  { id: 'greave', label: 'Iron greave', kind: 'armor', rarity: 'uncommon', stack: 1, piece: greave, gear: { part: 'greave' }, facing: Math.PI / 2, pose: { tip: -62 }, spin: 16, roles: ['iron', 'leather'], description: 'Guards the shin, with an iron knee cop and three straps.' },
  { id: 'bracer', label: 'Iron bracer', kind: 'armor', rarity: 'uncommon', stack: 1, piece: bracer, gear: { part: 'bracer' }, pose: { turn: 180, tip: 15 }, roles: ['iron', 'leather', 'hollow'], description: 'Hammered iron, strapped to the forearm of the sword arm.' },
  { id: 'leg-wraps', label: 'Leg wraps', kind: 'armor', rarity: 'common', stack: 1, piece: legWraps, gear: { part: 'leg-wraps' }, pose: { turn: 180, tip: 10 }, roles: ['leather', 'bone'], description: 'Leather strips wound round the shin. They still smell of the crypt.' },
  { id: 'belt', label: 'Leather belt', kind: 'accessory', rarity: 'common', stack: 1, piece: belt, gear: { part: 'belt' }, pose: { tip: -20 }, roles: ['leather', 'steel', 'hollow'], description: 'Worn leather, hand-stitched, with an iron buckle.' },
  { id: 'skull-buckle', label: 'Skull belt', kind: 'accessory', rarity: 'uncommon', stack: 1, piece: skullBelt, gear: { part: 'skull-buckle' }, facing: Math.PI / 2 + 0.4, spin: -24, roles: ['leather', 'steel', 'bone', 'hollow'], description: 'The buckle is a small skull, and it grins at whoever fastens it.' },
  { id: 'pouch', label: 'Leather pouch', kind: 'accessory', rarity: 'common', stack: 1, piece: pouch, gear: { part: 'pouch' }, roles: ['leather', 'bone', 'crystal', 'hollow'], description: 'Holds a handful of grave coins and an excuse or two.' },
  { id: 'tunic', label: 'Dark tunic', kind: 'armor', rarity: 'common', stack: 1, piece: tunic, gear: { part: 'tunic' }, facing: Math.PI / 2, pose: { tip: -48 }, roles: ['cloth', 'clothAccent', 'leather', 'hollow'], description: 'Mourning cloth, patched where the bone showed through.' },
  { id: 'tabard', label: 'Crimson tabard', kind: 'armor', rarity: 'common', stack: 1, piece: tabard, gear: { part: 'tabard' }, facing: Math.PI / 2, pose: { tip: -48 }, roles: ['clothAccent', 'cloth', 'bone', 'leather'], description: 'A long cloth, torn at the hem, dyed with what was left of the wine.' },
  { id: 'high-collar', label: 'Crimson high collar', kind: 'armor', rarity: 'uncommon', stack: 1, piece: highCollar, gear: { part: 'high-collar' }, facing: Math.PI / 2 + 0.2, pose: { tip: -16 }, roles: ['clothAccent', 'cloth', 'brass'], description: 'Hides the neck, and whatever must not be said.' },
  { id: 'baldric', label: 'Baldric', kind: 'accessory', rarity: 'common', stack: 1, piece: baldric, gear: { part: 'baldric' }, pose: { turn: 180 }, roles: ['leather', 'steel', 'hollow'], description: 'A strap of tanned leather across the chest, with a ring for the sword.' },
];
