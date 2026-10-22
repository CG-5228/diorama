import { defineTileSet } from '@core/volume';
import { SCENERY } from '../../src/scenery/catalog';

/**
 * Gothic tombstone, four facings: the piece lives in `src/scenery/props.ts`, sized against the character (about 0.63 of its height, one 48-wide
 * cell of the space profile) with a cell to match.
 * The catalog's `asset: 'props/tombstone'` points here, so `npm run scenery-items` writes no second copy.
 */
export default defineTileSet({ catalog: SCENERY, piece: 'tombstone' });
