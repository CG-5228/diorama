/**
 * Ossuary guard: a skeleton warrior (humanoid skeleton). Every clip sheet
 * (`sheets/characters/guard/<clip>.ts`) is one line, `export default character.sheet('<key>')`; this file
 * declares the character once.
 *
 * The rig (skeleton, clips, cell, pivot, sockets: see `spec.ts`) and the outfit (`outfit.ts`, as
 * data) are shared with the gear catalog, so the viewer's customizer edits exactly what this
 * character exports: `defineCharacter({ outfit })` draws it with `outfitFromData(OUTFIT, CATALOG)` and
 * takes the held weapon's sockets (`tip`) and clip checks from it.
 */

import { defineCharacter, type EffectCue } from '@core/rig';
import { CATALOG } from '../../gear/catalog';
import { OUTFIT } from './outfit';
import { GUARD_RIG } from './spec';

/**
 * Effects the guard plays on his clip events (catalog: `../../vfx/catalog.ts`): steel sparks at the
 * blade's tip where a slash lands, the soul shockwave round his feet when Soul Cleave strikes (its
 * `release`, with the sprite's own crescent still spreading from the tip), dust where a jump lands,
 * and the souls that leave him when his death ends.
 */
const effects: Record<string, EffectCue[]> = {
  slash: [{ on: 'hit', effect: 'slash-spark', at: 'tip' }],
  cleave: [{ on: 'release', effect: 'soul-shockwave', at: 'feet' }],
  jump: [{ on: 'land', effect: 'dust-puff', at: 'feet' }],
  death: [{ on: 'end', effect: 'death-souls', at: 'center' }],
};

export const character = defineCharacter({ ...GUARD_RIG, name: 'ossuary-guard', outfit: { data: OUTFIT, catalog: CATALOG }, effects });
