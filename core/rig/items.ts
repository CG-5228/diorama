/**
 * @core/rig - Items and their icons
 *
 * A project's items (weapons, armour, consumables, keys, materials, currency) as a catalog, and the
 * inventory icon of each: the item drawn alone in the project camera, fitted into a square with
 * room to spare, over the project's background and under its frame for the item's rarity. An item
 * is a gear part (drawn as worn, the body hidden), a piece of its own (a potion, a key), or both: a
 * piece drawn for the icon of a gear part the item equips.
 * Guide 06 of `@core/volume`.
 */

import { defineAsset, type AssetDefinition } from '../asset.js';
import { createRng } from '../random.js';
import { Frame3, Stage, vec3, type Camera, type PieceOption, type SceneMaterials, type StageObject, type VolumeStyle } from '../volume/index.js';
import { drawCharacterFrame } from './character.js';
import { idle as idleClip } from './clips.js';
import { outfitFromData, partRequires, type GearCatalog, type OutfitCharacterInfo, type OutfitData } from './gear.js';

/** What a piece of its own receives to draw an item. */
export interface ItemContext {
  /** The item's parts, sorted among themselves. */
  object: StageObject;
  camera: Camera;
  /** Origin at the item's centre (world 0, 0, 0), turned to the icon's view: x forward, y right, z up. */
  frame: Frame3;
  seed: number;
  materials: SceneMaterials;
}

/** A piece of its own for an item that is not a gear part (a potion, a key, a coin). */
export type ItemPiece<O = Record<string, unknown>> = (ctx: ItemContext, options: O) => void;

/** An item as editors, exporters and games see it. */
export interface ItemInfo {
  /** Stable id: its icon sheet is `sheets/icons/<id>.ts` (written by `npm run item-icons`). */
  id: string;
  label: string;
  /** 'weapon', 'armor', 'consumable', 'key', 'material', 'currency', 'quest' or the project's own. */
  kind: string;
  /** A key of the catalog's `rarities`. */
  rarity: string;
  description?: string;
  /** How many fit in one inventory slot (1 for gear). */
  stack?: number;
  /**
   * The gear part the item equips. Without a `piece`, the icon draws it as worn by a character of the
   * gear catalog (its body hidden); `hosts` says whether the pieces it rests on in that outfit (a
   * helm's skull, a shield's arm) are drawn (default) or only placed, hidden.
   */
  gear?: { part: string; character?: string; materials?: Record<string, string>; options?: Record<string, unknown>; hosts?: 'draw' | 'hide' };
  /** A piece of its own that draws the icon (with or without `gear`). */
  piece?: ItemPiece<any>;
  options?: PieceOption[];
  /** Material roles a piece of its own reads. */
  roles?: string[];
  /** The view: the yaw the item faces (default 3π/4, a three-quarter view from the front left). */
  facing?: number;
  /**
   * Turns the item before the view, in degrees: `turn` about up, then `tip` about its side (a shield
   * tipped towards the viewer). A gear item takes `turn` only (as more facing): a worn part cannot tip.
   */
  pose?: { turn?: number; tip?: number };
  /** Turns the drawn item in the icon's plane, in degrees clockwise: a sword or a key laid on the diagonal. Works for gear items too. */
  spin?: number;
}

/** A rarity tier: its name for players and its color for frames and text. */
export interface Rarity {
  label: string;
  color: string;
}

/**
 * What an item icon's atlas says about its item (`meta.data.item`, role 'icon'): the catalog's fields, the gear part it
 * equips (`gear`, the part's id) and that part's equipment slot (`equip`, when the gear catalog gives the part one).
 */
export interface ItemIconData {
  id: string;
  label: string;
  kind: string;
  rarity: string;
  rarityLabel: string;
  rarityColor: string;
  stack: number;
  description?: string;
  gear?: string;
  equip?: string;
}

/** A box in logical pixels. */
export interface IconBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A project's items: the list, the rarity tiers, the icon's size and art, the camera and materials. */
export interface ItemCatalog {
  items: ItemInfo[];
  rarities: Record<string, Rarity>;
  /** Icon size in logical pixels (square) and the room kept round the item. */
  icon: { size: number; padding?: number };
  /** Drawn under the item (a slot's ground, a glow of the rarity's color). */
  background?: (c: CanvasRenderingContext2D, box: IconBox, rarity: Rarity, item: ItemInfo) => void;
  /** Drawn over it (the border, a corner gem for the rarity). */
  frame?: (c: CanvasRenderingContext2D, box: IconBox, rarity: Rarity, item: ItemInfo) => void;
  camera: Camera;
  materials: Record<string, VolumeStyle>;
  defaultMaterials: Record<string, string>;
  /** The gear catalog and characters that gear items are drawn from. */
  gear?: { catalog: GearCatalog; characters: OutfitCharacterInfo[] };
}

const find = (catalog: ItemCatalog, id: string) => catalog.items.find(i => i.id === id);

/** The character a gear item is drawn on: the one it names, else one whose outfit has the part, else the first. */
function wearerOf(gear: NonNullable<ItemCatalog['gear']>, item: ItemInfo): OutfitCharacterInfo | undefined {
  const part = item.gear!.part;
  return gear.characters.find(ch => ch.id === item.gear!.character) ?? gear.characters.find(ch => ch.outfit.pieces.some(p => p.part === part)) ?? gear.characters[0];
}

/** Problems of an item catalog: ids, rarities, a source for each item, gear parts (an add-on drawn as worn needs a wearer) and materials. Empty when valid. */
export function validateItems(catalog: ItemCatalog): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const it of catalog.items) {
    const at = `item "${it.id}"`;
    if (ids.has(it.id)) problems.push(`${at}: the id is used twice`);
    ids.add(it.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(it.id)) problems.push(`${at}: ids are lowercase letters, digits and dashes (it is the icon's name)`);
    if (!catalog.rarities[it.rarity]) problems.push(`${at}: unknown rarity "${it.rarity}" (${Object.keys(catalog.rarities).join(', ')})`);
    if (!it.gear && !it.piece) problems.push(`${at}: give it a gear part, a piece of its own, or both`);
    if (it.gear && !it.piece && it.pose?.tip) problems.push(`${at}: pose.tip does nothing on a gear item drawn as worn; use spin to lay it on the diagonal`);
    if (it.gear) {
      if (!catalog.gear) problems.push(`${at}: a gear item needs the catalog's gear`);
      else {
        const info = catalog.gear.catalog.parts.find(p => p.id === it.gear!.part);
        if (!info) problems.push(`${at}: unknown gear part "${it.gear.part}"`);
        if (it.gear.character && !catalog.gear.characters.some(c => c.id === it.gear!.character)) problems.push(`${at}: unknown character "${it.gear.character}"`);
        // Drawn as worn, an add-on needs the piece it rests on in the wearer's outfit.
        const wearer = wearerOf(catalog.gear, it);
        if (!it.piece && !wearer) problems.push(`${at}: the catalog's gear has no characters to draw it on`);
        else if (!it.piece && info && wearer && partRequires(info).length && !wearer.outfit.pieces.some(p => p.part === info.id && p.on)) problems.push(`${at}: "${info.id}" rests on another part and "${wearer.id}" does not wear it; give the item a character whose outfit has it`);
      }
    }
    if (it.stack !== undefined && !(Number.isInteger(it.stack) && it.stack >= 1)) problems.push(`${at}: stack is a whole number from 1`);
  }
  for (const [role, name] of Object.entries(catalog.defaultMaterials)) if (!catalog.materials[name]) problems.push(`defaultMaterials: role "${role}" names unknown material "${name}"`);
  return problems;
}

/** Draws an item with `camera` (origin and scale) into `c`: its own piece, or a gear part as worn with the body hidden; turned by `spin` round the camera's origin. */
function drawItem(c: CanvasRenderingContext2D, catalog: ItemCatalog, item: ItemInfo, camera: Camera): void {
  if (!item.spin) return drawUnspun(c, catalog, item, camera);
  c.save();
  c.translate(camera.origin.x, camera.origin.y);
  c.rotate((item.spin * Math.PI) / 180);
  c.translate(-camera.origin.x, -camera.origin.y);
  drawUnspun(c, catalog, item, camera);
  c.restore();
}

function drawUnspun(c: CanvasRenderingContext2D, catalog: ItemCatalog, item: ItemInfo, camera: Camera): void {
  const facing = item.facing ?? (3 * Math.PI) / 4;
  if (item.gear && !item.piece) {
    const gear = catalog.gear!;
    const character = wearerOf(gear, item)!;
    const info = gear.catalog.parts.find(p => p.id === item.gear!.part)!;
    const worn = character.outfit.pieces.find(p => p.part === item.gear!.part);
    // The part, and the pieces it rests on (a crest needs its helm).
    const chain: OutfitData['pieces'] = [];
    for (let host = worn?.on; host; ) {
      const h = character.outfit.pieces.find(p => p.id === host);
      if (!h) break;
      chain.unshift(item.gear.hosts === 'hide' ? { ...h, hidden: true } : h);
      host = h.on;
    }
    const piece = { part: item.gear.part, slot: worn?.slot ?? info.slots[0], side: worn?.side ?? 1, options: { ...worn?.options, ...item.gear.options }, materials: { ...worn?.materials, ...item.gear.materials }, ...(worn?.on ? { on: worn.on } : {}) };
    const skin = outfitFromData({ materials: character.outfit.materials, pieces: [...chain, piece] }, gear.catalog);
    const entry = character.clips['idle'] ?? Object.values(character.clips)[0];
    const clip = entry ? ('drive' in entry ? entry : entry.clip) : idleClip(character.skeleton);
    // The camera is already placed on the icon's origin: the character's pivot goes there.
    drawCharacterFrame(c, { skeleton: character.skeleton, clip, skin, camera, pivot: camera.origin }, 0, facing + ((item.pose?.turn ?? 0) * Math.PI) / 180);
    return;
  }
  const stage = new Stage(camera);
  const object = stage.object({ at: vec3(0, 0, 0) });
  const names = { ...catalog.defaultMaterials };
  const materials: SceneMaterials = {};
  for (const [role, name] of Object.entries(names)) if (catalog.materials[name]) materials[role] = catalog.materials[name];
  let frame = Frame3.facing(vec3(0, 0, 0), facing);
  if (item.pose?.turn) frame = frame.turned(item.pose.turn);
  if (item.pose?.tip) frame = frame.pitched(item.pose.tip);
  let seed = 2166136261;
  for (const ch of item.id) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619);
  const options = { ...Object.fromEntries((item.options ?? []).map(o => [o.key, o.default])) };
  item.piece!({ object, camera, frame, seed: seed >>> 0, materials }, options);
  stage.draw(c);
}

/** A canvas to measure on: the page's, or an offscreen one. */
function scratch(size: number): { canvas: { width: number; height: number }; ctx: CanvasRenderingContext2D } {
  const canvas: HTMLCanvasElement | OffscreenCanvas = typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: size, height: size }) : new OffscreenCanvas(size, size);
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D };
}

/**
 * Bounds of the drawn pixels of an item drawn at scale 1 round the centre of a scratch canvas, or
 * null if nothing is drawn. An item that reaches the canvas's edge or misses it (a gear part far
 * from the character's pivot, turned by `spin`) is measured again smaller and its bounds scaled back.
 */
function measure(catalog: ItemCatalog, item: ItemInfo): { x0: number; y0: number; x1: number; y1: number; size: number } | null {
  const size = 768;
  const c = size / 2;
  const { ctx } = scratch(size);
  for (let scale = 1; ; scale /= 2) {
    ctx.clearRect(0, 0, size, size);
    drawItem(ctx, catalog, item, catalog.camera.at({ x: c, y: c }, scale));
    const data = ctx.getImageData(0, 0, size, size).data;
    let x0 = size, y0 = size, x1 = -1, y1 = -1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] < 8) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    const clipped = x1 < 0 || x0 === 0 || y0 === 0 || x1 === size - 1 || y1 === size - 1;
    if (clipped && scale > 1 / 16) continue;
    if (x1 < 0) return null;
    const back = (v: number) => c + (v - c) / scale;
    return { x0: back(x0), y0: back(y0), x1: back(x1 + 1), y1: back(y1 + 1), size };
  }
}

/** Options of `defineItemIcon`. */
export interface ItemIconOptions {
  items: ItemCatalog;
  item: string;
  /** Another rarity's frame than the item's own (to show the tiers). */
  rarity?: string;
  scale?: number;
}

/**
 * Exports an item's inventory icon: a square of the catalog's icon size with the item fitted inside
 * its padding (measured first, then drawn again at the scale that fits, so lines stay crisp), over the
 * catalog's background and under its frame for the item's rarity. The atlas says `role: 'icon'` and
 * the item: id, label, kind, rarity (with its color), stack, description, and the gear part it equips
 * with that part's equipment slot.
 */
export function defineItemIcon(o: ItemIconOptions): AssetDefinition {
  const item = find(o.items, o.item);
  if (!item) throw new Error(`items: unknown item "${o.item}" (catalog has ${o.items.items.map(i => i.id).join(', ')})`);
  const rarityKey = o.rarity ?? item.rarity;
  const rarity = o.items.rarities[rarityKey];
  if (!rarity) throw new Error(`items: unknown rarity "${rarityKey}"`);
  const size = o.items.icon.size;
  const pad = o.items.icon.padding ?? Math.round(size * 0.12);
  const equip = item.gear ? o.items.gear?.catalog.parts.find(p => p.id === item.gear!.part)?.equip : undefined;
  const data: ItemIconData = { id: item.id, label: item.label, kind: item.kind, rarity: rarityKey, rarityLabel: rarity.label, rarityColor: rarity.color, stack: item.stack ?? 1, ...(item.description ? { description: item.description } : {}), ...(item.gear ? { gear: item.gear.part } : {}), ...(equip ? { equip } : {}) };
  return defineAsset({
    width: size,
    height: size,
    scale: o.scale ?? 2,
    data: {
      role: 'icon',
      item: data,
    },
    render({ ctx }) {
      const box: IconBox = { x: 0, y: 0, w: size, h: size };
      o.items.background?.(ctx, box, rarity, item);
      const m = measure(o.items, item);
      if (m) {
        // Fit the drawn pixels into the padded square, centred, and draw again at that scale.
        const k = Math.min((size - pad * 2) / (m.x1 - m.x0), (size - pad * 2) / (m.y1 - m.y0));
        const cx = (m.x0 + m.x1) / 2 - m.size / 2;
        const cy = (m.y0 + m.y1) / 2 - m.size / 2;
        drawItem(ctx, o.items, item, o.items.camera.at({ x: size / 2 - cx * k, y: size / 2 - cy * k }, k));
      }
      o.items.frame?.(ctx, box, rarity, item);
    },
  });
}

/** A seeded generator for an item piece. */
export const itemRng = (ctx: Pick<ItemContext, 'seed'>, salt = 0) => createRng((ctx.seed ^ salt) >>> 0);
