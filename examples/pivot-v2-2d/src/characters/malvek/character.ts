/**
 * Malvek Ravenlight, the Soul Shepherd (a gaunt `humanoid()` skeleton, see `skeleton.ts`). Every clip
 * sheet (`sheets/characters/malvek/<clip>.ts`) is one line, `export default character.sheet('<key>')`; this
 * file declares the character once.
 *
 * The rig (skeleton, clips, cell, pivot, sockets: see `spec.ts`) and the outfit (`outfit.ts`, as
 * data) are shared with the gear catalog, so the viewer's customizer edits exactly what this
 * character exports: `defineCharacter({ outfit })` draws it with `outfitFromData(OUTFIT, CATALOG)` and
 * takes the held weapon's sockets (`tip`) and clip checks from it.
 */

import { defineCharacter, type EffectCue } from '@core/rig';
import { CATALOG } from '../../gear/catalog';
import { OUTFIT } from './outfit';
import { MALVEK_RIG } from './spec';

/**
 * Effects Malvek plays on his clip events (catalog: `../../vfx/catalog.ts`): a rune circle that draws
 * itself round his feet from the start of Soul Bolt (its own `release` lands with the clip's, 0.35 s in),
 * the bolt itself leaving his palm on `release` and flying along the facing, steel sparks at the scythe's
 * tip where a reap lands, and the souls that leave him when his death ends.
 */
const effects: Record<string, EffectCue[]> = {
  soulbolt: [
    { on: 'start', effect: 'cast-circle', at: 'feet' },
    { on: 'release', effect: 'soul-bolt', at: 'palm', motion: 'fly' },
  ],
  reap: [{ on: 'hit', effect: 'slash-spark', at: 'tip' }],
  death: [{ on: 'end', effect: 'death-souls', at: 'center' }],
};

export const character = defineCharacter({ ...MALVEK_RIG, name: 'malvek', outfit: { data: OUTFIT, catalog: CATALOG }, effects });
