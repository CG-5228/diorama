/**
 * Ossuary guard dodges: the engine's `dodge` (root motion `travel`, feet that stay planted in
 * the world and step one after the other, `cancel` event) with the guard's own body language on
 * top. The preset is a mild crouch for any body; a skeleton warrior with a sword and a shield
 * needs to read the intent in every facing:
 * - `dash`: snaps into a deep forward lean in two frames, holds it while the body travels (the
 *   feet leapfrog under it), then rises. The sword arm trails behind the back with the blade
 *   low and pointing back (`extra.weaponYaw` / `weaponPitch`), the shield arm tucks forward, so
 *   the silhouette is a low wedge with a streak of blade behind it.
 * - `backstep`: leans back, the shield comes up in front of the face and the sword rises in
 *   guard, blade up and forward, while the feet step back one after the other.
 * Both start and end on the idle pose (the sword at its default angle), so they blend with idle.
 *
 * The engine's `dodge` computes the planted-foot steps (`stepsAlong`) but does not put them in
 * the drive it returns, so its feet never leave the rest spots. The guard's clips therefore
 * compute the steps here, the same way (each foot keeps its world spot until its swing window,
 * then steps to the spot one `distance` further, lifted), and return them as `Drive.feet`.
 */

import { bump, defineClip, dodge, easeOutQuad, restFeet, smooth, track, type ArmDrive, type Clip, type Drive, type Local, type SkeletonSpec } from '@core/rig';
import { swordMix } from '../../shared/sword-angle';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export type GuardDodgeStyle = 'dash' | 'backstep';

export function guardDodge(skeleton: SkeletonSpec, style: GuardDodgeStyle, seconds = 0.45): Clip {
  const base = dodge(skeleton, { style, seconds });
  const k = skeleton.height / 80;
  const back = style === 'backstep';
  const n = skeleton.trunk.length;
  const travel = base.travel!;
  const distance = travel(1);
  const rest = restFeet(skeleton);
  // Feet step one after the other: the leading foot first in a dash, the rear foot first in a backstep.
  const order = skeleton.legs.map(l => l.name).sort((x, y) => (back ? rest[x][0] - rest[y][0] : rest[y][0] - rest[x][0]));
  const windows: Record<string, [number, number]> = {};
  order.forEach((name, i) => {
    const a = 0.1 + (0.4 * i) / Math.max(1, order.length);
    windows[name] = [a, a + 0.32];
  });
  const lift = (back ? 0.1 : 0.14) * skeleton.height;
  const stepFeet = (t: number): Record<string, Local> => {
    const feet: Record<string, Local> = {};
    for (const leg of skeleton.legs) {
      const r = rest[leg.name];
      const [a, b] = windows[leg.name];
      feet[leg.name] = [r[0] + distance * smooth(clamp01((t - a) / (b - a))) - travel(t), r[1], r[2] + lift * bump(t, a, b)];
    }
    return feet;
  };
  return defineClip({
    ...base,
    drive(t: number): Drive {
      const d = base.drive(t);
      // Pose envelope: snaps in during the first frames, holds while the body travels, then eases out.
      const e = back
        ? track(t, [[0, 0], [0.2, 1, easeOutQuad], [0.5, 1], [0.92, 0]])
        : track(t, [[0, 0], [0.16, 1, easeOutQuad], [0.52, 1], [0.92, 0]]);
      const trunk: Record<string, Local> = {};
      skeleton.trunk.forEach((j, i) => {
        const w = n > 1 ? i / (n - 1) : 1;
        const b = d.trunk?.[j.name] ?? [0, 0, 0];
        trunk[j.name] = back
          ? [b[0] - 1.5 * k * e * w, b[1], b[2]]
          : [b[0] + 5.5 * k * e * w, b[1], b[2] - 2.4 * k * e * w * w];
      });
      const r = d.root ?? [0, 0, 0];
      const arms: Record<string, ArmDrive> = back
        ? {
            armR: { swing: 0.95 * e, flex: 0.2 + 1.1 * e, out: 0.12 },
            armL: { swing: 1.15 * e, flex: 0.18 + 1.25 * e, out: 0.1 },
          }
        : {
            armR: { swing: -1.25 * e, flex: 0.2 + 0.2 * e, out: 0.12 },
            armL: { swing: 0.75 * e, flex: 0.18 + 0.95 * e, out: 0.12 },
          };
      // The sword follows the arm: trailing and low in a dash, up in guard in a backstep.
      const w = smooth(Math.min(1, e));
      return {
        ...d,
        feet: stepFeet(t),
        root: back ? [r[0], r[1], r[2] - 1.6 * k * e + 2.4 * k * bump(t, 0.12, 0.62)] : [r[0] + 3 * k * e, r[1], r[2] - 3.4 * k * e],
        trunk,
        pitch: (d.pitch ?? 0) * (back ? 1.6 : 2.1),
        twist: back ? -6 * e : 14 * e,
        arms,
        extra: back
          ? swordMix(0.3, 0.95, w)
          : swordMix(2.55, -0.3, w),
      };
    },
  });
}
