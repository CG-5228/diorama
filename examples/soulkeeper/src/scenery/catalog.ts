/**
 * The scenery catalog of Soulkeeper: the graveyard kit as an editor and the exporter see it.
 * The viewer's scene painter loads this module (`SCENERY`), `npm run scenery-items` writes one
 * tile set per piece into `sheets/scenery/`, and saved scenes (`SceneData`) name pieces and materials by the ids below.
 *
 * - `pieces`: one `ScenePieceInfo` for every piece of the kit: a kebab-case id, the label shown in
 *   the picker (UI copy is English), its group, how it connects, its variants, its priority (floors)
 *   or what it joins (walls and fences), the material roles its code asks for (every role it reads,
 *   fallbacks included) and its options with the piece's own defaults.
 * - `materials`: the theme's `VOLUMES`, by name.
 * - `defaultMaterials`: which material plays each role. Re-material the kit by overriding a role in a
 *   scene (`materials: { stone: 'sandstone' }`), never by editing a piece.
 * - `grid`, `camera` and `space`: the project's space profile (`../space.ts`, the jrpg preset): 48 × 36 px cells,
 *   walls on cell borders, sizes measured against an 80-unit character.
 *
 * Floors lie over each other by `priority`: dirt (0) under flagstones (1) under moss (2) under bone
 * gravel (3) under murky water (4); the lowest floor lays whole tiles at cell centres and every higher one lays transition
 * tiles at the vertices. Walls and fences connect by edges; the wooden fence joins the iron one (a fence that gives out into
 * timber: the rails meet on the cell's border).
 *
 * Doors (`doors.ts`, and the iron gate in `fences.ts`) are a group of their own: they stand on a cell EDGE between two wall
 * vertices (`{ piece, col, row, edge: 'N' | 'W', state }` in a scene's `props`), cut the wall run there (the walls on either side
 * end in piers, their jambs), face across the edge (S on a north edge, E on a west edge) and have states and clips (guide 05):
 * the crypt door and the iron gate rest 'closed' or 'open' and play `opening` and `closing` (the clips are not named like the
 * states: `scenery-items` writes `<id>--<state>` and `<id>--<clip>` into one namespace), the crypt archway only rests 'open'.
 * Their `nav` (`passableIn: ['open']`, `interact: 'door'`) is what `sceneNavigation` reads: a closed door blocks its edge.
 *
 * Runs of walls and fences get their variety from variants (crypt wall 4, iron fence 4, wooden fence 3): a straight run picks
 * its look per cell, and a scene chooses it by hand where it matters (`SceneCell`). New variants are only ever appended.
 *
 * Props (`props.ts`, `tree.ts`) and decals (`decals.ts`) have no connection: a prop has a footprint on the grid
 * and 1, 4 or 8 facings, a decal lies on the floor layer. Every prop is sized against the character
 * (`SPACE.scale.character`, `PROP_HEIGHT` in `prop-parts.ts`) and its `height` here is that nominal top: a tombstone about
 * 0.63 of a person, the reliquary half, the brazier half, a candle cluster and a bone pile low, a coffin about as long as a
 * person is tall, a lantern post 1.4 and the dead tree 2.5 times a person. Each prop sets its own exported `cell` (sized
 * for the 48 × 36 cells; the default is a wall-height cell) and the two that were standalone assets (`tombstone`,
 * `reliquary`) keep their one-line tile sets in `sheets/props/`: their `asset` (a path under `sheets/`) points there, so `scenery-items` skips them.
 * A prop's footprint turns with its facing (`footprintOf`): the coffin (1 × 2) covers 2 × 1 cells facing east or west; the
 * tombstone, the reliquary and the small props take one cell, the dead tree 2 × 2. Decals fill the 48 × 36 tile.
 *
 * Living pieces (guide 05): a prop can rest in `states` and play `clips` between them (the chest `shut` / `open`, the lever `up` / `down`,
 * the urn `whole` / `broken`; loops on the brazier, the candle cluster, the lantern post and the soul puddle), and every piece says in `nav`
 * what it does to movement (props block unless `blocks: false` or in a `passableIn` state, floors cost `cost`, `interact` lists what a
 * character can use). Clips are named for the action (`opening`, `pull`, `break`), never like a state: a clip and a state share the
 * name of their sheet (`<id>--<name>`). The timing lives in `motion.ts`; the chest in `props.ts`, the lever and the urn in `interactables.ts`.
 *
 * Adding a piece: write it in `floors.ts`, `walls.ts`, `fences.ts`, `props.ts` or `decals.ts` (or a new file here),
 * list it here with a group, roles and defaults, then run `npm run scenery-items -- soulkeeper`.
 */

import type { PieceOption, SceneryCatalog, ScenePieceInfo } from '@core/volume';
import { VOLUMES } from '../theme';
import { SPACE } from '../space';
import { FLOOR_LOOKS, FLOOR_PRIORITY, FLOOR_VARIANTS, boneGravel, cryptFlags, graveDirt, moss } from './floors';
import { IRON_FENCE_LOOKS, IRON_GATE_CELL, IRON_GATE_CLIPS, IRON_GATE_LOOKS, IRON_GATE_TOP, WOOD_FENCE_LOOKS, ironFence, ironGate, woodFence } from './fences';
import { WALL_LOOKS, cryptWall } from './walls';
import { CRYPT_ARCHWAY_CELL, CRYPT_ARCHWAY_LOOKS, CRYPT_DOOR_CELL, CRYPT_DOOR_CLIPS, CRYPT_DOOR_LOOKS, cryptArchway, cryptDoor } from './doors';
import { ruinedWall } from './ruins';
import { WATER_LOOKS, WATER_PRIORITY, WATER_VARIANTS, murkyWater } from './water';
import { DECAL_CELL, PUDDLE_CLIPS, floorCracks, scatteredBones, soulPuddle } from './decals';
import { TREE_CELL, TREE_TRUNK, deadTree } from './tree';
import { propHeight } from './prop-parts';
import { LEVER_CELL, LEVER_CLIPS, URN_CELL, URN_CLIPS, lever, urn } from './interactables';
import { BRAZIER_CELL, COFFIN_CELL, POST_CELL, POST_POLE, RELIQUARY_CELL, RELIQUARY_CLIPS, SMALL_CELL, TOMBSTONE_CELL, BRAZIER_CLIPS, CANDLE_CLIPS, POST_CLIPS, bonePile, candleCluster, coffin, lanternPost, reliquary, soulBrazier, tombstone } from './props';

// ----------------------------------------------------------------------------------------------
// Option builders: the piece's own default goes in, a range an editor can sweep comes with it.
// ----------------------------------------------------------------------------------------------

const num = (key: string, label: string, def: number, min: number, max: number, step = 0.05): PieceOption => ({ key, label, type: 'number', default: def, min, max, step });
const flag = (key: string, label: string, def = true): PieceOption => ({ key, label, type: 'boolean', default: def });

/** The kit's grid: the space profile's (cells 48 × 36 px on the project's camera; tiles are 96 × 72 at scale 2). */
export const GRID = SPACE.grid;

// ----------------------------------------------------------------------------------------------
// Pieces
// ----------------------------------------------------------------------------------------------

const PIECES: ScenePieceInfo[] = [
  // Floors: dual-grid, a whole tile at mask 15 and transitions at 1-14.
  {
    id: 'grave-dirt', label: 'Grave dirt', group: 'floor', piece: graveDirt, connect: 'corners', variants: FLOOR_VARIANTS.dirt, variantLabels: [...FLOOR_LOOKS.dirt], priority: FLOOR_PRIORITY.dirt, roles: ['dirt'],
    options: [num('pebbles', 'Stones', 1, 0, 2, 0.25)],
    nav: { cost: 1 },
  },
  {
    id: 'crypt-flags', label: 'Crypt flagstones', group: 'floor', piece: cryptFlags, connect: 'corners', variants: FLOOR_VARIANTS.flags, variantLabels: [...FLOOR_LOOKS.flags], priority: FLOOR_PRIORITY.flags, roles: ['flagstone', 'stone', 'mortar'],
    options: [num('wear', 'Wear', 1, 0, 1.5, 0.25)],
    nav: { cost: 1 },
  },
  {
    id: 'moss', label: 'Moss and dry grass', group: 'floor', piece: moss, connect: 'corners', variants: FLOOR_VARIANTS.moss, variantLabels: [...FLOOR_LOOKS.moss], priority: FLOOR_PRIORITY.moss, roles: ['moss'],
    options: [num('tufts', 'Edge tufts', 1, 0.5, 1.6, 0.1)],
    nav: { cost: 1 },
  },
  {
    id: 'bone-gravel', label: 'Bone gravel', group: 'floor', piece: boneGravel, connect: 'corners', variants: FLOOR_VARIANTS.gravel, variantLabels: [...FLOOR_LOOKS.gravel], priority: FLOOR_PRIORITY.gravel, roles: ['gravel', 'bone'],
    options: [num('bones', 'Bones', 1, 0, 2, 0.5)],
    nav: { cost: 1 },
  },
  {
    id: 'murky-water', label: 'Murky water', group: 'floor', piece: murkyWater, connect: 'corners', variants: WATER_VARIANTS, variantLabels: [...WATER_LOOKS], priority: WATER_PRIORITY, roles: ['water', 'glow'],
    options: [num('ripples', 'Ripples', 1, 0, 2, 0.5), num('glints', 'Soul glints', 1, 0, 2, 0.5)],
    // Flooded flagstones: shallow, and slow to wade through (a floor that blocks, `blocks: true`, would be deep water).
    nav: { cost: 3 },
  },
  // Walls: edge masks, a pier where the wall turns, ends or branches.
  {
    id: 'crypt-wall', label: 'Crypt wall', group: 'wall', piece: cryptWall, connect: 'edges', variants: WALL_LOOKS.length, variantLabels: [...WALL_LOOKS], roles: ['stone', 'mortar', 'moss', 'glow'],
    heights: ['wall', 'fence'],
    options: [flag('moss', 'Moss')],
    joins: ['iron-fence'],
  },
  // The same wall in ruins: an uneven, broken top and fallen stones; it joins the crypt wall (which joins it back).
  {
    id: 'ruined-wall', label: 'Ruined wall', group: 'wall', piece: ruinedWall, connect: 'edges', variants: 4, variantLabels: ['Tall top in the middle, with a rune', 'Tooth on the left, cracked', 'Tooth on the right, fallen block', 'Low gap, with a rune'], roles: ['stone', 'mortar', 'moss', 'glow'],
    heights: ['wall'],
    options: [num('rubble', 'Rubble', 1, 0, 2, 0.25), flag('moss', 'Moss')],
    joins: ['crypt-wall'],
  },
  // Fences: a post at every vertex (walls stand on cell borders) and an arm towards each connected edge.
  {
    id: 'iron-fence', label: 'Iron fence', group: 'fence', piece: ironFence, connect: 'edges', variants: IRON_FENCE_LOOKS.length, variantLabels: [...IRON_FENCE_LOOKS], roles: ['metal', 'stone', 'mortar', 'glow'],
    heights: ['fence', 'wall'],
    options: [flag('spikes', 'Spear tips')],
    joins: ['crypt-wall'],
  },
  {
    id: 'wood-fence', label: 'Wooden fence', group: 'fence', piece: woodFence, connect: 'edges', variants: WOOD_FENCE_LOOKS.length, variantLabels: [...WOOD_FENCE_LOOKS], roles: ['wood', 'glow'],
    heights: ['fence'],
    joins: ['iron-fence'],
  },
  // Doors: stand on a cell edge between two wall vertices (the run is cut there: the walls end in piers), face across it (S on a
  // north edge, E on a west edge); states and clips from `doors.ts`.
  {
    id: 'crypt-door', label: 'Crypt door', group: 'door', piece: cryptDoor, connect: 'none', height: 'wall', variantLabels: [...CRYPT_DOOR_LOOKS], directions: 4, roles: ['stone', 'mortar', 'darkwood', 'metal', 'glow'], cell: CRYPT_DOOR_CELL,
    options: [flag('ward', 'Ward rune')],
    states: ['closed', 'open'], clips: CRYPT_DOOR_CLIPS, nav: { passableIn: ['open'], interact: 'door' }, joins: ['crypt-wall'],
  },
  // A passage that never closes: a door with the one state 'open' and no clips.
  {
    id: 'crypt-archway', label: 'Crypt archway', group: 'door', piece: cryptArchway, connect: 'none', height: 'wall', variantLabels: [...CRYPT_ARCHWAY_LOOKS], directions: 4, roles: ['stone', 'mortar', 'glow'], cell: CRYPT_ARCHWAY_CELL,
    options: [flag('ward', 'Ward rune')],
    states: ['open'], nav: { passableIn: ['open'] }, joins: ['crypt-wall'],
  },
  // The iron gate was a fence piece; it is a door now (the fence's runs end in posts at its edge), its old ajar look became the state 'open'.
  {
    id: 'iron-gate', label: 'Iron gate', group: 'door', piece: ironGate, connect: 'none', height: IRON_GATE_TOP, variantLabels: [...IRON_GATE_LOOKS], directions: 4, roles: ['metal', 'stone', 'mortar', 'glow'], cell: IRON_GATE_CELL,
    options: [flag('lantern', "Will-o'-wisp lantern")],
    states: ['closed', 'open'], clips: IRON_GATE_CLIPS, nav: { passableIn: ['open'], interact: 'door' }, joins: ['iron-fence'],
  },
  // Props: no connection; a footprint on the grid, facings where the front differs from the back.
  {
    id: 'tombstone', label: 'Tombstone', group: 'prop', piece: tombstone, height: propHeight('tombstone'), connect: 'none', variantLabels: ['Gothic arch'], directions: 4, roles: ['stone', 'bone', 'moss'], cell: TOMBSTONE_CELL, asset: 'props/tombstone',
    options: [
      { key: 'emblem', label: 'Carving', type: 'select', default: 'skull', choices: [{ value: 'skull', label: 'Skull with lit eyes' }, { value: 'cross', label: 'Cross' }, { value: 'none', label: 'Plain' }] },
      flag('candle', 'Soul candle'),
      flag('moss', 'Moss on the pedestal', false),
    ],
    nav: { blocks: true },
  },
  {
    id: 'reliquary', label: 'Reliquary', group: 'prop', piece: reliquary, height: propHeight('reliquary'), connect: 'none', variantLabels: ['Skull lock'], directions: 8, roles: ['darkwood', 'metal', 'bone', 'glow'], cell: RELIQUARY_CELL, asset: 'props/reliquary',
    states: ['shut', 'open'], clips: RELIQUARY_CLIPS, nav: { interact: 'chest', interactIn: ['shut'] },
  },
  {
    id: 'candle-cluster', label: 'Soul candles', group: 'prop', piece: candleCluster, height: propHeight('candles'), connect: 'none', variants: 3, variantLabels: ['One tall in the center', 'Two tall', 'Low and close together'], roles: ['bone', 'glow'], cell: SMALL_CELL,
    options: [num('candles', 'Candles', 5, 1, 5, 1), num('glow', 'Floor glow', 0.28, 0, 0.6, 0.02)],
    // Burning candles on a pool of wax: nobody walks through the flames.
    nav: { blocks: true }, clips: CANDLE_CLIPS,
  },
  {
    id: 'bone-pile', label: 'Bone pile', group: 'prop', piece: bonePile, height: propHeight('bones'), connect: 'none', variants: 2, variantLabels: ['Crossed bones', 'Rib cage'], directions: 8, roles: ['bone', 'glow'], cell: SMALL_CELL,
    options: [flag('skull', 'Skull'), flag('candle', 'Soul candle stub'), flag('sparks', 'Sparks in the eye sockets')],
    // Knee high and flat: a character steps over the bones (the nominal height is 0.19 of its own).
    nav: { blocks: false },
  },
  {
    id: 'soul-brazier', label: 'Soul brazier', group: 'prop', piece: soulBrazier, height: propHeight('brazier'), connect: 'none', variants: 2, variantLabels: ['Lit fire', 'Embers'], roles: ['metal', 'glow'], cell: BRAZIER_CELL,
    options: [num('fire', 'Fire', 1, 0.3, 1.2, 0.1), num('glow', 'Floor glow', 0.3, 0, 0.6, 0.02)],
    nav: { blocks: true }, clips: BRAZIER_CLIPS,
  },
  {
    id: 'lantern-post', label: 'Lantern post', group: 'prop', piece: lanternPost, height: propHeight('post'), connect: 'none', variantLabels: ['Iron post'], directions: 4, roles: ['metal', 'stone', 'glow'], cell: POST_CELL,
    options: [num('height', 'Post height', Math.round(POST_POLE), Math.round(POST_POLE * 0.7), Math.round(POST_POLE * 1.25), 2), num('glow', 'Floor glow', 0.3, 0, 0.6, 0.02)],
    nav: { blocks: true }, clips: POST_CLIPS,
  },
  {
    id: 'dead-tree', label: 'Dead tree', group: 'prop', piece: deadTree, height: propHeight('tree'), connect: 'none', variants: 3, variantLabels: ['Spreading branches', 'Tall and slender', 'Crooked, long branch'], footprint: [2, 2], roles: ['wood', 'moss', 'glow'], cell: TREE_CELL,
    options: [num('trunk', 'Trunk height', TREE_TRUNK.default, TREE_TRUNK.min, TREE_TRUNK.max, 2), flag('hollow', 'Hollow with soul lights'), flag('moss', 'Moss')],
    nav: { blocks: true },
  },
  {
    id: 'coffin', label: 'Coffin', group: 'prop', piece: coffin, height: propHeight('coffin'), connect: 'none', variants: 2, variantLabels: ['Closed', 'Lid slid aside'], footprint: [1, 2], directions: 4, roles: ['darkwood', 'metal', 'bone', 'glow'], cell: COFFIN_CELL,
    options: [num('ajar', 'Lid slid aside', 1, 0, 1.2, 0.1)],
    nav: { blocks: true },
  },
  // Pieces a character uses: states, clips between them and `nav.interact` (guide 05). Clips are named for the action (`pull`, `break`), never the state they end in.
  {
    id: 'lever', label: 'Lever', group: 'prop', piece: lever, height: propHeight('lever'), connect: 'none', variantLabels: ['Iron lever with soul gems'], directions: 4, roles: ['stone', 'metal', 'darkwood', 'glow'], cell: LEVER_CELL,
    options: [num('glow', 'Floor glow', 0.3, 0, 0.6, 0.02)],
    states: ['up', 'down'], clips: LEVER_CLIPS, nav: { interact: 'lever' },
  },
  {
    id: 'urn', label: 'Funerary urn', group: 'prop', piece: urn, height: propHeight('urn'), connect: 'none', variantLabels: ['Glazed, with a ward rune'], roles: ['ceramic', 'metal', 'bone', 'stone', 'glow'], cell: URN_CELL,
    options: [num('glow', 'Soul light', 1, 0, 1.5, 0.1)],
    // Blocks until it is broken: a character walks over the shards.
    states: ['whole', 'broken'], clips: URN_CLIPS, nav: { passableIn: ['broken'], interact: 'break', interactIn: ['whole'] },
  },
  // Decals: marks on the floor layer, under everything else; one facing, several looks.
  {
    id: 'floor-cracks', label: 'Cracks', group: 'decal', piece: floorCracks, connect: 'none', variants: 4, variantLabels: ['Horizontal crack', 'Diagonal crack', 'Short crack', 'Soul light seeping out'], roles: ['glow'], cell: DECAL_CELL,
    options: [num('width', 'Width', 1.6, 0.8, 2.4, 0.1), num('glow', 'Soul light (variant 4)', 0.8, 0, 1.5, 0.1)],
    // Decals lie on the floor and never block.
    nav: { blocks: false },
  },
  {
    id: 'scattered-bones', label: 'Scattered bones', group: 'decal', piece: scatteredBones, connect: 'none', variants: 4, variantLabels: ['Long bone', 'Ribs and vertebrae', 'Two long bones', 'Skull and bone'], roles: ['bone', 'glow'], cell: DECAL_CELL,
    options: [num('pieces', 'Pieces', 7, 1, 7, 1)],
    nav: { blocks: false },
  },
  {
    id: 'soul-puddle', label: 'Soul puddle', group: 'decal', piece: soulPuddle, connect: 'none', variants: 3, variantLabels: ['Round', 'Long', 'Two puddles'], roles: ['glow'], cell: DECAL_CELL,
    options: [num('glow', 'Glow', 0.8, 0, 1.2, 0.05)],
    nav: { blocks: false }, clips: PUDDLE_CLIPS,
  },
];

export const SCENERY: SceneryCatalog = {
  pieces: PIECES,
  materials: VOLUMES,
  defaultMaterials: {
    dirt: 'dirt',
    flagstone: 'flagstone',
    stone: 'stone',
    mortar: 'mortar',
    moss: 'moss',
    gravel: 'gravel',
    water: 'water',
    metal: 'iron',
    wood: 'timber',
    darkwood: 'wood',
    bone: 'bone',
    ceramic: 'ceramic',
    glow: 'soul',
  },
  grid: SPACE.grid,
  camera: SPACE.camera,
  space: SPACE,
};
