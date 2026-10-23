import assert from 'node:assert/strict';
import { Camera, defineSpace, emptyScene, sceneNavigation, validateScene, type SceneData, type SceneryCatalog } from '../../core/volume/index.js';
import { EDGE, canStep, cellAt, findPath, flightStop, moveIn, projectionOf, toFloor, toScreen, type Grid, type SceneNavigation } from '@diorama/runtime';
import { fixtureSheets, near } from './helpers';

console.log('🧪 Checking movement on a scene\'s navigation (steps, paths, cells, sliding along walls, posts, what stops a projectile) and its floor on the screen...\n');

// 1. A 4 × 3 hall made by the engine (`sceneNavigation`, the producer): north wall along vertex row 0 with a door on the
//    north edge of cell (1, 0), a chest and an urn. The runtime walks what the engine exports.
const space = defineSpace({ camera: new Camera(), character: 80, preset: 'jrpg' });
const piece = (id: string, group: string, extra: object = {}) => ({ id, label: id, group, piece: () => {}, connect: 'none', roles: [], ...extra });
const catalog = {
  grid: space.grid,
  space,
  camera: new Camera(),
  materials: {},
  defaultMaterials: {},
  pieces: [
    piece('dirt', 'floor'),
    piece('wall', 'wall', { connect: 'wall' }),
    piece('door', 'door', { directions: 4, states: ['closed', 'open'], clips: { opening: { frames: 4, from: 'closed', to: 'open', events: [{ frame: 2, name: 'open' }] } }, nav: { passableIn: ['open'], interact: 'door' } }),
    piece('chest', 'prop', { states: ['shut', 'open'], nav: { interact: 'chest', interactIn: ['shut'] } }),
    piece('urn', 'prop', { states: ['whole', 'broken'], nav: { passableIn: ['broken'], interact: 'break', interactIn: ['whole'] } }),
  ],
} as unknown as SceneryCatalog;
const hall: SceneData = { ...emptyScene(catalog, 4, 3), floor: Array.from({ length: 3 }, () => Array(4).fill('dirt')), props: [{ piece: 'door', col: 1, row: 0, edge: 'N' }, { piece: 'chest', col: 3, row: 1 }, { piece: 'urn', col: 1, row: 1 }] };
hall.walls[0] = ['wall', 'wall', 'wall', 'wall', 'wall'];
assert.deepEqual(validateScene(hall, catalog), []);
const nav: SceneNavigation = sceneNavigation(hall, catalog);
const grid: Grid = { screen: space.grid.screen, cell: space.grid.cell };
assert.equal(nav.walls[0][1] & EDGE.N, EDGE.N, 'the closed door closes its edge');

assert.ok(canStep(nav, { col: 0, row: 1 }, { col: 0, row: 2 }));
assert.ok(!canStep(nav, { col: 0, row: 1 }, { col: 1, row: 1 }), 'not into the urn');
assert.ok(!canStep(nav, { col: 0, row: 1 }, { col: 1, row: 2 }), 'only to a 4-neighbour');
assert.ok(!canStep(nav, { col: 1, row: 0 }, { col: 1, row: -1 }), 'not through the shut door (nor off the floor)');
const path = findPath(nav, { col: 0, row: 1 }, { col: 2, row: 1 })!;
assert.ok(path && path.every((c) => nav.cost[c.row][c.col] > 0) && path.length === 5, 'the path goes round the urn');
assert.deepEqual([path[0], path.at(-1)], [{ col: 0, row: 1 }, { col: 2, row: 1 }], 'both ends included');
assert.equal(findPath(nav, { col: 0, row: 0 }, { col: 3, row: 1 }), null, 'no path into a blocked cell');
assert.deepEqual(cellAt(grid, { x: space.grid.cell.x * 0.49, y: -space.grid.cell.y * 0.51 }), { col: 0, row: -1 }, 'cell (0, 0) is centred on the origin');
// Free movement slides along walls: walking north into the north wall stops a radius short of it.
const start = { x: space.grid.center(0, 0).x, y: space.grid.center(0, 0).y };
const moved = moveIn(nav, grid, start, { x: 0, y: -30 }, 6);
assert.ok(near(moved.y, space.grid.center(0, 0).y - space.grid.cell.y / 2 + 6, 1e-3));
const slid = moveIn(nav, grid, start, { x: 5, y: -30 }, 6);
assert.ok(near(slid.x, start.x + 5, 1e-6), 'the move along the wall is kept');
// A long move is taken in steps: it cannot tunnel through the closed door or the urn.
const below = { x: space.grid.center(1, 2).x, y: space.grid.center(1, 2).y };
const pushed = moveIn(nav, grid, below, { x: 0, y: -200 }, 6);
assert.ok(pushed.y > space.grid.center(1, 1).y + space.grid.cell.y / 2 - 6 - 1e-3, 'the urn stops a long move in front of it');
// The posts of the north wall keep a body clear even where it walks along the wall.
const nearPost = moveIn(nav, grid, { x: space.grid.vertex(1, 0).x + 2, y: space.grid.center(1, 0).y }, { x: 0, y: -20 }, 6);
assert.ok(Math.hypot(nearPost.x - space.grid.vertex(1, 0).x, nearPost.y - space.grid.vertex(1, 0).y) >= 6 + space.grid.cell.x * 0.2 - 1e-6, 'a body keeps clear of a pier');
// Opened (a game's live state), the door frees its edge.
const opened = sceneNavigation(hall, catalog, { open: { 0: true } });
assert.equal(opened.walls[0][1] & EDGE.N, 0);
assert.ok(!canStep(opened, { col: 1, row: 0 }, { col: 1, row: -1 }), 'though there is no floor behind it');

// 2. What flies is stopped by what stops a body: the last free point before the wall, the urn or the edge of the floor.
const c = space.grid.cell;
const north = flightStop(nav, grid, { x: 0, y: 2 * c.y }, { x: 0, y: -2 * c.y })!;
assert.ok(north && north.y > -0.5 * c.y && north.y <= 0, `the north wall stops it in the first row (${north?.y})`);
assert.equal(flightStop(nav, grid, { x: 0, y: 2 * c.y }, { x: 0, y: 1 * c.y }), null, 'a clear way');
const atUrn = flightStop(nav, grid, { x: 0, y: c.y }, { x: 3 * c.x, y: c.y })!;
assert.ok(atUrn && atUrn.x < 0.5 * c.x, 'a whole urn stops it like a wall: its cell cannot be entered');
const corner = flightStop(nav, grid, { x: 0, y: 2 * c.y }, { x: 2 * c.x, y: 0 })!;
assert.ok(corner, 'a slant across a blocked corner is stopped');
const from = { x: 3, y: 4 };
assert.equal(flightStop(nav, grid, from, from), null, 'a point does not go anywhere');

// 3. The crypt entrance, as the sample exports it (its sheet's `meta.data`): the shut door, the pillars' posts, the coffins.
const crypt = fixtureSheets('scenes/crypt-entrance')[0].atlas!.meta.data!;
const cryptNav = crypt.navigation!;
const cryptGrid = crypt.grid!;
assert.deepEqual([cryptNav.cols, cryptNav.rows, cryptGrid.cell.x], [9, 7, 48]);
assert.deepEqual(cryptNav.doors.map((d) => [d.piece, d.col, d.row, d.edge, d.open]), [['crypt-door', 4, 0, 'N', false]]);
assert.ok(!canStep(cryptNav, { col: 4, row: 0 }, { col: 4, row: -1 }), 'the shut door');
assert.deepEqual(findPath(cryptNav, { col: 4, row: 6 }, { col: 4, row: 0 })?.length, 7, 'straight up the hall');
const atDoor = moveIn(cryptNav, cryptGrid, { x: 4 * 48, y: 1 * cryptGrid.cell.y }, { x: 0, y: -200 }, 9);
assert.ok(near(atDoor.y, -0.5 * cryptGrid.cell.y + 9, 1e-3), `the guard stops a body's width short of the shut door (${atDoor.y})`);
const bolt = flightStop(cryptNav, cryptGrid, { x: 4 * 48, y: 2 * cryptGrid.cell.y }, { x: 4 * 48, y: -3 * cryptGrid.cell.y })!;
assert.ok(bolt.y > -0.5 * cryptGrid.cell.y && bolt.y < 0, 'Malvek\'s bolt stops at the north wall');
assert.ok(cryptNav.posts.some((r) => r.some(Boolean)), 'the pillars stand on posts');
assert.ok([2, 3, 4].every((row) => cryptNav.cost[row][1] === 0 && cryptNav.cost[row][7] === 0), 'the coffins by the side walls cannot be walked over');
assert.ok(!canStep(cryptNav, { col: 2, row: 3 }, { col: 1, row: 3 }), 'not even from the aisle beside one');

// 4. The scene's floor on the screen: a world unit across is `grid.screen.w / grid.cell.x` logical px, in depth
//    `grid.screen.h / grid.cell.y` (the camera's tilt), cell (0, 0)'s centre at the scene's `origin`, all × the sheet's scale.
const cryptSheet = fixtureSheets('scenes/crypt-entrance')[0].atlas!;
const projection = projectionOf(cryptSheet, { tilt: 30, scale: 1 });
assert.deepEqual([projection.scale, projection.kx, projection.origin], [2, 1, { x: crypt.origin!.x * 2, y: crypt.origin!.y * 2 }], 'the scene\'s own scale and origin, not the fallback');
assert.ok(near(projection.ky, cryptGrid.screen.h / cryptGrid.cell.y) && near(projection.ky, Math.sin((48 * Math.PI) / 180), 1e-9), 'depth shrinks by sin(48°), the sample\'s camera');
assert.deepEqual(toScreen(projection, { x: 0, y: 0 }), projection.origin, 'cell (0, 0) is centred on the origin');
const nextCell = toScreen(projection, { x: cryptGrid.cell.x, y: cryptGrid.cell.y });
assert.ok(near(nextCell.x - projection.origin.x, cryptGrid.screen.w * 2) && near(nextCell.y - projection.origin.y, cryptGrid.screen.h * 2), 'a cell along and down is one screen cell along and down');
assert.ok(near(toScreen(projection, { x: 0, y: 0 }, 10).y, projection.origin.y - 20), 'a lift raises it by logical px × scale');
const roundTrip = toFloor(projection, toScreen(projection, { x: 100, y: 70 }));
assert.ok(near(roundTrip.x, 100) && near(roundTrip.y, 70), 'and back to the floor');
const unscaled = projectionOf({ ...cryptSheet, meta: { ...cryptSheet.meta, scale: undefined } }, { tilt: 30, scale: 3 });
assert.deepEqual([unscaled.scale, unscaled.origin], [1, crypt.origin!], 'a sheet without a scale is at scale 1, like every sheet: the fallback is only for no scene');
assert.throws(() => projectionOf({ ...cryptSheet, meta: { ...cryptSheet.meta, data: { role: 'scene' } } }, { tilt: 30, scale: 1 }), /grid and origin/, 'a scene without its grid is refused, not drawn at the fallback');

console.log('✅ navigation checks passed');
