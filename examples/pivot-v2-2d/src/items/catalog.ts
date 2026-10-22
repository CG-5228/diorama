/**
 * The item catalog of pivot-v2-2d (guide 06 of @core/volume): `ITEMS`, exported for `npm run item-icons`.
 *
 * - **Rarities** (`rarity.ts`): common (iron grey), uncommon (bone), rare (steel blue), epic (violet) and legendary (soul
 *   green, the only tier that burns the project's accent). Every color is a theme token. The tier lives in the icon's frame and
 *   ground only; the item keeps its own colors.
 * - **Icon**: 48 logical px (96 exported), 5 px of room round the item. The ground is a dark slot with a soft glow of the tier's
 *   color; the frame is a thin bevelled border (light from the upper left) with a small corner gem for epic and legendary,
 *   both drawn with `@core/draw` in `rarity.ts`.
 * - **Gear items** (`gear.ts`): parts of the gear kit drawn as a character wears them, body hidden: the guard's, the captain's
 *   and Malvek's own pieces (and one dye: a crimson coat from the captain's cloth). `loot.ts` hands the engine
 *   these characters with the bodies the parts rest on drawn dark and hollow (a helm shows its inside and two soul eyes) and
 *   one that holds the scythe along a diagonal. `facing` picks the view of each. Both workarounds were weighed against the
 *   engine's own `gear.hosts: 'hide'` and `spin` and kept (see `loot.ts`).
 * - **Pieces of their own**: `flask.ts` (soul potion), `keys.ts` (bone key, crypt key), `scroll.ts`, `shard.ts`, `coin.ts`,
 *   `amulet.ts`, `tome.ts`; and, for the garments whose gear part is only a shell round a body (a shield on an arm, a belt on
 *   a tunic, a shin guard round a leg, a collar behind a neck), `armor.ts` (round shield, greave, bracer, leg wraps), `worn.ts`
 *   (belt, skull belt, pouch) and `cloth.ts` (tunic, tabard, high collar, baldric). They use the kit's own leather, iron, brass
 *   and cloth through the roles below, with the same proportions as the worn parts. Each also carries `gear: { part }` for the part
 *   it stands for, so the atlas says what it equips (`gear` and `equip`) while the piece draws the icon. Poses lay a key or a strap
 *   on a diagonal, stand a greave upright, and tip a shield or a garment towards the viewer (`pose: { turn, tip }`, `spin`). Pairs
 *   that could read alike differ in silhouette at 1x: the greave is a tall plate and the bracer a short flared cuff; the belt is a
 *   coiled ring and the skull belt a strap with a big skull plate; the high collar is an open ring with two tips.
 * - **Not loot**: bodies (skull, bones, hands, rib cage), the add-ons that only exist on another part (skull sutures, sash tail,
 *   coat sleeve, the fist on the scythe) and every effect (smears, charges, the shockwave).
 *
 * World size: a piece is built at a design size (units are logical px of the project, a person is 80) and the icon fits it to its
 * square, so only proportions show. The small items are drawn larger than life so their parts have room (the flask is 15
 * units tall, a key 17 long, the coin 9 across, the amulet 10 tall: two to four times life size); the larger ones are at
 * life size (tome 9.4 × 12.6 × 3.4, belt 11 across, greave 16 long, bracer 8 long, scroll 12 long; the shield is a 16 across buckler).
 */

import type { ItemCatalog } from '@core/rig';
import { CAMERA, VOLUMES } from '../theme';
import { CATALOG } from '../gear/catalog';
import { GEAR_ITEMS } from './gear';
import { LOOT_CHARACTERS } from './loot';
import { PIECE_ITEMS } from './pieces';
import { RARITIES, rarityFrame, slotBackground } from './rarity';

export const ITEMS: ItemCatalog = {
  items: [...PIECE_ITEMS, ...GEAR_ITEMS],
  rarities: RARITIES,
  icon: { size: 48, padding: 5 },
  background: slotBackground,
  frame: rarityFrame,
  camera: CAMERA,
  materials: VOLUMES,
  // The role a piece asks for (`role(ctx.materials, 'leather')`) and the theme material that plays it.
  defaultMaterials: {
    bone: 'bone', boneLimb: 'boneLimb', leather: 'leather', wood: 'wood', cork: 'shield', planks: 'shield', iron: 'iron', steel: 'steel', brass: 'brass',
    blade: 'blade', glass: 'glass', parchment: 'parchment', crystal: 'crystal', hollow: 'hollow', glow: 'soul', cloth: 'robe', clothAccent: 'sash', stone: 'stone',
  },
  gear: { catalog: CATALOG, characters: LOOT_CHARACTERS },
};
