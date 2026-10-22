/**
 * The pieces of their own (guide 06 §2), by item: consumables, keys, materials, currency, relics, and the garments and armor whose
 * gear part is only a shell round a body. Each one is built from `@core/volume` parts in its own file and given its tier, stack and
 * pose here. Poses lie a long item diagonally (a key's bit to the upper right), stand a tall one up (the greave) and tip a flat
 * one towards the viewer; the icon then fits whatever the item draws.
 *
 * An item that stands for a part of the gear kit (round shield, greave, bracer, leg wraps, belt, skull buckle, pouch, tunic,
 * tabard, high collar, baldric) also carries `gear: { part }`: the piece draws the icon, the part says what it equips, and the
 * atlas carries both `gear` and `equip`.
 */

import type { ItemInfo } from '@core/rig';
import { reliquaryAmulet } from './amulet';
import { bracer, greave, legWraps, roundShield } from './armor';
import { baldric, highCollar, tabard, tunic } from './cloth';
import { graveCoin } from './coin';
import { soulPotion } from './flask';
import { boneKey, cryptKey } from './keys';
import { ancientScroll } from './scroll';
import { soulShard } from './shard';
import { necromancersTome } from './tome';
import { belt, pouch, skullBelt } from './worn';

export const PIECE_ITEMS: ItemInfo[] = [
  { id: 'soul-potion', label: 'Poção de alma', kind: 'consumable', rarity: 'uncommon', stack: 10, piece: soulPotion, roles: ['glass', 'crystal', 'cork', 'leather', 'bone'], description: 'Alma líquida num frasco fechado com rolha. Restaura a vida de quem bebe e o silêncio de quem a perdeu.' },
  { id: 'bone-key', label: 'Chave de osso', kind: 'key', rarity: 'common', stack: 1, piece: boneKey, pose: { turn: 180, tip: 20 }, roles: ['bone', 'boneLimb', 'leather', 'crystal'], description: 'Talhada de um osso comprido. Abre as portas que os vivos esqueceram.' },
  { id: 'crypt-key', label: 'Chave da cripta', kind: 'key', rarity: 'rare', stack: 1, piece: cryptKey, pose: { turn: 180, tip: 30 }, roles: ['steel', 'brass', 'crystal'], description: 'Aço frio, latão e uma gema de alma no arco. Só a porta da cripta a reconhece.' },
  { id: 'ancient-scroll', label: 'Pergaminho antigo', kind: 'consumable', rarity: 'uncommon', stack: 5, piece: ancientScroll, pose: { turn: 180, tip: 12 }, roles: ['parchment', 'cork', 'leather', 'clothAccent', 'glow'], description: 'Velino quebradiço escrito em runas de alma. Lido em voz alta, gasta-se.' },
  { id: 'soul-shard', label: 'Fragmento de alma', kind: 'material', rarity: 'common', stack: 99, piece: soulShard, roles: ['crystal', 'stone'], description: 'Um caco de alma cristalizada. Quente ao toque, mesmo na cripta mais fria.' },
  { id: 'grave-coin', label: 'Moeda de túmulo', kind: 'currency', rarity: 'common', stack: 999, piece: graveCoin, roles: ['brass'], description: 'Latão escurecido, com uma caveira no verso. Paga a travessia, e pouco mais.' },
  { id: 'reliquary-amulet', label: 'Amuleto de relicário', kind: 'accessory', rarity: 'epic', stack: 1, piece: reliquaryAmulet, facing: Math.PI / 2 + 0.5, roles: ['brass', 'steel', 'hollow', 'crystal'], description: 'Um relicário minúsculo em forma de caixão, com um estilhaço de alma atrás do vidro.' },
  { id: 'necromancers-tome', label: 'Tomo do necromante', kind: 'relic', rarity: 'legendary', stack: 1, piece: necromancersTome, facing: Math.PI / 2 + 0.55, pose: { tip: 38 }, roles: ['cloth', 'brass', 'parchment', 'leather', 'clothAccent', 'glow', 'hollow'], description: 'O livro que ainda escreve. Seu olho acompanha quem o abre, e lembra o nome de cada alma que ele já leu.' },
  { id: 'round-shield', label: 'Escudo redondo', kind: 'shield', rarity: 'uncommon', stack: 1, piece: roundShield, gear: { part: 'round-shield' }, pose: { tip: -50 }, roles: ['planks', 'iron', 'clothAccent'], description: 'Tábuas de madeira, aro de ferro e uma faixa carmesim pintada.' },
  { id: 'greave', label: 'Greva de ferro', kind: 'armor', rarity: 'uncommon', stack: 1, piece: greave, gear: { part: 'greave' }, facing: Math.PI / 2, pose: { tip: -62 }, spin: 16, roles: ['iron', 'leather'], description: 'Protege a canela, com uma joelheira de ferro e três correias.' },
  { id: 'bracer', label: 'Braçadeira de ferro', kind: 'armor', rarity: 'uncommon', stack: 1, piece: bracer, gear: { part: 'bracer' }, pose: { turn: 180, tip: 15 }, roles: ['iron', 'leather', 'hollow'], description: 'Ferro batido, preso ao antebraço do braço da espada.' },
  { id: 'leg-wraps', label: 'Faixas de perna', kind: 'armor', rarity: 'common', stack: 1, piece: legWraps, gear: { part: 'leg-wraps' }, pose: { turn: 180, tip: 10 }, roles: ['leather', 'bone'], description: 'Tiras de couro enroladas na canela. Ainda cheiram a cripta.' },
  { id: 'belt', label: 'Cinto de couro', kind: 'accessory', rarity: 'common', stack: 1, piece: belt, gear: { part: 'belt' }, pose: { tip: -20 }, roles: ['leather', 'steel', 'hollow'], description: 'Couro gasto, costurado à mão, e uma fivela de ferro.' },
  { id: 'skull-buckle', label: 'Cinto de caveira', kind: 'accessory', rarity: 'uncommon', stack: 1, piece: skullBelt, gear: { part: 'skull-buckle' }, facing: Math.PI / 2 + 0.4, spin: -24, roles: ['leather', 'steel', 'bone', 'hollow'], description: 'A fivela é uma caveira pequena, e sorri para quem a afivela.' },
  { id: 'pouch', label: 'Bolsa de couro', kind: 'accessory', rarity: 'common', stack: 1, piece: pouch, gear: { part: 'pouch' }, roles: ['leather', 'bone', 'crystal', 'hollow'], description: 'Cabe um punhado de moedas de túmulo e uma ou duas desculpas.' },
  { id: 'tunic', label: 'Túnica escura', kind: 'armor', rarity: 'common', stack: 1, piece: tunic, gear: { part: 'tunic' }, facing: Math.PI / 2, pose: { tip: -48 }, roles: ['cloth', 'clothAccent', 'leather', 'hollow'], description: 'Pano de luto, remendado onde o osso aparecia.' },
  { id: 'tabard', label: 'Tabardo carmesim', kind: 'armor', rarity: 'common', stack: 1, piece: tabard, gear: { part: 'tabard' }, facing: Math.PI / 2, pose: { tip: -48 }, roles: ['clothAccent', 'cloth', 'bone', 'leather'], description: 'Um pano comprido, rasgado na barra, tingido com o que sobrou do vinho.' },
  { id: 'high-collar', label: 'Gola alta carmesim', kind: 'armor', rarity: 'uncommon', stack: 1, piece: highCollar, gear: { part: 'high-collar' }, facing: Math.PI / 2 + 0.2, pose: { tip: -16 }, roles: ['clothAccent', 'cloth', 'brass'], description: 'Esconde o pescoço e o que não deve ser dito.' },
  { id: 'baldric', label: 'Boldrié', kind: 'accessory', rarity: 'common', stack: 1, piece: baldric, gear: { part: 'baldric' }, pose: { turn: 180 }, roles: ['leather', 'steel', 'hollow'], description: 'Uma tira de couro curtido que cruza o peito, com um anel para a espada.' },
];
