import type { ScenePieceInfo } from '@core/volume';

export type PieceGroup = ScenePieceInfo['group'];

export const GROUP_LABELS: Record<PieceGroup, string> = { floor: 'Chão', wall: 'Paredes', fence: 'Cercas', door: 'Portas', prop: 'Props', decal: 'Decais' };

/** The order the palette lists groups in. */
export const GROUP_ORDER: PieceGroup[] = ['floor', 'wall', 'fence', 'door', 'prop', 'decal'];

/** What a piece is drawn into: floors, walls and fences fill cells, props, decals and doors are placements (doors stand on cell edges). */
export const layerOf = (group: PieceGroup) => (group === 'floor' ? 'floor' : group === 'wall' || group === 'fence' ? 'walls' : 'props');

/** The brush a piece arms: each painting tool holds one piece. */
export type BrushKey = 'floor' | 'wall' | 'door' | 'prop';
export const brushOf = (group: PieceGroup): BrushKey => (group === 'floor' ? 'floor' : group === 'wall' || group === 'fence' ? 'wall' : group === 'door' ? 'door' : 'prop');

export const TOOL_LABELS = {
  floor: 'Chão',
  wall: 'Parede ou cerca',
  door: 'Porta',
  prop: 'Prop ou decal',
  select: 'Selecionar',
  fill: 'Preencher chão',
  erase: 'Borracha',
  pick: 'Conta-gotas',
  figure: 'Figura de escala',
} as const;
export type Tool = keyof typeof TOOL_LABELS;

export const TOOL_KEYS: Record<Tool, string> = { floor: 'F', wall: 'W', door: 'D', prop: 'P', select: 'V', fill: 'B', erase: 'E', pick: 'I', figure: 'M' };

export const LAYER_LABELS = { floor: 'Chão', walls: 'Paredes', props: 'Props' } as const;

/** What the eraser can take: everything on top under the pointer, or one layer (Props includes the scale figures). */
export const ERASE_LABELS = { all: 'Tudo', ...LAYER_LABELS } as const;

/** What a tool does, in one line, shown beside its options. */
export const TOOL_HINTS: Record<Tool, string> = {
  floor: 'Arraste para pintar. Shift traça uma linha; botão direito apaga.',
  wall: 'Arraste pelas bordas das células (ou pelas células, se o kit usa paredes no centro). Shift traça uma linha; botão direito apaga.',
  door: 'Clique numa borda de célula (a mais próxima do cursor, até na borda da cena). R vira o lado; botão direito apaga.',
  prop: 'Clique para colocar. R gira; botão direito apaga.',
  select: 'Clique em qualquer coisa (prop, parede, figura ou chão, pelo desenho) para ver as opções; arraste para mover (prop, parede ou figura); setas empurram.',
  fill: 'Clique numa região do chão para preenchê-la.',
  erase: 'Arraste para apagar o que está sob o cursor, de qualquer tipo; escolha uma camada para apagar só ela.',
  pick: 'Clique no que quer pegar: o prop, a parede (perto do vértice) ou o chão.',
  figure: 'Clique numa célula para fixar um manequim do tamanho do personagem; clique nele para tirar.',
};

/** The tools in the rail, in groups: moving about, painting, correcting. */
export const TOOL_GROUPS: Tool[][] = [
  ['select', 'pick'],
  ['floor', 'wall', 'door', 'prop'],
  ['fill', 'erase'],
  ['figure'],
];

const HEIGHT_LABELS: Record<string, string> = { wall: 'Muro', fence: 'Baixo (cerca)', door: 'Porta', character: 'Personagem', cell: 'Célula' };

/** A wall height by its name: a size of the space profile ("Muro", "Porta") or the number of world units it is given as. */
export const heightLabel = (height: number | string) => (typeof height === 'number' ? `${height}` : (HEIGHT_LABELS[height] ?? height));

const STATE_LABELS: Record<string, string> = { closed: 'Fechada', open: 'Aberta', broken: 'Quebrada', whole: 'Inteira', on: 'Ligada', off: 'Desligada', locked: 'Trancada', unlocked: 'Destrancada', lit: 'Acesa', unlit: 'Apagada', up: 'Para cima', down: 'Para baixo' };

/** A resting state by its name: the Portuguese word for the usual ones, the state's own name for the project's others. */
export const stateLabel = (state: string) => STATE_LABELS[state] ?? state;

const USE_VERBS: Record<string, string> = { opening: 'Abrir', closing: 'Fechar', pulling: 'Puxar', pushing: 'Empurrar', breaking: 'Quebrar', open: 'Abrir', close: 'Fechar', pull: 'Puxar', push: 'Empurrar' };
/** The verb of a transition that has an unusual name, from the state it leads to. */
const TO_VERBS: Record<string, string> = { open: 'Abrir', opened: 'Abrir', closed: 'Fechar', shut: 'Fechar', broken: 'Quebrar', on: 'Ligar', off: 'Desligar', lit: 'Acender', unlit: 'Apagar' };
const USE_NOUNS: Record<string, string> = { door: 'porta', chest: 'baú', lever: 'alavanca' };

/** What the use key does, from the clip it plays (or the state it leads to) and the kind of thing it is: "Abrir porta", "Puxar alavanca"; the piece's own name for the project's other kinds. */
export const useLabel = (kind: string, clip: string, piece: string, to?: string) => `${USE_VERBS[clip] ?? (to !== undefined ? TO_VERBS[to] : undefined) ?? 'Usar'} ${USE_NOUNS[kind] ?? piece.toLowerCase()}`;
