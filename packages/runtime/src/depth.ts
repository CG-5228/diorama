/**
 * One depth key for everything that is sorted on a scene, so a host can hand it to its renderer (`setDepth`, a sort key).
 * It follows the order of the viewer's Playground (`viewer/src/components/playground/scene.tsx`) on a grid of a sixteenth
 * of a px: the ground first, then `layer: 'ground'` effects (both under every key), then standing items, actors and air
 * effects by the screen y of their floor point. On one level a standing item comes first (and standing items keep their
 * layout order), then the actors, then the air effects; `order` keeps the order of things of one kind. The Playground
 * compares y exactly, so the two orders differ only for things less than a sixteenth of a px apart.
 */

/**
 * Screen y is rounded to the nearest sixteenth of a px, and things whose y rounds to the same sixteenth are level. That is a
 * grid, not a tolerance: two points 0.01 px apart can fall on either side of a sixteenth, and within one sixteenth the kind
 * decides where the Playground's exact comparison of y would not (an actor at 100 is drawn after a standing item at 100.03).
 */
const STEPS_PER_PX = 16;
/** Things of one kind on one level: their `order` runs from 0 to this. */
const PER_KIND = 2 ** 16;
const KINDS = { standing: 0, actor: 1, fx: 2 } as const;

/** The depth key of something whose floor point is at `screenY` (px): larger keys are drawn later, in front. */
export function depthKey(screenY: number, kind: keyof typeof KINDS, order = 0): number {
  const level = Math.round(screenY * STEPS_PER_PX);
  return level * (3 * PER_KIND) + KINDS[kind] * PER_KIND + Math.max(0, Math.min(PER_KIND - 1, Math.floor(order)));
}
