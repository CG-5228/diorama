import type { Slot } from '@core/rig';
import type { TFn } from '../../i18n/core';

/** The places of a body, in the order the skeleton lists them is up to the caller; this only names them. */
export const slotLabel = (t: TFn, slot: Slot) => t(`outfit.slots.${slot}`);

/** A paired slot's side: 1 is the character's right, -1 its left. */
export const sideLabel = (t: TFn, side: 1 | -1) => t(side === 1 ? 'outfit.sides.right' : 'outfit.sides.left');

const KNOWN_GROUPS = ['head', 'shoulders', 'torso', 'garments', 'weapons', 'shields', 'effects', 'bodies'] as const;
type KnownGroup = (typeof KNOWN_GROUPS)[number];
const isKnownGroup = (group: string): group is KnownGroup => (KNOWN_GROUPS as readonly string[]).includes(group);

/** The picker's group names are the kit's ids ('weapons'); show them in the language of the screen, and any new one as written. */
export const groupLabel = (t: TFn, group: string) => (isKnownGroup(group) ? t(`outfit.groups.${group}`) : group.charAt(0).toUpperCase() + group.slice(1));

/** Material roles read as words ('metalAccent' -> 'metal accent'); the id stays what the kit calls it. */
export const roleLabel = (role: string) => role.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
