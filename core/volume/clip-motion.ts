/**
 * @core/volume - Motion for piece clips
 *
 * Small timing helpers for animated scenery (guide 05): where a transition is in frames, a curve
 * through hand-timed keys (so a door's overshoot is a key above its target, not a blind ease), and
 * waves that close a loop exactly.
 */

/** A piece clip's position in frames (`t × (frames − 1)`): the `x` of `keyed`. */
export const playhead = (clip: { t: number; frames: number }): number => clip.t * Math.max(0, clip.frames - 1);

/** Hand-timed keys, `[frame, value]`, sorted by frame. */
export type ClipKeys = readonly (readonly [number, number])[];

/**
 * The value of hand-timed keys at frame position `x`: exactly a key's value on its frame, a smooth
 * curve (Catmull-Rom) through the keys between them, and the first or last value outside them.
 */
export function keyed(x: number, keys: ClipKeys): number {
  if (x <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (x >= last[0]) return last[1];
  let i = 0;
  while (keys[i + 1][0] < x) i++;
  const [x1, y1] = keys[i];
  const [x2, y2] = keys[i + 1];
  const [x0, y0] = keys[Math.max(0, i - 1)];
  const [x3, y3] = keys[Math.min(keys.length - 1, i + 2)];
  const u = (x - x1) / (x2 - x1);
  // Tangents from the neighbours, in values per frame, scaled to this segment.
  const m1 = x2 > x0 && i > 0 ? ((y2 - y0) / (x2 - x0)) * (x2 - x1) : y2 - y1;
  const m2 = x3 > x1 && i + 2 < keys.length ? ((y3 - y1) / (x3 - x1)) * (x2 - x1) : y2 - y1;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * y1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * y2 + (u3 - u2) * m2;
}

/**
 * A wave for loops: `cycles` whole turns over the loop at `phase` (a fraction of a turn), minus its
 * starting value, so the loop's frame 0 is the still look and it closes exactly. Sum a few with
 * different cycles and phases for a flame.
 */
export const loopWave = (t: number, cycles: number, phase = 0): number => Math.sin(2 * Math.PI * (cycles * t + phase)) - Math.sin(2 * Math.PI * phase);
