/**
 * Ossuary guard outfit, as data: a skeleton warrior under a horned iron helm, a hollow rib cage, a
 * crimson tabard with a torn hem over a dark tunic, one layered pauldron with a spike on the left
 * shoulder (the asymmetric primary feature), a round shield on the left forearm and a notched
 * sword with soul runes in the right hand. Draws any pose of the `humanoid()` skeleton; the slash
 * clip drives `weaponYaw` / `weaponPitch`, and the strike gets one smear.
 *
 * It is `OutfitData`: part ids and material names of the catalog (`../../gear/catalog.ts`), so the
 * viewer's customizer edits exactly what the game exports. `character.ts` draws it with
 * `outfitFromData(OUTFIT, CATALOG)` and `CHARACTERS` lists it as the guard's default outfit. This
 * file only says which piece goes where and which theme material plays each role. A captain, a
 * knight or the same guard in bronze is another list of pieces or another `materials` table on
 * the same skeleton and clips.
 *
 * Soul Cleave (the `cleave` skill) adds two effects: `extra.charge` (0..1) lights the blade (a
 * glowing edge and bigger rune halos) and flares the eyes through the charge; from the clip's
 * `release` event on, a crescent of soul fire spreads over the floor from where the blade
 * struck, with a flash at the impact and a few sparks (`ground-shockwave`).
 *
 * Built to survive pitch: every trunk part (tunic, belt, tabard, ribs, spine, baldric, pauldron,
 * head) follows the trunk's own axis through the engine's `bodyFrames` (ending at the chest joint
 * the arms hang from), so the hit recoil and the death topple carry them along. Only what truly
 * hangs (the tabard, which drapes to the floor once the body lies down) or rests (the sword and
 * the shield on the floor) looks at world up. The hit clip's `extra.hurt` flares the soul eyes
 * and gapes the jaw; once the body lies the eyes burn low and the skull turns its face towards
 * the camera so it still reads.
 *
 * Detail tiers: primary = helm + horns, shield, pauldron (silhouette); secondary = rib cage,
 * tabard, belt, greave, bracer; tertiary = teeth, rivets, runes, wraps, plank seams.
 */

import type { OutfitData } from '@core/rig';

export const OUTFIT: OutfitData = {
  base: 'bone-legs',
  // Which theme material plays each role of the gear kit for the guard.
  materials: {
    metal: 'iron',
    blade: 'blade',
    cloth: 'robe',
    clothAccent: 'sash',
    leather: 'leather',
    wood: 'shield',
    bone: 'bone',
    boneLimb: 'boneLimb',
    hollow: 'hollow',
    glow: 'soul',
  },
  pieces: [
    // Limb armor: an iron greave on the right leg, leather wraps on the left.
    { part: 'greave', slot: 'shin', side: 1 },
    { part: 'leg-wraps', slot: 'shin', side: -1 },
    // Around the trunk: tunic with the belt on it, torn tabard, pouch and baldric.
    { part: 'tunic', slot: 'pelvis', id: 'tunic' },
    { part: 'tabard', slot: 'pelvis' },
    { part: 'belt', slot: 'pelvis', on: 'tunic' },
    { part: 'pouch', slot: 'pelvis' },
    { part: 'bone-spine', slot: 'chest' },
    { part: 'rib-cage', slot: 'chest' },
    { part: 'baldric', slot: 'shoulder', side: -1 },
    // Arms: bone shafts, an iron bracer on the sword arm, the pauldron and the shield on the left.
    { part: 'bone-arm', slot: 'shoulder', side: -1, id: 'armL' },
    { part: 'bone-arm', slot: 'shoulder', side: 1 },
    { part: 'bracer', slot: 'forearm', side: 1 },
    { part: 'lamed-pauldron', slot: 'shoulder', side: -1 },
    { part: 'round-shield', slot: 'forearm', side: -1, on: 'armL' },
    // Skull under a horned helm.
    { part: 'bone-skull', slot: 'head', id: 'skull' },
    { part: 'horned-helm', slot: 'head', on: 'skull' },
    // Sword in the right hand, and what it leaves in the air: the smear, the charge, the shockwave.
    { part: 'notched-sword', slot: 'hand', side: 1, id: 'blade' },
    { part: 'weapon-smear', slot: 'hand', side: 1, on: 'blade' },
    { part: 'charged-edge', slot: 'hand', side: 1, on: 'blade' },
    { part: 'ground-shockwave', slot: 'hand', side: 1, on: 'blade' },
  ],
};
