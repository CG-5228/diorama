/**
 * Ossuary captain: the guard's skeleton warrior in a rank's gear (humanoid skeleton). Every clip
 * sheet (`sheets/characters/captain/<clip>.ts`) is one line, `export default character.sheet('<key>')`;
 * this file declares the character once.
 *
 * The rig (skeleton, clips, cell, pivot, sockets: see `spec.ts`) and the outfit (`outfit.ts`, as
 * data) are shared with the gear catalog, so the viewer's customizer edits exactly what this
 * character exports: `defineCharacter({ outfit })` draws it with `outfitFromData(OUTFIT, CATALOG)` and
 * takes the held weapon's sockets (`tip`) and clip checks from it.
 */

import { defineCharacter, type EffectCue } from '@core/rig';
import { CATALOG } from '../../gear/catalog';
import { OUTFIT } from './outfit';
import { CAPTAIN_RIG } from './spec';

/**
 * Effects the captain plays on his clip events (catalog: `../../vfx/catalog.ts`): steel sparks at the
 * tip of his longer blade where a slash lands, and the souls that leave him when his death ends.
 */
const effects: Record<string, EffectCue[]> = {
  slash: [{ on: 'hit', effect: 'slash-spark', at: 'tip' }],
  death: [{ on: 'end', effect: 'death-souls', at: 'center' }],
};

export const character = defineCharacter({ ...CAPTAIN_RIG, name: 'ossuary-captain', outfit: { data: OUTFIT, catalog: CATALOG }, effects });
