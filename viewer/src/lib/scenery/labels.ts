import type { ScenePieceInfo } from '@core/volume';
import type { TFn } from '../../i18n/core';

export type PieceGroup = ScenePieceInfo['group'];

/** The order the palette lists groups in. */
export const GROUP_ORDER: PieceGroup[] = ['floor', 'wall', 'fence', 'door', 'prop', 'decal'];

/** What a piece is drawn into: floors, walls and fences fill cells, props, decals and doors are placements (doors stand on cell edges). */
export const layerOf = (group: PieceGroup) => (group === 'floor' ? 'floor' : group === 'wall' || group === 'fence' ? 'walls' : 'props');

/** The brush a piece arms: each painting tool holds one piece. */
export type BrushKey = 'floor' | 'wall' | 'door' | 'prop';
export const brushOf = (group: PieceGroup): BrushKey => (group === 'floor' ? 'floor' : group === 'wall' || group === 'fence' ? 'wall' : group === 'door' ? 'door' : 'prop');

/** The tools, in the order the shortcut list gives them. Their names and hints are in the dictionary (`scenery.tools`, `scenery.hints`). */
export const TOOLS = ['floor', 'wall', 'door', 'prop', 'select', 'fill', 'erase', 'pick', 'figure'] as const;
export type Tool = (typeof TOOLS)[number];

export const TOOL_KEYS: Record<Tool, string> = { floor: 'F', wall: 'W', door: 'D', prop: 'P', select: 'V', fill: 'B', erase: 'E', pick: 'I', figure: 'M' };

/** The tools in the rail, in groups: moving about, painting, correcting. */
export const TOOL_GROUPS: Tool[][] = [
  ['select', 'pick'],
  ['floor', 'wall', 'door', 'prop'],
  ['fill', 'erase'],
  ['figure'],
];

const HEIGHTS = ['wall', 'fence', 'door', 'character', 'cell'] as const;
const isHeight = (height: string): height is (typeof HEIGHTS)[number] => (HEIGHTS as readonly string[]).includes(height);

/** A wall height by its name: a size of the space profile ("Wall", "Door") or the number of world units it is given as. */
export const heightLabel = (t: TFn, height: number | string) => (typeof height === 'number' ? `${height}` : isHeight(height) ? t(`scenery.heights.${height}`) : height);

const STATES = ['closed', 'open', 'broken', 'whole', 'on', 'off', 'locked', 'unlocked', 'lit', 'unlit', 'up', 'down'] as const;
const isState = (state: string): state is (typeof STATES)[number] => (STATES as readonly string[]).includes(state);

/** A resting state by its name: the word for the usual ones, the state's own name for the project's others. */
export const stateLabel = (t: TFn, state: string) => (isState(state) ? t(`scenery.states.${state}`) : state);

type Verb = 'open' | 'close' | 'pull' | 'push' | 'break' | 'turnOn' | 'turnOff' | 'light' | 'putOut';
const USE_VERBS: Record<string, Verb> = { opening: 'open', closing: 'close', pulling: 'pull', pushing: 'push', breaking: 'break', open: 'open', close: 'close', pull: 'pull', push: 'push' };
/** The verb of a transition that has an unusual name, from the state it leads to. */
const TO_VERBS: Record<string, Verb> = { open: 'open', opened: 'open', closed: 'close', shut: 'close', broken: 'break', on: 'turnOn', off: 'turnOff', lit: 'light', unlit: 'putOut' };
const USE_NOUNS = ['door', 'chest', 'lever'] as const;
const isNoun = (kind: string): kind is (typeof USE_NOUNS)[number] => (USE_NOUNS as readonly string[]).includes(kind);

/** What the use key does, from the clip it plays (or the state it leads to) and the kind of thing it is: "Open door", "Pull lever"; the piece's own name for the project's other kinds. */
export function useLabel(t: TFn, kind: string, clip: string, piece: string, to?: string) {
  const verb = USE_VERBS[clip] ?? (to !== undefined ? TO_VERBS[to] : undefined);
  return t('scenery.use.format', {
    verb: verb ? t(`scenery.use.verbs.${verb}`) : t('scenery.use.verbs.use'),
    noun: isNoun(kind) ? t(`scenery.use.nouns.${kind}`) : piece.toLowerCase(),
  });
}
