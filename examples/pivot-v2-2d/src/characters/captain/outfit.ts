/**
 * Ossuary captain outfit, as data: the guard's bone body under better gear. Same skeleton, same
 * clips, the kit's parts in other places and other materials, so it reads as a higher rank:
 * - a crested steel helm (no horns) with a crimson horsehair plume (`helm-crest`);
 * - lamed pauldrons on both shoulders, mirrored, in brass over the steel;
 * - a longer tabard with a swallowtail hem over a dark tunic, a belt with a sash tail and a skull buckle;
 * - greaves on both legs, bracers on both arms, a baldric over the sword shoulder;
 * - a longer sword (`CAPTAIN_BLADE`), no shield.
 *
 * It is `OutfitData` like the guard's (`../guard/outfit.ts`; part ids and material names of
 * `../../gear/catalog.ts`): this file only says which piece goes where and which theme material
 * plays each role. `character.ts` draws it with `outfitFromData(OUTFIT, CATALOG)`.
 *
 * Detail tiers: primary = crested helm, pauldrons on both shoulders, long sword; secondary = rib cage,
 * tabard, sash tail, belt, greaves, bracers, baldric; tertiary = teeth, rivets, runes, buckle skull, plume strands.
 */

import type { OutfitData } from '@core/rig';

/** Length of the captain's blade (the guard's is 24): the drawing, the smear and the sockets all read this. */
export const CAPTAIN_BLADE = 32;

/** Gilded fittings: a piece wears this over the outfit's materials (the pauldrons, the sword's guard and pommel, the crest's comb). */
const GILT = { metal: 'brass' };

export const OUTFIT: OutfitData = {
  base: 'bone-legs',
  // Which theme material plays each role of the gear kit for the captain: polished steel for the
  // metal (a step lighter than the guard's iron), a crimson cloth and a violet tabard.
  materials: {
    metal: 'steel',
    blade: 'blade',
    cloth: 'sash',
    clothAccent: 'robe',
    plume: 'sash',
    leather: 'leather',
    bone: 'bone',
    boneLimb: 'boneLimb',
    hollow: 'hollow',
    glow: 'soul',
  },
  pieces: [
    { part: 'greave', slot: 'shin', side: -1 },
    { part: 'greave', slot: 'shin', side: 1 },
    { part: 'tunic', slot: 'pelvis', id: 'tunic' },
    // The swallowtail hem: `tears` is the part's raw option (two lists of offsets, front and back).
    { part: 'tabard', slot: 'pelvis', options: { length: 19, width: 8.8, tears: [[2.2, 1, 0, 1, 2.2], [2.2, 1, 0, 1, 2.2]] } },
    { part: 'belt', slot: 'pelvis', on: 'tunic', id: 'belt' },
    { part: 'sash-tail', slot: 'pelvis', on: 'belt', materials: { clothAccent: 'sash' } },
    { part: 'skull-buckle', slot: 'pelvis', on: 'belt' },
    { part: 'pouch', slot: 'pelvis' },
    { part: 'bone-spine', slot: 'chest' },
    { part: 'rib-cage', slot: 'chest' },
    { part: 'baldric', slot: 'shoulder', side: 1 },
    { part: 'bone-arm', slot: 'shoulder', side: -1 },
    { part: 'bone-arm', slot: 'shoulder', side: 1 },
    { part: 'bracer', slot: 'forearm', side: -1 },
    { part: 'bracer', slot: 'forearm', side: 1 },
    { part: 'lamed-pauldron', slot: 'shoulder', side: -1, options: { lames: 3, size: 1.1 }, materials: GILT },
    { part: 'lamed-pauldron', slot: 'shoulder', side: 1, options: { lames: 3, size: 1.1 }, materials: GILT },
    { part: 'bone-skull', slot: 'head', id: 'skull' },
    { part: 'horned-helm', slot: 'head', on: 'skull', id: 'helm', options: { horns: false, size: 1.08 } },
    { part: 'helm-crest', slot: 'head', on: 'helm', options: { size: 1.08 }, materials: GILT },
    { part: 'notched-sword', slot: 'hand', side: 1, id: 'blade', options: { length: CAPTAIN_BLADE }, materials: GILT },
    { part: 'weapon-smear', slot: 'hand', side: 1, on: 'blade', options: { length: CAPTAIN_BLADE } },
    { part: 'charged-edge', slot: 'hand', side: 1, on: 'blade', options: { length: CAPTAIN_BLADE } },
    { part: 'ground-shockwave', slot: 'hand', side: 1, on: 'blade', options: { length: CAPTAIN_BLADE } },
  ],
};
