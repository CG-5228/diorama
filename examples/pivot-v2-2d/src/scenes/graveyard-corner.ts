/**
 * Graveyard corner (10 × 8 cells of 48 × 36 px): the far corner of a churchyard, seen from the camera. An iron fence runs
 * along the back and down the left side, on the border of the set's cells (the space profile's border placement), and a gate
 * in the back fence (a door of the kit, one cell wide, shut: the fence's runs end in posts on either side of it) closes the
 * end of a flagstone path; the path goes down to a landing at the brazier and an arm leaves to the right. At the back fence's right end the iron gives out into two cells of rotten timber that close the
 * corner. Grave dirt everywhere, moss round the dead tree and where it is damp, a small bed of bone gravel at the end of
 * the path's right arm where the bone pile lies, tombstones in two rows, soul candles at their feet, bones in the dirt, an urn
 * left at a grave and another smashed beside the cross at the front, a brazier at the landing and lantern posts at the gate.
 *
 * Living: the gate is an interactable door (shut, so `navigation` blocks its edge until a game opens it: `sceneNavigation(SCENE,
 * SCENERY, { open: { 0: true } })`), the whole urn blocks its cell and the smashed one does not.
 *
 * The eye goes: gate lanterns → down the path → the brazier at the landing, lit against the tombstone rows, with the dead tree's
 * tall crown breaking the horizon on the left. The right side and the front stay open (breathing room): the floor ends where
 * the fence does, under it, and at the open sides where the set does.
 *
 * Sizes come from `../space.ts`: the character is 80 tall, the fence 44 (about waist-high), the gate 92 (the character's head
 * and a little more), a cell 48 wide; a tombstone is about 0.6 of a character.
 */

import type { SceneData } from '@core/volume';
import { readMap, sceneOf, withCells } from './map';

const FLOORS = { d: 'grave-dirt', f: 'crypt-flags', m: 'moss', g: 'bone-gravel' };
const WALLS = { F: 'iron-fence', T: 'wood-fence' };

/**
 * Dirt, a flagstone path two cells wide from the gate down to a landing, moss where it is damp and a gravel bed by the bone
 * pile. Nothing but dirt touches the open edges of the set, so the floors do not spill over them; the one exception is the path
 * at the gate, whose rough edge lies behind the gate and the fence.
 */
const ground = readMap([
  'ddddffdddd',
  'dmddffdddd',
  'dmmmffdddd',
  'dmmdffdggd',
  'ddfffffggd',
  'dddffffddd',
  'dddddddddd',
  'dddddddddd',
], FLOORS);

/**
 * The fences are on the VERTICES (11 × 9 for a 10 × 8 yard): the back fence on row 0 and the left fence on column 0 down to
 * the front. The gate is not a vertex: it is a door on the north edge of cell (5, 0), between the fence posts of vertices 5 and 6
 * (the fence runs end in those posts), so the fence closes the path's left lane and the gate shuts its right one. The back fence's last three vertices
 * (8 to 10, two cells) are rotten timber. The wooden fence joins the iron one (catalog `joins`), so the run goes on with no
 * gap: the rails meet on the cell's border and the two fences are the same height (44), so the join reads as a repair.
 */
const plan = readMap([
  'FFFFFFFFTTT',
  'F..........',
  'F..........',
  'F..........',
  'F..........',
  'F..........',
  'F..........',
  'F..........',
  'F..........',
], WALLS);

/**
 * The fences' looks, chosen by hand (iron: variant 0 whole with the ward rune on its post, 1 bent bars and one gone,
 * 2 whole and plain, 3 a single bent bar; timber: 0 whole with a rune, 1 snapped pickets and one gone, 2 uneven and plain).
 * A vertex draws its post and half an arm each way, so a look shows on both halves. The runes flank the gate and mark the back
 * corner, so the entrance is the one place the fence speaks; the damage sits where it would: behind the dead tree, whose roots
 * push at it, and along the quiet right end, with a plain post now and then between. The pattern never repeats at an even step,
 * so the run does not print a rhythm. The timber past the gap is the worst of it.
 */
const fences = withCells(plan, [
  [0, 0, { piece: 'iron-fence', variant: 0 }],
  [1, 0, { piece: 'iron-fence', variant: 2 }],
  [2, 0, { piece: 'iron-fence', variant: 1 }],
  [3, 0, { piece: 'iron-fence', variant: 2 }],
  [4, 0, { piece: 'iron-fence', variant: 0 }],
  [5, 0, { piece: 'iron-fence', variant: 0 }],
  [6, 0, { piece: 'iron-fence', variant: 0 }],
  [7, 0, { piece: 'iron-fence', variant: 3 }],
  [8, 0, { piece: 'wood-fence', variant: 1 }],
  [9, 0, { piece: 'wood-fence', variant: 2 }],
  [10, 0, { piece: 'wood-fence', variant: 1 }],
  [0, 1, { piece: 'iron-fence', variant: 1 }],
  [0, 2, { piece: 'iron-fence', variant: 2 }],
  [0, 3, { piece: 'iron-fence', variant: 3 }],
  [0, 4, { piece: 'iron-fence', variant: 1 }],
  [0, 5, { piece: 'iron-fence', variant: 0 }],
  [0, 6, { piece: 'iron-fence', variant: 2 }],
  [0, 7, { piece: 'iron-fence', variant: 3 }],
  [0, 8, { piece: 'iron-fence', variant: 2 }],
]);

export const SCENE: SceneData = sceneOf({
  floor: ground,
  walls: fences,
  props: [
    // The gate: a door on the north edge of cell (5, 0), between the fence posts of vertices 5 and 6, shut (state 'open' lets the path
    // through). It is one cell wide: the fence's post at vertex 4 and its arm over cell 4 close the path's left lane.
    { piece: 'iron-gate', col: 5, row: 0, edge: 'N', state: 'closed' },
    // The lanterns on the path's sides face it (arm towards it): the one on its left reaches right, the one on its right reaches left.
    { piece: 'lantern-post', col: 3, row: 2, dir: 2 },
    { piece: 'lantern-post', col: 6, row: 2, dir: 0 },
    // The dead tree, tall at the back left (2 × 2 cells).
    { piece: 'dead-tree', col: 1, row: 1, variant: 1 },
    // Tombstones: most face the camera and one is turned to face the path (west), with candles at their feet.
    { piece: 'tombstone', col: 1, row: 4, options: { moss: true } },
    { piece: 'tombstone', col: 7, row: 2 },
    { piece: 'tombstone', col: 7, row: 5, dir: 1 },
    { piece: 'tombstone', col: 2, row: 6, options: { emblem: 'cross', candle: false } },
    { piece: 'tombstone', col: 8, row: 7, options: { emblem: 'cross', moss: true } },
    { piece: 'candle-cluster', col: 5, row: 7, variant: 0 },
    { piece: 'candle-cluster', col: 9, row: 5, variant: 2 },
    // Urns left at the graves: one whole by the tombstone on the right, one smashed beside the cross at the front left.
    { piece: 'urn', col: 8, row: 2, state: 'whole' },
    { piece: 'urn', col: 3, row: 6, state: 'broken' },
    // The brazier on the landing.
    { piece: 'soul-brazier', col: 4, row: 5, variant: 0 },
    { piece: 'bone-pile', col: 9, row: 3, dir: 5, variant: 0 },
    // Marks on the ground.
    { piece: 'scattered-bones', col: 3, row: 3, variant: 3 },
    { piece: 'scattered-bones', col: 6, row: 7, variant: 1 },
    { piece: 'floor-cracks', col: 4, row: 2, variant: 0 },
    { piece: 'floor-cracks', col: 3, row: 4, variant: 2 },
    { piece: 'soul-puddle', col: 1, row: 6, variant: 2 },
  ],
});
