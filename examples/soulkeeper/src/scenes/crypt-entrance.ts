/**
 * Crypt entrance (9 × 7 cells of 48 × 36 px): the forecourt of a burial vault. A back wall holds a shut crypt door in its middle
 * and a wall runs down each side to hold the court; flagstones all over, moss creeping in where the stone is damp, and cracks and
 * puddles of soul light where the vault leaks. Two lantern posts flank the door, a lever stands by the right one, the reliquary
 * (a chest, shut) by the left one, free-standing pillars frame the aisle, and two coffins lie by the side walls, one with its lid
 * pushed off. The front is open to the camera.
 *
 * The eye goes: the lit door (lanterns, the ward burning on its leaf, the chest's candle) → down the pillars' aisle to the open
 * coffin glowing on the left. The floor ends exactly under the walls (they stand on the border of the set's cells, the space
 * profile's border placement), and nothing but flagstone touches the open front.
 *
 * Living: the door is a piece of its own on the back wall's north edge of cell (4, 0), between the piers of vertices 4 and 5 (the
 * wall's run ends in them); shut, `navigation` blocks that edge, and the lever, the chest and the door list themselves as
 * interactables with the cells to use them from. The pillars at vertices (3, 4) and (6, 4) are lone piers: the picture says they
 * stand, the navigation (edges only) leaves their corners free.
 *
 * Sizes come from `../space.ts`: the character is 80 tall (a little under two cells), the walls 100 (a little over two cells
 * on screen), the door 92 clear (28 wide between the piers' faces), the aisle 124 clear, a character is about 24 wide.
 */

import type { SceneData } from '@core/volume';
import { readMap, sceneOf, withCells } from './map';

const FLOORS = { f: 'crypt-flags', m: 'moss' };
const WALLS = { W: 'crypt-wall' };

/** Flagstones all over; moss in the corners where it is damp, never on the open front. */
const ground = readMap([
  'fffffffff',
  'fffffffff',
  'fmfffffmf',
  'fmmfffmmf',
  'ffmfffmff',
  'fffffffff',
  'fffffffff',
], FLOORS);

/**
 * The walls are on the VERTICES (10 × 8 for a 9 × 7 court): the back wall on row 0 right across (the door stands on the edge between
 * vertices 4 and 5, which become its piers), the side walls on columns 0 and 9 down to the open front, and two free-standing
 * pillars (a lone vertex is a pier) at vertices (3, 4) and (6, 4), three cells apart, so the aisle is three cells wide with the door's column in the middle.
 */
const plan = readMap([
  'WWWWWWWWWW',
  'W........W',
  'W........W',
  'W........W',
  'W..W..W..W',
  'W........W',
  'W........W',
  'W........W',
], WALLS);

/**
 * The wall's looks, chosen by hand (variant 0 is whole, and the ward rune is burned into its piers; 1 has a fallen block and
 * cracks; 2 is whole and plain; 3 is mossy, with a chipped block and cracks). A vertex draws its pier and half an arm each way.
 * The door's piers (vertices 4 and 5 on the back wall) and the left pillar keep their runes, the door's frame (the lanterns' lamps
 * hang over the piers' faces and hide them from the front); the wear is off to the sides: a fallen block in the back wall left of the door, the cracked right-hand pillar of the aisle and the cracked
 * foot of the right wall. The back wall right of the door is plain. The side walls run north-south: the camera sees only their
 * top and their end, so on a straight stretch the look changes little but the tint; their piers carry the visible ones.
 */
const walls = withCells(plan, [
  [0, 0, { piece: 'crypt-wall', variant: 0 }],
  [1, 0, { piece: 'crypt-wall', variant: 1 }],
  [2, 0, { piece: 'crypt-wall', variant: 2 }],
  [3, 0, { piece: 'crypt-wall', variant: 0 }],
  [4, 0, { piece: 'crypt-wall', variant: 0 }],
  [5, 0, { piece: 'crypt-wall', variant: 0 }],
  [6, 0, { piece: 'crypt-wall', variant: 2 }],
  [7, 0, { piece: 'crypt-wall', variant: 2 }],
  [8, 0, { piece: 'crypt-wall', variant: 3 }],
  [9, 0, { piece: 'crypt-wall', variant: 0 }],
  [0, 1, { piece: 'crypt-wall', variant: 2 }],
  [0, 2, { piece: 'crypt-wall', variant: 0 }],
  [0, 3, { piece: 'crypt-wall', variant: 3 }],
  [0, 4, { piece: 'crypt-wall', variant: 0 }],
  [0, 5, { piece: 'crypt-wall', variant: 2 }],
  [0, 6, { piece: 'crypt-wall', variant: 1 }],
  [0, 7, { piece: 'crypt-wall', variant: 0 }],
  [9, 1, { piece: 'crypt-wall', variant: 0 }],
  [9, 2, { piece: 'crypt-wall', variant: 2 }],
  [9, 3, { piece: 'crypt-wall', variant: 3 }],
  [9, 4, { piece: 'crypt-wall', variant: 1 }],
  [9, 5, { piece: 'crypt-wall', variant: 2 }],
  [9, 6, { piece: 'crypt-wall', variant: 0 }],
  [9, 7, { piece: 'crypt-wall', variant: 3 }],
  [3, 4, { piece: 'crypt-wall', variant: 0 }],
  [6, 4, { piece: 'crypt-wall', variant: 1 }],
]);

export const SCENE: SceneData = sceneOf({
  floor: ground,
  walls,
  props: [
    // The lanterns at the door reach towards it.
    { piece: 'lantern-post', col: 3, row: 1, dir: 2 },
    { piece: 'lantern-post', col: 5, row: 1, dir: 0 },
    // The door: a crypt door on the north edge of cell (4, 0), between the piers of vertices 4 and 5, shut. The lever by the right lantern opens it.
    { piece: 'crypt-door', col: 4, row: 0, edge: 'N', state: 'closed' },
    { piece: 'lever', col: 6, row: 1, dir: 0, state: 'up' },
    // The chest by the left lantern, shut, and a candle cluster by the right wall.
    { piece: 'reliquary', col: 2, row: 1, dir: 0, state: 'shut' },
    { piece: 'candle-cluster', col: 7, row: 4, variant: 1 },
    // Coffins by the side walls: the left one open, the right one shut and turned the other way.
    { piece: 'coffin', col: 1, row: 2, dir: 0, variant: 1 },
    { piece: 'coffin', col: 7, row: 2, dir: 2, variant: 0 },
    // The dead's leavings.
    { piece: 'bone-pile', col: 6, row: 5, dir: 7, variant: 1 },
    { piece: 'scattered-bones', col: 2, row: 5, variant: 0 },
    { piece: 'candle-cluster', col: 1, row: 4, variant: 2, options: { candles: 3 } },
    // Marks on the floor.
    { piece: 'floor-cracks', col: 3, row: 2, variant: 1 },
    { piece: 'floor-cracks', col: 4, row: 3, variant: 3 },
    { piece: 'floor-cracks', col: 7, row: 6, variant: 0 },
    { piece: 'soul-puddle', col: 3, row: 4, variant: 0, options: { glow: 0.55 } },
    { piece: 'soul-puddle', col: 1, row: 6, variant: 2, options: { glow: 0.55 } },
  ],
});
