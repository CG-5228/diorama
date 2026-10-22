/**
 * Chapel ruins (9 × 7 cells of 48 × 36 px): what is left of a small chapel in a churchyard. The flagstone nave is 7 × 5 cells and
 * its walls stand on the border of those cells (the space profile's border placement): the back wall is whole on the left
 * and falls to a broken top on the right, with a vestry door in its whole part (shut, its ward still burning), the left wall is
 * ruined all along, and the right wall stands for two cells and then gives out, so the flagstones give way to dirt there. The
 * reliquary stands against the back wall between two soul candles, an urn beside it and another smashed in the nave, moss and
 * dry grass have taken the floor, a dead tree has grown up through the right of the nave, and bones lie about. The front is open
 * to the camera; a stump marks the front corner on the right.
 *
 * The eye goes: the altar and its candles → along the whole back wall to where it breaks → the dead tree against the gap. The shut
 * door's ward is a second, smaller light at the wall's left end. Dirt rings the set; the nave's floor ends exactly under its walls,
 * and where a wall is gone the dirt has come in.
 *
 * Living: the vestry door is on the back wall's north edge of cell (2, 1), between the piers of vertices 2 and 3, with the yard
 * (row 0) behind it, so shut it blocks that step and open it saves the walk round the ruin (8 steps instead of 12 from the front). The
 * stump at vertex (8, 6) is a lone pier: it stands in the picture and blocks nothing in the navigation (edges only). The ruin's walls
 * block along their whole run, breaches included (a breach is 38 high, a little under the waist-high fence's 44).
 *
 * Sizes come from `../space.ts`: the whole wall is 100 (a little over two cells on screen), the ruin keeps 71 at every border
 * and breaks to 38 in a breach, the door 92.
 */

import type { SceneData } from '@core/volume';
import { readMap, sceneOf, withCells } from './map';

const FLOORS = { d: 'grave-dirt', f: 'crypt-flags', m: 'moss' };
const WALLS = { C: 'crypt-wall', R: 'ruined-wall' };

/** Dirt all round, the flagstone nave in the middle (cols 1 to 7, rows 1 to 5) with moss in its lower left; dirt has come in where the right wall is gone. */
const ground = readMap([
  'ddddddddd',
  'dfffffffd',
  'dfffffffd',
  'dffmmfddd',
  'dmmmmfddd',
  'dmmfffmfd',
  'ddddddddd',
], FLOORS);

/**
 * The walls are on the VERTICES (10 × 8 for a 9 × 7 set). The back wall runs along vertex row 1: whole crypt wall from the
 * left corner (vertex 1) to vertex 6, ruined wall from there to the right corner (vertex 8). The left wall is ruined wall down
 * vertex column 1 to the front. The right wall stands on column 8 for two cells (vertices 1 to 3) and ends; a lone stump
 * marks the front corner (a lone vertex is a pier).
 */
const plan = readMap([
  '..........',
  '.CCCCCRRR.',
  '.R......R.',
  '.R......R.',
  '.R........',
  '.R........',
  '.R......R.',
  '..........',
], WALLS);

/**
 * The looks, chosen by hand. Crypt wall (0 whole with the ward rune on its piers, 1 a fallen block and cracks, 2 whole and
 * plain, 3 mossy with a chipped block): the corner keeps its rune, the middle is plain and mossy, the broken run toward the
 * ruin has a fallen block, so the whole wall wears out the way it goes. Ruined wall (0 high top with the rune, 1 tooth on the
 * left with cracks, 2 tooth on the right with a fallen block, 3 low breach with the rune): the back wall breaks into a breach
 * and a tooth, the left wall mixes a high stretch, teeth and a breach so it never repeats at an even step, the right corner is
 * a high tooth and a breach and the stump stands alone.
 */
const walls = withCells(plan, [
  [1, 1, { piece: 'crypt-wall', variant: 0 }],
  [2, 1, { piece: 'crypt-wall', variant: 2 }],
  [3, 1, { piece: 'crypt-wall', variant: 3 }],
  [4, 1, { piece: 'crypt-wall', variant: 0 }],
  [5, 1, { piece: 'crypt-wall', variant: 1 }],
  [6, 1, { piece: 'ruined-wall', variant: 3 }],
  [7, 1, { piece: 'ruined-wall', variant: 1 }],
  [8, 1, { piece: 'ruined-wall', variant: 0 }],
  [1, 2, { piece: 'ruined-wall', variant: 1 }],
  [1, 3, { piece: 'ruined-wall', variant: 3 }],
  [1, 4, { piece: 'ruined-wall', variant: 2 }],
  [1, 5, { piece: 'ruined-wall', variant: 0 }],
  [1, 6, { piece: 'ruined-wall', variant: 1 }],
  [8, 2, { piece: 'ruined-wall', variant: 3 }],
  [8, 3, { piece: 'ruined-wall', variant: 1 }],
  [8, 6, { piece: 'ruined-wall', variant: 2 }],
]);

export const SCENE: SceneData = sceneOf({
  floor: ground,
  walls,
  props: [
    // The vestry door in the whole part of the back wall, on the north edge of cell (2, 1) between the piers of vertices 2 and 3, still shut
    // (the yard behind it is row 0).
    { piece: 'crypt-door', col: 2, row: 1, edge: 'N', state: 'closed' },
    // The altar against the back wall, between two soul candles.
    { piece: 'reliquary', col: 4, row: 1, dir: 0 },
    { piece: 'candle-cluster', col: 3, row: 1, variant: 0 },
    { piece: 'candle-cluster', col: 5, row: 1, variant: 2 },
    { piece: 'candle-cluster', col: 2, row: 3, variant: 1 },
    // Urns: one whole at the altar's right, one smashed in the nave where the roof came down.
    { piece: 'urn', col: 6, row: 1, state: 'whole' },
    { piece: 'urn', col: 6, row: 2, state: 'broken' },
    // The dead tree has come up through the right of the nave, against the gap.
    { piece: 'dead-tree', col: 7, row: 3, variant: 1 },
    // Bones.
    { piece: 'bone-pile', col: 3, row: 4, dir: 3, variant: 1 },
    { piece: 'scattered-bones', col: 5, row: 3, variant: 3 },
    { piece: 'scattered-bones', col: 2, row: 5, variant: 1 },
    { piece: 'scattered-bones', col: 7, row: 2, variant: 0 },
    { piece: 'scattered-bones', col: 7, row: 5, variant: 2 },
    { piece: 'scattered-bones', col: 8, row: 5, variant: 1 },
    // Cracks in the nave floor.
    { piece: 'floor-cracks', col: 4, row: 2, variant: 1 },
    { piece: 'floor-cracks', col: 5, row: 2, variant: 3 },
  ],
});
