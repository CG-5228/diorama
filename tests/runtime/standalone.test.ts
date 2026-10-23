/**
 * The runtime compiles on its own: `packages/runtime` with its own tsconfig.json (lib ES2022, no DOM, no paths, strict), in
 * this process, as tools/typecheck.ts does for a project. A DOM global, a Node module or a package (`@core`) does not
 * compile there. A relative path out of the package does compile, so this test also refuses any program that reads a file
 * outside the package (tests/engine/boundary.test.ts refuses such an import too). The probes below check both. Its
 * package.json declares no dependencies.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import ts from 'typescript';

console.log('🧪 Checking that @diorama/runtime compiles alone (lib ES2022, no DOM, no dependencies)...\n');

const PACKAGE = resolve('packages/runtime');
const configFile = resolve(PACKAGE, 'tsconfig.json');
const read = ts.readConfigFile(configFile, ts.sys.readFile);
assert.equal(read.error, undefined, 'the package has its own tsconfig.json');
const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, PACKAGE, undefined, configFile);
assert.deepEqual(parsed.errors, []);
assert.deepEqual(parsed.options.lib, ['lib.es2022.d.ts'], 'lib ES2022 only: no DOM');
assert.equal(parsed.options.strict, true);
assert.equal(parsed.options.paths, undefined, 'no path aliases: nothing outside the package resolves');
assert.deepEqual(parsed.options.types, [], 'no ambient types (no node)');

const show = (d: ts.Diagnostic) => {
  const message = ts.flattenDiagnosticMessageText(d.messageText, ' ');
  if (!d.file || d.start === undefined) return message;
  const { line } = d.file.getLineAndCharacterOfPosition(d.start);
  return `${relative(resolve('.'), d.file.fileName).split(sep).join('/')}:${line + 1}: ${message}`;
};

/** Compiles the package, plus extra files (path inside the package -> source) served from memory. */
function compile(extra: Record<string, string> = {}) {
  const host = ts.createCompilerHost(parsed.options);
  const virtual = new Map(Object.entries(extra).map(([path, source]) => [resolve(PACKAGE, path), source]));
  const getSourceFile = host.getSourceFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.getSourceFile = (name, version, onError, create) => (virtual.has(resolve(name)) ? ts.createSourceFile(name, virtual.get(resolve(name))!, version) : getSourceFile(name, version, onError, create));
  host.fileExists = (name) => virtual.has(resolve(name)) || fileExists(name);
  host.readFile = (name) => virtual.get(resolve(name)) ?? readFile(name);
  const program = ts.createProgram({ rootNames: [...parsed.fileNames, ...virtual.keys()], options: parsed.options, host });
  return { program, errors: ts.getPreEmitDiagnostics(program).filter((d) => d.category === ts.DiagnosticCategory.Error) };
}

/** The files a program reads from outside the package, but the language's own library. */
const outsideOf = (program: ts.Program) => program.getSourceFiles().map((f) => resolve(f.fileName)).filter((f) => !f.startsWith(PACKAGE + sep) && !/[\\/]typescript[\\/]lib[\\/]lib\.[^\\/]+\.d\.ts$/.test(f));

// 1. The package alone: no errors, and every file it reads is its own or the ES2022 library.
const alone = compile();
assert.equal(alone.errors.length, 0, `the runtime does not compile on its own:\n${alone.errors.map(show).join('\n')}`);
assert.deepEqual(outsideOf(alone.program), [], 'it reads nothing outside the package but the language library');
assert.ok(alone.program.getRootFileNames().some((f) => f.endsWith('src/index.ts')), 'the entry point is compiled');

// 2. The checks bite: a DOM global, a Node module or an import from the engine does not compile.
const probes: Array<[string, string, RegExp]> = [
  ['src/probe-dom.ts', 'export const title = document.title;\n', /Cannot find name 'document'/],
  ['src/probe-node.ts', "import { readFileSync } from 'node:fs';\nexport const read = readFileSync;\n", /Cannot find module 'node:fs'/],
  ['src/probe-core.ts', "import { createRng } from '@core';\nexport const rng = createRng;\n", /Cannot find module '@core'/],
];
for (const [path, source, expected] of probes) {
  const probe = compile({ [path]: source });
  const own = probe.errors.filter((d) => d.file && resolve(d.file.fileName) === resolve(PACKAGE, path));
  assert.ok(own.some((d) => expected.test(ts.flattenDiagnosticMessageText(d.messageText, ' '))), `${path} is refused: ${own.map(show).join('; ') || 'no error'}`);
}
// A relative path out of the package compiles in TypeScript's eyes, but the program then reads a file of core/: the check
// of 1 refuses it.
const byPath = compile({ 'src/probe-path.ts': "import { EDGE } from '../../../core/volume/grid.js';\nexport const edge = EDGE;\n" });
assert.ok(outsideOf(byPath.program).some((f) => f.endsWith(`${sep}core${sep}volume${sep}grid.ts`)), 'a relative import out of the package is caught by what the program reads');

// 3. The package is a package: private, ES modules, its source as the export, and no dependencies at all.
const pkg = JSON.parse(readFileSync(resolve(PACKAGE, 'package.json'), 'utf8'));
assert.equal(pkg.name, '@diorama/runtime');
assert.equal(pkg.private, true);
assert.equal(pkg.type, 'module');
assert.deepEqual(pkg.exports, { '.': './src/index.ts' });
for (const field of ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies']) assert.equal(pkg[field], undefined, `no ${field}`);
assert.equal(dirname(resolve(PACKAGE, pkg.exports['.'])), resolve(PACKAGE, 'src'));

console.log(`✔ ${parsed.fileNames.length} files compile alone; DOM globals, Node modules and packages do not compile there, and nothing outside the package is read.\n`);
