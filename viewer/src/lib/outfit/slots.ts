import { equipPart, isHandSlot, partKind, partRequires, removePiece as removePart, slotsOf, swapBlocker, swapCandidates, swapPiece as swapPart, type GearCatalog, type OutfitEdit, type OutfitData, type PartInfo, type SkeletonSpec, type Slot } from '@core/rig';
import { isPaired, partOf, type Piece, type Side } from './edit';

/**
 * The outfit seen by slot, as the customizer shows it: each place on the body (head, the left shoulder, the right hand…)
 * holds a stack of pieces, and a piece can be swapped for another that fits there in one step. Pure, like `edit.ts`:
 * every function returns a new outfit and leaves the one it was given alone. The edits themselves are the engine's
 * (`swapPiece`, `equipPart`: the rules a game shares when it equips an item); this file adds what a screen needs around them:
 * which parts to offer and why one cannot be chosen, the other side of a pair, and the host that comes later in the list.
 */

/** A place on the body: a slot, and for a paired one the side (0 for a central slot). */
export interface Place {
  slot: Slot;
  side: Side | 0;
}

/** The slots in the order they are listed: from the head down. */
export const SLOT_ORDER: Slot[] = ['head', 'shoulder', 'chest', 'back', 'upperArm', 'forearm', 'hand', 'pelvis', 'thigh', 'shin', 'foot'];

export const samePlace = (a: Place, b: Place) => a.slot === b.slot && a.side === b.side;
export const placeOf = (piece: Piece): Place => ({ slot: piece.slot, side: isPaired(piece.slot) ? (piece.side ?? 1) : 0 });
export const placeKey = (place: Place) => `${place.slot}:${place.side}`;

/** The places a skeleton has, from the head down (the engine's `slotsOf`: a wolf or a spider has no arm slots). */
export function placesOf(skeleton: SkeletonSpec): Place[] {
  return slotsOf(skeleton)
    .map((place): Place => ({ slot: place.slot, side: place.side }))
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || a.side - b.side);
}

/** Parts that are the character's body (bone limbs, a rib cage) and not something it wears (`kind: 'body'`, or the group 'bodies'). */
export const isBodyPart = (info: PartInfo | undefined) => !!info && partKind(info) === 'body';

/** What a slot board folds away: the body's parts, and the flourishes clips play (smears, shockwaves): they stay in the list view. */
export const isHidden = (info: PartInfo | undefined) => !!info && partKind(info) !== 'gear';

/** The pieces of an outfit that are in a place (by index). */
export const piecesIn = (outfit: OutfitData, place: Place): number[] => outfit.pieces.flatMap((piece, i) => (samePlace(placeOf(piece), place) ? [i] : []));

/** A piece with the pieces resting on it, as a tree. */
export interface Stack {
  index: number;
  children: Stack[];
}

/**
 * What is worn in a place, as stacks: a piece resting on another of the same place hangs under it (a crest under a
 * helm); one whose host is in another place, or hidden, stands by itself. Body parts and flourishes are left out unless asked for.
 */
export function stacksIn(outfit: OutfitData, catalog: GearCatalog, place: Place, withHidden = false): Stack[] {
  const indexes = piecesIn(outfit, place).filter((i) => withHidden || !isHidden(partOf(catalog, outfit.pieces[i].part)));
  const byId = new Map(indexes.flatMap((i) => (outfit.pieces[i].id ? [[outfit.pieces[i].id!, i] as const] : [])));
  const nodes = new Map(indexes.map((i) => [i, { index: i, children: [] as Stack[] }]));
  const roots: Stack[] = [];
  for (const i of indexes) {
    const host = outfit.pieces[i].on ? byId.get(outfit.pieces[i].on!) : undefined;
    (host !== undefined && host !== i ? nodes.get(host)!.children : roots).push(nodes.get(i)!);
  }
  return roots;
}

/** Every piece in a stack, the top one first. */
export const flatten = (stack: Stack): number[] => [stack.index, ...stack.children.flatMap(flatten)];

/** The indexes of the pieces resting on a piece, however deep. */
export function dependentsOf(outfit: OutfitData, index: number): number[] {
  const gone = new Set<number>();
  const hosts = new Set([outfit.pieces[index]?.id].filter((id): id is string => !!id));
  for (let changed = true; changed; ) {
    changed = false;
    outfit.pieces.forEach((piece, i) => {
      if (i === index || gone.has(i) || !piece.on || !hosts.has(piece.on)) return;
      gone.add(i);
      if (piece.id) hosts.add(piece.id);
      changed = true;
    });
  }
  return [...gone].sort((a, b) => a - b);
}

/** Whether a piece fits the part that must carry it: `requires` names a part (or a piece id). */
const hostsFor = (info: PartInfo, piece: Piece) => partRequires(info).some((required) => piece.part === required || piece.id === required);

/** The piece a part can rest on, among the ones not in `excluded`: the nearest to the place when several fit. Null when it needs one and none is there. */
function findHost(outfit: OutfitData, info: PartInfo, place: Place, excluded: ReadonlySet<number>, prefer?: string): number | null {
  const fits = outfit.pieces.map((_, i) => i).filter((i) => !excluded.has(i) && hostsFor(info, outfit.pieces[i]));
  if (fits.length === 0) return null;
  const preferred = prefer ? fits.find((i) => outfit.pieces[i].id === prefer) : undefined;
  return preferred ?? fits.find((i) => samePlace(placeOf(outfit.pieces[i]), place)) ?? fits[0];
}

/**
 * The piece (not in `ignore`) that takes the equipment slot a part would take in a place: the engine keeps one piece per `equip`
 * on each side of a pair, or one for the whole body. Null when the part has no `equip` or the slot is free.
 */
function equipHolder(outfit: OutfitData, catalog: GearCatalog, info: PartInfo, place: Place, ignore: ReadonlySet<number>): number | null {
  if (info.equip === undefined) return null;
  const side = isPaired(place.slot) ? (place.side === 0 ? 1 : place.side) : 0;
  const at = outfit.pieces.findIndex((piece, i) => !ignore.has(i) && partOf(catalog, piece.part)?.equip === info.equip && placeOf(piece).side === side);
  return at >= 0 ? at : null;
}

/** A part that can be put in a place, or why it cannot be now. */
export interface Candidate {
  info: PartInfo;
  /** The part that is there now. */
  current: boolean;
  /** Said when it cannot be chosen: the parts it could rest on, none of which is worn. */
  blocked?: string[];
  /** Said when it cannot be chosen: the part that already takes its equipment slot, which a swap would leave in place. */
  taken?: string;
  /** What choosing it takes out of the hands (a shield, when the part needs both): said before, not a reason to refuse it. */
  pushes?: string[];
}

/**
 * The parts that fit a place. When swapping a piece (`replacing`), the ones that do the same job come first (the engine's
 * `swapCandidates`: one helm replaces another); the rest follow. A part that rests on another needs that one in the outfit, not counting the piece being replaced and what rests
 * on it, and a part whose equipment slot another piece keeps is taken. Body parts and flourishes are not offered unless asked for.
 */
export function candidatesFor(catalog: GearCatalog, outfit: OutfitData, place: Place, replacing?: number, withHidden = false): { similar: Candidate[]; others: Candidate[] } {
  const old = replacing !== undefined ? outfit.pieces[replacing] : undefined;
  const oldInfo = old ? partOf(catalog, old.part) : undefined;
  const excluded = new Set(replacing !== undefined ? [replacing, ...dependentsOf(outfit, replacing)] : []);
  const alike = new Set(replacing !== undefined && oldInfo ? swapCandidates(catalog, outfit, replacing) : []);
  const similar: Candidate[] = [];
  const others: Candidate[] = [];
  for (const info of catalog.parts) {
    if (!info.slots.includes(place.slot) || (!withHidden && isHidden(info))) continue;
    const needs = partRequires(info).length > 0 && findHost(outfit, info, place, excluded) === null;
    // What rests on the piece being swapped has nowhere to go once it is out: offering it as "needs the part that is worn" misleads.
    if (needs && excluded.size > 0 && findHost(outfit, info, place, new Set()) !== null) continue;
    // Swapping can leave two pieces in one equipment slot (the engine rejects that): the swap itself says so. Wearing a part in an
    // empty place replaces what holds its slot there (`equipOrSwap`), and fails only when the holder is elsewhere.
    let taken: string | undefined;
    let pushes: string[] | undefined;
    if (replacing === undefined) {
      const holder = equipHolder(outfit, catalog, info, place, excluded);
      if (holder !== null && !samePlace(placeOf(outfit.pieces[holder]), place)) taken = outfit.pieces[holder].part;
    } else if (!needs && info.id !== old?.part) {
      const tried = trySwap(outfit, catalog, replacing, info);
      if (tried && 'taken' in tried) taken = tried.taken;
      else if (tried && tried.swapped.pushed.length > 0) pushes = tried.swapped.pushed;
    }
    const candidate: Candidate = { info, current: old?.part === info.id, ...(needs ? { blocked: partRequires(info) } : {}), ...(taken ? { taken } : {}), ...(pushes ? { pushes } : {}) };
    // Equipping an empty place offers what can stand alone first (add-ons are for the piece they rest on); swapping offers what
    // the engine says can take the piece's place: the same `equip` slot, else the same group resting on the same kind of part.
    const same = !oldInfo ? partRequires(info).length === 0 : info.id === oldInfo.id || alike.has(info.id);
    (same ? similar : others).push(candidate);
  }
  return { similar, others };
}

export interface Swapped {
  outfit: OutfitData;
  /** The add-ons that went with the swap: they cannot rest on the new part (their part ids). */
  dropped: string[];
  /** What the new part pushed out of the hands: a shield beside a two-handed weapon (their part ids). */
  pushed: string[];
}

/** An edit's removed pieces as part ids, told apart: held parts pushed out of the hands, and the add-ons that went with their host. `except` is the piece being swapped. */
function removedBy(from: OutfitData, catalog: GearCatalog, edit: OutfitEdit, except = -1): { dropped: string[]; pushed: string[] } {
  const dropped: string[] = [];
  const pushed: string[] = [];
  for (const i of edit.removed) {
    if (i === except) continue;
    const piece = from.pieces[i];
    (partOf(catalog, piece.part)?.wield && isHandSlot(piece.slot) ? pushed : dropped).push(piece.part);
  }
  return { dropped, pushed };
}

/** What a swap came to: the new outfit, or the part that keeps the equipment slot the new one would take; null when it cannot be done. */
type Outcome = { swapped: Swapped } | { taken: string } | null;

/**
 * A part that needs the hands (a two-handed weapon beside a shield) cannot be swapped in place: the engine's `equipPart` takes
 * the hands, replacing the piece that holds the same `equip` slot, or the piece goes first when it holds another.
 */
function swapByHands(outfit: OutfitData, catalog: GearCatalog, index: number, info: PartInfo): Swapped {
  const old = outfit.pieces[index];
  const where = { slot: old.slot, ...(isPaired(old.slot) ? { side: old.side === -1 ? (-1 as const) : (1 as const) } : {}) };
  const oldEquip = partOf(catalog, old.part)?.equip;
  if (oldEquip !== undefined && oldEquip === info.equip) {
    const edit = equipPart(outfit, catalog, info.id, where);
    return { outfit: edit.outfit, ...removedBy(outfit, catalog, edit) };
  }
  const first = removePart(outfit, catalog, index);
  const second = equipPart(first.outfit, catalog, info.id, where);
  const before = removedBy(outfit, catalog, first, index);
  const after = removedBy(first.outfit, catalog, second);
  return { outfit: second.outfit, dropped: [...before.dropped, ...after.dropped], pushed: [...before.pushed, ...after.pushed] };
}

function trySwap(outfit: OutfitData, catalog: GearCatalog, index: number, info: PartInfo): Outcome {
  if (!outfit.pieces[index]) return null;
  try {
    const blocker = swapBlocker(catalog, outfit, index, info.id);
    if (blocker?.reason === 'equip') return { taken: blocker.part };
    if (blocker) return { swapped: swapByHands(outfit, catalog, index, info) };
    const edit = swapPart(outfit, catalog, index, info.id);
    return { swapped: { outfit: edit.outfit, ...removedBy(outfit, catalog, edit) } };
  } catch {
    return null;
  }
}

/**
 * Puts another part where a piece is, in one step (the engine's `swapPiece`): the piece keeps its place, side, `id`, the materials
 * of the roles the new part reads and the options of the same key; what rested on it stays if it does not need a host, or the
 * new part is one it accepts, and goes if it cannot rest on it; a host that comes later in the list is put before the piece.
 * A part that needs both hands takes them (a shield goes). Null when the new part rests on another and none is in the outfit,
 * or another piece keeps its equipment slot.
 */
export function swapPiece(outfit: OutfitData, catalog: GearCatalog, index: number, info: PartInfo): Swapped | null {
  const tried = trySwap(outfit, catalog, index, info);
  return tried && 'swapped' in tried ? tried.swapped : null;
}

/** Wears a part in a place (the engine's `equipPart`): it replaces the piece that keeps its equipment slot there, or is added at the end on the host it needs; what the hands cannot hold with it goes. */
function wear(outfit: OutfitData, catalog: GearCatalog, info: PartInfo, place: Place): Swapped | null {
  try {
    const edit = equipPart(outfit, catalog, info.id, { slot: place.slot, ...(isPaired(place.slot) ? { side: place.side === -1 ? -1 : 1 } : {}) });
    return { outfit: edit.outfit, ...removedBy(outfit, catalog, edit) };
  } catch {
    return null;
  }
}

/** The piece of the opposite side of a pair that wears the same part, for "both sides" edits; -1 when there is none. */
export function mirrorOf(outfit: OutfitData, index: number): number {
  const piece = outfit.pieces[index];
  if (!piece || !isPaired(piece.slot)) return -1;
  const side = (piece.side ?? 1) === 1 ? -1 : 1;
  return outfit.pieces.findIndex((p, i) => i !== index && p.slot === piece.slot && p.part === piece.part && (p.side ?? 1) === side && (p.on === undefined) === (piece.on === undefined));
}

/** Two edits' consequences, one after the other. */
const joined = (first: Swapped, next: Swapped): Swapped => ({ outfit: next.outfit, dropped: [...first.dropped, ...next.dropped], pushed: [...first.pushed, ...next.pushed] });

/**
 * Swaps a piece and, for a pair, does the same on the other side ("both sides"): the opposite piece that wore the same part
 * is swapped too, and an opposite side with nothing in it gets the part. Pieces are found again by id after the first swap,
 * because the swap can remove pieces and shift the others.
 */
export function swapBoth(outfit: OutfitData, catalog: GearCatalog, index: number, info: PartInfo, both: boolean): Swapped | null {
  const first = swapPiece(outfit, catalog, index, info);
  if (!first || !both || !isPaired(outfit.pieces[index].slot)) return first;
  const piece = outfit.pieces[index];
  const mirror = mirrorOf(outfit, index);
  const side: Side = (piece.side ?? 1) === 1 ? -1 : 1;
  const opposite: Place = { slot: piece.slot, side };
  if (mirror >= 0) {
    const id = outfit.pieces[mirror].id;
    const at = first.outfit.pieces.findIndex((p, i) => (id ? p.id === id : i === mirror));
    const second = at >= 0 ? swapPiece(first.outfit, catalog, at, info) : null;
    return second ? joined(first, second) : first;
  }
  // The other side holds nothing of the kind: the same part goes there too (a side that wears something else is left alone).
  if (piecesIn(first.outfit, opposite).length === 0) {
    const worn = wear(first.outfit, catalog, info, opposite);
    if (worn) return joined(first, worn);
  }
  return first;
}

/**
 * Wears a part the way an equipment screen does: a part with an `equip` slot replaces the piece that keeps that slot in the place
 * (on that side), and any other is added as a layer. For a pair, the other side gets it too unless it keeps the slot with
 * something else, which is left alone. Null when it needs a host the outfit does not have, or the slot is kept by a piece elsewhere.
 */
export function equipOrSwap(outfit: OutfitData, catalog: GearCatalog, info: PartInfo, place: Place, both: boolean): Swapped | null {
  const none: ReadonlySet<number> = new Set();
  const holder = equipHolder(outfit, catalog, info, place, none);
  if (holder !== null) return samePlace(placeOf(outfit.pieces[holder]), place) ? swapBoth(outfit, catalog, holder, info, both) : null;
  const paired = isPaired(place.slot);
  const here: Place = { slot: place.slot, side: paired ? (place.side === -1 ? -1 : 1) : 0 };
  const opposite: Place = { slot: place.slot, side: here.side === 1 ? -1 : 1 };
  const places = paired && both && equipHolder(outfit, catalog, info, opposite, none) === null ? [here, opposite] : [here];
  let result: Swapped | null = { outfit, dropped: [], pushed: [] };
  for (const there of places) {
    const worn: Swapped | null = result && wear(result.outfit, catalog, info, there);
    result = worn && result && joined(result, worn);
    if (!result) return null;
  }
  return result;
}
