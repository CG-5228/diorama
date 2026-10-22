import assert from 'node:assert/strict';
import { validateCatalog, validateScene, emptyScene, type SceneData } from '../../core/volume';
import { FIXTURE_SCENE, FIXTURE_SCENERY } from '../../viewer/src/lib/scenery/fixture';
import { groundOf } from '../../viewer/src/lib/scenery/background';
import {
  BODY_RADIUS, WORLD_SCALE, clipFrames, constrain, drawnItem, flightStop, loopOf, mappingOf, play, playing, spawnPoint, standable, startLive, stateOf, stepLive, strike, toView, toWorld, transitionFrom, transitionTarget, usableFrom, use,
} from '../../viewer/src/lib/scenery/living';

console.log('🧪 Checking the living scene (states and clips, doors, navigation, collision, interaction, depth order)...\n');

const catalog = FIXTURE_SCENERY;
const grid = catalog.grid;
const base = catalog.camera.at({ x: 100, y: 80 });
const project = (at: Parameters<typeof base.project>[0]) => base.project(at);
const piece = (id: string) => catalog.pieces.find((p) => p.id === id)!;
const cellCentre = (col: number, row: number) => ({ x: col * grid.cell.x, y: row * grid.cell.y });

// 1. The fixture's kit and scene are valid for the engine, and the scene plays with its doors where they are.
assert.deepEqual(validateCatalog(catalog), []);
assert.deepEqual(validateScene(FIXTURE_SCENE, catalog), []);
const live = startLive(FIXTURE_SCENE, catalog, project);
const doorIndexes = FIXTURE_SCENE.props.flatMap((p, i) => (p.edge ? [i] : []));
assert.deepEqual(live.nav.doors.map((d) => [d.index, d.open]), [[doorIndexes[0], false], [doorIndexes[1], true]], 'a door starts in its saved state: one shut, one open');
assert.deepEqual(live.standing.filter((s) => s.index !== undefined).map((s) => s.index).sort((a, b) => a! - b!), FIXTURE_SCENE.props.flatMap((p, i) => (piece(p.piece).group === 'decal' ? [] : [i])), 'every standing placement knows which one it is');
assert.ok(live.standing.every((s) => s.item.pass === 'object'));
// The standing things come in drawing order: by the depth of their pivot on the screen.
for (let i = 1; i < live.standing.length; i++) assert.ok(live.standing[i].screen.y >= live.standing[i - 1].screen.y - 1e-9, 'sorted by pivot depth');

// 2. The ground is what is left without walls and placements: floors alone.
const ground = groundOf(FIXTURE_SCENE);
assert.equal(ground.props.length, 0);
assert.ok(ground.walls.every((row) => row.every((cell) => cell === null)));
assert.equal(ground.walls.length, FIXTURE_SCENE.walls.length, 'the walls grid keeps its shape');
assert.equal(ground.figures, undefined, 'scale figures are an editor aid, not part of the scene');
assert.deepEqual(validateScene(ground, catalog), []);

// 3. The view and the floor map to each other: a point of the floor goes to the view and back.
const map = mappingOf(catalog, { x: 100, y: 80 }, { x: 37, y: 12 });
for (const p of [{ x: 0, y: 0 }, { x: 48, y: 48 }, { x: -20, y: 31.5 }]) {
  const back = toWorld(map, toView(map, p));
  assert.ok(Math.abs(back.x - p.x) < 1e-9 && Math.abs(back.y - p.y) < 1e-9);
}
const origin = toView(map, { x: 0, y: 0 });
assert.deepEqual([origin.x, origin.y], [37 + 100 * WORLD_SCALE, 12 + 80 * WORLD_SCALE], 'the centre of cell (0, 0) is where the drawing puts it');
const step = toView(map, { x: grid.cell.x, y: grid.cell.y });
assert.ok(Math.abs(step.x - origin.x - grid.screen.w * WORLD_SCALE) < 1e-9 && Math.abs(step.y - origin.y - grid.screen.h * WORLD_SCALE) < 1e-9, 'one cell is the cell on screen, at the export scale');
// What the engine projects for a pivot is what the mapping says (the drawing is made with the same camera).
const projected = project(grid.center(3, 2));
const viewed = toView(mappingOf(catalog, { x: 100, y: 80 }, { x: 0, y: 0 }), grid.center(3, 2));
assert.ok(Math.abs(projected.x * WORLD_SCALE - viewed.x) < 1e-6 && Math.abs(projected.y * WORLD_SCALE - viewed.y) < 1e-6);

// 4. Which clip leads out of a state, and which loops.
assert.equal(transitionFrom(piece('crypt-door'), 'closed'), 'opening');
assert.equal(transitionFrom(piece('crypt-door'), 'open'), 'closing');
assert.equal(transitionFrom(piece('urn'), 'whole'), 'breaking');
assert.equal(transitionFrom(piece('urn'), 'broken'), null, 'a broken urn stays broken');
assert.equal(transitionFrom(piece('chest'), 'closed'), 'opening');
assert.equal(transitionFrom(piece('chest'), 'open'), null);
assert.equal(transitionFrom(piece('brazier'), undefined), null, 'a loop is not a transition');
assert.equal(loopOf(piece('brazier'), undefined), 'flame');
// A clip is found by the transition it makes, whatever it is called; the one that leads to the next state wins.
const odd = { id: 'odd', states: ['a', 'b', 'c'], clips: { zap: { frames: 3, from: 'a', to: 'c' }, wobble: { frames: 3, from: 'a', to: 'b' }, hum: { frames: 4, loop: true, from: 'a' }, back: { frames: 3, from: 'c', to: 'a' } } } as unknown as Parameters<typeof transitionFrom>[0];
assert.equal(transitionFrom(odd, 'a'), 'wobble', 'a goes to b next, not to c');
assert.equal(transitionFrom(odd, 'c'), 'back', 'after the last state comes the first');
assert.equal(transitionFrom(odd, 'b'), null);
assert.equal(transitionTarget(odd, 'zap'), 'c');
assert.equal(loopOf(odd, 'a'), 'hum');
assert.equal(loopOf(piece('crypt-door'), 'closed'), null);

// 5. A door opens: its clip runs, the door lets through from its `open` event, and rests open when the clip ends.
const closedDoor = doorIndexes[0];
assert.equal(stateOf(live, closedDoor), 'closed');
const events: string[] = [];
assert.equal(play(live, closedDoor, 'opening', (e) => events.push(`${e.name}@${e.frame}`)), true);
assert.equal(playing(live, closedDoor), true);
assert.equal(play(live, closedDoor, 'opening'), false, 'it is already opening');
assert.equal(play(live, closedDoor, 'closing'), false, 'a closed door has nothing to close');
const fps = piece('crypt-door').clips!.opening.fps!;
assert.equal(stepLive(live, 1 / fps, project, (e) => events.push(`${e.name}@${e.frame}`)), false, 'the first frames change nothing standing');
assert.equal(live.nav.doors.find((d) => d.index === closedDoor)!.open, false, 'still shut before its `open` event');
assert.equal(stepLive(live, 3 / fps, project, (e) => events.push(`${e.name}@${e.frame}`)), false);
assert.deepEqual(events, ['open@3'], 'the event fires when its frame is reached');
assert.equal(live.nav.doors.find((d) => d.index === closedDoor)!.open, true, 'open from the event on, before the leaf stops');
assert.equal(stateOf(live, closedDoor), 'closed', 'the state changes when the clip ends');
assert.equal(stepLive(live, 10 / fps, project), true, 'the clip ended: what stands changed');
assert.equal(stateOf(live, closedDoor), 'open');
assert.equal(playing(live, closedDoor), false);
assert.equal(live.standing.find((s) => s.index === closedDoor)!.item.state, 'open', 'the door is laid out open now');
assert.equal(live.scene.props[closedDoor].state, 'open');
assert.equal(FIXTURE_SCENE.props[closedDoor].state, undefined, 'the scene it was given is untouched');
assert.deepEqual(live.last && [live.last.name, live.last.piece, live.last.frame], ['open', 'crypt-door', 3]);
// And shuts again.
assert.equal(play(live, closedDoor, 'closing'), true);
stepLive(live, 10 / fps, project);
assert.equal(stateOf(live, closedDoor), 'closed');
assert.equal(live.nav.doors.find((d) => d.index === closedDoor)!.open, false);
assert.deepEqual(live.open, {}, 'nothing is left of the early opening');

// 6. A frame to draw: the resting one, a clip's while it plays, a loop's always.
const standing = (index: number) => live.standing.find((s) => s.index === index)!;
const brazier = FIXTURE_SCENE.props.findIndex((p) => p.piece === 'brazier');
assert.equal(drawnItem(live, standing(closedDoor), 0).clip, undefined);
assert.deepEqual(drawnItem(live, standing(brazier), 0.35).clip, { name: 'flame', frame: Math.floor(0.35 * 10) % 8 }, 'a loop follows the clock and wraps');
assert.deepEqual(drawnItem(live, standing(brazier), 0.85).clip, { name: 'flame', frame: Math.floor(0.85 * 10) % 8 });
play(live, closedDoor, 'opening');
stepLive(live, 2 / fps, project);
assert.deepEqual(drawnItem(live, standing(closedDoor), 0).clip, { name: 'opening', frame: 2 });
stepLive(live, 10 / fps, project);
assert.equal(drawnItem(live, standing(closedDoor), 0).clip, undefined, 'at rest again');
const frames = clipFrames(live);
assert.equal(frames.slice(0, 8).every((f) => f.clip.name === 'flame'), true, 'loops come first: they play from the start');
assert.ok(frames.some((f) => f.clip.name === 'opening' && f.state === 'closed') && frames.some((f) => f.clip.name === 'closing' && f.state === 'open'), 'each clip is warmed from the state it starts in');
assert.equal(new Set(frames.map((f) => `${f.piece}|${f.variant}|${f.dir}|${f.clip.name}|${f.clip.frame}`)).size, frames.length, 'one set of frames for each look of a piece, however many places it stands in');

// 7. A scene with a door inside, between two rooms: walls block, a shut door blocks, an open one lets through.
const rooms: SceneData = {
  ...emptyScene(catalog, 6, 4),
  floor: Array.from({ length: 4 }, () => Array(6).fill('dirt')),
  props: [{ piece: 'crypt-door', col: 2, row: 2, edge: 'N' }, { piece: 'urn', col: 4, row: 3 }],
};
for (let col = 0; col <= 6; col++) rooms.walls[2][col] = col === 2 || col === 3 ? 'crypt-wall' : 'crypt-wall';
assert.deepEqual(validateScene(rooms, catalog), []);
const inside = startLive(rooms, catalog, project);
const radius = BODY_RADIUS;
const mapping = mappingOf(catalog, { x: 100, y: 80 }, { x: 0, y: 0 });
const through = (live: typeof inside, col: number) => {
  // A character in the cell below the wall pushes north with a long step.
  const from = toView(mapping, { x: col * grid.cell.x, y: 2 * grid.cell.y });
  const to = toView(mapping, { x: col * grid.cell.x, y: 0.2 * grid.cell.y });
  return toWorld(mapping, constrain(live, grid, mapping, from, to));
};
const wallLine = 1.5 * grid.cell.y;
const walled = through(inside, 0);
assert.ok(Math.abs(walled.y - (wallLine + radius)) < 1e-3, `a wall stops it a body's width short (${walled.y})`);
assert.ok(Math.abs(through(inside, 2).y - (wallLine + radius)) < 1e-3, 'a shut door stops it too');
// Sliding: the step that hits the wall at an angle keeps its side part, as far as the wall's posts let it.
const slideTo = (x: number) => toWorld(mapping, constrain(inside, grid, mapping, toView(mapping, { x: 0, y: 2 * grid.cell.y }), toView(mapping, { x, y: 1.2 * grid.cell.y })));
const slid = slideTo(8);
assert.ok(slid.x > 7 && slid.y >= wallLine + radius - 1e-3, `it slides along the wall (${slid.x}, ${slid.y})`);
// The wall's posts (its vertices) keep the body clear: a long slide goes past them, never through them or the wall.
const posted = slideTo(60);
assert.ok(posted.x > 40 && posted.y > wallLine + radius, `it slides past a post, kept clear of it (${posted.x}, ${posted.y})`);
// Open the door (the clip's own events do it) and the same step goes through, only at the door.
assert.equal(play(inside, 0, 'opening'), true);
stepLive(inside, 10 / piece('crypt-door').clips!.opening.fps!, project);
assert.equal(through(inside, 2).y < wallLine - 1, true, 'an open door lets it through');
assert.ok(through(inside, 1).y > wallLine, 'but not the wall beside it');
// Something that flies (a projectile) is stopped by what stops a body: a wall, a shut door, the edge of the floor.
const closed = startLive(rooms, catalog, project);
const flyFrom = (live: typeof inside, col: number, from: number, to: number) =>
  flightStop(live, grid, mapping, toView(mapping, { x: col * grid.cell.x, y: from * grid.cell.y }), toView(mapping, { x: col * grid.cell.x, y: to * grid.cell.y }));
const stopped = flyFrom(closed, 0, 2.6, 0.5);
assert.ok(stopped && toWorld(mapping, stopped).y > wallLine, `a wall stops it before the wall (${stopped && toWorld(mapping, stopped).y})`);
assert.ok(flyFrom(closed, 2, 2.6, 0.5), 'so does a shut door');
assert.equal(flyFrom(inside, 2, 2.6, 0.5), null, 'an open door lets it through');
assert.ok(flyFrom(inside, 1, 2.6, 0.5), 'but not the wall beside it');
assert.equal(flyFrom(closed, 1, 3, 2.2), null, 'nothing in the way inside a room');
assert.ok(flyFrom(closed, 4, 2.2, 3.2), 'a whole urn stops it like a wall: its cell cannot be entered');
const aimed = flightStop(closed, grid, mapping, toView(mapping, { x: 0, y: grid.cell.y }), toView(mapping, { x: 9 * grid.cell.x, y: grid.cell.y }));
assert.ok(aimed && toWorld(mapping, aimed).x <= 5.5 * grid.cell.x + 1e-6 && toWorld(mapping, aimed).x > 4.5 * grid.cell.x, 'the edge of the floor ends it');
const corner = flightStop(closed, grid, mapping, toView(mapping, { x: 0, y: 3 * grid.cell.y }), toView(mapping, { x: 2 * grid.cell.x, y: 0.2 * grid.cell.y }));
assert.ok(corner, 'a path across the wall at a slant is stopped');
const whole = flightStop(closed, grid, mapping, toView(mapping, { x: 0.2 * grid.cell.x, y: 3 * grid.cell.y }), toView(mapping, { x: 0.2 * grid.cell.x, y: 3 * grid.cell.y }));
assert.equal(whole, null, 'a point does not go anywhere');

// A step that stays inside a room is not touched; the floor's edge stops it like a wall.
const free = toView(mapping, { x: grid.cell.x, y: 3 * grid.cell.y });
const freeTo = toView(mapping, { x: 2 * grid.cell.x, y: 3 * grid.cell.y });
assert.deepEqual(constrain(inside, grid, mapping, free, freeTo), freeTo);
const off = toWorld(mapping, constrain(inside, grid, mapping, toView(mapping, { x: 5 * grid.cell.x, y: 3 * grid.cell.y }), toView(mapping, { x: 9 * grid.cell.x, y: 3 * grid.cell.y })));
assert.ok(off.x < 5.5 * grid.cell.x - radius + 1e-3, 'the edge of the floor stops it');

// 8. Using things: what is in reach from where a character stands, nearest first; the use starts the clip.
const fresh = startLive(FIXTURE_SCENE, catalog, project);
const shut = FIXTURE_SCENE.props.findIndex((p) => p.piece === 'crypt-door' && p.edge === 'N');
const chest = FIXTURE_SCENE.props.findIndex((p) => p.piece === 'chest');
assert.deepEqual(usableFrom(fresh, grid, cellCentre(5, 0)).map((u) => [u.piece, u.clip, u.to]), [['crypt-door', 'opening', 'open']], 'in the cell below a shut door: open it');
assert.deepEqual(usableFrom(fresh, grid, cellCentre(5, 3)), [], 'nothing in reach in the middle of the floor');
assert.deepEqual(usableFrom(fresh, grid, cellCentre(2, 3)).map((u) => [u.index, u.clip]), [[chest, 'opening']], 'beside the chest');
assert.deepEqual(usableFrom(fresh, grid, cellCentre(0, 4)).map((u) => [u.piece, u.clip]), [['crypt-door', 'closing']], 'beside the open door: shut it');
assert.deepEqual(usableFrom(fresh, grid, cellCentre(6, 6)), [], 'an urn is hit, not used');
const used = use(fresh, grid, cellCentre(5, 0));
assert.equal(used?.index, shut);
assert.equal(playing(fresh, shut), true);
assert.equal(use(fresh, grid, cellCentre(5, 0)), null, 'what is busy is not used again');
stepLive(fresh, 10 / fps, project);
assert.deepEqual(usableFrom(fresh, grid, cellCentre(5, 0)).map((u) => u.clip), ['closing'], 'now it can be shut');
use(fresh, grid, cellCentre(2, 3));
stepLive(fresh, 10 / piece('chest').clips!.opening.fps!, project);
assert.equal(stateOf(fresh, chest), 'open');
assert.deepEqual(usableFrom(fresh, grid, cellCentre(2, 3)), [], 'an open chest has nothing more to give');
assert.equal(fresh.nav.interactables.some((i) => i.index === chest), false, 'the navigation drops it once opened (`interactIn`)');

// 9. A blow breaks what is in front of the character, and only that; a broken urn can be walked over.
const urn = FIXTURE_SCENE.props.findIndex((p) => p.piece === 'urn');
const urnCell = { col: FIXTURE_SCENE.props[urn].col, row: FIXTURE_SCENE.props[urn].row };
const south = Math.PI / 2;
const north = -Math.PI / 2;
const kxy = { kx: map.kx, ky: map.ky };
const struck = startLive(FIXTURE_SCENE, catalog, project);
assert.deepEqual(strike(struck, grid, kxy, cellCentre(urnCell.col, urnCell.row - 1), north), [], 'a blow away from it misses');
assert.deepEqual(strike(struck, grid, kxy, cellCentre(urnCell.col + 3, urnCell.row), south), [], 'so does one from too far');
assert.equal(struck.nav.cost[urnCell.row][urnCell.col], 0, 'a whole urn blocks its cell');
const hits: string[] = [];
assert.deepEqual(strike(struck, grid, kxy, cellCentre(urnCell.col, urnCell.row - 1), south, (e) => hits.push(`${e.clip}:${e.name}@${e.frame}`)), [urn], 'a blow towards it lands');
assert.equal(playing(struck, urn), true);
assert.deepEqual(strike(struck, grid, kxy, cellCentre(urnCell.col, urnCell.row - 1), south), [], 'a second blow while it breaks does nothing');
stepLive(struck, 10 / piece('urn').clips!.breaking.fps!, project, (e) => hits.push(`${e.clip}:${e.name}@${e.frame}`));
assert.deepEqual(hits, ['breaking:break@2'], 'the clip tells when it breaks');
assert.equal(stateOf(struck, urn), 'broken');
assert.ok(struck.nav.cost[urnCell.row][urnCell.col] > 0, 'a broken urn is walked over');
assert.deepEqual(strike(struck, grid, kxy, cellCentre(urnCell.col, urnCell.row - 1), south), [], 'and there is nothing left to break');

// 10. A character starts on the floor, near the middle, and knows when it stands off it.
const start = spawnPoint(fresh, grid);
assert.equal(standable(fresh, grid, start), true);
assert.equal(standable(fresh, grid, cellCentre(urnCell.col, urnCell.row)), false, 'a whole urn is not floor to stand on');
assert.equal(standable(fresh, grid, cellCentre(-1, 0)), false);
assert.equal(standable(fresh, grid, cellCentre(2, 2)), false, 'nor is a chest');
assert.ok(Math.hypot(start.x / grid.cell.x - 5.5, start.y / grid.cell.y - 4) < 2, 'near the middle of the scene');

console.log('✅ living scene checks passed');
