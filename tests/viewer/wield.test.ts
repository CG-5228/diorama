import assert from 'node:assert/strict';
import { checkWield, type CharacterClip, type GearCatalog, type OutfitData, type PartInfo } from '../../core/rig';
import { createTranslator } from '../../viewer/src/i18n/core';
import { candidatesFor, placeOf, swapPiece } from '../../viewer/src/lib/outfit/slots';
import { classNameOf, wieldReport } from '../../viewer/src/lib/outfit/wield';
import { CATALOG, CHARACTERS } from '../../examples/pivot-v2-2d/src/gear/catalog';

console.log('🧪 Checking what a character holds and the clips made for it (the report, the real kit)...\n');

// The report is written in the language of the screen: the pure code takes the translator, so a test picks the language.
const pt = createTranslator('pt-BR');
const en = createTranslator('en');

const part = (id: string, group: string, slots: PartInfo['slots'], extra: Partial<PartInfo> = {}): PartInfo => ({ id, label: id.toUpperCase(), group, part: () => {}, slots, roles: ['metal'], ...extra });
const catalog: GearCatalog = {
  parts: [
    part('sword', 'weapons', ['hand'], { equip: 'weapon', wield: { class: 'blade' } }),
    part('scythe', 'weapons', ['hand'], { equip: 'weapon', wield: { class: 'polearm' } }),
    part('buckler', 'shields', ['forearm'], { equip: 'shield', wield: { class: 'shield', offHand: 'hold' } }),
    part('dagger', 'weapons', ['hand'], { equip: 'weapon', wield: { class: 'blade' } }),
  ],
  bases: [{ id: 'bone', label: 'Bone', skin: () => {}, roles: [] }],
  materials: {},
};
// Clips are made for what is held: a slash for a blade in the main hand, a bash for a shield in the off hand.
const clip = (wields?: { main?: string[]; off?: string[] }) => ({ clip: {}, frames: 8, ...(wields ? { wields } : {}) }) as unknown as CharacterClip;
const clips: Record<string, CharacterClip> = { idle: clip(), slash: clip({ main: ['blade'] }), cleave: clip({ main: ['blade'] }), bash: clip({ off: ['shield'] }) };
const wearing = (...pieces: OutfitData['pieces']): OutfitData => ({ base: 'bone', materials: {}, pieces });
const blade = { part: 'sword', slot: 'hand' as const, side: 1 as const, id: 'sword-right' };
const shield = { part: 'buckler', slot: 'forearm' as const, side: -1 as const, id: 'buckler-left' };
const scythe = { part: 'scythe', slot: 'hand' as const, side: 1 as const, id: 'scythe-right' };

// 1. A blade in the main hand and a shield in the off hand suit every clip: nothing to say.
const fine = wieldReport(clips, wearing(blade, shield), catalog, pt);
assert.deepEqual(fine.notes, []);
assert.equal(fine.unusable.size, 0);
assert.deepEqual([fine.main?.label, fine.main?.class, fine.off?.label], ['SWORD', 'blade', 'BUCKLER']);

// 2. A scythe in the hand of a character whose attacks are for a blade: it says so, and which clips do not run.
const wrong = wieldReport(clips, wearing(scythe, shield), catalog, pt);
assert.deepEqual([...wrong.unusable], [['slash', 'lâmina na mão principal'], ['cleave', 'lâmina na mão principal']]);
assert.equal(wrong.notes.length, 2);
assert.match(wrong.notes[0], /Nenhum clipe foi feito para haste na mão principal \(SCYTHE\): os golpes são para lâmina\./);
assert.match(wrong.notes[1], /Os clipes slash, cleave são feitos para lâmina na mão principal/);

// 2b. The same report in English: same clips, same count of notes, the sentences in the other language.
const wrongEn = wieldReport(clips, wearing(scythe, shield), catalog, en);
assert.deepEqual([...wrongEn.unusable], [['slash', 'blade in the main hand'], ['cleave', 'blade in the main hand']]);
assert.equal(wrongEn.notes.length, 2);
assert.equal(wrongEn.notes[0], 'No clip was made for polearm in the main hand (SCYTHE): the strikes are for blade.');
assert.equal(wrongEn.notes[1], 'The clips slash, cleave are made for blade in the main hand: they do not run with what the character holds.');
const bareEn = wieldReport(clips, wearing(blade), catalog, en);
assert.equal(bareEn.notes[0], 'The clip bash is made for shield in the off hand: it does not run with what the character holds.');
const swungEn = wieldReport({ idle: clip(), slash: clip({ main: ['blade'] }) }, wearing(blade, { part: 'dagger', slot: 'hand', side: -1, id: 'dagger-left' }), catalog, en);
assert.equal(swungEn.notes[0], 'The off hand holds DAGGER (blade), but no clip swings it: it stays still.');

// 3. Without a shield the bash has no shield to use; a clip made for an empty hand needs the hand to be empty.
const bare = wieldReport(clips, wearing(blade), catalog, pt);
assert.deepEqual([...bare.unusable], [['bash', 'escudo na mão secundária']]);
assert.match(bare.notes[0], /O clipe bash é feito para escudo na mão secundária/);
const unarmed = wieldReport({ ...clips, punch: clip({ main: ['unarmed'] }) }, wearing(blade), catalog, pt);
assert.equal(unarmed.unusable.get('punch'), 'mão vazia na mão principal');

// 4. An item in the off hand that is swung and has no clip for it stays still; one that is only held does not warn.
const swung = wieldReport({ idle: clip(), slash: clip({ main: ['blade'] }) }, wearing(blade, { part: 'dagger', slot: 'hand', side: -1, id: 'dagger-left' }), catalog, pt);
assert.equal(swung.notes.length, 1);
assert.match(swung.notes[0], /A mão secundária segura DAGGER \(lâmina\), mas nenhum clipe a balança/);
assert.deepEqual(wieldReport({ idle: clip(), slash: clip({ main: ['blade'] }) }, wearing(blade, shield), catalog, pt).notes, [], 'a shield is only held');

// 5. A class the table does not know is shown as it is.
assert.equal(classNameOf(pt.t, 'blade'), 'lâmina');
assert.equal(classNameOf(en.t, 'blade'), 'blade');
assert.equal(classNameOf(pt.t, 'flail'), 'flail');
assert.equal(classNameOf(en.t, 'flail'), 'flail');

// 6. The real kit: the report says something exactly when the engine warns, for every character and every swap the picker offers.
let checked = 0;
for (const character of CHARACTERS) {
  const agree = (outfit: OutfitData, where: string) => {
    const engine = checkWield(character.clips, outfit, CATALOG);
    const report = wieldReport(character.clips, outfit, CATALOG, en);
    assert.equal(report.notes.length > 0, engine.warnings.length > 0, `${where}: the report and the engine agree on whether there is something to say`);
    assert.deepEqual([...report.unusable.keys()], engine.unusable.map((u) => u.key), `${where}: the same clips do not run`);
    checked++;
  };
  agree(character.outfit, `${character.id} as it is`);
  character.outfit.pieces.forEach((piece, index) => {
    for (const { info, blocked, taken } of candidatesFor(CATALOG, character.outfit, placeOf(piece), index).similar) {
      if (blocked || taken) continue;
      const swapped = swapPiece(character.outfit, CATALOG, index, info);
      if (swapped) agree(swapped.outfit, `${character.id}: ${piece.part} → ${info.id}`);
    }
  });
}
assert.ok(checked > 20, `the kit has plenty to compare (${checked})`);
// The guard swinging a scythe is the case worth telling: its attacks are for a blade.
const guard = CHARACTERS.find((c) => c.outfit.pieces.some((p) => p.part === 'notched-sword') && c.outfit.pieces.some((p) => p.part === 'round-shield'));
assert.ok(guard, 'the kit has a character with a sword and a shield');
const swordAt = guard.outfit.pieces.findIndex((p) => p.part === 'notched-sword');
const reaping = swapPiece(guard.outfit, CATALOG, swordAt, CATALOG.parts.find((p) => p.id === 'reaper-scythe')!)!;
const told = wieldReport(guard.clips, reaping.outfit, CATALOG, pt);
assert.ok(told.notes.length > 0 && told.notes[0].includes('haste'), 'the guard with a scythe is told its attacks are not for it');

console.log(`✅ wield checks passed (${checked} outfits compared with the engine)`);
