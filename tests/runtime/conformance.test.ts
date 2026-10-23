/**
 * Conformance traces (tests/runtime/conformance/*.json): for a set of inputs, what the runtime plays at fixed time steps,
 * frame by frame: the actor's floor point, facing, clips and clocks, the events its clips fire, and the effects they cue
 * with their own events. The sheets are the small fixtures cut from the sample's export (tests/runtime/fixtures/). Another
 * implementation of the contract (the Godot port, M13) replays the same files: each holds its inputs (the script, the
 * time step and the body `radius` the floor stops) and its frames.
 *
 *   npx tsx tests/runtime/conformance.test.ts            compare with the recorded traces
 *   npx tsx tests/runtime/conformance.test.ts --update   record them again (after a deliberate change of behaviour)
 */

import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  BODY_RADIUS, FREE_FLOOR, buildLibrary, createActor, cues, flightStop, frameOfFx, moveIn, play, reset, shownFrame, steer, stepFx, takeEvents,
  type ClipEvent, type Floor, type Fx, type FxWorld, type Vec2,
} from '@diorama/runtime';
import { fixtureSheets } from './helpers';

const FORMAT = 'diorama-conformance/1';
const DIR = resolve('tests/runtime/conformance');
const update = process.argv.includes('--update');

/**
 * One step of a script: hold an input for some frames, play a clip by key, reset, or aim the `fly` cues that follow at a
 * floor point (contract C5; `null` stops aiming).
 */
type Step = { frames: number; input?: [dx: number, dy: number, run: boolean] } | { play: string } | { reset: true } | { aim: [x: number, y: number] | null };

interface Script {
  about: string;
  /** Fixture sheets (or folders) the library is built from. */
  sheets: string[];
  /** The character played, by manifest name. */
  character: string;
  /** A scene sheet whose navigation is the floor (`moveIn`) and stops projectiles (`flightStop`); null for a free floor. */
  scene: string | null;
  start: { x: number; y: number; row: number };
  steps: Step[];
}

const E: [number, number, boolean] = [1, 0, false];
const SCRIPTS: Record<string, Script> = {
  guard: {
    about: 'The ossuary guard on a free floor: walking and running in several directions, every action (root motion, the slash\'s spark at its tip, the cleave\'s shockwave at its feet, the landing dust), hit, death and reset.',
    sheets: ['characters/guard', 'vfx'],
    character: 'ossuary-guard',
    scene: null,
    start: { x: 0, y: 0, row: 0 },
    steps: [
      { frames: 30, input: E }, { frames: 20, input: [0, -1, true] }, { frames: 20, input: [-1, 1, false] }, { frames: 6 },
      { play: 'slash' }, { frames: 40 }, { frames: 1, input: [0, 1, false] }, { frames: 1 }, { play: 'cleave' }, { frames: 50 },
      { frames: 1, input: E }, { frames: 1 }, { play: 'dash' }, { frames: 36 }, { play: 'backstep' }, { frames: 36 }, { play: 'jump' }, { frames: 50 },
      { play: 'hit' }, { frames: 30 }, { play: 'death' }, { frames: 60 }, { play: 'slash' }, { frames: 4 }, { reset: true }, { frames: 4 },
    ],
  },
  malvek: {
    about:
      'Malvek in the crypt entrance: the soul bolt from his palm stopped by the north wall and its burst, an aimed bolt (C5) stopped by a lantern post, the reap\'s spark; ' +
      'then walking into what stops a body (moveIn, at `radius`): stopped by a coffin, sliding along the reliquary and a lantern post, pressed against the shut crypt door, ' +
      'sliding along the wall until one of its piers holds him, stopped by the east wall, and sliding along the other coffin into the corner by the lever.',
    sheets: ['characters/malvek', 'vfx', 'scenes/crypt-entrance'],
    character: 'malvek',
    scene: 'scenes/crypt-entrance',
    start: { x: 4 * 48, y: 2 * 48.442778265829546, row: 4 },
    steps: [
      { frames: 30, input: [0, -1, false] }, { frames: 4 }, { play: 'soulbolt' }, { frames: 90 },
      { frames: 20, input: [1, 1, true] }, { frames: 2 }, { aim: [0, 0] }, { play: 'soulbolt' }, { frames: 90 }, { aim: null },
      { frames: 1, input: [-1, 0, false] }, { frames: 1 }, { play: 'reap' }, { frames: 60 },
      { frames: 60, input: [-1, 0, true] }, { frames: 48, input: [1, -1, true] }, { frames: 75, input: [0, -1, false] }, { frames: 24, input: [1, -1, true] },
      { frames: 12, input: [0, 1, false] }, { frames: 80, input: [1, 0, true] }, { frames: 45, input: [-1, 1, true] },
    ],
  },
  wolf: {
    about: 'The ghoul wolf on a free floor: its four-legged walk and run, the bite\'s bone dust at its mouth, the howl, hit and death.',
    sheets: ['characters/wolf', 'vfx'],
    character: 'ghoul-wolf',
    scene: null,
    start: { x: 0, y: 0, row: 6 },
    steps: [
      { frames: 30, input: [1, -1, false] }, { frames: 25, input: [-1, 0, true] }, { frames: 4 },
      { play: 'bite' }, { frames: 45 }, { play: 'howl' }, { frames: 70 }, { play: 'hit' }, { frames: 30 }, { play: 'death' }, { frames: 70 },
    ],
  },
};

const DT = 1 / 60;
/** World units a body reaches from its feet: where the floor stops it short of what it cannot cross. */
const RADIUS = BODY_RADIUS;
const round = (n: number) => (Number.isInteger(n) ? n : Number(n.toFixed(9)));
const point = (p: Vec2) => [round(p.x), round(p.y)];

/** Plays a script against the runtime and records every frame. */
function record(script: Script) {
  const library = buildLibrary(fixtureSheets(...script.sheets.filter((s) => !s.startsWith('scenes/'))));
  const character = library.characters.find((c) => c.name === script.character);
  if (!character) throw new Error(`no character ${script.character}`);
  const scene = script.scene ? fixtureSheets(script.scene)[0].atlas!.meta.data! : null;
  const floor: Floor = scene ? { move: (from, delta, radius) => moveIn(scene.navigation!, scene.grid!, from, delta, radius) } : FREE_FLOOR;
  const world: FxWorld = { effects: library.effects, ...(scene ? { blocked: (from: Vec2, to: Vec2) => flightStop(scene.navigation!, scene.grid!, from, to) } : {}) };
  const actor = createActor(character, { x: script.start.x, y: script.start.y }, { id: 1, row: script.start.row, radius: RADIUS });
  let fx: Fx[] = [];
  let aim: Vec2 | null = null;
  const frames: unknown[] = [];
  const events: unknown[] = [];
  const cue = (fired: ClipEvent[]) => {
    for (const event of fired) {
      events.push([event.clip.key, event.row, event.frame, event.name]);
      fx.push(...cues(event, library.effects, aim ? { aim } : {}));
    }
  };
  let f = 0;
  for (const step of script.steps) {
    if ('play' in step) {
      play(actor, step.play);
      cue(takeEvents(actor));
    } else if ('reset' in step) reset(actor);
    else if ('aim' in step) aim = step.aim ? { x: step.aim[0], y: step.aim[1] } : null;
    else {
      for (let i = 0; i < step.frames; i++) {
        const [dx, dy, run] = step.input ?? [0, 0, false];
        cue(steer(actor, { dx, dy, run }, DT, floor));
        const stepped = stepFx(fx, DT, world);
        fx = stepped.fx;
        const now = shownFrame(actor);
        frames.push({
          f: f++,
          pos: point(actor.pos),
          row: actor.row,
          clip: actor.clip.key,
          time: round(actor.time),
          act: actor.act ? [actor.act.clip.key, round(actor.act.time), actor.act.row, round(actor.act.travelled)] : null,
          held: actor.held ? actor.held.clip.key : null,
          shown: [now.clip.key, now.row, now.index],
          events: events.splice(0),
          fx: fx.map((e) => [e.sheet.id, ...point(e.pos), round(e.lift), e.row, frameOfFx(e), e.motion]),
          fxEvents: stepped.events.map((e) => [e.fx.sheet.id, e.name, e.frame, ...point(e.pos)]),
        });
      }
    }
  }
  return frames;
}

/** Differences between two recorded values: numbers within 1e-6, everything else exactly. */
function differences(a: unknown, b: unknown, path: string, out: string[]) {
  if (out.length > 20) return out;
  if (typeof a === 'number' && typeof b === 'number') {
    if (!(Math.abs(a - b) <= 1e-6)) out.push(`${path}: ${a} vs ${b}`);
  } else if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.push(`${path}: ${a.length} items vs ${b.length}`);
    a.forEach((x, i) => differences(x, b[i], `${path}[${i}]`, out));
  } else if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) differences((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`, out);
  } else if (a !== b) out.push(`${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  return out;
}

/** One frame per line, so a change of behaviour shows as the frames it changes. */
const write = (file: string, trace: object & { frames: unknown[] }) => {
  const { frames, ...head } = trace;
  const body = JSON.stringify(head, null, 2).replace(/\n}$/, `,\n  "frames": [\n${frames.map((frame) => `    ${JSON.stringify(frame)}`).join(',\n')}\n  ]\n}\n`);
  writeFileSync(file, body);
};

console.log(`🧪 ${update ? 'Recording' : 'Checking'} the conformance traces (${Object.keys(SCRIPTS).join(', ')})...\n`);
for (const [name, script] of Object.entries(SCRIPTS)) {
  const file = join(DIR, `${name}.json`);
  const frames = record(script);
  const trace = { format: FORMAT, ...script, dt: DT, radius: RADIUS, frames };
  if (update) {
    write(file, trace);
    console.log(`  wrote tests/runtime/conformance/${name}.json (${frames.length} frames)`);
    continue;
  }
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(saved.format, FORMAT, `${name}: format`);
  assert.deepEqual({ ...saved, frames: undefined }, { ...JSON.parse(JSON.stringify(trace)), frames: undefined }, `${name}: the script changed; record it again with --update`);
  const found = differences(saved.frames, JSON.parse(JSON.stringify(frames)), name, []);
  assert.deepEqual(found, [], `${name}: the runtime no longer plays its trace (record it again with --update only for a deliberate change):\n${found.join('\n')}`);
  console.log(`✔ ${name}: ${frames.length} frames`);
}
console.log(update ? '\nTraces recorded.\n' : '\n✅ conformance traces match\n');
