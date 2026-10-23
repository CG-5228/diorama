import type { ProjectRoot } from './types';

/**
 * Where a project's files are, as the viewer names them. A project lives in `projects/` (yours) or `examples/` (the
 * samples that ship with Diorama); the server says which in `root`, and a name in `projects/` wins over an example.
 * Inside it: `src/` (code), `sheets/` (one file per exported sheet), `assets/` (the exports), `review/` (scratch).
 */

/** The project's folder from the repository root, as typed in a terminal: `examples/soulkeeper`. */
export const projectDir = (root: ProjectRoot, name: string) => `${root}/${name}`;

/** A file of the project from the repository root: `examples/soulkeeper/sheets/gear/helm.ts`. */
export const projectFile = (root: ProjectRoot, name: string, path: string) => `${projectDir(root, name)}/${path}`;

/** Where the dev server serves a file of the project from: `/examples/soulkeeper/src/gear/catalog.ts`. */
export const projectUrl = (root: ProjectRoot, name: string, path: string) => `/${projectFile(root, name, path)}`;

/** Where a project's kit catalogs are (`src/<kit>/catalog.ts`): the customize and scenery tabs import them. */
export const kitCatalogUrl = (root: ProjectRoot, name: string, kit: 'gear' | 'scenery') => projectUrl(root, name, `src/${kit}/catalog.ts`);

/** A scene saved by the scene painter: `src/scenes/<name>.ts` exports it as `SCENE`. */
export const sceneUrl = (root: ProjectRoot, name: string, scene: string) => projectUrl(root, name, `src/scenes/${scene}.ts`);
