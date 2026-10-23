import assert from 'node:assert/strict';
import { validateOutfit, type GearCatalog, type OutfitData, type PartInfo } from '../../core/rig';
import { addPiece, partOf, removePiece } from '../../viewer/src/lib/outfit/edit';
import { candidatesFor, dependentsOf, equipOrSwap, flatten, mirrorOf, placeOf, placesOf, piecesIn, stacksIn, swapBoth, swapPiece, type Place } from '../../viewer/src/lib/outfit/slots';
import { CATALOG, CHARACTERS } from '../../examples/soulkeeper/src/gear/catalog';

console.log('🧪 Checking the customizer by slot (places of a body, stacks, candidates, swapping a piece in one step, wearing a part)...\n');

const part = (id: string, group: string, slots: PartInfo['slots'], extra: Partial<PartInfo> = {}): PartInfo => ({ id, label: id, group, part: () => {}, slots, roles: ['metal'], ...extra });

const catalog: GearCatalog = {
  parts: [
    part('skull', 'bodies', ['head']),
    part('helm', 'head', ['head'], {
      requires: 'skull', roles: ['metal', 'metalAccent'],
      options: [{ key: 'size', label: 'Size', type: 'number', default: 1, min: 0.5, max: 2 }, { key: 'visor', label: 'Visor', type: 'boolean', default: true }, { key: 'shape', label: 'Shape', type: 'select', default: 'round', choices: [{ value: 'round', label: 'Round' }, { value: 'tall', label: 'Tall' }] }],
    }),
    part('crown', 'head', ['head'], { requires: 'skull', roles: ['metal'], options: [{ key: 'size', label: 'Size', type: 'number', default: 1, min: 0.8, max: 1.5 }, { key: 'visor', label: 'Visor', type: 'number', default: 0, min: 0, max: 3 }, { key: 'shape', label: 'Shape', type: 'select', default: 'flat', choices: [{ value: 'flat', label: 'Flat' }] }] }),
    part('crest', 'head', ['head'], { requires: 'helm', roles: ['cloth'] }),
    part('feather', 'head', ['head'], { requires: 'crown', roles: ['cloth'] }),
    part('hat', 'head', ['head']),
    part('pauldron', 'shoulders', ['shoulder']),
    part('spiked-pauldron', 'shoulders', ['shoulder']),
    part('sword', 'weapons', ['hand']),
    part('bow', 'weapons', ['hand']),
    part('smear', 'effects', ['hand'], { requires: 'sword' }),
  ],
  bases: [{ id: 'bone', label: 'Bone', skin: () => {}, roles: [] }],
  materials: {},
};
const info = (id: string) => partOf(catalog, id)!;

/** Every piece rests on an earlier piece that exists, and every part fits its slot. */
function check(outfit: OutfitData) {
  outfit.pieces.forEach((piece, i) => {
    if (piece.on) {
      const host = outfit.pieces.findIndex((p) => p.id === piece.on);
      assert.ok(host >= 0 && host < i, `piece ${i} (${piece.part}) rests on an earlier piece`);
    }
    assert.ok(info(piece.part).slots.includes(piece.slot), `${piece.part} fits ${piece.slot}`);
  });
  const ids = outfit.pieces.flatMap((p) => (p.id ? [p.id] : []));
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
}

// 1. The places of a body: the central ones always, an arm's slots for each arm, a leg's for any skeleton with legs.
const humanoid = { arms: [{ side: -1 }, { side: 1 }], legs: [{ offset: [0, -1, 0] }, { offset: [0, 1, 0] }] } as unknown as Parameters<typeof placesOf>[0];
const spider = { legs: [{ offset: [1, -1, 0] }, { offset: [1, 1, 0] }, { offset: [-1, -1, 0] }, { offset: [-1, 1, 0] }] } as unknown as Parameters<typeof placesOf>[0];
const key = (p: Place[]) => p.map((x) => `${x.slot}${x.side || ''}`);
assert.deepEqual(key(placesOf(humanoid)), ['head', 'shoulder-1', 'shoulder1', 'chest', 'back', 'upperArm-1', 'upperArm1', 'forearm-1', 'forearm1', 'hand-1', 'hand1', 'pelvis', 'thigh-1', 'thigh1', 'shin-1', 'shin1', 'foot-1', 'foot1']);
assert.deepEqual(key(placesOf(spider)), ['head', 'chest', 'back', 'pelvis', 'thigh-1', 'thigh1', 'shin-1', 'shin1', 'foot-1', 'foot1'], 'no arms: no shoulders, forearms or hands');
assert.deepEqual(key(placesOf({ arms: [{ side: 1 }], legs: [{ offset: [0, 1, 0] }] } as unknown as Parameters<typeof placesOf>[0])).filter((k) => k.startsWith('shoulder')), ['shoulder1'], 'one arm, one shoulder');

// 2. What is worn in a place, as stacks: a crest hangs under its helm; the body part is left out unless asked for.
let outfit: OutfitData = { base: 'bone', materials: {}, pieces: [] };
outfit = addPiece(outfit, info('skull'), { slot: 'head' });
outfit = addPiece(outfit, info('helm'), { slot: 'head', on: 'skull' });
outfit = addPiece(outfit, info('crest'), { slot: 'head', on: 'helm' });
outfit = addPiece(outfit, info('pauldron'), { slot: 'shoulder', sides: [-1, 1] });
outfit = addPiece(outfit, info('sword'), { slot: 'hand' });
outfit = addPiece(outfit, info('smear'), { slot: 'hand', on: 'sword-right' });
check(outfit);
const head: Place = { slot: 'head', side: 0 };
assert.deepEqual(piecesIn(outfit, head), [0, 1, 2]);
assert.deepEqual(piecesIn(outfit, { slot: 'shoulder', side: -1 }), [3]);
assert.deepEqual(piecesIn(outfit, { slot: 'shoulder', side: 1 }), [4]);
assert.deepEqual(placeOf(outfit.pieces[0]), head);
assert.deepEqual(stacksIn(outfit, catalog, head).map((s) => [s.index, s.children.map((c) => c.index)]), [[1, [2]]], 'the helm with its crest; the skull is the body');
assert.deepEqual(stacksIn(outfit, catalog, head, true).map((s) => [s.index, flatten(s)]), [[0, [0, 1, 2]]], 'with the body, everything hangs from the skull');
assert.deepEqual(stacksIn(outfit, catalog, { slot: 'hand', side: 1 }).map((s) => flatten(s)), [[5]], 'a flourish (group effects) is folded away');
assert.deepEqual(stacksIn(outfit, catalog, { slot: 'hand', side: 1 }, true).map((s) => flatten(s)), [[5, 6]], 'unless asked for');
assert.deepEqual(dependentsOf(outfit, 1), [2]);
assert.deepEqual(dependentsOf(outfit, 0), [1, 2], 'however deep');
assert.deepEqual(dependentsOf(outfit, 2), []);

// 3. What can go in a place: for a swap, the parts that do the same job come first; one that rests on another needs it.
const swaps = candidatesFor(catalog, outfit, head, 1);
assert.deepEqual(swaps.similar.map((c) => [c.info.id, c.current, c.blocked]), [['helm', true, undefined], ['crown', false, undefined]], 'same group, resting on the same part');
assert.deepEqual(swaps.others.map((c) => [c.info.id, c.blocked]), [['feather', ['crown']], ['hat', undefined]], 'the rest; an add-on whose host is not worn is blocked, one that only rests on the piece being replaced is not offered');
const equipHead = candidatesFor(catalog, { ...outfit, pieces: [] }, head);
assert.deepEqual(equipHead.similar.map((c) => c.info.id), ['hat'], 'an empty place offers what stands alone first (not the body)');
assert.ok(equipHead.others.every((c) => c.blocked), 'add-ons need their host');
assert.ok(candidatesFor(catalog, outfit, head, 1, true).others.concat(candidatesFor(catalog, outfit, head, 1, true).similar).some((c) => c.info.id === 'skull'), 'the body is offered when asked for');

// 4. Swapping: in one step, in the same place, keeping what can be kept.
const tuned: OutfitData = {
  ...outfit,
  pieces: outfit.pieces.map((p) => (p.part === 'helm' ? { ...p, options: { size: 1.8, visor: false, shape: 'tall' }, materials: { metal: 'gold', metalAccent: 'brass' } } : p)),
};
const crowned = swapPiece(tuned, catalog, 1, info('crown'))!;
check(crowned.outfit);
assert.deepEqual(crowned.outfit.pieces[1], { part: 'crown', slot: 'head', id: 'helm', on: 'skull', options: { size: 1.5 }, materials: { metal: 'gold' } }, 'same place, id and host; the number held to the new range; options of another type or choice are left; only roles the crown reads');
assert.deepEqual(crowned.dropped, ['crest'], 'the crest rested on the helm and cannot rest on a crown');
assert.equal(crowned.outfit.pieces.length, tuned.pieces.length - 1);
assert.equal(crowned.outfit.pieces.some((p) => p.part === 'crest'), false);
assert.equal(tuned.pieces.length, outfit.pieces.length, 'the outfit it was given is untouched');
assert.equal(tuned.pieces[1].part, 'helm');
// What can rest on the new part stays (the piece keeps its id, so what rested on it still does).
const withFeather = addPiece(addPiece(outfit, info('crown'), { slot: 'head', on: 'skull' }), info('feather'), { slot: 'head', on: 'crown' });
const feathered = swapPiece(withFeather, catalog, withFeather.pieces.findIndex((p) => p.part === 'crown'), info('crown'))!;
check(feathered.outfit);
assert.deepEqual(feathered.dropped, [], 'what rests on a part stays when the part is the one it requires');
assert.equal(feathered.outfit.pieces.find((p) => p.part === 'feather')!.on, feathered.outfit.pieces.find((p) => p.part === 'crown')!.id);
// A part that needs a host the outfit lacks cannot be swapped in.
assert.equal(swapPiece(outfit, catalog, 1, info('feather')), null, 'a feather needs a crown');
assert.equal(swapPiece(outfit, catalog, 99, info('hat')), null);
// A piece that stands alone swaps and what rested on it goes.
const bowed = swapPiece(outfit, catalog, 5, info('bow'))!;
check(bowed.outfit);
assert.deepEqual([bowed.outfit.pieces[5].part, bowed.dropped], ['bow', ['smear']]);
assert.deepEqual(bowed.outfit.pieces.map((p) => p.part), ['skull', 'helm', 'crest', 'pauldron', 'pauldron', 'bow']);
// A side is kept: the left pauldron becomes the other kind, the right one stays.
const spiked = swapPiece(outfit, catalog, 3, info('spiked-pauldron'))!;
check(spiked.outfit);
assert.deepEqual([spiked.outfit.pieces[3].part, spiked.outfit.pieces[3].side, spiked.outfit.pieces[3].id, spiked.outfit.pieces[4].part], ['spiked-pauldron', -1, 'pauldron-left', 'pauldron']);
// The opposite side of a pair, for "both sides".
assert.equal(mirrorOf(outfit, 3), 4);
assert.equal(mirrorOf(spiked.outfit, 3), -1, 'it wears another part now');
assert.equal(mirrorOf(outfit, 0), -1, 'a central piece has none');
// Both sides: the pair is swapped together; a side with nothing gets the part; a side that wears another part is left alone.
const pair = swapBoth(outfit, catalog, 3, info('spiked-pauldron'), true)!;
check(pair.outfit);
assert.deepEqual(pair.outfit.pieces.filter((p) => p.slot === 'shoulder').map((p) => [p.part, p.side]), [['spiked-pauldron', -1], ['spiked-pauldron', 1]]);
const oneSided: OutfitData = { ...outfit, pieces: outfit.pieces.filter((_, i) => i !== 4) };
const filled = swapBoth(oneSided, catalog, 3, info('spiked-pauldron'), true)!;
check(filled.outfit);
assert.deepEqual(filled.outfit.pieces.filter((p) => p.slot === 'shoulder').map((p) => [p.part, p.side]), [['spiked-pauldron', -1], ['spiked-pauldron', 1]], 'the empty side is dressed too');
const odd: OutfitData = { ...outfit, pieces: outfit.pieces.map((p, i) => (i === 4 ? { ...p, part: 'spiked-pauldron' } : p)) };
const lone = swapBoth(odd, catalog, 3, info('spiked-pauldron'), true)!;
assert.deepEqual(lone.outfit.pieces.filter((p) => p.slot === 'shoulder').map((p) => [p.part, p.side]), [['spiked-pauldron', -1], ['spiked-pauldron', 1]], 'a side that already wears it stays');
const apart = swapBoth(outfit, catalog, 3, info('spiked-pauldron'), false)!;
assert.deepEqual(apart.outfit.pieces.filter((p) => p.slot === 'shoulder').map((p) => p.part), ['spiked-pauldron', 'pauldron'], 'one side only when not asked for both');
const swords = swapBoth(outfit, catalog, 5, info('bow'), true)!;
check(swords.outfit);
assert.deepEqual(swords.dropped, ['smear'], 'what rested on the old part goes');
assert.equal(swords.outfit.pieces.filter((p) => p.part === 'bow').length, 2, 'both hands, since the other hand was empty (the switch is off unless the pair already matches)');

// A host that comes later in the list: the new piece moves after it (with what rests on it).
const late: OutfitData = { base: 'bone', materials: {}, pieces: [{ part: 'hat', slot: 'head', id: 'hat' }, { part: 'skull', slot: 'head', id: 'skull' }] };
const helmed = swapPiece(late, catalog, 0, info('helm'))!;
check(helmed.outfit);
assert.deepEqual(helmed.outfit.pieces.map((p) => p.part), ['skull', 'helm']);
assert.equal(helmed.outfit.pieces[1].on, 'skull');

// What rests on a piece without needing it stays: a belt on a tunic that becomes a tabard. Taking the tunic out frees the belt;
// the add-ons that need it go with it.
const garb: GearCatalog = { ...catalog, parts: [...catalog.parts, part('tunic', 'torso', ['pelvis']), part('tabard', 'torso', ['pelvis']), part('belt', 'garments', ['pelvis'])] };
const dressed: OutfitData = { base: 'bone', materials: {}, pieces: [{ part: 'tunic', slot: 'pelvis', id: 'tunic' }, { part: 'belt', slot: 'pelvis', id: 'belt', on: 'tunic' }] };
const retied = swapPiece(dressed, garb, 0, partOf(garb, 'tabard')!)!;
assert.deepEqual(retied.outfit.pieces.map((p) => [p.part, p.on]), [['tabard', undefined], ['belt', 'tunic']]);
assert.equal(retied.outfit.pieces[0].id, 'tunic', 'the piece keeps its id: the belt still rests on it');
assert.deepEqual(retied.dropped, [], 'the belt needs no host, so it stays');
const untied = removePiece(dressed, garb, 0);
assert.deepEqual([untied.removed, untied.outfit.pieces.map((p) => [p.part, p.on])], [1, [['belt', undefined]]], 'the belt stays, resting on nothing');
assert.equal(removePiece(outfit, catalog, 1).removed, 2, 'the helm and the crest that needs it');

// 5. Wearing a part where there is nothing: once, or for both sides; an add-on goes on the piece it needs.
const bare: OutfitData = { base: 'bone', materials: {}, pieces: [] };
const equip = (outfit: OutfitData, id: string, place: Place, both = false) => equipOrSwap(outfit, catalog, info(id), place, both)?.outfit ?? null;
const both = equip(bare, 'pauldron', { slot: 'shoulder', side: -1 }, true)!;
assert.deepEqual(both.pieces.map((p) => [p.part, p.side]), [['pauldron', -1], ['pauldron', 1]]);
const one = equip(bare, 'pauldron', { slot: 'shoulder', side: -1 })!;
assert.deepEqual(one.pieces.map((p) => [p.part, p.side]), [['pauldron', -1]], 'the side of the place');
assert.deepEqual(equip(bare, 'hat', head)!.pieces.map((p) => [p.part, p.side]), [['hat', undefined]], 'a central slot has no side');
assert.equal(equip(bare, 'crest', head), null, 'no helm to rest on');
const noHelm: OutfitData = { ...outfit, pieces: outfit.pieces.filter((p) => p.part !== 'helm' && p.part !== 'crest') };
assert.equal(equip(noHelm, 'crest', head), null, 'the crest needs a helm, which this outfit does not have');
const onHelm = equip(outfit, 'crest', head)!;
check(onHelm);
assert.equal(onHelm.pieces.at(-1)!.on, 'helm');

// An `equip` slot says which parts replace each other, the way an equipment screen works: equipping one swaps the one worn.
const equipCatalog: GearCatalog = { ...catalog, parts: catalog.parts.map((p) => (p.id === 'helm' || p.id === 'hat' ? { ...p, equip: 'headgear' } : p)) };
const equipInfo = (id: string) => equipCatalog.parts.find((p) => p.id === id)!;
const asHelm = candidatesFor(equipCatalog, outfit, head, 1);
assert.deepEqual(asHelm.similar.map((c) => c.info.id), ['helm', 'hat'], 'the parts of the same equip slot are the ones that do the same job, whatever they rest on');
const swappedIn = equipOrSwap(outfit, equipCatalog, equipInfo('hat'), head, false)!;
check(swappedIn.outfit);
assert.deepEqual(swappedIn.outfit.pieces.filter((p) => p.slot === 'head').map((p) => p.part), ['skull', 'hat'], 'wearing a hat takes the helm off (and its crest with it)');
assert.deepEqual(swappedIn.dropped, ['crest']);
// A swap cannot put a second piece in an equipment slot that another one keeps (the engine rejects it): the picker marks it taken.
const crestAt = outfit.pieces.findIndex((p) => p.part === 'crest');
const overCrest = candidatesFor(equipCatalog, outfit, head, crestAt);
assert.equal([...overCrest.similar, ...overCrest.others].find((c) => c.info.id === 'hat')?.taken, 'helm', 'the hat would share the headgear slot with the helm that stays');
assert.equal(swapPiece(outfit, equipCatalog, crestAt, equipInfo('hat')), null, 'and the swap refuses');
assert.equal([...asHelm.similar, ...asHelm.others].some((c) => c.taken), false, 'swapping the piece that keeps the slot is fine');
// A pair: the side with a free slot gets the part, and a side that keeps the slot with something else is left alone.
const padCatalog: GearCatalog = { ...catalog, parts: catalog.parts.map((p) => (p.id === 'pauldron' || p.id === 'spiked-pauldron' ? { ...p, equip: 'pad' } : p)) };
const padInfo = (id: string) => padCatalog.parts.find((p) => p.id === id)!;
const rightOnly: OutfitData = { ...outfit, pieces: outfit.pieces.filter((p) => !(p.slot === 'shoulder' && p.side === -1)) };
const leftOver = equipOrSwap(rightOnly, padCatalog, padInfo('spiked-pauldron'), { slot: 'shoulder', side: -1 }, true)!;
assert.deepEqual(validateOutfit(leftOver.outfit, padCatalog), []);
assert.deepEqual(leftOver.outfit.pieces.filter((p) => p.slot === 'shoulder').map((p) => [p.part, p.side]).sort((a, b) => (a[1] as number) - (b[1] as number)), [['spiked-pauldron', -1], ['pauldron', 1]], 'the side that keeps the slot with another part is left alone');
const layered = equipOrSwap(outfit, catalog, info('hat'), head, false)!;
assert.deepEqual(layered.outfit.pieces.filter((p) => p.slot === 'head').map((p) => p.part), ['skull', 'helm', 'crest', 'hat'], 'a part without equip is a layer that stacks');
assert.equal(equipOrSwap(bare, catalog, info('crest'), head, false), null);

// Hands: a part that needs both takes them (the shield goes), and a shield beside a two-handed weapon takes the weapon out.
const warCatalog: GearCatalog = {
  ...catalog,
  parts: [
    ...catalog.parts,
    part('blade', 'weapons', ['hand'], { equip: 'weapon', wield: { class: 'blade' } }),
    part('greataxe', 'weapons', ['hand'], { equip: 'weapon', wield: { class: 'axe', hands: 2 } }),
    part('buckler', 'shields', ['forearm'], { equip: 'shield', wield: { class: 'shield', offHand: 'hold' } }),
  ],
};
const war = (id: string) => partOf(warCatalog, id)!;
const armed: OutfitData = { base: 'bone', materials: {}, pieces: [{ part: 'blade', slot: 'hand', side: 1, id: 'blade-right' }, { part: 'buckler', slot: 'forearm', side: -1, id: 'buckler-left' }] };
const rightHand: Place = { slot: 'hand', side: 1 };
const axeCandidate = candidatesFor(warCatalog, armed, rightHand, 0).similar.find((c) => c.info.id === 'greataxe')!;
assert.deepEqual([axeCandidate.pushes, axeCandidate.taken, axeCandidate.blocked], [['buckler'], undefined, undefined], 'choosing it is allowed, and the picker can say what it takes out');
const axed = swapPiece(armed, warCatalog, 0, war('greataxe'))!;
assert.deepEqual(axed.outfit.pieces.map((p) => p.part), ['greataxe'], 'the axe takes both hands');
assert.deepEqual([axed.pushed, axed.dropped], [['buckler'], []]);
assert.deepEqual(validateOutfit(axed.outfit, warCatalog), []);
assert.deepEqual(swapPiece(armed, warCatalog, 0, war('blade'))!.pushed, [], 'a one-handed swap leaves the shield');
const twoHanded: OutfitData = { base: 'bone', materials: {}, pieces: [{ part: 'greataxe', slot: 'hand', side: 1, id: 'greataxe-right' }] };
const shielded = equipOrSwap(twoHanded, warCatalog, war('buckler'), { slot: 'forearm', side: -1 }, false)!;
assert.deepEqual(shielded.outfit.pieces.map((p) => p.part), ['buckler'], 'a shield beside a two-handed weapon takes the weapon out');
assert.deepEqual(shielded.pushed, ['greataxe']);
assert.deepEqual(validateOutfit(shielded.outfit, warCatalog), []);
// A part that does not fit the piece's slot cannot be swapped in.
const withHat: OutfitData = { base: 'bone', materials: {}, pieces: [{ part: 'blade', slot: 'hand', side: 1, id: 'blade-right' }, { part: 'hat', slot: 'head', id: 'hat' }] };
assert.equal(swapPiece(withHat, warCatalog, 1, war('blade')), null, 'a hat cannot become a blade: it does not fit the head');

// 6. The real kit: every swap the picker offers gives an outfit the engine accepts, whatever the character wears.
let swapped = 0;
for (const character of CHARACTERS) {
  const base = validateOutfit(character.outfit, CATALOG);
  assert.deepEqual(base, [], `${character.id}'s own outfit is valid`);
  character.outfit.pieces.forEach((piece, index) => {
    const place = placeOf(piece);
    const { similar, others } = candidatesFor(CATALOG, character.outfit, place, index, true);
    for (const candidate of [...similar, ...others]) {
      const result = swapPiece(character.outfit, CATALOG, index, candidate.info);
      assert.equal(result === null, !!candidate.blocked || !!candidate.taken, `${character.id}: ${piece.part} → ${candidate.info.id} is ${candidate.blocked || candidate.taken ? 'blocked' : 'possible'}`);
      if (!result) continue;
      assert.deepEqual(validateOutfit(result.outfit, CATALOG), [], `${character.id}: ${piece.part} → ${candidate.info.id}`);
      swapped++;
    }
  });
}
assert.ok(swapped > 100, `the kit has plenty of swaps (${swapped})`);
// And wearing: whatever the picker offers in any place of a character, as a new piece, is accepted by the engine.
let worn = 0;
for (const character of CHARACTERS) {
  for (const place of placesOf(character.skeleton)) {
    const { similar, others } = candidatesFor(CATALOG, character.outfit, place);
    for (const candidate of [...similar, ...others].filter((c) => !c.blocked && !c.taken)) {
      const result = equipOrSwap(character.outfit, CATALOG, candidate.info, place, false);
      assert.ok(result, `${character.id}: ${candidate.info.id} in ${place.slot}`);
      assert.deepEqual(validateOutfit(result.outfit, CATALOG), [], `${character.id}: wearing ${candidate.info.id} in ${place.slot}:${place.side}`);
      worn++;
    }
  }
}
assert.ok(worn > 50, `plenty of ways to wear a part (${worn})`);

console.log('✅ slot checks passed');
