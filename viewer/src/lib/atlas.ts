/** Shapes written by tools/export.ts and helpers to turn an atlas into playable frames. */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AtlasEvent {
  frame: number;
  name: string;
}

/** Points on the body where effects appear. x, y are logical px from the cell's top-left; d > 0 is in front of the body. */
export interface AtlasSockets {
  names: string[];
  frames: Record<string, Array<[x: number, y: number, d: number]>>;
}

export interface ManifestClip {
  key: string;
  name?: string;
  kind: string;
  category: string;
  tags: string[];
  loop: boolean;
  hold: boolean;
  seconds: number;
  frames: number;
  fps: number;
  groundSpeed: number;
  events: AtlasEvent[];
  travel?: number[];
  /** The classes of held parts, by hand, the clip is made for (`core/rig` `ClipWields`); none suits anything. */
  wields?: { main?: string[]; off?: string[] };
  /** False when the clip is made for something the character does not hold: it is left out of `controls` and must not be played. */
  usable?: boolean;
}

/** An effect a character plays on an event of one of its clips (docs/guides/rig/04-atlas-contract.md §4). */
export interface EffectCue {
  /** The clip event ('release', 'hit', 'cast', 'land', 'step:left'), or 'start' / 'end' of the clip. */
  on: string;
  /** The effect's id: its sheet is `vfx/<id>`. */
  effect: string;
  /** The socket it starts at; default the socket of a `spawn:<socket>` event on the same frame, else 'center'; 'feet' is the pivot on the floor. */
  at?: string;
  motion?: 'fly' | 'follow' | 'stay';
}

/** What a visual effect's sheet says about it (`meta.data.effect`, role 'vfx'): frames across, facings down, pivoted on the effect's origin. */
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

/** What an item icon's sheet says about the item (`meta.data.item`, role 'icon'). */
export interface ItemMeta {
  id: string;
  label: string;
  kind: string;
  rarity: string;
  rarityLabel?: string;
  rarityColor?: string;
  stack?: number;
  description?: string;
  gear?: { part: string; character?: string };
}

export interface Insets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A box in logical pixels. */
export interface UiBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A bitmap font (`meta.data.font`, ui kind 'font'): one glyph per frame, in `chars` order. */
export interface FontMeta {
  chars: string;
  cell: { w: number; h: number };
  baseline: number;
  lineHeight: number;
  spacing: number;
  advances: Record<string, number>;
}

/** Every sheet of a character repeats this: reading any one of them describes them all. */
export interface CharacterManifest {
  name: string;
  skeleton?: string;
  scale: number;
  directions: string[];
  /** The camera the sheets were rendered with: `tilt` in degrees above the ground plane. */
  camera?: { tilt: number; heightBoost?: number };
  sockets: string[];
  clips: ManifestClip[];
  controls: { idle: string; move: string[]; actions: Record<string, string[]> };
  /** Effects to play on clip events, by clip key. */
  effects?: Record<string, EffectCue[]>;
  /** What the outfit holds in each hand (`wield`), when the character was made from one. */
  wield?: { main?: { part: string; class: string; hands: 1 | 2 }; off?: { part: string; class: string; hands: 1 | 2 } };
  warnings?: string[];
}

export interface AtlasMeta {
  project?: string;
  mode?: string;
  frameCount?: number;
  directions?: string[];
  directionFacings?: number[];
  directionOrder?: string;
  pivot?: { x: number; y: number; logical?: { x: number; y: number } };
  data?: {
    /** Written by the engine for characters; assets exported before that are classified by fallback rules. */
    role?: string;
    clipKind?: 'locomotion' | 'idle' | 'action';
    /** The clip's kind: idle, walk, run, attack, skill, hit, death... (docs/guides/rig/04-atlas-contract.md). */
    action?: string;
    key?: string;
    tags?: string[];
    hold?: boolean;
    /** Root motion: forward world units from the start at each frame, then at the end (frames + 1 values). */
    travel?: number[];
    sockets?: AtlasSockets;
    /** The character's manifest on a character sheet; on a gear item only the id of the character it is worn by. */
    character?: CharacterManifest | string;
    /** A gear item (`role: 'gear'`): the catalog part it shows, with its label, group, slot and side. */
    part?: string;
    label?: string;
    group?: string;
    slot?: string;
    side?: number;
    skeleton?: string;
    clip?: string;
    loop?: boolean;
    seconds?: number;
    groundSpeed?: number;
    groundSpeedUnits?: string;
    events?: AtlasEvent[];
    /** Visual effects (`role: 'vfx'`). */
    effect?: EffectMeta;
    /** Item icons (`role: 'icon'`). */
    item?: ItemMeta;
    /** Interface pieces (`role: 'ui'`): what it is for, and what a game needs to stretch or fill it. */
    kind?: string;
    nineSlice?: Insets;
    /** One row per state (nine-slices, images). */
    states?: string[];
    fillBox?: UiBox;
    grows?: 'right' | 'left' | 'up' | 'down';
    /** Bars: the layers, one frame each, in sheet order ('back', 'fill', 'frame', then the optional 'cap'). */
    layers?: string[];
    /** Bars: the cap, a frame drawn with the bright edge at the full end of `fillBox`, within `width` logical px of it. */
    cap?: { width: number };
    /** Slots: the margin round the well (logical px), so a slot for an icon is the icon plus these. */
    content?: Insets;
    measure?: string;
    font?: FontMeta;
  };
  frameWidth?: number;
  frameHeight?: number;
  fps?: number;
  width?: number;
  height?: number;
  scale?: number;
  format?: string;
  image?: string;
  animations?: Record<string, number[]>;
}

export interface Atlas {
  meta: AtlasMeta;
  frames: Record<string, Rect & { direction?: string; frame?: number }>;
}

/** Compass layout for the direction picker: row 0 faces the camera (S), each next row turns clockwise. */
export const COMPASS: ReadonlyArray<ReadonlyArray<string | null>> = [
  ['NW', 'N', 'NE'],
  ['W', null, 'E'],
  ['SW', 'S', 'SE'],
];

export type PlaybackKind = 'animated' | 'sheet' | 'still';

export function playbackKind(atlas: Atlas | undefined): PlaybackKind {
  if (!atlas) return 'still';
  return atlas.meta.mode === 'strip' || atlas.meta.mode === 'directions' ? 'animated' : 'sheet';
}

export function clipNames(atlas: Atlas): string[] {
  const names = Object.keys(atlas.meta.animations ?? {});
  return names.length ? names : ['default'];
}

/** The frame rectangles of one clip facing one direction, in playback order. */
export function clipFrames(atlas: Atlas, clip: string, directionIndex: number): Rect[] {
  const { meta, frames } = atlas;
  const indices = meta.animations?.[clip] ?? Array.from({ length: meta.frameCount ?? 1 }, (_, i) => i);
  const directions = meta.directions ?? [];
  const frameWidth = meta.frameWidth ?? 0;
  const frameHeight = meta.frameHeight ?? 0;
  return indices.map((index) => {
    const key = directions.length > 1 ? `${directions[directionIndex]}_${index}` : `frame_${index}`;
    return (
      frames[key] ?? {
        x: index * frameWidth,
        y: directionIndex * frameHeight,
        width: frameWidth,
        height: frameHeight,
      }
    );
  });
}

/** The events a sheet declares: a clip's own, or an effect's (`meta.data.effect.events`). */
export const eventsOf = (atlas: Atlas | undefined): AtlasEvent[] => atlas?.meta.data?.events ?? atlas?.meta.data?.effect?.events ?? [];

/** Events keyed by frame index, so the timeline and the current frame can look them up directly. */
export function eventsByFrame(atlas: Atlas | undefined): Map<number, string[]> {
  const byFrame = new Map<number, string[]>();
  for (const event of eventsOf(atlas)) {
    byFrame.set(event.frame, [...(byFrame.get(event.frame) ?? []), event.name]);
  }
  return byFrame;
}
