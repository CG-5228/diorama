/**
 * Sheets for the runtime's tests: synthetic atlases written here (the contract's fields, nothing else), and the small JSON
 * fixtures cut from the sample's real exports (`tests/runtime/fixtures/`, no PNG: `assets/` is not versioned). The cut
 * leaves out what the tests do not read (most sheets' cells, a clip's `motion`, the space profile); after an export,
 * `npx tsx tests/runtime/fixtures/cut.ts` cuts them again (see there).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { buildLibrary, readSheet, type Atlas, type AtlasSockets, type CharacterManifest, type Sheet } from '@diorama/runtime';

export const DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'];
export const FACINGS = DIRS.map((_, d) => Math.PI / 2 + (d * 2 * Math.PI) / 8);

export interface ClipSpec {
  key: string;
  action: string;
  clipKind: 'idle' | 'locomotion' | 'action';
  frames: number;
  fps?: number;
  loop?: boolean;
  hold?: boolean;
  groundSpeed?: number;
  events?: Array<{ frame: number; name: string }>;
  tags?: string[];
  /** Cell width in exported px; the anchor sits in the middle of it. */
  frameWidth?: number;
  travel?: number[];
  sockets?: AtlasSockets;
}

/** A character clip sheet: eight facings, 100 px cells pivoted at (width / 2, 90), exported at scale 2. */
export function clipSheet(spec: ClipSpec, manifest?: CharacterManifest): Atlas {
  return {
    meta: {
      mode: 'directions', frameCount: spec.frames, directions: DIRS, directionFacings: FACINGS, pivot: { x: (spec.frameWidth ?? 100) / 2, y: 90 },
      frameWidth: spec.frameWidth ?? 100, frameHeight: 100, fps: spec.fps ?? 10, scale: 2,
      data: {
        role: 'character', skeleton: 'humanoid', key: spec.key, action: spec.action, clipKind: spec.clipKind, loop: spec.loop ?? spec.clipKind !== 'action',
        hold: spec.hold ?? false, tags: spec.tags, groundSpeed: spec.groundSpeed ?? 0, events: spec.events ?? [], travel: spec.travel, sockets: spec.sockets,
        ...(manifest ? { character: manifest } : {}),
      },
    },
    frames: {},
  };
}

/** An effect sheet (`role: 'vfx'`): its frames across, one row per facing (`rows`: 1, 8 or any count), pivoted on its origin. */
export function effectAtlas(id: string, effect: Record<string, unknown>, rows = 1): Atlas {
  const frames = Number(effect.frames ?? 4);
  const names = rows === 8 ? DIRS : rows === 1 ? [] : Array.from({ length: rows }, (_, i) => `D${i}`);
  return {
    meta: {
      mode: rows > 1 ? 'directions' : 'strip', frameCount: frames, ...(rows > 1 ? { directions: names, directionFacings: rows === 8 ? FACINGS : names.map((_, i) => Math.PI / 2 + (i * 2 * Math.PI) / rows) } : {}),
      pivot: { x: 32, y: 32 }, frameWidth: 64, frameHeight: 64, fps: Number(effect.fps ?? 12), scale: 2,
      data: { role: 'vfx', effect: { id, kind: 'burst', frames, fps: 12, loop: false, height: 0, size: 20, directions: rows, ...effect } as never },
    },
    frames: {},
  };
}

/** The sheets of one character folder, read, from specs. */
export const characterSheets = (folder: string, specs: ClipSpec[], manifest?: CharacterManifest): Sheet[] => specs.map((spec) => readSheet(`${folder}/${spec.key}`, clipSheet(spec, manifest)));

/** A library of one character, and the character. */
export function characterOf(folder: string, specs: ClipSpec[], manifest?: CharacterManifest) {
  const library = buildLibrary(characterSheets(folder, specs, manifest));
  return { library, character: library.characters[0] };
}

export const FIXTURES = resolve('tests/runtime/fixtures');

/** Every fixture sheet under a folder of `tests/runtime/fixtures/` (or one sheet), read, in path order. */
export function fixtureSheets(...paths: string[]): Sheet[] {
  const walk = (dir: string): string[] => readdirSync(dir).sort().flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : name.endsWith('.json') ? [join(dir, name)] : []));
  return paths.flatMap((path) => {
    const full = join(FIXTURES, path);
    const files = statSync(full, { throwIfNoEntry: false })?.isDirectory() ? walk(full) : [`${full}.json`];
    return files.map((file) => readSheet(relative(FIXTURES, file).split(sep).join('/').replace(/\.json$/, ''), JSON.parse(readFileSync(file, 'utf8'))));
  });
}

/** Assert two numbers are within `eps`. */
export const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
