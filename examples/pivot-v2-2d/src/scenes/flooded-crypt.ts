/**
 * Flooded crypt (10 × 8 cells of 48 × 36 px): a burial chamber whose floor has sunk into a pool of murky water, with a bed of
 * bone gravel where the water has left it. The room is enclosed on its border (the space profile's border placement): the back
 * wall holds a crypt door standing open on the next chamber (one cell wide, between the piers of vertices 4 and 5), the side walls
 * are whole height and the front is a LOW wall (the crypt wall at the fence's height, 44) with a doorway two vertices wide, so the
 * whole room stays visible over it. A coffin stands in the shallows with its lid pushed off, a lantern post lights the gravel,
 * soul candles burn on the dry stone, two urns stand on it (one whole by the lantern, one smashed against the left wall), bones
 * lie about and the stone is cracked.
 *
 * The eye goes: the pool's dark middle → the open coffin → the lantern's light on the gravel to the right, the dark of the open
 * door at the top as the way on. The floor ends exactly under the walls all round; the front row lies behind the low wall, so it
 * carries only marks on the floor.
 *
 * Living: the back door is open, so `navigation` leaves its edge free (the walk from the front doorway to it goes round the pool,
 * which costs 3 a cell to wade); the whole urn blocks its cell, the smashed one does not. The low front wall blocks its edges like
 * any wall (waist-high, 44).
 *
 * Sizes come from `../space.ts`: the character is 80 tall, the full wall 100, the low wall 44 (about waist-high), the door 92.
 */

import type { SceneData } from '@core/volume';
import { readMap, sceneOf, withCells } from './map';

const FLOORS = { f: 'crypt-flags', w: 'murky-water', g: 'bone-gravel' };
const WALLS = { W: 'crypt-wall' };

/** Flagstones all round; the pool in the middle (rows 2 to 6), the bone gravel on its right bank. */
const ground = readMap([
  'ffffffffff',
  'ffffffffff',
  'fffwwwffgf',
  'ffwwwwwggf',
  'ffwwwwwwgf',
  'fffwwwwfff',
  'ffffwwffff',
  'ffffffffff',
], FLOORS);

/**
 * The walls are on the VERTICES (11 × 9 for a 10 × 8 room): the back wall on row 0 right across (the door stands on the edge between
 * vertices 4 and 5, its piers), whole-height side walls on columns 0 and 10, and on the front row (8) tall corner piers, a low wall
 * (rows of `L`, set to the fence's height below) and a doorway two vertices wide (4 and 5).
 */
const plan = readMap([
  'WWWWWWWWWWW',
  'W.........W',
  'W.........W',
  'W.........W',
  'W.........W',
  'W.........W',
  'W.........W',
  'W.........W',
  'WLLL..LLLLW',
], { ...WALLS, L: { piece: 'crypt-wall', height: 'fence' } });

/** A low crypt wall of the given look. */
const low = (variant: number) => ({ piece: 'crypt-wall', variant, height: 'fence' as const });

/**
 * The looks, chosen by hand (0 whole with the ward rune on its piers, 1 a fallen block and cracks, 2 whole and plain, 3 mossy,
 * with a chipped block and cracks). The back door's piers (vertices 4 and 5) keep their runes; the wear sits low and along the sides,
 * where the water has been at the stone: mossy and cracked blocks near the front, a fallen block left of the back door.
 * The side walls run north-south, so the camera sees little but their tops and the piers carry the visible looks.
 */
const walls = withCells(plan, [
  [0, 0, { piece: 'crypt-wall', variant: 0 }],
  [1, 0, { piece: 'crypt-wall', variant: 1 }],
  [2, 0, { piece: 'crypt-wall', variant: 2 }],
  [3, 0, { piece: 'crypt-wall', variant: 3 }],
  [4, 0, { piece: 'crypt-wall', variant: 0 }],
  [5, 0, { piece: 'crypt-wall', variant: 0 }],
  [6, 0, { piece: 'crypt-wall', variant: 2 }],
  [7, 0, { piece: 'crypt-wall', variant: 1 }],
  [8, 0, { piece: 'crypt-wall', variant: 2 }],
  [9, 0, { piece: 'crypt-wall', variant: 3 }],
  [10, 0, { piece: 'crypt-wall', variant: 0 }],
  [0, 1, { piece: 'crypt-wall', variant: 2 }],
  [0, 2, { piece: 'crypt-wall', variant: 1 }],
  [0, 3, { piece: 'crypt-wall', variant: 3 }],
  [0, 4, { piece: 'crypt-wall', variant: 0 }],
  [0, 5, { piece: 'crypt-wall', variant: 2 }],
  [0, 6, { piece: 'crypt-wall', variant: 1 }],
  [0, 7, { piece: 'crypt-wall', variant: 2 }],
  [0, 8, { piece: 'crypt-wall', variant: 0 }],
  [10, 1, { piece: 'crypt-wall', variant: 0 }],
  [10, 2, { piece: 'crypt-wall', variant: 1 }],
  [10, 3, { piece: 'crypt-wall', variant: 2 }],
  [10, 4, { piece: 'crypt-wall', variant: 3 }],
  [10, 5, { piece: 'crypt-wall', variant: 0 }],
  [10, 6, { piece: 'crypt-wall', variant: 2 }],
  [10, 7, { piece: 'crypt-wall', variant: 1 }],
  [10, 8, { piece: 'crypt-wall', variant: 0 }],
  [1, 8, low(2)],
  [2, 8, low(3)],
  [3, 8, low(0)],
  [6, 8, low(0)],
  [7, 8, low(1)],
  [8, 8, low(2)],
  [9, 8, low(3)],
]);

export const SCENE: SceneData = sceneOf({
  floor: ground,
  walls,
  props: [
    // The back door: a crypt door on the north edge of cell (4, 0), between the piers of vertices 4 and 5, standing open on the next chamber.
    { piece: 'crypt-door', col: 4, row: 0, edge: 'N', state: 'open' },
    // The coffin in the shallows, lid pushed off.
    { piece: 'coffin', col: 5, row: 4, dir: 0, variant: 1 },
    // The lantern lights the gravel.
    { piece: 'lantern-post', col: 7, row: 2, dir: 0 },
    // Soul candles on the dry stone.
    { piece: 'candle-cluster', col: 3, row: 1, variant: 0 },
    { piece: 'candle-cluster', col: 7, row: 6, variant: 2 },
    { piece: 'candle-cluster', col: 1, row: 4, variant: 1 },
    // Urns on the dry stone: one whole by the lantern's side, one smashed against the left wall.
    { piece: 'urn', col: 8, row: 1, state: 'whole' },
    { piece: 'urn', col: 1, row: 2, state: 'broken' },
    // Bones.
    { piece: 'bone-pile', col: 1, row: 6, dir: 2, variant: 1 },
    { piece: 'scattered-bones', col: 8, row: 5, variant: 1 },
    { piece: 'scattered-bones', col: 2, row: 1, variant: 0 },
    // Cracks in the stone.
    { piece: 'floor-cracks', col: 5, row: 1, variant: 0 },
    { piece: 'floor-cracks', col: 8, row: 6, variant: 3 },
    { piece: 'floor-cracks', col: 3, row: 7, variant: 2 },
  ],
});
