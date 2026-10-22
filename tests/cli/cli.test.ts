import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

console.log('🧪 Checking agent commands (new-project, new-asset, check, layout, list, export, inspect, contact)...\n');

const project = `zz-cli-test-${Date.now()}`;
const projectDir = resolve('projects', project);
const layoutProject = `${project}-layout`;
const layoutDir = resolve('projects', layoutProject);

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

// Runs an npm script. Never throws: callers check the exit code.
function run(command: string): Result {
  try {
    const stdout = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, stdout, stderr: '' };
  } catch (err: any) {
    return { code: err.status ?? 1, stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? '') };
  }
}

/**
 * A hand-written asset in the project layout: the definition in src/<name>.ts as a named export,
 * the sheet in sheets/<name>.ts re-exporting it (`source` is written with `export default`).
 */
function writeAsset(name: string, source: string): void {
  const id = name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  writeFileSync(resolve(projectDir, 'src', `${name}.ts`), source.replace('export default ', `export const ${id} = `), 'utf8');
  writeFileSync(resolve(projectDir, 'sheets', `${name}.ts`), `export { ${id} as default } from '../src/${name}';\n`, 'utf8');
}

const badgeSource = `import { defineAsset } from '@core';
import { Polygon } from '@core/draw';

export default defineAsset({
  width: 32,
  height: 32,
  scale: 1,
  render({ ctx, preview }) {
    Polygon.circle(12, { cx: 16, cy: 16 }).draw(ctx, { fill: preview ? '#00ff00' : '#ff0000' });
  },
});
`;

try {
  // 1. new-project creates the layout (src/theme.ts, an empty sheets/, a .gitignore for review/) and refuses to overwrite it.
  const created = run(`npm run --silent new-project -- ${project}`);
  assert.equal(created.code, 0, `new-project failed: ${created.stderr}`);
  assert.ok(created.stdout.includes('--engine volume|rig'), `new-project must point at the two engines: ${created.stdout}`);
  const theme = readFileSync(resolve(projectDir, 'src', 'theme.ts'), 'utf8');
  for (const token of ['export const PALETTES', 'export const RAMPS', 'export const CAMERA', 'export const VOLUMES']) {
    assert.ok(theme.includes(token), `the template theme must declare ${token.split(' ').pop()}`);
  }
  assert.deepEqual(readdirSync(resolve(projectDir, 'sheets')), [], 'sheets/ starts empty');
  assert.ok(/^review\/$/m.test(readFileSync(resolve(projectDir, '.gitignore'), 'utf8')), 'the project .gitignore ignores review/');
  assert.deepEqual(readdirSync(projectDir).filter(n => n !== '.DS_Store').sort(), ['.gitignore', 'sheets', 'src'], 'a new project holds only src/, sheets/ and its .gitignore');
  assert.ok(!existsSync(resolve(projectDir, 'STYLE.md')), 'STYLE.md is optional and must not be created by default');
  assert.ok(!existsSync(resolve(projectDir, 'src', 'space.ts')), 'space.ts is only written with --genre');
  const withOptional = run(`npm run --silent new-project -- ${project}-opt --style`);
  assert.equal(withOptional.code, 0, `new-project --style failed: ${withOptional.stderr}`);
  const optionalDir = resolve('projects', `${project}-opt`);
  try {
    assert.ok(readFileSync(resolve(optionalDir, 'STYLE.md'), 'utf8').includes(`${project}-opt`), 'STYLE.md must carry the name');
  } finally {
    rmSync(optionalDir, { recursive: true, force: true });
  }
  const again = run(`npm run --silent new-project -- ${project}`);
  assert.notEqual(again.code, 0, 'new-project must refuse an existing project');
  // --genre writes the space profile from an engine preset; an unknown preset stops before anything is written.
  const badGenre = run(`npm run --silent new-project -- ${project}-genre --genre nope`);
  assert.notEqual(badGenre.code, 0, 'an unknown genre must fail');
  assert.ok(badGenre.stderr.includes('jrpg'), 'and list the presets');
  assert.ok(!existsSync(resolve('projects', `${project}-genre`)), 'without creating the project');
  const genreDir = resolve('projects', `${project}-genre`);
  try {
    assert.equal(run(`npm run --silent new-project -- ${project}-genre --genre tactics --character 64`).code, 0);
    const space = readFileSync(resolve(genreDir, 'src', 'space.ts'), 'utf8');
    assert.ok(space.includes("preset: 'tactics'") && space.includes('= 64;') && space.includes("from './theme'"), 'space.ts carries the preset and the character height, and reads the theme next to it');
  } finally {
    rmSync(genreDir, { recursive: true, force: true });
  }

  // 2. new-asset: volume is the default engine; the drawing in src/<subpath>.ts (a named export), the sheet in
  // sheets/<subpath>.ts (one line re-exporting it); space-separated values; refusal to overwrite.
  const asset = run(`npm run --silent new-asset -- ${project} props/barrel --size 96x64`);
  assert.equal(asset.code, 0, `new-asset failed: ${asset.stderr}`);
  const assetFile = readFileSync(resolve(projectDir, 'src', 'props', 'barrel.ts'), 'utf8');
  assert.ok(assetFile.includes('width: 96') && assetFile.includes('height: 64'), 'new-asset must honor --size');
  assert.ok(assetFile.includes("from '@core/volume'") && assetFile.includes('pivot: { x: 48, y: 50 }'), 'without --engine the asset is a volume asset with its pivot near the bottom');
  assert.ok(assetFile.includes('export const barrel = defineAsset({') && !assetFile.includes('export default'), 'the drawing is a named export of src/');
  assert.equal(readFileSync(resolve(projectDir, 'sheets', 'props', 'barrel.ts'), 'utf8'), "export { barrel as default } from '../../src/props/barrel';\n", 'the sheet is one re-export');
  assert.ok(asset.stdout.includes('The export is 192x128 per frame, 8 directions as rows'), `new-asset must say how big the export is: ${asset.stdout}`);
  assert.notEqual(
    run(`npm run --silent new-asset -- ${project} props/barrel --engine volume`).code,
    0,
    'new-asset must refuse an existing file',
  );

  // 2a. Volume assets: 8 facings by default, the theme's camera; --directions 1 for a piece that never turns; strips.
  const vol = run(`npm run --silent new-asset -- ${project} props/crate --engine volume --size 64x64`);
  assert.equal(vol.code, 0, `new-asset --engine volume failed: ${vol.stderr}`);
  const volFile = readFileSync(resolve(projectDir, 'src', 'props', 'crate.ts'), 'utf8');
  assert.ok(volFile.includes('directions: 8') && volFile.includes("from '../theme'") && volFile.includes('CAMERA.at(') && volFile.includes('scale: 2'), 'volume template uses 8 facings, the theme camera and scale 2');
  assert.equal(run(`npm run --silent new-asset -- ${project} marks/rune --directions 1 --frames 4 --fps 8`).code, 0);
  const rune = readFileSync(resolve(projectDir, 'src', 'marks', 'rune.ts'), 'utf8');
  assert.ok(!rune.includes('directions:') && rune.includes('frames: 4') && rune.includes('fps: 8') && rune.includes('frameIndex'), 'one facing writes no directions; frames and fps make a strip');
  // Only the two engines of Diorama; a rejected command leaves no file.
  for (const engine of ['sprite', 'nope']) {
    const refused = run(`npm run --silent new-asset -- ${project} flat --engine ${engine}`);
    assert.ok(refused.code !== 0 && refused.stderr.includes('"volume" or "rig"'), `--engine ${engine} must be refused and name the engines: ${refused.stderr}`);
  }
  assert.notEqual(run(`npm run --silent new-asset -- ${project} flat --directions 0`).code, 0, '--directions must be a whole number, 1 or more');
  const badName = run(`npm run --silent new-asset -- ${project} props/Big_Crate`);
  assert.ok(badName.code !== 0 && badName.stderr.includes('kebab-case'), `a subpath that is not kebab-case must be refused: ${badName.stderr}`);
  assert.ok(!existsSync(resolve(projectDir, 'src', 'flat.ts')) && !existsSync(resolve(projectDir, 'sheets', 'flat.ts')) && !existsSync(resolve(projectDir, 'sheets', 'props', 'Big_Crate.ts')), 'a rejected command must not leave a file');

  // 2c. Rig assets: the first clip of a character creates its src/<folder>/character.ts (defineCharacter with
  // the theme's first VOLUMES key in mannequinSkin, cell and pivot fitting the skeleton); every
  // clip sheet (sheets/<folder>/<clip>.ts) is one line exporting character.sheet('<key>').
  const charDir = (name: string) => resolve(projectDir, 'src', 'characters', name);
  const clipSheet = (name: string, clip: string) => resolve(projectDir, 'sheets', 'characters', name, `${clip}.ts`);
  const rig = run(`npm run --silent new-asset -- ${project} characters/knight/walk --engine rig`);
  assert.equal(rig.code, 0, `new-asset --engine rig failed: ${rig.stderr}`);
  const knight = readFileSync(resolve(charDir('knight'), 'character.ts'), 'utf8');
  assert.ok(knight.includes('defineCharacter({') && knight.includes("name: 'knight'") && knight.includes('mannequinSkin(VOLUMES.cloth)'), 'the character wraps the first theme material in mannequinSkin');
  assert.ok(knight.includes("from '../../theme'") && knight.includes('camera: CAMERA') && knight.includes('diorama-rig skill'), 'the character reads the theme camera and points at the skill');
  assert.ok(knight.includes('humanoid()') && knight.includes("walk: locomotion(skeleton, 'walk')"), 'the first clip is a humanoid walk keyed by the file name');
  assert.ok(knight.includes('width: 96') && knight.includes('height: 112') && knight.includes('pivot: { x: 48, y: 96 }'), 'humanoid cell is 96x112 with the feet at 48,96');
  assert.ok(knight.includes('frames: 8') && knight.includes('directions: 8'), 'rig template defaults to 8 frames and 8 facings');
  const knightWalk = readFileSync(clipSheet('knight', 'walk'), 'utf8');
  assert.ok(knightWalk.includes("from '../../../src/characters/knight/character'") && knightWalk.includes("character.sheet('walk')"), 'a clip sheet only exports its sheet of the character in src/');
  assert.ok(!existsSync(resolve(charDir('knight'), 'walk.ts')), 'nothing of a clip sheet is written into src/');
  const rigPup = run(`npm run --silent new-asset -- ${project} characters/pup/walk --engine rig --skeleton quadruped --frames 4 --directions 4`);
  assert.equal(rigPup.code, 0, `new-asset --engine rig --skeleton quadruped failed: ${rigPup.stderr}`);
  const pupChar = readFileSync(resolve(charDir('pup'), 'character.ts'), 'utf8');
  assert.ok(pupChar.includes('quadruped()') && pupChar.includes('width: 112') && pupChar.includes('height: 96') && pupChar.includes('pivot: { x: 56, y: 72 }'), 'quadruped cell is 112x96 with the feet at 56,72');
  assert.ok(pupChar.includes('frames: 4') && pupChar.includes('directions: 4'), 'rig template honors --frames and --directions');
  // A second clip of an existing character leaves character.ts alone and says what to add.
  const pupBite = run(`npm run --silent new-asset -- ${project} characters/pup/bite --engine rig --clip attack`);
  assert.equal(pupBite.code, 0, pupBite.stderr);
  assert.ok(pupBite.stdout.includes("'bite': bite(skeleton)") && readFileSync(resolve(charDir('pup'), 'character.ts'), 'utf8') === pupChar, 'a second clip is added by hand to clips');
  assert.ok(readFileSync(clipSheet('pup', 'bite'), 'utf8').includes("character.sheet('bite')"), 'and gets its sheet');
  writeFileSync(resolve(charDir('pup'), 'character.ts'), pupChar.replace(/import \{ ([^}]*) \} from '@core\/rig';/, "import { bite, $1 } from '@core/rig';").replace('  clips: {\n', '  clips: {\n    bite: bite(skeleton),\n'), 'utf8');
  assert.equal(run(`npm run --silent new-asset -- ${project} characters/imp/idle --engine rig --size 80x100`).code, 0);
  const imp = readFileSync(resolve(charDir('imp'), 'character.ts'), 'utf8');
  assert.ok(imp.includes('idle: idle(skeleton)') && imp.includes('width: 80') && imp.includes('pivot: { x: 40, y: 86 }'), 'the clip preset follows the file name, and --size scales the pivot with the cell');
  for (const [target, flags, why] of [
    ['characters/bad', '--skeleton bird', 'an unknown skeleton'],
    ['characters/bad', '--clip fly', 'an unknown clip'],
    ['characters/bad', '--fps 8', '--fps (the clip sets the playback speed)'],
    ['lonely', '', 'a clip without a character folder'],
    ['characters/ogre/Walk_Fast', '', 'a clip key that is not lowercase-dashed'],
  ]) {
    assert.notEqual(run(`npm run --silent new-asset -- ${project} ${target} --engine rig ${flags}`).code, 0, `rig must reject ${why}`);
  }
  assert.ok(!existsSync(resolve(projectDir, 'sheets', 'characters', 'bad.ts')) && !existsSync(resolve(projectDir, 'src', 'characters', 'character.ts')) && !existsSync(charDir('ogre')) && !existsSync(resolve(projectDir, 'sheets', 'characters', 'ogre')), 'a rejected rig command must not leave a file');
  assert.notEqual(run(`npm run --silent new-asset -- ${project} flat --engine volume --skeleton humanoid`).code, 0, '--skeleton must be refused outside --engine rig');
  assert.notEqual(run(`npm run --silent new-asset -- ${project} flat --clip walk`).code, 0, '--clip must be refused outside --engine rig');
  // A theme with no VOLUMES material leaves a TODO instead of guessing a key.
  const bare = `${project}-novol`;
  const bareDir = resolve('projects', bare);
  assert.equal(run(`npm run --silent new-project -- ${bare}`).code, 0);
  try {
    writeFileSync(resolve(bareDir, 'src', 'theme.ts'), `import { Camera, type VolumeStyle } from '@core/volume';
export const PALETTES = { ink: '#000000' };
export const CAMERA = new Camera({ tilt: 48, heightBoost: 1.2, light: { azimuth: 140, elevation: 45, ambient: 0.35 } });
export const VOLUMES: Record<string, VolumeStyle> = {};
`, 'utf8');
    assert.equal(run(`npm run --silent new-asset -- ${bare} hero/walk --engine rig`).code, 0);
    const bareFile = readFileSync(resolve(bareDir, 'src', 'hero', 'character.ts'), 'utf8');
    assert.ok(bareFile.includes('TODO') && !bareFile.includes('VOLUMES.cloth'), 'a theme without a VOLUMES key must leave a TODO');
  } finally {
    rmSync(bareDir, { recursive: true, force: true });
  }

  // 2b. A freshly created project must type-check and follow the layout: the template theme may not depend on
  // missing files, and the scaffolds are thin sheets over src/. Not exported yet: warnings, unless --strict.
  const checked = run(`npm run --silent check -- ${project}`);
  assert.equal(checked.code, 0, `a new project must pass check: ${checked.stdout}`);
  assert.ok(checked.stdout.includes('layout follows docs/ARCHITECTURE.md') && checked.stdout.includes('not exported yet'), `check runs the layout rules too: ${checked.stdout}`);
  assert.notEqual(run(`npm run --silent check -- ${project} --strict`).code, 0, 'with --strict, sheets without an export fail');

  // 3. list --json reports the sheets, and where the project lives.
  const listed = JSON.parse(run(`npm run --silent list -- ${project} --json`).stdout);
  assert.deepEqual(listed.projects[0].sheets, ['characters/imp/idle', 'characters/knight/walk', 'characters/pup/bite', 'characters/pup/walk', 'marks/rune', 'props/barrel', 'props/crate']);
  assert.equal(listed.projects[0].dir, `projects/${project}`);
  // Projects are found in projects/ first, then examples/; examples/<name> names the sample explicitly.
  assert.equal(JSON.parse(run('npm run --silent list -- pivot-v2-2d --json').stdout).projects[0].dir, 'examples/pivot-v2-2d', 'the sample is found in examples/');
  assert.equal(JSON.parse(run('npm run --silent list -- examples/pivot-v2-2d --json').stdout).projects[0].project, 'pivot-v2-2d');
  const missingProject = run('npm run --silent list -- zz-no-such-project');
  assert.ok(missingProject.code !== 0 && missingProject.stderr.includes('projects/ or examples/') && missingProject.stderr.includes('pivot-v2-2d (examples)'), `an unknown project lists the ones there are: ${missingProject.stderr}`);

  // 3b. A volume scaffold exports as a direction sheet: 8 rows, the pivot at scale 2, the role in meta.data.
  assert.equal(run(`npm run --silent export -- ${project} props/crate`).code, 0, 'the volume scaffold must export');
  const crate = JSON.parse(readFileSync(resolve(projectDir, 'assets', 'props', 'crate.json'), 'utf8'));
  assert.deepEqual(crate.meta.directions, ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']);
  assert.deepEqual([crate.meta.width, crate.meta.height, crate.meta.pivot.x, crate.meta.pivot.y, crate.meta.data.role], [128, 1024, 64, 100, 'prop']);

  // 4. Mockup isolation (the review render scenery-test uses): an official export is not changed by a mockup export.
  writeAsset('badge', badgeSource);
  const official = run(`npm run --silent export -- ${project} badge --json`);
  assert.equal(official.code, 0, `official export failed: ${official.stderr}`);
  const officialPath = resolve(projectDir, 'assets', 'badge.png');
  const before = readFileSync(officialPath);

  const mockup = run(`npm run --silent export -- ${project} badge --mockup --json`);
  assert.equal(mockup.code, 0, `mockup export failed: ${mockup.stderr}`);
  const mockupSummary = JSON.parse(mockup.stdout);
  assert.equal(mockupSummary.mode, 'mockup');
  assert.equal(mockupSummary.outputDir, `projects/${project}/review/mockups`);
  assert.ok(existsSync(resolve(projectDir, 'review', 'mockups', 'badge.png')), 'mockup must write to review/mockups/');
  assert.ok(readFileSync(officialPath).equals(before), 'mockup export must not change assets/badge.png');

  // 5. Unknown export options are rejected before anything is rendered.
  for (const flag of ['--preview', '--sheet', '-c']) {
    assert.notEqual(run(`npm run --silent export -- ${project} badge ${flag}`).code, 0, `${flag} must be rejected`);
  }

  // 6. inspect returns numbers for an official output.
  const inspected = JSON.parse(run(`npm run --silent inspect -- projects/${project}/assets/badge.png --json`).stdout);
  assert.equal(inspected.width, 32);
  assert.equal(inspected.height, 32);
  assert.ok(inspected.distinctOpaqueColors > 0, 'inspect must count opaque colors');

  // 6b. A character sheet reports its loop in inspect, and contact takes a subset of rows and frames.
  const pup = run(`npm run --silent export -- ${project} characters/pup/walk --json`);
  assert.equal(pup.code, 0, `rig export failed: ${pup.stderr}`);
  const pupPng = `projects/${project}/assets/characters/pup/walk.png`;
  const pupInspect = run(`npm run --silent inspect -- ${pupPng}`);
  assert.ok(/motion: clean · loops \(gap 0\)/.test(pupInspect.stdout), `inspect must print the loop status: ${pupInspect.stdout}`);
  assert.ok(pupInspect.stdout.includes('character: pup · this sheet: walk (walk) · 2 clips') && pupInspect.stdout.includes('controls: idle none · move walk · attack: bite'), `inspect must summarize the character manifest: ${pupInspect.stdout}`);
  assert.ok(pupInspect.stdout.includes('no sheet for clip "bite"') && pupInspect.stdout.includes('no idle clip'), 'inspect must report clips without a sheet and manifest warnings');
  assert.equal(JSON.parse(run(`npm run --silent inspect -- ${pupPng} --json`).stdout).motion.loop, true, 'inspect --json must carry the loop flag');

  // The hint needs an atlas whose clip stands still, ends where it starts and has loop false.
  // Scratch files of the test live in review/ (the project's scratch place).
  const loopy = (data: object) => {
    writeFileSync(resolve(projectDir, 'review', 'temp', 'loopy.json'), JSON.stringify({ frames: {}, meta: { data } }), 'utf8');
    return run(`npm run --silent inspect -- projects/${project}/review/temp/loopy.png`);
  };
  mkdirSync(resolve(projectDir, 'review', 'temp'), { recursive: true });
  copyFileSync(resolve(projectDir, 'assets', 'badge.png'), resolve(projectDir, 'review', 'temp', 'loopy.png'));
  const cycle = loopy({ loop: false, groundSpeed: 0, clipKind: 'idle', motion: { loopGap: 0, warnings: [] } });
  assert.ok(cycle.stdout.includes('motion: clean · plays once') && cycle.stdout.includes('pass loop: true to defineClip'), `a closed clip with loop false must get the hint: ${cycle.stdout}`);
  const cycleJson = JSON.parse(run(`npm run --silent inspect -- projects/${project}/review/temp/loopy.png --json`).stdout).motion;
  assert.ok(cycleJson.loop === false && cycleJson.loopGap === 0 && String(cycleJson.hint).includes('pass loop: true to defineClip'), 'inspect --json must carry the loop flag, the gap and the hint');
  assert.ok(!loopy({ loop: false, groundSpeed: 0, clipKind: 'action', events: [{ frame: 4, name: 'hit' }], motion: { loopGap: 0, warnings: [] } }).stdout.includes('hint:'), 'an action (it has events) needs no loop hint');
  assert.ok(loopy({ loop: false, groundSpeed: 0, clipKind: 'action', events: [], motion: { loopGap: 0, warnings: [] } }).stdout.includes('hint:'), 'an engine atlas of a forgotten cycle (clipKind action, no events) gets the hint');
  assert.ok(!loopy({ loop: false, groundSpeed: 0, clipKind: 'idle', motion: { loopGap: 0.4, warnings: [] } }).stdout.includes('hint:'), 'an open clip needs no loop hint');
  assert.ok(loopy({ loop: true, motion: { loopGap: null, warnings: [] } }).stdout.includes('motion: clean · loops\n'), 'a null loopGap prints the loop without a gap');

  // Contact: 4 facings (S, W, N, E) x 4 frames of 224x192 cells. 2x by default, subsets in the name.
  const sheet = (args: string) => JSON.parse(run(`npm run --silent contact -- ${pupPng} ${args} --json`).stdout);
  const pngSize = (rel: string) => {
    const bytes = readFileSync(resolve(rel));
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  };
  const full = sheet('');
  assert.ok(full.file.startsWith(`projects/${project}/review/contact/characters/pup/walk-contact`), `contact writes into review/contact/ at the asset's path: ${full.file}`);
  assert.equal(full.zoom, 2, 'contact defaults to 2x while the sheet stays narrow');
  assert.equal(full.rows, 4);
  assert.deepEqual(pngSize(full.file), { width: 4 * 224 * 2 + 5 * 6, height: 4 * 192 * 2 + 5 * 6 }, 'full sheet at 2x');
  const part = sheet('--rows W,S --frames 0-1');
  assert.ok(part.file.endsWith('walk-contact-W-S-f0-1.png'), `subset must be in the file name: ${part.file}`);
  assert.deepEqual(part.subset, { rows: ['W', 'S'], frames: [0, 1] });
  assert.deepEqual(pngSize(part.file), { width: 2 * 224 * 2 + 3 * 6, height: 2 * 192 * 2 + 3 * 6 }, 'two rows x two frames at 2x');
  assert.ok(existsSync(resolve(full.file)) && existsSync(resolve(part.file)), 'a subset must not overwrite the full sheet');
  assert.ok(sheet('--rows w --frames 0,2 --gray').file.endsWith('walk-contact-W-f0_2-gray.png'), 'rows match any case, a frame list is encoded with "_", gray goes last');
  assert.equal(sheet('--rows N --zoom 1').zoom, 1, 'an explicit --zoom wins');
  assert.notEqual(run(`npm run --silent contact -- ${pupPng} --rows NE`).code, 0, 'contact must reject a direction the sheet lacks');
  assert.notEqual(run(`npm run --silent contact -- ${pupPng} --frames 9`).code, 0, 'contact must reject a frame the sheet lacks');
  assert.notEqual(run(`npm run --silent contact -- ${pupPng} --frames 3-1`).code, 0, 'contact must reject a backwards frame range');
  // A sheet that would pass ~4000px at 2x drops to 1x: 30 cells of 160px.
  writeAsset('wide', `import { defineAsset } from '@core';
import { Polygon } from '@core/draw';

export default defineAsset({
  width: 160,
  height: 32,
  scale: 1,
  frames: 30,
  fps: 12,
  render({ ctx, frameIndex }) {
    Polygon.circle(8, { cx: 16 + frameIndex * 4, cy: 16 }).draw(ctx, { fill: '#2244ff' });
  },
});
`);
  assert.equal(run(`npm run --silent export -- ${project} wide`).code, 0);
  const wide = JSON.parse(run(`npm run --silent contact -- projects/${project}/assets/wide.png --json`).stdout);
  assert.equal(wide.zoom, 1, 'a very wide strip falls back to 1x');
  assert.equal(pngSize(wide.file).width, 30 * 160 + 31 * 6);
  assert.equal(JSON.parse(run(`npm run --silent contact -- projects/${project}/assets/wide.png --frames 0-3 --json`).stdout).zoom, 2, 'a subset of the strip fits at 2x');
  assert.notEqual(run(`npm run --silent contact -- projects/${project}/assets/wide.png --rows W`).code, 0, '--rows needs a direction sheet: a strip has no directions');

  // Contact --with: the same rows and frames of a second sheet, as a band under the first behind a
  // 2px line, with the cells aligned. The rows of a PNG written by contact (no filter) are compared.
  const pixelRows = (rel: string): Buffer[] => {
    const bytes = readFileSync(resolve(rel));
    const idat: Buffer[] = [];
    for (let at = 8; at < bytes.length; at += 12 + bytes.readUInt32BE(at)) {
      if (bytes.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(bytes.subarray(at + 8, at + 8 + bytes.readUInt32BE(at)));
    }
    const raw = inflateSync(Buffer.concat(idat));
    const stride = pngSize(rel).width * 4 + 1;
    return Array.from({ length: pngSize(rel).height }, (_, y) => raw.subarray(y * stride + 1, (y + 1) * stride));
  };
  const rowsMatch = (whole: Buffer[], from: number, band: Buffer[]) => band.every((row, y) => whole[from + y].equals(row));
  const versus = (args: string, a: string, b: string) => JSON.parse(run(`npm run --silent contact -- ${a} --with ${b} ${args} --json`).stdout);
  writeFileSync(resolve(projectDir, 'review', 'temp', 'walk-before.json'), readFileSync(resolve(pupPng.replace(/\.png$/, '.json'))));
  copyFileSync(resolve(pupPng), resolve(projectDir, 'review', 'temp', 'walk-before.png'));
  const beforePng = `projects/${project}/review/temp/walk-before.png`;
  const onSelf = versus('--rows W,S --frames 0-1', pupPng, beforePng);
  assert.deepEqual({ width: onSelf.width, height: onSelf.height }, { width: part.width, height: 2 * part.height + 2 }, 'two bands of the same size and a 2px line between them');
  assert.ok(onSelf.file.endsWith('walk-vs-temp_walk-before-contact-W-S-f0-1.png') && onSelf.with === beforePng, `the second sheet is in the name: ${onSelf.file}`);
  assert.deepEqual(onSelf.bands.map((b: { rows: number }) => b.rows), [2, 2]);
  const solo = pixelRows(part.file);
  const stacked = pixelRows(onSelf.file);
  assert.ok(rowsMatch(stacked, 0, solo) && rowsMatch(stacked, part.height + 2, solo), 'each band is the plain sheet, cells at the same columns');
  const line = stacked[part.height];
  assert.ok(line.equals(stacked[part.height + 1]) && line.equals(Buffer.alloc(line.length, line.subarray(0, 4))) && !line.equals(stacked[part.height - 1]), 'a plain 2px line, not the gap color, separates the bands');

  // A second character: its own rows and frames come from its own sheet. Without --rows it follows the first sheet's directions
  // (4 here, the wolf has 8); the other way round it cannot, and says so.
  assert.equal(run(`npm run --silent new-asset -- ${project} characters/wolf/walk --engine rig --skeleton quadruped --frames 4`).code, 0);
  assert.equal(run(`npm run --silent export -- ${project} characters/wolf/walk`).code, 0);
  const wolfPng = `projects/${project}/assets/characters/wolf/walk.png`;
  const other = versus('--rows W,S --frames 0-1', pupPng, wolfPng);
  assert.ok(other.file.endsWith('walk-vs-wolf_walk-contact-W-S-f0-1.png'), `a sheet from another folder is named with it: ${other.file}`);
  const wolfSolo = JSON.parse(run(`npm run --silent contact -- ${wolfPng} --rows W,S --frames 0-1 --json`).stdout);
  assert.ok(rowsMatch(pixelRows(other.file), part.height + 2, pixelRows(wolfSolo.file)), 'the bottom band is the second sheet, same rows and frames');
  const followed = versus('', pupPng, wolfPng);
  assert.deepEqual(followed.bands.map((b: { rowOrder: string }) => b.rowOrder), ['S | W | N | E', 'S | W | N | E'], 'the second sheet follows the directions of the first');
  const reversed = run(`npm run --silent contact -- ${wolfPng} --with ${pupPng}`);
  assert.ok(reversed.code !== 0 && reversed.stderr.includes('has no direction "SW"') && reversed.stderr.includes('--rows'), `a sheet with fewer directions must name the way out: ${reversed.stderr}`);
  assert.equal(JSON.parse(run(`npm run --silent contact -- ${wolfPng} --with ${pupPng} --rows W --json`).stdout).rows, 2, '--rows lets the wolf sheet be compared with the pup');

  // Cells of different sizes cannot line up, unless --zoom says each band keeps its own: 224x192 against 32x32.
  const badgePng = `projects/${project}/assets/badge.png`;
  const mismatch = run(`npm run --silent contact -- ${pupPng} --with ${badgePng}`);
  assert.ok(mismatch.code !== 0 && mismatch.stderr.includes('cells differ in size') && mismatch.stderr.includes('--zoom'), `different cell sizes must fail with a clear message: ${mismatch.stderr}`);
  const mixed = versus('--zoom 1', pupPng, badgePng);
  assert.deepEqual({ width: mixed.width, height: mixed.height }, { width: 4 * 224 + 5 * 6, height: (4 * 192 + 5 * 6) + 2 + (32 + 2 * 6) }, 'with --zoom each band keeps its own cell size, left-aligned');
  assert.deepEqual(mixed.bands.map((b: { cell: object }) => b.cell), [{ width: 224, height: 192 }, { width: 32, height: 32 }]);
  assert.notEqual(run(`npm run --silent contact -- ${pupPng} --with=`).code, 0, '--with needs a file');
  assert.notEqual(run(`npm run --silent contact -- ${pupPng} --with projects/${project}/assets/none.png`).code, 0, '--with must reject a missing file');

  // 7. An unknown command is refused, and the CLI lists the commands it has.
  const unknown = run(`npx tsx tools/cli.ts nope ${project}`);
  assert.ok(unknown.code !== 0 && unknown.stderr.includes('unknown command "nope"') && unknown.stderr.includes('npm run new-asset'), `an unknown command must be refused with the list of commands: ${unknown.stderr}`);

  // 8. Named animations reach the atlas; an out-of-range index fails before any PNG is written.
  writeAsset('strip', `import { defineAsset } from '@core';
import { Polygon } from '@core/draw';

export default defineAsset({
  width: 32,
  height: 32,
  scale: 1,
  frames: 2,
  fps: 4,
  animations: { idle: [0, 1] },
  render({ ctx, frameIndex }) {
    Polygon.circle(8 + frameIndex * 2, { cx: 16, cy: 16 }).draw(ctx, { fill: '#2244ff' });
  },
});
`);
  const strip = run(`npm run --silent export -- ${project} strip --json`);
  assert.equal(strip.code, 0, `strip export failed: ${strip.stderr}`);
  const atlas = JSON.parse(readFileSync(resolve(projectDir, 'assets', 'strip.json'), 'utf8'));
  assert.deepEqual(atlas.meta.animations, { idle: [0, 1] }, 'atlas must carry the named animations');
  assert.equal(atlas.meta.frameCount, 2);

  writeAsset('badstrip', `import { defineAsset } from '@core';

export default defineAsset({
  width: 32,
  height: 32,
  scale: 1,
  frames: 2,
  animations: { idle: [0, 5] },
  render({ ctx }) {},
});
`);
  const bad = run(`npm run --silent export -- ${project} badstrip`);
  assert.notEqual(bad.code, 0, 'an out-of-range animation index must fail the export');
  assert.ok(!existsSync(resolve(projectDir, 'assets', 'badstrip.png')), 'a failed animation must not leave a PNG behind');

  // 9. --help on a subcommand prints its usage and exits 0; without a command it lists them all.
  const help = run('npm run --silent new-asset -- --help');
  assert.equal(help.code, 0, '--help must exit 0');
  assert.ok(help.stdout.includes('--frames') && help.stdout.includes('volume|rig'), '--help must describe the options of the two engines');
  const overview = run('npx tsx tools/cli.ts --help');
  assert.ok(overview.code === 0 && overview.stdout.includes('npm run scenery-items') && overview.stdout.includes('npm run export'), `--help lists the commands: ${overview.stdout}`);

  // 10. The layout checker (npm run layout, and npm run check): each rule fails with a message that says what to move where.
  assert.equal(run(`npm run --silent new-project -- ${layoutProject}`).code, 0);
  const layoutOf = (args = '') => run(`npm run --silent layout -- ${layoutProject} ${args}`);
  const clean = layoutOf();
  assert.ok(clean.code === 0 && clean.stdout.includes('layout follows docs/ARCHITECTURE.md'), `a new project follows the layout: ${clean.stdout}`);
  assert.equal(run(`npm run --silent new-asset -- ${layoutProject} props/crate`).code, 0);
  const unexported = layoutOf();
  assert.ok(unexported.code === 0 && unexported.stdout.includes('not exported yet'), `a sheet without its export is a warning: ${unexported.stdout}`);
  const strict = layoutOf('--strict');
  assert.ok(strict.code !== 0 && strict.stdout.includes('sheets/props/crate.ts has no export yet') && strict.stdout.includes(`npm run export -- ${layoutProject} props/crate`), `--strict fails on it and says how to export it: ${strict.stdout}`);
  // Each broken rule, one at a time: write the file, check the message, remove it.
  const breaks = (file: string, content: string, expected: string[], why: string) => {
    const full = resolve(layoutDir, file);
    mkdirSync(resolve(full, '..'), { recursive: true });
    writeFileSync(full, content, 'utf8');
    try {
      const result = layoutOf();
      assert.notEqual(result.code, 0, `${why} must fail the layout check`);
      for (const text of expected) assert.ok(result.stdout.includes(text), `${why}: the message must say "${text}": ${result.stdout}`);
      return result;
    } finally {
      rmSync(full, { force: true });
    }
  };
  breaks('notes.txt', 'todo\n', ['notes.txt is not allowed at the project root', 'README.md or STYLE.md'], 'a stray file at the root');
  breaks('drafts/crate.ts', 'export {};\n', ['drafts/ is not allowed at the project root', 'src/drafts/'], 'a stray folder at the root');
  rmSync(resolve(layoutDir, 'drafts'), { recursive: true, force: true });
  breaks('src/_helpers.ts', 'export const x = 1;\n', ['src/_helpers.ts: no underscore prefixes', 'rename it to src/helpers.ts'], 'an underscore file in src/');
  breaks('sheets/_shared.ts', 'export const x = 1;\n', ['sheets/_shared.ts: no underscore prefixes', 'Every file in sheets/ is a sheet'], 'an underscore file in sheets/');
  breaks('src/BigCrate.ts', 'export const x = 1;\n', ['names are kebab-case', 'src/big-crate.ts'], 'a name that is not kebab-case');
  const fat = `import { defineAsset } from '@core';

export default defineAsset({
  width: 32,
  height: 32,
  render({ ctx }) {
    ctx.fillRect(0, 0, 4, 4);
  },
});
`;
  breaks('sheets/props/fat.ts', fat, ['sheets/props/fat.ts declares a function or a class', 'drawing code lives in src/', "export { fat as default } from '../../src/props/fat'"], 'a sheet with drawing code');
  const long = `import { defineAsset } from '@core';\n\nconst SIZES = [\n${Array.from({ length: 24 }, (_, i) => `  ${i},`).join('\n')}\n];\n\nexport default defineAsset({ width: SIZES.length, height: 1 } as never);\n`;
  breaks('sheets/props/long.ts', long, ['sheets/props/long.ts has 28 lines of code', 'at most 20'], 'a long sheet');
  breaks('src/uses-sheet.ts', "import crate from '../sheets/props/crate';\n\nexport const again = crate;\n", ['src/uses-sheet.ts imports "../sheets/props/crate", a sheet', 'src/ never imports sheets/'], 'src/ importing a sheet');
  breaks('sheets/props/twin.ts', "export { default } from './crate';\n", ['sheets/props/twin.ts imports "./crate", another sheet'], 'a sheet importing a sheet');
  breaks('sheets/gear/helm.ts', "export { crate as default } from '../../src/props/crate';\n", ['has lost its "// Generated by npm run gear-items" first line', `npm run gear-items -- ${layoutProject}`], 'a generated sheet without its header');
  breaks('src/kit/catalog.ts', 'export const KIT = {};\n', ['src/kit/ has a catalog.ts but no index.ts'], 'a kit without its index');
  rmSync(resolve(layoutDir, 'src', 'kit'), { recursive: true, force: true });
  breaks('assets/notes.txt', 'x\n', ['assets/notes.txt: assets/ holds only exported images (PNG) and atlas JSON'], 'a stray file in assets/');
  // An asset without its sheet is an orphan: a warning, an error with --strict.
  mkdirSync(resolve(layoutDir, 'assets'), { recursive: true });
  writeFileSync(resolve(layoutDir, 'assets', 'ghost.png'), readFileSync(resolve(projectDir, 'assets', 'badge.png')));
  assert.equal(layoutOf().code, 0, 'an orphan asset is only a warning');
  assert.ok(layoutOf('--strict').stdout.includes('assets/ghost.png has no sheet'), 'and --strict names it');
  rmSync(resolve(layoutDir, 'assets', 'ghost.png'));
  // check runs the same rules after the type check, and --json carries the report.
  writeFileSync(resolve(layoutDir, 'scratch.md'), 'x\n', 'utf8');
  const checkBroken = run(`npm run --silent check -- ${layoutProject}`);
  assert.ok(checkBroken.code !== 0 && checkBroken.stdout.includes('no type errors') && checkBroken.stdout.includes('scratch.md is not allowed at the project root'), `check fails on a layout error: ${checkBroken.stdout}`);
  const layoutJson = JSON.parse(layoutOf('--json').stdout);
  assert.ok(layoutJson.ok === false && layoutJson.errors.some((e: { rule: string; path: string }) => e.rule === 'root' && e.path === 'scratch.md'), 'layout --json lists the errors by rule and path');
  rmSync(resolve(layoutDir, 'scratch.md'));
  assert.equal(layoutOf().code, 0, 'and passes again once the file is gone');
  // The sample follows every rule.
  const sample = JSON.parse(run('npm run --silent layout -- pivot-v2-2d --json').stdout);
  assert.ok(sample.ok && sample.errors.length === 0, `examples/pivot-v2-2d follows the layout: ${JSON.stringify(sample.errors.slice(0, 3))}`);

  console.log('✔ new-project, new-asset (volume and rig), check, layout, list, export (incl. --mockup), inspect and contact behave as documented.\n');
} finally {
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(layoutDir, { recursive: true, force: true });
}
