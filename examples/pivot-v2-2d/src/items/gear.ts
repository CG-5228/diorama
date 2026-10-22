/**
 * The loot made of the gear kit (`../gear/catalog.ts`): each part drawn as a character wears it, body hidden, fitted into
 * the icon. A part that rests on another (a crest on its helm) brings that host along, so the icon shows what a player
 * would find. The view (`facing`) is picked per item: a coat from the front, a helm with both horns showing, a pauldron with its lames.
 * Ids are the part's own where one part is one item.
 */

import type { ItemInfo } from '@core/rig';

export const GEAR_ITEMS: ItemInfo[] = [
  { id: 'horned-helm', label: 'Elmo com chifres', kind: 'armor', rarity: 'uncommon', facing: 1.57, gear: { part: 'horned-helm', character: 'guard' }, description: 'Ferro escuro e dois chifres. Quem o usa ouve o ossuário respirar.' },
  { id: 'helm-crest', label: 'Elmo de capitão', kind: 'armor', rarity: 'rare', facing: 2.0, gear: { part: 'helm-crest', character: 'captain' }, description: 'Aço polido, crista dourada e um penacho de crina carmesim.' },
  { id: 'fire-crown', label: 'Coroa de fogo', kind: 'armor', rarity: 'epic', facing: 1.57, gear: { part: 'fire-crown', character: 'malvek', options: { size: 1.8 } }, description: 'Chamas de alma que ninguém acende e nada apaga.' },
  { id: 'lamed-pauldron', label: 'Ombreira de lâminas', kind: 'armor', rarity: 'uncommon', facing: 2.9, gear: { part: 'lamed-pauldron', character: 'guard' }, description: 'Lâminas de ferro sobrepostas e um espinho para quem chegar perto.' },
  { id: 'gilded-pauldron', label: 'Ombreira dourada', kind: 'armor', rarity: 'rare', facing: 2.9, gear: { part: 'lamed-pauldron', character: 'captain' }, description: 'Três lâminas de latão sobre o aço, o orgulho de um capitão.' },
  { id: 'skull-pauldron', label: 'Ombreira de caveira', kind: 'armor', rarity: 'rare', facing: 1.9, gear: { part: 'skull-pauldron', character: 'malvek', materials: { hollow: 'soul' } }, description: 'Uma caveira de osso sobre uma placa de ferro, que olha por cima do ombro de quem a veste.' },
  { id: 'rib-breastplate', label: 'Peitoral de costelas', kind: 'armor', rarity: 'rare', facing: 1.75, gear: { part: 'rib-breastplate', character: 'malvek', materials: { hollow: 'soul' } }, description: 'Costelas de osso presas sobre o casaco. Ninguém pergunta de quem eram.' },
  { id: 'long-coat', label: 'Casaco longo carmesim', kind: 'armor', rarity: 'epic', facing: 1.75, gear: { part: 'long-coat', character: 'captain' }, description: 'Longo, aberto na frente, tingido de carmesim e esfarrapado na barra de tanto caminhar entre túmulos.' },
  { id: 'grimoire', label: 'Grimório acorrentado', kind: 'accessory', rarity: 'rare', facing: 2.1, gear: { part: 'grimoire', character: 'malvek' }, description: 'Preso ao cinto por uma corrente, para que não fuja.' },
  { id: 'notched-sword', label: 'Espada entalhada', kind: 'weapon', rarity: 'uncommon', gear: { part: 'notched-sword', character: 'guard' }, description: 'Um entalhe na lâmina e runas de alma no gume.' },
  { id: 'captain-blade', label: 'Lâmina do capitão', kind: 'weapon', rarity: 'rare', gear: { part: 'notched-sword', character: 'captain', options: { length: 32 } }, description: 'Mais longa que a do guarda, com a guarda e o pomo dourados.' },
  // The scythe is drawn with the soul lantern hung from its hook (the part that rests on the scythe): it is how Malvek carries it, and
  // the lantern is the icon's one saturated color. The scythe lies along a diagonal through the `malvek-scythe` loot character.
  { id: 'reaper-scythe', label: 'Foice do ceifador', kind: 'weapon', rarity: 'epic', gear: { part: 'soul-lantern', character: 'malvek-scythe' }, description: 'Aros de ferro no cabo, uma lâmina que ceifa o que não tem corpo e uma lanterna de almas pendurada no gancho.' },
];
