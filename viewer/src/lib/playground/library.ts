import { clipFrames, clipNames, type Atlas, type AtlasEvent, type CharacterManifest, type EffectCue, type Rect } from '../atlas';
import { effectSheetOf, type EffectSheet } from './vfx';
import { basename, dirname, stripExtension } from '../format';
import type { AssetFileMeta } from '../types';

/**
 * What the playground can put on its scene, read only from exported assets and following
 * docs/guides/rig/04-atlas-contract.md: a character is a set of clips that share a manifest (or, for older
 * atlases, a folder, skeleton and pivot); everything else is a sprite. Meaning never comes from file names.
 */
export type ClipCategory = 'idle' | 'locomotion' | 'action';

export interface Clip {
  asset: AssetFileMeta;
  atlas: Atlas;
  /** The file name without extension: the key the manifest refers to. */
  key: string;
  name: string;
  /** idle, walk, run, attack, skill, hit, death, dodge... */
  kind: string;
  category: ClipCategory;
  tags: string[];
  fps: number;
  frameCount: number;
  loop: boolean;
  /** Plays once and stays on its last frame until the character is reset. */
  hold: boolean;
  /** Exported pixels per second the sprite must move for the feet to stay planted. */
  speed: number;
  events: AtlasEvent[];
  /** The action may be interrupted from this frame on. */
  cancelFrame: number | null;
  /** Root motion in exported px: distance ahead at each frame boundary (frames + 1 values). */
  travel: number[] | null;
  /** The frames of this clip when facing one direction row, cached. */
  rects: (row: number) => Rect[];
}

/** The camera tilt (degrees) assumed when a character has no manifest. */
export const DEFAULT_TILT = 48;

export interface Character {
  id: string;
  name: string;
  folder: string;
  clips: Clip[];
  idle: Clip | null;
  /** Slowest first: the first one walks, the last one runs. */
  locomotion: Clip[];
  /** Bound to 1, 2, 3...: attack, skill, dodge and the like, in that order. Hit and death have their own keys. */
  actions: Clip[];
  hit: Clip | null;
  death: Clip | null;
  /** Problems the engine found when the character was defined. Shown, never blocking. */
  warnings: string[];
  /** Camera tilt in degrees: ground distances along the view shrink by its sine on screen. */
  tilt: number;
  /** The camera's height boost: how much a height above the floor lifts something on the screen. */
  boost: number;
  /** The effects it plays on the events of its clips, by clip key (`meta.data.character.effects`). */
  effects: Record<string, EffectCue[]>;
}

export interface Sprite {
  id: string;
  name: string;
  clip: Clip;
}

/** What a click on the scene puts down. `key` identifies the entry in the palette. */
export type Armed =
  | { key: string; type: 'sprite'; clip: Clip; row: number }
  | { key: string; type: 'character'; character: Character };

export interface Library {
  characters: Character[];
  sprites: Sprite[];
  /** The project's visual effects by id: the sheets characters cue on their events. */
  effects: Map<string, EffectSheet>;
}

const ACTION_ORDER = ['attack', 'skill', 'dodge', 'jump', 'interact', 'emote', 'spawn', 'action'];
const orderOf = (kind: string) => {
  const at = ACTION_ORDER.indexOf(kind);
  return at < 0 ? ACTION_ORDER.length : at;
};

const isAnimated = (atlas: Atlas) => atlas.meta.mode === 'strip' || atlas.meta.mode === 'directions';

/** Old atlases have no clipKind: what the clip does says what it is. */
function categoryOf(atlas: Atlas): ClipCategory {
  const { data } = atlas.meta;
  if (data?.clipKind) return data.clipKind;
  if ((data?.groundSpeed ?? 0) > 0) return 'locomotion';
  return data?.loop ? 'idle' : 'action';
}

/** The manifest of a character sheet. A gear item names its wearer as plain text: that is not a manifest. */
const manifestOf = (atlas: Atlas): CharacterManifest | undefined => {
  const character = atlas.meta.data?.character;
  return typeof character === 'object' ? character : undefined;
};

/** A gear item (a helm, a shield) is something to place on the scene, never a character, whoever wears it in its sheet. */
const isCharacter = (atlas: Atlas) =>
  atlas.meta.data?.role !== 'gear' && (atlas.meta.data?.role === 'character' || atlas.meta.data?.skeleton !== undefined || manifestOf(atlas) !== undefined);

function makeClip(asset: AssetFileMeta, atlas: Atlas): Clip {
  const rows = new Map<number, Rect[]>();
  const firstClip = clipNames(atlas)[0];
  const { data, scale = 1 } = atlas.meta;
  const category = categoryOf(atlas);
  const events = data?.events ?? [];
  const cancels = events.filter((e) => e.name === 'cancel').map((e) => e.frame);
  return {
    asset,
    atlas,
    key: data?.key ?? basename(stripExtension(asset.subpath)),
    name: data?.key ?? basename(stripExtension(asset.subpath)),
    kind: data?.action ?? (category === 'idle' ? 'idle' : category === 'locomotion' ? 'walk' : 'action'),
    category,
    tags: data?.tags ?? [],
    fps: atlas.meta.fps || 8,
    frameCount: atlas.meta.frameCount ?? 1,
    loop: data?.loop ?? true,
    hold: data?.hold ?? false,
    speed: (data?.groundSpeed ?? 0) * scale,
    events,
    cancelFrame: cancels.length > 0 ? Math.min(...cancels) : null,
    travel: data?.travel ? data.travel.map((d) => d * scale) : null,
    rects: (row) => {
      let cached = rows.get(row);
      if (!cached) {
        cached = clipFrames(atlas, firstClip, row);
        rows.set(row, cached);
      }
      return cached;
    },
  };
}

const present = (clip: Clip | undefined): clip is Clip => clip !== undefined;

/** The bindings: from the manifest's controls when there is one, else from what each clip declares. */
function bindings(clips: Clip[], manifest: CharacterManifest | undefined) {
  const byKey = new Map(clips.map((c) => [c.key, c]));
  const pick = (keys: string[] = []) => keys.map((k) => byKey.get(k)).filter(present);

  if (manifest) {
    const { controls } = manifest;
    const groups = Object.entries(controls.actions ?? {}).filter(([kind]) => kind !== 'hit' && kind !== 'death');
    groups.sort(([a], [b]) => orderOf(a) - orderOf(b));
    return {
      idle: byKey.get(controls.idle) ?? null,
      locomotion: pick(controls.move),
      actions: groups.flatMap(([, keys]) => pick(keys)),
      hit: pick(controls.actions?.hit)[0] ?? null,
      death: pick(controls.actions?.death)[0] ?? null,
    };
  }
  const byCategory = (category: ClipCategory) => clips.filter((c) => c.category === category);
  return {
    idle: byCategory('idle')[0] ?? null,
    locomotion: byCategory('locomotion').sort((a, b) => a.speed - b.speed),
    actions: byCategory('action')
      .filter((c) => c.kind !== 'hit' && c.kind !== 'death')
      .sort((a, b) => orderOf(a.kind) - orderOf(b.kind) || a.key.localeCompare(b.key)),
    hit: clips.find((c) => c.kind === 'hit') ?? null,
    death: clips.find((c) => c.kind === 'death') ?? null,
  };
}

function makeCharacter(folder: string, clips: Clip[]): Character {
  const manifest = clips.map((c) => manifestOf(c.atlas)).find((m) => m !== undefined);
  const name = manifest?.name ?? basename(folder);
  // A clip the manifest marks unusable (made for something the character does not hold) is never played, even when its sheet is there.
  const unusable = new Set((manifest?.clips ?? []).filter((c) => c.usable === false).map((c) => c.key));
  const playable = clips.filter((c) => !unusable.has(c.key));
  const own = playable.length > 0 ? playable : clips;
  return {
    id: `${folder}|${manifest?.name ?? clips[0].atlas.meta.data?.skeleton ?? ''}`,
    name,
    folder,
    clips: own,
    ...bindings(own, manifest),
    warnings: manifest?.warnings ?? [],
    tilt: manifest?.camera?.tilt ?? DEFAULT_TILT,
    boost: manifest?.camera?.heightBoost ?? 1.2,
    effects: manifest?.effects ?? {},
  };
}

/** Characters group by manifest; older atlases by folder, skeleton and pivot. */
function groupKey(asset: AssetFileMeta, atlas: Atlas): string {
  const manifest = manifestOf(atlas);
  if (manifest) return `${dirname(asset.subpath)}|character:${manifest.name}`;
  const { pivot } = atlas.meta;
  return `${dirname(asset.subpath)}|${atlas.meta.data?.skeleton}|${pivot?.x},${pivot?.y}`;
}

export function buildLibrary(assets: AssetFileMeta[], atlases: Map<string, Atlas>): Library {
  const characterClips = new Map<string, Clip[]>();
  const sprites: Sprite[] = [];
  const effects = new Map<string, EffectSheet>();

  for (const asset of assets) {
    const atlas = asset.atlas ? atlases.get(asset.subpath) : undefined;
    if (asset.atlas && !atlas) continue;
    // Effects are played on cues, item icons and interface pieces are not things of the scene: none of them is placed by hand.
    const sheet = atlas && effectSheetOf(asset, atlas);
    if (sheet) {
      effects.set(sheet.id, sheet);
      continue;
    }
    if (atlas?.meta.data?.role === 'icon' || atlas?.meta.data?.role === 'ui') continue;
    if (atlas && !isAnimated(atlas)) continue; // grid and compact sheets are not playable
    const clip = atlas ? makeClip(asset, atlas) : null;
    if (clip && isCharacter(clip.atlas)) {
      const key = groupKey(asset, clip.atlas);
      characterClips.set(key, [...(characterClips.get(key) ?? []), clip]);
    } else {
      sprites.push({ id: asset.subpath, name: stripExtension(asset.subpath), clip: clip ?? stillClip(asset) });
    }
  }

  const characters = [...characterClips.entries()].map(([key, clips]) => makeCharacter(key.split('|')[0], clips));
  return { characters: characters.sort((a, b) => a.folder.localeCompare(b.folder)), sprites, effects };
}

/** An image without an atlas: one frame, anchored at the bottom centre. */
function stillClip(asset: AssetFileMeta): Clip {
  const width = asset.width ?? 0;
  const height = asset.height ?? 0;
  const atlas: Atlas = { meta: { mode: 'strip', frameCount: 1, frameWidth: width, frameHeight: height, scale: 1 }, frames: {} };
  const key = basename(stripExtension(asset.subpath));
  return {
    asset,
    atlas,
    key,
    name: key,
    kind: 'idle',
    category: 'idle',
    tags: [],
    fps: 1,
    frameCount: 1,
    loop: true,
    hold: false,
    speed: 0,
    events: [],
    cancelFrame: null,
    travel: null,
    rects: () => [{ x: 0, y: 0, width, height }],
  };
}
