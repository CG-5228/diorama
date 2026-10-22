/**
 * Diorama - Core Random Utilities
 * 
 * Deterministic, seedable pseudo-random number generator.
 * Allows procedural visual variations to remain repeatable between runs and exports.
 */

export interface Rng {
  /** Returns a float in [0, 1) */
  random: () => number;
  /** Returns a float in [min, max) */
  float: (min: number, max: number) => number;
  /** Returns an integer in [min, max] (inclusive) */
  int: (min: number, max: number) => number;
  /** Returns true with probability = chance (default 0.5) */
  boolean: (chance?: number) => boolean;
  /** Picks a random item from an array */
  pick: <T>(items: readonly T[]) => T;
  /** Returns a randomly shuffled copy of an array */
  shuffle: <T>(items: readonly T[]) => T[];
  /** Returns a random hex color or selects from a palette */
  color: (palette?: readonly string[]) => string;
}

/**
 * MurmurHash3-based 32-bit string hashing
 */
function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/**
 * Creates a deterministic PRNG using Mulberry32 algorithm.
 * Accepts a number seed or string (e.g. asset name or hash).
 */
export function createRng(seed: number | string = Date.now()): Rng {
  let s = typeof seed === 'string' ? hashString(seed) : Math.floor(seed) >>> 0;

  function next(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function float(min: number, max: number): number {
    return min + next() * (max - min);
  }

  function int(min: number, max: number): number {
    return Math.floor(float(min, max + 1));
  }

  function boolean(chance = 0.5): boolean {
    return next() < chance;
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from empty array');
    }
    return items[Math.floor(next() * items.length)];
  }

  function shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function color(palette?: readonly string[]): string {
    if (palette && palette.length > 0) {
      return pick(palette);
    }
    const r = Math.floor(float(0, 256)).toString(16).padStart(2, '0');
    const g = Math.floor(float(0, 256)).toString(16).padStart(2, '0');
    const b = Math.floor(float(0, 256)).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  return {
    random: next,
    float,
    int,
    boolean,
    pick,
    shuffle,
    color,
  };
}
