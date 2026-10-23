/**
 * The game's space, declared once (docs/guides/volume/04-scenery-kits.md): the grid, the scale of everything against the
 * characters, and where walls stand. Scenery pieces and checks read SPACE; change proportions here, never in pieces.
 * Started from the "jrpg" preset: a character about two cells tall and one wide, walls taller than the party
 * enclosing rooms on cell borders.
 */

import { defineSpace } from '@core/volume';
import { CAMERA } from './theme';

/** Height of a standing adult character in world units: what the project's skins are built at (the guard). */
export const CHARACTER_HEIGHT = 80;

export const SPACE = defineSpace({ camera: CAMERA, preset: 'jrpg', character: CHARACTER_HEIGHT });
