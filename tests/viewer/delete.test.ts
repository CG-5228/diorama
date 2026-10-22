import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PathError,
  deleteAsset,
  deleteProject,
  planDelete,
  restoreAsset,
  restoreProject,
  safeProjectName,
  safeSubpath,
} from '../../viewer/server/assets-fs';

console.log('🧪 Checking the viewer delete / undo endpoint (path validation, trash, restore)...\n');

// A repository in miniature: projects live in <repo>/projects and <repo>/examples, and the trash in <repo>/.diorama-trash.
const root = mkdtempSync(join(tmpdir(), 'diorama-viewer-'));
const projectsDir = join(root, 'projects');
const project = 'demo';
const trash = (...parts: string[]) => join(root, '.diorama-trash', 'assets', project, ...parts);

function seed(rel: string, area: 'assets' | 'sheets', content = 'x', where = join(projectsDir, project)) {
  const file = join(where, area, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content);
  return file;
}

async function rejects(run: () => unknown, label: string) {
  await assert.rejects(Promise.resolve().then(run), PathError, label);
}

try {
  // 1. Names and subpaths that could leave the project are refused before touching the disk.
  for (const bad of ['', '..', '../x', 'a/../b', '/etc/passwd', 'a//b', 'a\\b', 'C:/x', './a', 'a/./b', 'a\0b']) {
    assert.throws(() => safeSubpath(bad), PathError, `safeSubpath must refuse ${JSON.stringify(bad)}`);
  }
  for (const bad of ['', '..', '.hidden', '../other', 'a/b', 'a..b', '-rf']) {
    assert.throws(() => safeProjectName(bad), PathError, `safeProjectName must refuse ${JSON.stringify(bad)}`);
  }
  assert.equal(safeSubpath('characters/wolf/walk.png'), 'characters/wolf/walk.png');
  assert.equal(safeProjectName('pivot-v2-2d'), 'pivot-v2-2d');

  // 2. The plan lists exactly the files that exist: image, atlas, and the optional sheet.
  seed('chars/wolf/walk.png', 'assets');
  seed('chars/wolf/walk.json', 'assets', '{}');
  seed('chars/wolf/walk.ts', 'sheets');
  seed('chars/wolf/idle.png', 'assets');
  const plan = await planDelete(root, project, 'chars/wolf/walk.png');
  assert.deepEqual(plan.files.map((f) => `${f.kind}:${f.rel}:${f.optional}`), [
    'image:chars/wolf/walk.png:false',
    'atlas:chars/wolf/walk.json:false',
    'sheet:chars/wolf/walk.ts:true',
  ]);
  await rejects(() => planDelete(root, project, 'chars/wolf/missing.png'), 'missing asset');
  await rejects(() => planDelete(root, project, '../demo/assets/chars/wolf/walk.png'), 'dot-dot traversal');
  await rejects(() => planDelete(root, project, 'chars/wolf/walk.ts'), 'a sheet is not an exported image');
  await rejects(() => planDelete(root, '../escape', 'a.png'), 'project traversal');

  // 3. A folder symlinked outside assets/ cannot be used to reach other files.
  const outside = mkdtempSync(join(tmpdir(), 'diorama-outside-'));
  writeFileSync(join(outside, 'secret.png'), 'secret');
  symlinkSync(outside, join(projectsDir, project, 'assets', 'link'));
  await rejects(() => planDelete(root, project, 'link/secret.png'), 'symlink escape');
  assert.ok(existsSync(join(outside, 'secret.png')), 'file behind the symlink must be untouched');
  rmSync(outside, { recursive: true, force: true });

  assert.deepEqual(plan.files.map((f) => f.path), [
    'projects/demo/assets/chars/wolf/walk.png',
    'projects/demo/assets/chars/wolf/walk.json',
    'projects/demo/sheets/chars/wolf/walk.ts',
  ], 'paths are from the repository root');
  await rejects(() => planDelete(root, 'ghost', 'a.png'), 'a project that is in neither projects/ nor examples/');

  // 4. Delete without the sheet: image and atlas go to the trash, the sheet stays.
  const first = await deleteAsset(root, project, 'chars/wolf/walk.png');
  assert.ok(!existsSync(join(projectsDir, project, 'assets/chars/wolf/walk.png')));
  assert.ok(!existsSync(join(projectsDir, project, 'assets/chars/wolf/walk.json')));
  assert.ok(existsSync(join(projectsDir, project, 'sheets/chars/wolf/walk.ts')), 'the sheet must stay unless asked');
  assert.ok(existsSync(join(projectsDir, project, 'assets/chars/wolf/idle.png')), 'siblings must stay');
  assert.ok(existsSync(trash(first.trashId, 'assets/chars/wolf/walk.png')));
  assert.ok(existsSync(trash(first.trashId, 'manifest.json')));
  assert.ok(!existsSync(join(projectsDir, project, '.trash')), 'a project root holds only src/, sheets/, assets/ and review/: the trash is outside it');

  // 5. Restore puts everything back and removes the trash entry.
  const restored = await restoreAsset(root, project, first.trashId);
  assert.equal(restored.restored.length, 2);
  assert.ok(existsSync(join(projectsDir, project, 'assets/chars/wolf/walk.png')));
  assert.equal(readFileSync(join(projectsDir, project, 'assets/chars/wolf/walk.json'), 'utf8'), '{}');
  assert.ok(!existsSync(trash(first.trashId)));

  // 6. Delete with the sheet, then refuse to restore over a file that was re-created meanwhile.
  const second = await deleteAsset(root, project, 'chars/wolf/walk.png', { deleteSheet: true });
  assert.ok(!existsSync(join(projectsDir, project, 'sheets/chars/wolf/walk.ts')));
  assert.equal(second.moved.length, 3);
  seed('chars/wolf/walk.png', 'assets', 'new export');
  await rejects(() => restoreAsset(root, project, second.trashId), 'restore must not overwrite');
  assert.equal(readFileSync(join(projectsDir, project, 'assets/chars/wolf/walk.png'), 'utf8'), 'new export');
  assert.ok(existsSync(trash(second.trashId, 'manifest.json')), 'a refused restore keeps the trash entry');

  // 7. A forged manifest cannot move files outside the project or restore from a bad id.
  const forged = trash('forged');
  mkdirSync(forged, { recursive: true });
  writeFileSync(
    join(forged, 'manifest.json'),
    JSON.stringify({ project, subpath: 'x.png', files: [{ kind: 'image', area: 'assets', rel: '../../../outside.png' }] }),
  );
  await rejects(() => restoreAsset(root, project, 'forged'), 'forged manifest');
  await rejects(() => restoreAsset(root, project, '../forged'), 'trash id traversal');

  // 8. Empty folders left behind by a delete are pruned.
  seed('solo/only.png', 'assets');
  await deleteAsset(root, project, 'solo/only.png');
  assert.ok(!existsSync(join(projectsDir, project, 'assets/solo')), 'empty asset folder must be removed');

  // 9. A project is found in projects/ first and then in examples/: a sample's assets can be deleted and restored,
  // a name in projects/ hides the sample of the same name, and a restore only goes back where the asset came from.
  const sample = join(root, 'examples', 'sample');
  seed('gear/helm.png', 'assets', 'x', sample);
  seed('gear/helm.json', 'assets', '{}', sample);
  seed('gear/helm.ts', 'sheets', 'x', sample);
  const samplePlan = await planDelete(root, 'sample', 'gear/helm.png');
  assert.deepEqual(samplePlan.files.map((f) => f.path), ['examples/sample/assets/gear/helm.png', 'examples/sample/assets/gear/helm.json', 'examples/sample/sheets/gear/helm.ts']);
  const sampleGone = await deleteAsset(root, 'sample', 'gear/helm.png', { deleteSheet: true });
  assert.ok(!existsSync(join(sample, 'assets/gear/helm.png')) && !existsSync(join(sample, 'sheets/gear/helm.ts')));
  assert.ok(existsSync(join(root, '.diorama-trash', 'assets', 'sample', sampleGone.trashId, 'sheets/gear/helm.ts')));
  assert.ok(!existsSync(join(sample, '.trash')), 'no trash inside a sample either');
  assert.equal((await restoreAsset(root, 'sample', sampleGone.trashId)).restored.length, 3);
  assert.ok(existsSync(join(sample, 'assets/gear/helm.png')));
  await rejects(() => deleteProject(root, 'sample'), 'a sample ships with Diorama: it is not deleted as a whole');
  assert.ok(existsSync(sample), 'the sample must stay');
  const shadowed = await deleteAsset(root, 'sample', 'gear/helm.png');
  seed('gear/helm.png', 'assets', 'mine', join(projectsDir, 'sample'));
  seed('gear/helm.json', 'assets', '{}', join(projectsDir, 'sample'));
  await rejects(() => restoreAsset(root, 'sample', shadowed.trashId), 'the project of that name is now another one');
  rmSync(join(projectsDir, 'sample'), { recursive: true });
  await restoreAsset(root, 'sample', shadowed.trashId);
  assert.ok(existsSync(join(sample, 'assets/gear/helm.png')), 'back in the sample once the project that hid it is gone');
  assert.ok(!existsSync(join(root, '.diorama-trash', 'assets', 'sample')), 'restoring the last trash entry of a project leaves no empty folder');
  assert.ok(existsSync(join(root, '.diorama-trash', 'assets', project)), 'entries of other projects stay');

  // 10. Whole-project delete goes to <repo>/.diorama-trash, never touches other projects, and can be undone.
  seed('props/again.png', 'assets');
  mkdirSync(join(projectsDir, 'other'), { recursive: true });
  await rejects(() => deleteProject(root, '../demo'), 'project traversal');
  await rejects(() => deleteProject(root, 'ghost'), 'unknown project');
  const gone = await deleteProject(root, project);
  assert.ok(!existsSync(join(projectsDir, project)), 'project folder must be gone');
  assert.ok(existsSync(join(projectsDir, 'other')), 'other projects must stay');
  assert.ok(existsSync(join(root, '.diorama-trash', 'projects', gone.trashId, project, 'assets/props/again.png')));
  assert.ok(existsSync(join(root, 'examples', 'sample')), 'samples must stay');
  mkdirSync(join(projectsDir, project), { recursive: true });
  await rejects(() => restoreProject(root, project, gone.trashId), 'restore must not overwrite a project');
  rmSync(join(projectsDir, project), { recursive: true });
  await restoreProject(root, project, gone.trashId);
  assert.ok(existsSync(join(projectsDir, project, 'assets/props/again.png')), 'project must be back');
  assert.ok(!existsSync(join(root, '.diorama-trash', 'projects')), 'restoring the last trashed project leaves no empty folder');
  await rejects(() => restoreProject(root, project, '../x'), 'trash id traversal');

  console.log('✅ viewer delete / undo checks passed');
} finally {
  rmSync(root, { recursive: true, force: true });
}
