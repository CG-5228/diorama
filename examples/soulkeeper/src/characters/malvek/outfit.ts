/**
 * Malvek Ravenlight, the Soul Shepherd, as outfit data: the second outfit on the humanoid skeleton,
 * dressed entirely from the gear kit. Where the guard is an armored skeleton warrior, Malvek is a
 * tall, gaunt necromancer: a bare skull wreathed in soul fire, a long split coat in dusk purple
 * with a high collar and a torn hem, a bone rib cage worn over it as a breastplate, skull pauldrons,
 * a crimson sash with a skull buckle, a red grimoire hanging from the belt on a chain, bony hands and
 * shins, a scythe in the right hand with a caged soul lantern hanging off the head of its snath, and
 * a soul flame over the open left palm. The soul fire (the crown, the palm flame, the lantern, the
 * eyes) is the only saturated color.
 *
 * It is `OutfitData` (part ids and material names of `../../gear/catalog.ts`): this file says which
 * piece goes where and which theme material plays each role. `character.ts` draws it with
 * `outfitFromData(OUTFIT, CATALOG)`, and the viewer's customizer edits the same data.
 * The clips drive the channels the parts read: `weaponYaw` / `weaponPitch` / `bladeAim` and
 * `lanternSway` (the scythe), `flare` (the palm flame), `charge` and `hurt` (the skull's eyes and the
 * fire crown), `dead` (the fire going out).
 *
 * Built to survive pitch: the coat body, breastplate, collar, skirt, sash, buckle and grimoire follow
 * the trunk through `bodyFrames` (ending at the chest joint), so a hit recoils them and a death lays
 * them flat; the skirt drapes along the floor, the grimoire and the lantern fall to it, the scythe
 * lies down beside the hand.
 *
 * Detail tiers: primary = the fire crown on the skull, the high collar, the skull pauldrons, the
 * long split coat, the scythe (silhouette); secondary = the rib breastplate, the sash and buckle, the
 * grimoire on its chain, the lantern, the sleeves and cuffs, the bone hands and shins, the soul flame
 * in the palm; tertiary = teeth and sockets (skull and pauldrons), the pauldron rims and spikes, the
 * leg wraps, the blade's nick, groove and bevel, the iron bands on the snath, the chain links, the
 * grimoire's eye and clasp, the torn hem, the lantern bars, the embers.
 */

import type { OutfitData } from '@core/rig';

export const OUTFIT: OutfitData = {
  base: 'bone-legs',
  // Which theme material plays each role of the gear kit for Malvek.
  materials: {
    metal: 'iron',
    blade: 'blade',
    cloth: 'robe',
    clothAccent: 'sash',
    leather: 'sash',
    wood: 'shield',
    bone: 'bone',
    boneLimb: 'boneLimb',
    boneGroove: 'boneGroove',
    hollow: 'hollow',
    glow: 'soul',
  },
  pieces: [
    // Bone shins with crimson wraps, under the hem.
    { part: 'leg-wraps', slot: 'shin', side: -1 },
    { part: 'leg-wraps', slot: 'shin', side: 1 },
    // The coat: split skirt, fitted body with the rib breastplate over it, the sash, buckle and grimoire at the waist.
    { part: 'long-coat', slot: 'pelvis', id: 'skirt' },
    { part: 'bone-spine', slot: 'chest' },
    { part: 'coat-torso', slot: 'chest', id: 'coat' },
    { part: 'rib-breastplate', slot: 'chest', on: 'coat' },
    { part: 'belt', slot: 'pelvis', on: 'coat', id: 'belt', options: { buckle: false } },
    { part: 'skull-buckle', slot: 'pelvis', on: 'belt' },
    { part: 'sash-tail', slot: 'pelvis', on: 'belt' },
    { part: 'grimoire', slot: 'pelvis' },
    { part: 'high-collar', slot: 'chest' },
    // Left arm: sleeve, open bone palm, the soul flame over it.
    { part: 'coat-sleeve', slot: 'shoulder', side: -1 },
    { part: 'bone-hand', slot: 'hand', side: -1, id: 'palm' },
    { part: 'palm-flame', slot: 'hand', side: -1, on: 'palm' },
    // Right arm: the scythe, the lantern off its head, the sleeve and the fist closed on the snath.
    { part: 'reaper-scythe', slot: 'hand', side: 1, id: 'scythe' },
    { part: 'soul-lantern', slot: 'hand', side: 1, on: 'scythe' },
    { part: 'coat-sleeve', slot: 'shoulder', side: 1 },
    { part: 'scythe-fist', slot: 'hand', side: 1, on: 'scythe' },
    { part: 'skull-pauldron', slot: 'shoulder', side: -1 },
    { part: 'skull-pauldron', slot: 'shoulder', side: 1 },
    // The skull and its crown of fire; the sweep's smear.
    { part: 'bone-skull', slot: 'head', id: 'skull' },
    { part: 'skull-sutures', slot: 'head', on: 'skull' },
    { part: 'fire-crown', slot: 'head', on: 'skull', options: { size: 1.3 } },
    { part: 'scythe-smear', slot: 'hand', side: 1, on: 'scythe' },
  ],
};
