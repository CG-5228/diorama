/**
 * The characters that gear items are drawn from. A gear item is a part drawn as a character wears it, body hidden
 * (`@core/rig`'s `defineItemIcon`), so the catalog hands the engine the kit's own characters with two changes that suit loot:
 *
 * - the bodies that parts rest on are drawn dark and hollow: a helm sits on a skull in the outfit, and as loot it should show
 *   the inside of the helm and two sparks of soul (the skull's `glow` eyes), not a head;
 * - for a weapon that has to lie diagonally in the icon, a copy of the character whose idle clip holds it along a chosen
 *   direction and raises the body, so the whole weapon hangs in the air (`holding`).
 *
 * Nothing else about the characters changes: same skeleton, same clips, same outfit pieces and materials.
 *
 * Why both stay, with `gear.hosts` and `spin` now in the engine (compared side by side on the helm, the crest, the crown and the
 * scythe): `hosts: 'hide'` places the host without drawing it, so a helm floats as an empty shell, the crest as a bare plume and
 * the crown as three flames, and the soul eyes that are the icon's one saturated spot are lost; the default draws the whole bone
 * skull, which outweighs the helm. The hollow skull is the one that reads as "a helm with a soul in it". `spin` lays the scythe
 * on the diagonal well, but the plain character keeps its blade edge-on and the lantern small at the hook, where `holding` turns
 * the blade to the viewer and hangs the lantern in the clear, so the soul accent shows.
 */

import type { CharacterClip, Clip, OutfitCharacterInfo, OutfitData } from '@core/rig';
import { CHARACTERS } from '../gear/catalog';

const clipOf = (entry: CharacterClip): Clip => ('drive' in entry ? entry : entry.clip);

/** An outfit whose bone body parts are drawn in the theme's hollow material (the dark of the inside of a helm). */
function hollowBodies(outfit: OutfitData): OutfitData {
  const dark = { bone: 'hollow', boneLimb: 'hollow', boneGroove: 'hollow' };
  return { ...outfit, pieces: outfit.pieces.map(p => (p.part === 'bone-skull' ? { ...p, materials: { ...p.materials, ...dark } } : p)) };
}

/** The character with its idle clip holding the weapon along (`yaw`, `pitch`) in the body's frame, the body raised by `lift`. */
function holding(base: OutfitCharacterInfo, id: string, o: { yaw: number; pitch: number; aim?: number; lift?: number }): OutfitCharacterInfo {
  const clip = clipOf(base.clips['idle'] ?? Object.values(base.clips)[0]);
  const laid: Clip = {
    ...clip,
    drive: t => {
      const d = clip.drive(t);
      const r = d.root ?? [0, 0, 0];
      return { ...d, root: [r[0], r[1], r[2] + (o.lift ?? 0)], extra: { ...d.extra, weaponYaw: o.yaw, weaponPitch: o.pitch, ...(o.aim !== undefined ? { bladeAim: o.aim } : {}) } };
    },
  };
  return { ...base, id, clips: { idle: laid } };
}

const BASE = CHARACTERS.map(c => ({ ...c, outfit: hollowBodies(c.outfit) }));
const malvek = BASE.find(c => c.id === 'malvek')!;

export const LOOT_CHARACTERS: OutfitCharacterInfo[] = [
  ...BASE,
  // The reaper's scythe lies along a diagonal with its blade turned to the viewer, the body raised so the whole snath hangs free.
  holding(malvek, 'malvek-scythe', { yaw: 1.4, pitch: 0.7, lift: 50, aim: Math.PI }),
];
