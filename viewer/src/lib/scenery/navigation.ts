import { sceneNavigation, type SceneData, type SceneNavigation, type SceneryCatalog } from '@core/volume';

let last: { scene: SceneData; catalog: SceneryCatalog; nav: SceneNavigation | null } | null = null;

/**
 * The navigation of a scene (`sceneNavigation`), kept for the scene it was made for: the painter asks again at every
 * frame of a drag, and a scene that is the same object has the same movement data. Null for a scene the engine refuses.
 */
export function navigationOf(scene: SceneData, catalog: SceneryCatalog): SceneNavigation | null {
  if (last?.scene === scene && last.catalog === catalog) return last.nav;
  let nav: SceneNavigation | null = null;
  try {
    nav = sceneNavigation(scene, catalog);
  } catch {
    // A scene with problems has no navigation to show.
  }
  last = { scene, catalog, nav };
  return nav;
}
