/**
 * A seeded generator for game rules (battle damage, a wanderer's next stop): the same seed gives the same draws, so the
 * rules can be tested. Mulberry32, the generator of `@core`'s `createRng`: a numeric seed gives the same sequence.
 */

/** Draws in [0, 1), one per call, from a seed. */
export function createRng(seed: number): () => number {
  let s = Math.floor(seed) >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
