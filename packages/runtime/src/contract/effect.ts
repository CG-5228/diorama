/** What a visual effect's sheet says about it (`meta.data.effect`, role 'vfx', contract §5 rule 9). */

import type { AtlasEvent } from './atlas.js';

/** Frames across, facings down, pivoted on the effect's origin. */
export interface EffectMeta {
  id: string;
  label?: string;
  /** projectile, impact, cast, aura, area, burst or trail. */
  kind: string;
  frames: number;
  fps: number;
  loop: boolean;
  /** 'ground' under every standing thing, 'air' sorted with them. */
  layer: 'ground' | 'air';
  /** Height of the origin above the floor, world units. */
  height: number;
  /** Radius it reaches, world units. */
  size: number;
  directions: number;
  events?: AtlasEvent[];
  /** Projectiles: world units per second and how far (world units) before they end. */
  travel?: { speed: number; range?: number };
  /** The effect played where this one ends. */
  follows?: string;
  followsSheet?: string;
}
