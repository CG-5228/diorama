/**
 * Ghoul wolf death: the engine's `death` preset (belly collapse with the head slumping to one side,
 * front legs splaying, tail going limp, `land` event, held on its last frame) plus the wolf's own
 * channels for the skin: ears flatten, the jaw hangs open and the eyes burn down to embers
 * (`dim`, from the preset's `dead`).
 */

import { death, defineClip, smooth, type Clip, type Drive, type SkeletonSpec } from '@core/rig';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function collapse(skeleton: SkeletonSpec, seconds = 0.9): Clip {
  const base = death(skeleton, seconds);
  return defineClip({
    ...base,
    drive(t: number): Drive {
      const d = base.drive(t);
      const s = smooth(clamp01((t - 0.2) / 0.55));
      return { ...d, extra: { ...d.extra, ears: s, jaw: 0.23 * s, dim: d.extra?.dead ?? s } };
    },
  });
}
