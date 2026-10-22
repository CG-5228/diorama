/**
 * @core/volume - Visual effects
 *
 * A project's effects (projectiles, impacts, casts, auras, area blasts, bursts) as a catalog of
 * pieces drawn with the project camera and exported as sheets a game plays: frames across, the
 * effect's facings down, with what a player needs in the atlas (kind, timing, events, how fast a
 * projectile flies and what plays where it ends). Characters cue them on their clip events
 * (`defineCharacter({ effects })`, guide 06).
 */

import { defineAsset, type AssetDefinition } from '../asset.js';
import { createRng } from '../random.js';
import type { Camera } from './camera.js';
import { Frame3, facingYaw } from './frame.js';
import type { PieceOption, SceneMaterials } from './scenery.js';
import { spaceData, type SpaceProfile } from './space.js';
import { Stage, type StageObject } from './stage.js';
import { vec3 } from './vec3.js';
import type { VolumeStyle } from './volume.js';

/** What an effect is for, which tells a player how to play it. */
export type EffectKind = 'projectile' | 'impact' | 'cast' | 'aura' | 'area' | 'burst' | 'trail';

/** Everything an effect piece receives to draw one frame. */
export interface EffectContext {
  /** Parts that stand or fly (layer 1). */
  object: StageObject;
  /** Marks on the floor under them: rings, scorches, shadows, pools of light (layer 0, drawn first). */
  ground: StageObject;
  /** The project camera with the world origin on the effect's origin. */
  camera: Camera;
  /**
   * Origin at the effect's origin (world 0, 0, 0), turned to its heading: x forward (a projectile's
   * travel), y right, z up. An effect that plays in the air (a projectile at a hand's height) has its
   * origin there: the floor is `height` below it.
   */
  frame: Frame3;
  /** Height of the origin above the floor in world units (0 for effects on the floor). */
  height: number;
  /** Progress: 0 → 1 across a one-shot effect (its last frame is 1); frame ÷ frames round a loop. */
  t: number;
  frameIndex: number;
  frames: number;
  /** Facing index and count (projectiles and other turned effects). */
  dir: number;
  directions: number;
  /** The heading as a yaw on the floor (π/2 faces the camera). */
  yaw: number;
  /** How far it reaches, in world units (its `size`). */
  size: number;
  /** The seed of this effect: the same in every frame and facing, so details hold still while it plays. */
  seed: number;
  materials: SceneMaterials;
}

/** An effect piece: draws one frame. `O` are its options. */
export type EffectPiece<O = Record<string, unknown>> = (ctx: EffectContext, options: O) => void;

/** An effect as editors, exporters and players see it. */
export interface EffectInfo {
  /** Stable id: its sheet is `sheets/vfx/<id>.ts` (written by `npm run vfx-items`), exported to `assets/vfx/<id>`. */
  id: string;
  label: string;
  kind: EffectKind;
  piece: EffectPiece<any>;
  frames: number;
  /** Frames per second. Default 12. */
  fps?: number;
  /** Plays round and round (a projectile in flight, an aura); else once. */
  loop?: boolean;
  /** Facings it is drawn in (projectiles: 8 or 16, so its heading reads). Default 1. */
  directions?: 1 | 4 | 8 | 16;
  /** Radius it reaches in world units: sizes the exported cell. */
  size: number;
  /** Height of its origin above the floor (a projectile flies at about a hand's height). Default 0. */
  height?: number;
  /** Where a player draws it: 'ground' under every standing thing (rings, scorches), or 'air' sorted with them. Default by kind: area and cast on the ground, the rest in the air. */
  layer?: 'ground' | 'air';
  /** Moments a game reacts to: { frame: 2, name: 'hit' } (damage lands), 'release', 'fade'. */
  events?: { frame: number; name: string }[];
  /** Projectiles: how fast they fly (world units per second) and how far before they end. */
  travel?: { speed: number; range?: number };
  /** The effect played where this one ends (a projectile's impact). */
  follows?: string;
  roles: string[];
  options?: PieceOption[];
  /** Logical size of one exported cell and the pivot (the effect's origin) inside it (default from `size` and `height`). */
  cell?: { width: number; height: number; pivot: { x: number; y: number } };
}

/** A project's effects: pieces, materials, camera and (optionally) its space profile. */
export interface EffectCatalog {
  effects: EffectInfo[];
  materials: Record<string, VolumeStyle>;
  defaultMaterials: Record<string, string>;
  camera: Camera;
  space?: SpaceProfile;
}

const find = (catalog: EffectCatalog, id: string) => catalog.effects.find(e => e.id === id);

/** Where an effect is drawn by default for its kind. */
export const effectLayer = (info: EffectInfo): 'ground' | 'air' => info.layer ?? (info.kind === 'area' || info.kind === 'cast' ? 'ground' : 'air');

/** Problems of an effect catalog: ids, frames, events, travel, follows, materials. Empty when valid. */
export function validateEffects(catalog: EffectCatalog): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const e of catalog.effects) {
    const at = `effect "${e.id}"`;
    if (ids.has(e.id)) problems.push(`${at}: the id is used twice`);
    ids.add(e.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.id)) problems.push(`${at}: ids are lowercase letters, digits and dashes (it is the sheet's name)`);
    if (!(Number.isInteger(e.frames) && e.frames >= 1)) problems.push(`${at}: frames must be a whole number from 1`);
    if (!(e.size > 0)) problems.push(`${at}: size must be a positive number of world units`);
    if (e.directions !== undefined && ![1, 4, 8, 16].includes(e.directions)) problems.push(`${at}: directions must be 1, 4, 8 or 16`);
    for (const ev of e.events ?? []) if (!(Number.isInteger(ev.frame) && ev.frame >= 0 && ev.frame < e.frames)) problems.push(`${at}: event "${ev.name}" at frame ${ev.frame} is outside its ${e.frames} frames`);
    if (e.kind === 'projectile' && !e.travel) problems.push(`${at}: a projectile needs travel { speed }`);
    if (e.travel && !(e.travel.speed > 0)) problems.push(`${at}: travel.speed must be positive`);
    if (e.follows && !catalog.effects.some(x => x.id === e.follows)) problems.push(`${at}: follows unknown effect "${e.follows}"`);
  }
  for (const [role, name] of Object.entries(catalog.defaultMaterials)) if (!catalog.materials[name]) problems.push(`defaultMaterials: role "${role}" names unknown material "${name}"`);
  return problems;
}

/** Default exported cell of an effect: room for its reach on every side, and for the floor under an effect in the air. */
export function effectCell(info: EffectInfo, camera: Camera): { width: number; height: number; pivot: { x: number; y: number } } {
  if (info.cell) return info.cell;
  const reach = Math.ceil(info.size * 1.25 * camera.scale);
  const drop = Math.ceil(camera.project(vec3(0, 0, -(info.height ?? 0))).y - camera.project(vec3(0, 0, 0)).y);
  const width = reach * 2;
  return { width, height: reach * 2 + drop, pivot: { x: reach, y: reach } };
}

/** Draws one frame of an effect with `camera` on its origin: its floor marks, then its parts. */
export function drawEffectFrame(c: CanvasRenderingContext2D, info: EffectInfo, catalog: EffectCatalog, camera: Camera, f: { frame: number; dir: number; options: Record<string, unknown>; materials: SceneMaterials }): void {
  const stage = new Stage(camera);
  const ground = stage.object({ layer: 0, at: vec3(0, 0, 0) });
  const object = stage.object({ layer: 1, at: vec3(0, 0, 0) });
  const directions = info.directions ?? 1;
  const yaw = facingYaw(f.dir, directions);
  const frame = Math.max(0, Math.min(info.frames - 1, f.frame));
  const t = info.loop ? frame / info.frames : info.frames > 1 ? frame / (info.frames - 1) : 1;
  let seed = 2166136261;
  for (const ch of info.id) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  info.piece(
    { object, ground, camera, frame: Frame3.facing(vec3(0, 0, 0), yaw), height: info.height ?? 0, t, frameIndex: frame, frames: info.frames, dir: f.dir, directions, yaw, size: info.size, seed: seed >>> 0, materials: f.materials },
    f.options,
  );
  stage.draw(c);
}

/** Options of `defineEffect`. */
export interface EffectAssetOptions {
  catalog: EffectCatalog;
  effect: string;
  options?: Record<string, unknown>;
  /** Role → material name overrides. */
  materials?: Record<string, string>;
  scale?: number;
}

/**
 * Exports one effect as the sheet a game plays: its frames across and its facings down, pivoted on
 * the effect's origin. The atlas says `role: 'vfx'` and the effect: kind, frames, fps, loop, layer,
 * height, size, events, travel and follows.
 */
export function defineEffect(o: EffectAssetOptions): AssetDefinition {
  const info = find(o.catalog, o.effect);
  if (!info) throw new Error(`effects: unknown effect "${o.effect}" (catalog has ${o.catalog.effects.map(e => e.id).join(', ')})`);
  const options = { ...Object.fromEntries((info.options ?? []).map(op => [op.key, op.default])), ...o.options };
  const names = { ...o.catalog.defaultMaterials, ...o.materials };
  const materials: SceneMaterials = {};
  for (const [role, name] of Object.entries(names)) {
    const m = o.catalog.materials[name];
    if (!m) throw new Error(`effects: unknown material "${name}" for role "${role}"`);
    materials[role] = m;
  }
  const cell = effectCell(info, o.catalog.camera);
  return defineAsset({
    width: cell.width,
    height: cell.height,
    scale: o.scale ?? 2,
    frames: info.frames,
    fps: info.fps ?? 12,
    directions: info.directions ?? 1,
    pivot: cell.pivot,
    data: {
      role: 'vfx',
      effect: {
        id: info.id,
        label: info.label,
        kind: info.kind,
        frames: info.frames,
        fps: info.fps ?? 12,
        loop: !!info.loop,
        layer: effectLayer(info),
        height: info.height ?? 0,
        size: info.size,
        directions: info.directions ?? 1,
        events: info.events ?? [],
        ...(info.travel ? { travel: info.travel } : {}),
        ...(info.follows ? { follows: info.follows, followsSheet: `vfx/${info.follows}` } : {}),
      },
      camera: { tilt: o.catalog.camera.tilt, heightBoost: o.catalog.camera.heightBoost },
      ...(o.catalog.space ? { space: spaceData(o.catalog.space) } : {}),
    },
    render({ ctx, frameIndex = 0, direction = 0 }) {
      drawEffectFrame(ctx, info, o.catalog, o.catalog.camera.at(cell.pivot), { frame: frameIndex, dir: direction, options, materials });
    },
  });
}

/** A seeded generator for an effect (stable across its frames). */
export const effectRng = (ctx: Pick<EffectContext, 'seed'>, salt = 0) => createRng((ctx.seed ^ salt) >>> 0);
