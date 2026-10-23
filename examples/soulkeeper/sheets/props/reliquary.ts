import { defineTileSet } from '@core/volume';
import { SCENERY } from '../../src/scenery/catalog';

/**
 * The necromancer's reliquary, eight facings: the piece lives in `src/scenery/props.ts`, sized against the character (about half its height, a
 * chest in one 48-wide cell of the space profile) with a cell to match.
 * The catalog's `asset: 'props/reliquary'` points here, so `npm run scenery-items` writes no second copy.
 */
export default defineTileSet({ catalog: SCENERY, piece: 'reliquary' });
