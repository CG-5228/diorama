/**
 * The scenery catalog of pivot-v2-2d: the graveyard kit as an editor and the exporter see it.
 * The viewer's scene painter loads this module (`SCENERY`), `npm run scenery-items` writes one
 * tile set per piece into `sheets/scenery/`, and saved scenes (`SceneData`) name pieces and materials by the ids below.
 *
 * - `pieces`: one `ScenePieceInfo` for every piece of the kit: a kebab-case id, the label shown in
 *   the picker (UI copy is pt-BR), its group, how it connects, its variants, its priority (floors)
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
 * list it here with a group, roles and defaults, then run `npm run scenery-items -- pivot-v2-2d`.
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
    id: 'grave-dirt', label: 'Terra de sepultura', group: 'floor', piece: graveDirt, connect: 'corners', variants: FLOOR_VARIANTS.dirt, variantLabels: [...FLOOR_LOOKS.dirt], priority: FLOOR_PRIORITY.dirt, roles: ['dirt'],
    options: [num('pebbles', 'Pedras', 1, 0, 2, 0.25)],
    nav: { cost: 1 },
  },
  {
    id: 'crypt-flags', label: 'Lajes da cripta', group: 'floor', piece: cryptFlags, connect: 'corners', variants: FLOOR_VARIANTS.flags, variantLabels: [...FLOOR_LOOKS.flags], priority: FLOOR_PRIORITY.flags, roles: ['flagstone', 'stone', 'mortar'],
    options: [num('wear', 'Desgaste', 1, 0, 1.5, 0.25)],
    nav: { cost: 1 },
  },
  {
    id: 'moss', label: 'Musgo e capim seco', group: 'floor', piece: moss, connect: 'corners', variants: FLOOR_VARIANTS.moss, variantLabels: [...FLOOR_LOOKS.moss], priority: FLOOR_PRIORITY.moss, roles: ['moss'],
    options: [num('tufts', 'Tufos na borda', 1, 0.5, 1.6, 0.1)],
    nav: { cost: 1 },
  },
  {
    id: 'bone-gravel', label: 'Cascalho de ossos', group: 'floor', piece: boneGravel, connect: 'corners', variants: FLOOR_VARIANTS.gravel, variantLabels: [...FLOOR_LOOKS.gravel], priority: FLOOR_PRIORITY.gravel, roles: ['gravel', 'bone'],
    options: [num('bones', 'Ossos', 1, 0, 2, 0.5)],
    nav: { cost: 1 },
  },
  {
    id: 'murky-water', label: 'Água turva', group: 'floor', piece: murkyWater, connect: 'corners', variants: WATER_VARIANTS, variantLabels: [...WATER_LOOKS], priority: WATER_PRIORITY, roles: ['water', 'glow'],
    options: [num('ripples', 'Ondas', 1, 0, 2, 0.5), num('glints', 'Brilhos de alma', 1, 0, 2, 0.5)],
    // Flooded flagstones: shallow, and slow to wade through (a floor that blocks, `blocks: true`, would be deep water).
    nav: { cost: 3 },
  },
  // Walls: edge masks, a pier where the wall turns, ends or branches.
  {
    id: 'crypt-wall', label: 'Muro da cripta', group: 'wall', piece: cryptWall, connect: 'edges', variants: WALL_LOOKS.length, variantLabels: [...WALL_LOOKS], roles: ['stone', 'mortar', 'moss', 'glow'],
    heights: ['wall', 'fence'],
    options: [flag('moss', 'Musgo')],
    joins: ['iron-fence'],
  },
  // The same wall in ruins: an uneven, broken top and fallen stones; it joins the crypt wall (which joins it back).
  {
    id: 'ruined-wall', label: 'Muro em ruínas', group: 'wall', piece: ruinedWall, connect: 'edges', variants: 4, variantLabels: ['Topo alto no meio, com runa', 'Dente à esquerda, rachado', 'Dente à direita, bloco caído', 'Brecha baixa, com runa'], roles: ['stone', 'mortar', 'moss', 'glow'],
    heights: ['wall'],
    options: [num('rubble', 'Entulho', 1, 0, 2, 0.25), flag('moss', 'Musgo')],
    joins: ['crypt-wall'],
  },
  // Fences: a post at every vertex (walls stand on cell borders) and an arm towards each connected edge.
  {
    id: 'iron-fence', label: 'Grade de ferro', group: 'fence', piece: ironFence, connect: 'edges', variants: IRON_FENCE_LOOKS.length, variantLabels: [...IRON_FENCE_LOOKS], roles: ['metal', 'stone', 'mortar', 'glow'],
    heights: ['fence', 'wall'],
    options: [flag('spikes', 'Pontas de lança')],
    joins: ['crypt-wall'],
  },
  {
    id: 'wood-fence', label: 'Cerca de madeira', group: 'fence', piece: woodFence, connect: 'edges', variants: WOOD_FENCE_LOOKS.length, variantLabels: [...WOOD_FENCE_LOOKS], roles: ['wood', 'glow'],
    heights: ['fence'],
    joins: ['iron-fence'],
  },
  // Doors: stand on a cell edge between two wall vertices (the run is cut there: the walls end in piers), face across it (S on a
  // north edge, E on a west edge); states and clips from `doors.ts`.
  {
    id: 'crypt-door', label: 'Porta da cripta', group: 'door', piece: cryptDoor, connect: 'none', height: 'wall', variantLabels: [...CRYPT_DOOR_LOOKS], directions: 4, roles: ['stone', 'mortar', 'darkwood', 'metal', 'glow'], cell: CRYPT_DOOR_CELL,
    options: [flag('ward', 'Runa de proteção')],
    states: ['closed', 'open'], clips: CRYPT_DOOR_CLIPS, nav: { passableIn: ['open'], interact: 'door' }, joins: ['crypt-wall'],
  },
  // A passage that never closes: a door with the one state 'open' and no clips.
  {
    id: 'crypt-archway', label: 'Arco da cripta', group: 'door', piece: cryptArchway, connect: 'none', height: 'wall', variantLabels: [...CRYPT_ARCHWAY_LOOKS], directions: 4, roles: ['stone', 'mortar', 'glow'], cell: CRYPT_ARCHWAY_CELL,
    options: [flag('ward', 'Runa de proteção')],
    states: ['open'], nav: { passableIn: ['open'] }, joins: ['crypt-wall'],
  },
  // The iron gate was a fence piece; it is a door now (the fence's runs end in posts at its edge), its old ajar look became the state 'open'.
  {
    id: 'iron-gate', label: 'Portão de ferro', group: 'door', piece: ironGate, connect: 'none', height: IRON_GATE_TOP, variantLabels: [...IRON_GATE_LOOKS], directions: 4, roles: ['metal', 'stone', 'mortar', 'glow'], cell: IRON_GATE_CELL,
    options: [flag('lantern', 'Lanterna de fogo-fátuo')],
    states: ['closed', 'open'], clips: IRON_GATE_CLIPS, nav: { passableIn: ['open'], interact: 'door' }, joins: ['iron-fence'],
  },
  // Props: no connection; a footprint on the grid, facings where the front differs from the back.
  {
    id: 'tombstone', label: 'Lápide', group: 'prop', piece: tombstone, height: propHeight('tombstone'), connect: 'none', variantLabels: ['Arco gótico'], directions: 4, roles: ['stone', 'bone', 'moss'], cell: TOMBSTONE_CELL, asset: 'props/tombstone',
    options: [
      { key: 'emblem', label: 'Entalhe', type: 'select', default: 'skull', choices: [{ value: 'skull', label: 'Caveira de olhos acesos' }, { value: 'cross', label: 'Cruz' }, { value: 'none', label: 'Liso' }] },
      flag('candle', 'Vela de alma'),
      flag('moss', 'Musgo no pedestal', false),
    ],
    nav: { blocks: true },
  },
  {
    id: 'reliquary', label: 'Relicário', group: 'prop', piece: reliquary, height: propHeight('reliquary'), connect: 'none', variantLabels: ['Fechadura de caveira'], directions: 8, roles: ['darkwood', 'metal', 'bone', 'glow'], cell: RELIQUARY_CELL, asset: 'props/reliquary',
    states: ['shut', 'open'], clips: RELIQUARY_CLIPS, nav: { interact: 'chest', interactIn: ['shut'] },
  },
  {
    id: 'candle-cluster', label: 'Velas de alma', group: 'prop', piece: candleCluster, height: propHeight('candles'), connect: 'none', variants: 3, variantLabels: ['Uma alta ao centro', 'Duas altas', 'Baixas e juntas'], roles: ['bone', 'glow'], cell: SMALL_CELL,
    options: [num('candles', 'Velas', 5, 1, 5, 1), num('glow', 'Brilho no chão', 0.28, 0, 0.6, 0.02)],
    // Burning candles on a pool of wax: nobody walks through the flames.
    nav: { blocks: true }, clips: CANDLE_CLIPS,
  },
  {
    id: 'bone-pile', label: 'Pilha de ossos', group: 'prop', piece: bonePile, height: propHeight('bones'), connect: 'none', variants: 2, variantLabels: ['Ossos cruzados', 'Caixa torácica'], directions: 8, roles: ['bone', 'glow'], cell: SMALL_CELL,
    options: [flag('skull', 'Caveira'), flag('candle', 'Toco de vela de alma'), flag('sparks', 'Faíscas nas órbitas')],
    // Knee high and flat: a character steps over the bones (the nominal height is 0.19 of its own).
    nav: { blocks: false },
  },
  {
    id: 'soul-brazier', label: 'Braseiro de almas', group: 'prop', piece: soulBrazier, height: propHeight('brazier'), connect: 'none', variants: 2, variantLabels: ['Fogo aceso', 'Brasas'], roles: ['metal', 'glow'], cell: BRAZIER_CELL,
    options: [num('fire', 'Fogo', 1, 0.3, 1.2, 0.1), num('glow', 'Brilho no chão', 0.3, 0, 0.6, 0.02)],
    nav: { blocks: true }, clips: BRAZIER_CLIPS,
  },
  {
    id: 'lantern-post', label: 'Poste de lanterna', group: 'prop', piece: lanternPost, height: propHeight('post'), connect: 'none', variantLabels: ['Poste de ferro'], directions: 4, roles: ['metal', 'stone', 'glow'], cell: POST_CELL,
    options: [num('height', 'Altura do poste', Math.round(POST_POLE), Math.round(POST_POLE * 0.7), Math.round(POST_POLE * 1.25), 2), num('glow', 'Brilho no chão', 0.3, 0, 0.6, 0.02)],
    nav: { blocks: true }, clips: POST_CLIPS,
  },
  {
    id: 'dead-tree', label: 'Árvore morta', group: 'prop', piece: deadTree, height: propHeight('tree'), connect: 'none', variants: 3, variantLabels: ['Galhos abertos', 'Alta e esguia', 'Torta, galho longo'], footprint: [2, 2], roles: ['wood', 'moss', 'glow'], cell: TREE_CELL,
    options: [num('trunk', 'Altura do tronco', TREE_TRUNK.default, TREE_TRUNK.min, TREE_TRUNK.max, 2), flag('hollow', 'Oco com luzes de alma'), flag('moss', 'Musgo')],
    nav: { blocks: true },
  },
  {
    id: 'coffin', label: 'Caixão', group: 'prop', piece: coffin, height: propHeight('coffin'), connect: 'none', variants: 2, variantLabels: ['Fechado', 'Tampa deslocada'], footprint: [1, 2], directions: 4, roles: ['darkwood', 'metal', 'bone', 'glow'], cell: COFFIN_CELL,
    options: [num('ajar', 'Tampa deslocada', 1, 0, 1.2, 0.1)],
    nav: { blocks: true },
  },
  // Pieces a character uses: states, clips between them and `nav.interact` (guide 05). Clips are named for the action (`pull`, `break`), never the state they end in.
  {
    id: 'lever', label: 'Alavanca', group: 'prop', piece: lever, height: propHeight('lever'), connect: 'none', variantLabels: ['Alavanca de ferro com gemas de alma'], directions: 4, roles: ['stone', 'metal', 'darkwood', 'glow'], cell: LEVER_CELL,
    options: [num('glow', 'Brilho no chão', 0.3, 0, 0.6, 0.02)],
    states: ['up', 'down'], clips: LEVER_CLIPS, nav: { interact: 'lever' },
  },
  {
    id: 'urn', label: 'Urna funerária', group: 'prop', piece: urn, height: propHeight('urn'), connect: 'none', variantLabels: ['Esmaltada, com runa de proteção'], roles: ['ceramic', 'metal', 'bone', 'stone', 'glow'], cell: URN_CELL,
    options: [num('glow', 'Luz de alma', 1, 0, 1.5, 0.1)],
    // Blocks until it is broken: a character walks over the shards.
    states: ['whole', 'broken'], clips: URN_CLIPS, nav: { passableIn: ['broken'], interact: 'break', interactIn: ['whole'] },
  },
  // Decals: marks on the floor layer, under everything else; one facing, several looks.
  {
    id: 'floor-cracks', label: 'Rachaduras', group: 'decal', piece: floorCracks, connect: 'none', variants: 4, variantLabels: ['Rachadura horizontal', 'Rachadura diagonal', 'Rachadura curta', 'Luz de alma saindo'], roles: ['glow'], cell: DECAL_CELL,
    options: [num('width', 'Largura', 1.6, 0.8, 2.4, 0.1), num('glow', 'Luz de alma (variante 4)', 0.8, 0, 1.5, 0.1)],
    // Decals lie on the floor and never block.
    nav: { blocks: false },
  },
  {
    id: 'scattered-bones', label: 'Ossos espalhados', group: 'decal', piece: scatteredBones, connect: 'none', variants: 4, variantLabels: ['Osso longo', 'Costelas e vértebras', 'Dois ossos longos', 'Caveira e osso'], roles: ['bone', 'glow'], cell: DECAL_CELL,
    options: [num('pieces', 'Peças', 7, 1, 7, 1)],
    nav: { blocks: false },
  },
  {
    id: 'soul-puddle', label: 'Poça de almas', group: 'decal', piece: soulPuddle, connect: 'none', variants: 3, variantLabels: ['Redonda', 'Comprida', 'Duas poças'], roles: ['glow'], cell: DECAL_CELL,
    options: [num('glow', 'Brilho', 0.8, 0, 1.2, 0.05)],
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
