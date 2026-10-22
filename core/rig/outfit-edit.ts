/**
 * @core/rig - Editing outfits
 *
 * The rules an editor (the viewer's customizer) and a game (equipping an item) share to change an
 * outfit saved as data, keeping hosts, add-ons, equipment slots and hands consistent:
 * - `swapCandidates`: the parts that can take a piece's place;
 * - `swapPiece`: one part in place of another, keeping its side, host, materials and options;
 * - `equipPart`: a part into its equipment slot and hand, replacing what was there, or added;
 * - `removePiece`: a piece out, with the add-ons that needed it.
 * Every edit returns a new outfit (the old one is not changed; an edit that changes nothing returns
 * it as it is), the indices of the pieces it took out, where the edited piece is now, and notes an
 * editor can show. Every piece comes after the piece it rests on: an edit that would break that
 * moves the add-on after its host. Guide 05 of `@core/rig`.
 */

import { isHandSlot, isPairedSlot, partKind, partRequires, type GearCatalog, type OutfitData, type PartInfo, type Slot } from './gear.js';

type Piece = OutfitData['pieces'][number];

/** A piece during an edit, with its index in the outfit before the edit (-1 for a new one). */
interface Item {
  p: Piece;
  from: number;
}

/** The result of an outfit edit. */
export interface OutfitEdit {
  outfit: OutfitData;
  /** Indices, in the outfit before the edit, of the pieces taken out with it (add-ons whose host went away, what an equipped part pushed out of its slot or hands). */
  removed: number[];
  /** Where the swapped or equipped piece is in the new outfit (-1 after a removal). */
  index: number;
  /** What changed besides the edit itself, in words an editor can show. */
  notes: string[];
}

function infoOf(catalog: GearCatalog, id: string): PartInfo {
  const info = catalog.parts.find(p => p.id === id);
  if (!info) throw new Error(`outfit: unknown part "${id}"`);
  return info;
}

function checkIndex(outfit: OutfitData, index: number): void {
  if (!outfit.pieces[index]) throw new Error(`outfit: there is no piece ${index} (the outfit has ${outfit.pieces.length})`);
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x));
const sideOf = (p: Piece) => (isPairedSlot(p.slot) ? (p.side ?? 1) : 0);
const named = (parts: string[]) => parts.map(r => `"${r}"`).join(' or ');
const handName = (side: number) => (side < 0 ? 'left' : 'right');

/** The hand a piece is held in (its side), or 0 when it is not a held part in a hand slot. */
function handOf(catalog: GearCatalog, p: Piece): number {
  const info = catalog.parts.find(x => x.id === p.part);
  return info?.wield && isHandSlot(p.slot) ? (p.side ?? 1) : 0;
}

/**
 * Parts that can take the place of piece `index`: the same kind, fitting its slot, and the same
 * equipment slot (`equip`); for a part without one, the same group and the same hosts (`requires`).
 */
export function swapCandidates(catalog: GearCatalog, outfit: OutfitData, index: number): string[] {
  checkIndex(outfit, index);
  const piece = outfit.pieces[index];
  const info = infoOf(catalog, piece.part);
  const kind = partKind(info);
  const hosts = partRequires(info);
  return catalog.parts
    .filter(p => p.id !== info.id && partKind(p) === kind && p.slots.includes(piece.slot))
    .filter(p => (info.equip ? p.equip === info.equip : !p.equip && p.group === info.group && sameSet(partRequires(p), hosts)))
    .map(p => p.id);
}

/** Option values worth keeping from `from` (only those set away from the old part's default), clamped to the new part's options. */
function carryOptions(piece: Piece, from: PartInfo, to: PartInfo): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const opt of to.options ?? []) {
    const v = piece.options?.[opt.key];
    if (v === undefined) continue;
    const old = from.options?.find(o => o.key === opt.key);
    if (old && old.type === opt.type && v === old.default) continue;
    if (opt.type === 'number' && typeof v === 'number') out[opt.key] = Math.min(opt.max, Math.max(opt.min, v));
    else if (opt.type === 'boolean' && typeof v === 'boolean') out[opt.key] = v;
    else if (opt.type === 'select' && opt.choices.some(c => c.value === v)) out[opt.key] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The piece's own materials for the roles the new part reads. */
function carryMaterials(piece: Piece, to: PartInfo): Record<string, string> | undefined {
  const kept = Object.entries(piece.materials ?? {}).filter(([role]) => to.roles.includes(role));
  return kept.length ? Object.fromEntries(kept) : undefined;
}

/** A piece id not used in `items`, from the part's id. */
function freshId(items: Item[], part: string): string {
  const used = new Set(items.map(i => i.p.id).filter(Boolean));
  if (!used.has(part)) return part;
  for (let n = 2; ; n++) if (!used.has(`${part}-${n}`)) return `${part}-${n}`;
}

/**
 * The host for a piece of `info` at `at`: a piece whose part it accepts, preferring the one it rests
 * on now, then an earlier one on the same side (or central), then any earlier one, then a later one
 * (the add-on is moved after it when the edit ends). Gives the host an id if it has none.
 */
function hostFor(items: Item[], at: number, info: PartInfo, current: string | undefined, side: number): string | undefined {
  const accepted = partRequires(info);
  if (!accepted.length) return current;
  const all = items.map((item, i) => ({ item, i })).filter(({ item, i }) => i !== at && accepted.includes(item.p.part));
  const earlier = all.filter(({ i }) => i < at).reverse();
  const pick = all.find(({ item }) => item.p.id !== undefined && item.p.id === current) ?? earlier.find(({ item }) => sideOf(item.p) === side || sideOf(item.p) === 0) ?? earlier[0] ?? all.find(({ item }) => sideOf(item.p) === side || sideOf(item.p) === 0) ?? all[0];
  if (!pick) return undefined;
  if (!pick.item.p.id) items[pick.i] = { ...pick.item, p: { ...pick.item.p, id: freshId(items, pick.item.p.part) } };
  return items[pick.i].p.id;
}

/**
 * Takes the `out` items out and, through them, the add-ons resting on them that need their host
 * (`requires`); the other pieces resting on them stay, freed from `on`.
 */
function takeOut(items: Item[], out: Set<Item>, catalog: GearCatalog, notes: string[]): void {
  const freed = new Set<Item>();
  for (let changed = true; changed; ) {
    changed = false;
    for (const item of items) {
      if (out.has(item) || !item.p.on) continue;
      const host = items.find(h => h.p.id === item.p.on);
      if (!host || !out.has(host)) continue;
      if (partRequires(infoOf(catalog, item.p.part)).length) {
        out.add(item);
        notes.push(`"${item.p.part}" was taken out with "${host.p.part}", which it rests on`);
        changed = true;
      } else freed.add(item);
    }
  }
  const kept = items.flatMap(item => {
    if (out.has(item)) return [];
    if (!freed.has(item) || out.has(item)) return [item];
    const { on: _on, ...rest } = item.p;
    notes.push(`"${item.p.part}" no longer rests on anything`);
    return [{ p: rest, from: item.from }];
  });
  items.splice(0, items.length, ...kept);
}

/** The items in an order where every piece comes after the piece it rests on, moving add-ons as little as possible. */
function hostsFirst(items: Item[]): Item[] {
  const ids = new Set(items.map(i => i.p.id).filter(Boolean));
  const placed = new Set<string>();
  const waiting = new Map<string, Item[]>();
  const order: Item[] = [];
  const emit = (item: Item) => {
    order.push(item);
    if (!item.p.id) return;
    placed.add(item.p.id);
    const next = waiting.get(item.p.id) ?? [];
    waiting.delete(item.p.id);
    next.forEach(emit);
  };
  for (const item of items) {
    const host = item.p.on;
    if (host && ids.has(host) && !placed.has(host)) waiting.set(host, [...(waiting.get(host) ?? []), item]);
    else emit(item);
  }
  for (const rest of waiting.values()) order.push(...rest);
  return order;
}

/** The edit's result: hosts first, the removed indices, where the edited item is. */
function finish(outfit: OutfitData, items: Item[], notes: string[], edited: Item | undefined): OutfitEdit {
  const order = hostsFirst(items);
  if (edited && order.indexOf(edited) !== items.indexOf(edited)) notes.push(`"${edited.p.part}" moved after "${edited.p.on}", which it rests on`);
  const kept = new Set(order.map(i => i.from));
  const removed = outfit.pieces.map((_, i) => i).filter(i => !kept.has(i));
  return { outfit: { ...outfit, pieces: order.map(i => i.p) }, removed, index: edited ? order.indexOf(edited) : -1, notes };
}

/** Puts `partId` in place of the item at `at` (see `swapPiece`); returns the new item. */
function swapAt(items: Item[], at: number, catalog: GearCatalog, partId: string, slot: Slot, notes: string[]): Item {
  const item = items[at];
  const piece = item.p;
  const from = infoOf(catalog, piece.part);
  const to = infoOf(catalog, partId);
  const on = hostFor(items, at, to, piece.on, sideOf(piece));
  if (partRequires(to).length && !on) throw new Error(`outfit: "${partId}" must rest on a ${named(partRequires(to))} piece, and the outfit has none`);
  if (on && on !== piece.on) notes.push(`"${partId}" now rests on "${on}"`);
  const next: Piece = { part: partId, slot };
  if (isPairedSlot(slot)) next.side = piece.side ?? 1;
  const options = carryOptions(piece, from, to);
  if (options) next.options = options;
  const materials = carryMaterials(piece, to);
  if (materials) next.materials = materials;
  if (piece.id) next.id = piece.id;
  if (on) next.on = on;
  if (piece.hidden) next.hidden = true;
  const edited: Item = { p: next, from: item.from };
  items[at] = edited;
  // Add-ons on the old part that do not accept the new one go; anything else resting on it stays.
  const misfits = new Set(
    piece.id
      ? items.filter(i => {
          if (i.p.on !== piece.id) return false;
          const needs = partRequires(infoOf(catalog, i.p.part));
          return needs.length > 0 && !needs.includes(partId);
        })
      : [],
  );
  for (const i of misfits) notes.push(`"${i.p.part}" was taken out: it needs a ${named(partRequires(infoOf(catalog, i.p.part)))} to rest on`);
  takeOut(items, misfits, catalog, notes);
  return edited;
}

/** Pieces that `info`, held on `side` in a hand slot, pushes out of the hands (skipping `except`). */
function handClashes(items: Item[], catalog: GearCatalog, info: PartInfo, slot: Slot, side: number, except?: Item): Item[] {
  if (!info.wield || !isHandSlot(slot)) return [];
  const both = (info.wield.hands ?? 1) === 2;
  return items.filter(item => {
    if (item === except) return false;
    const hand = handOf(catalog, item.p);
    if (!hand) return false;
    if (hand === side) return true;
    return both || (infoOf(catalog, item.p.part).wield!.hands ?? 1) === 2;
  });
}

/** What keeps a part from taking a piece's place: another piece holding its equipment slot or the hands. */
export interface SwapBlocker {
  /** The blocking piece's index in the outfit. */
  index: number;
  part: string;
  /** 'equip': it holds the part's equipment slot on that side; 'hands': the hands cannot take both. */
  reason: 'equip' | 'hands';
}

/**
 * The piece that keeps part `partId` from taking the place of piece `index` (in `slot`, default the
 * piece's), or undefined when `swapPiece` can do it. An editor shows it ("taken by the helm");
 * `equipPart` replaces it instead.
 */
export function swapBlocker(catalog: GearCatalog, outfit: OutfitData, index: number, partId: string, slot?: Slot): SwapBlocker | undefined {
  checkIndex(outfit, index);
  const items = outfit.pieces.map((p, i) => ({ p, from: i }));
  const piece = items[index].p;
  const to = infoOf(catalog, partId);
  const at = slot ?? piece.slot;
  const side = isPairedSlot(at) ? (piece.side ?? 1) : 0;
  if (to.equip) {
    const holder = items.find((item, i) => i !== index && sideOf(item.p) === side && catalog.parts.find(x => x.id === item.p.part)?.equip === to.equip);
    if (holder) return { index: holder.from, part: holder.p.part, reason: 'equip' };
  }
  const clash = handClashes(items, catalog, to, at, side, items[index])[0];
  return clash ? { index: clash.from, part: clash.p.part, reason: 'hands' } : undefined;
}

/**
 * Puts part `partId` in place of piece `index`: it keeps the piece's side, `id` and host (re-hosted to
 * an accepted piece if the new part needs another, and moved after it if that host comes later), the
 * piece's materials for the roles the new part reads, and the options set on it that the new part has
 * too (clamped to its range). Add-ons resting on the piece that do not accept the new part are taken
 * out; the other pieces resting on it now rest on the new one. Throws when the part does not fit the
 * piece's slot (unless `slot` names one it fits), needs a host the outfit lacks, or would share an
 * equipment slot or a hand with another piece (`swapBlocker` says which): `equipPart` settles those
 * by replacing.
 */
export function swapPiece(outfit: OutfitData, catalog: GearCatalog, index: number, partId: string, o: { slot?: Slot } = {}): OutfitEdit {
  checkIndex(outfit, index);
  const items = outfit.pieces.map((p, i) => ({ p, from: i }));
  const piece = items[index].p;
  const to = infoOf(catalog, partId);
  const slot = o.slot ?? piece.slot;
  if (!to.slots.includes(slot)) throw new Error(`outfit: "${partId}" does not fit slot "${slot}" (fits ${to.slots.join(', ')})`);
  const side = isPairedSlot(slot) ? (piece.side ?? 1) : 0;
  const blocker = swapBlocker(catalog, outfit, index, partId, slot);
  if (blocker?.reason === 'equip') throw new Error(`outfit: equipment slot "${to.equip}"${side ? ` (${handName(side)})` : ''} is held by piece ${blocker.index + 1} ("${blocker.part}"); equipPart replaces it`);
  if (blocker) throw new Error(`outfit: "${partId}" would share the hands with piece ${blocker.index + 1} ("${blocker.part}"); equipPart replaces it`);
  const notes: string[] = [];
  const edited = swapAt(items, index, catalog, partId, slot, notes);
  return finish(outfit, items, notes, edited);
}

/**
 * Equips a part the way a game does:
 * - when it has an equipment slot (`equip`), it replaces the piece holding that slot on the same side
 *   (as `swapPiece`), in that piece's slot unless `slot` is given (or the part does not fit it);
 *   otherwise, or when the slot is free, it is added, on the host it needs;
 * - a held part (`wield`) takes the hand: what else is held in it goes, and a two-handed part empties
 *   the other hand too (equipping a shield beside a two-handed weapon takes the weapon out).
 * `slot` defaults to the part's first slot and `side` to the right. Equipping the part that already
 * holds the slot there changes nothing and returns the same outfit.
 */
export function equipPart(outfit: OutfitData, catalog: GearCatalog, partId: string, o: { slot?: Slot; side?: -1 | 1 } = {}): OutfitEdit {
  const info = infoOf(catalog, partId);
  const slot = o.slot ?? info.slots[0];
  if (!info.slots.includes(slot)) throw new Error(`outfit: "${partId}" does not fit slot "${slot}" (fits ${info.slots.join(', ')})`);
  const side = isPairedSlot(slot) ? (o.side ?? 1) : 0;
  const items: Item[] = outfit.pieces.map((p, i) => ({ p, from: i }));
  const holder = info.equip ? items.find(item => sideOf(item.p) === side && catalog.parts.find(x => x.id === item.p.part)?.equip === info.equip) : undefined;
  const there = holder ? (o.slot ?? (info.slots.includes(holder.p.slot) ? holder.p.slot : slot)) : slot;
  const clashes = handClashes(items, catalog, info, there, side, holder);
  if (holder && holder.p.part === partId && holder.p.slot === there && !clashes.length) return { outfit, removed: [], index: holder.from, notes: [] };
  const notes: string[] = [];
  for (const c of clashes) notes.push(`"${c.p.part}" was taken out: ${(info.wield?.hands ?? 1) === 2 ? `"${partId}" takes both hands` : `the ${handName(handOf(catalog, c.p))} hand holds "${partId}" now`}`);
  takeOut(items, new Set(clashes), catalog, notes);
  if (holder && items.includes(holder)) return finish(outfit, items, notes, swapAt(items, items.indexOf(holder), catalog, partId, there, notes));
  const next: Piece = { part: partId, slot };
  if (side) next.side = side as -1 | 1;
  const edited: Item = { p: next, from: -1 };
  items.push(edited);
  const on = hostFor(items, items.length - 1, info, undefined, side);
  if (partRequires(info).length && !on) throw new Error(`outfit: "${partId}" must rest on a ${named(partRequires(info))} piece, and the outfit has none`);
  if (on) next.on = on;
  return finish(outfit, items, notes, edited);
}

/**
 * Takes piece `index` out of the outfit, with the add-ons that need it (and theirs); the other
 * pieces resting on it stay, no longer resting on anything.
 */
export function removePiece(outfit: OutfitData, catalog: GearCatalog, index: number): OutfitEdit {
  checkIndex(outfit, index);
  const items = outfit.pieces.map((p, i) => ({ p, from: i }));
  const notes: string[] = [];
  takeOut(items, new Set([items[index]]), catalog, notes);
  return finish(outfit, items, notes, undefined);
}
