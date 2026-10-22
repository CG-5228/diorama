import { checkWield, wieldsOf, type CharacterClip, type GearCatalog, type OutfitData } from '@core/rig';

/**
 * What a character holds and the clips made for it, in the words of the screen. A character's attacks are made for what it holds
 * (a slash swings a blade, a reap a scythe): the engine's `checkWield` says which clips suit the outfit and what is wrong, and this
 * turns that into sentences and a note per clip. The rules are the engine's; a test keeps the two agreeing on when there is
 * something to say.
 */

/** The names of the classes a held part can have; one the table does not know is shown as it is. */
const CLASS_NAMES: Record<string, string> = { blade: 'lâmina', polearm: 'haste', shield: 'escudo', staff: 'cajado', axe: 'machado', hammer: 'martelo', bow: 'arco', unarmed: 'mão vazia' };
export const classNameOf = (id: string) => CLASS_NAMES[id] ?? id;
const either = (classes: string[]) => classes.map(classNameOf).join(' ou ');

export interface WieldReport {
  /** What each hand holds: the part's label and its class. */
  main?: { label: string; class: string };
  off?: { label: string; class: string };
  /** The clips made for something else, with what they need ("lâmina na mão principal"). */
  unusable: ReadonlyMap<string, string>;
  /** What to tell the user, a sentence each; empty when everything suits. */
  notes: string[];
}

export function wieldReport(clips: Record<string, CharacterClip>, outfit: OutfitData, catalog: GearCatalog): WieldReport {
  const check = checkWield(clips, outfit, catalog);
  const labelOf = (part: string) => catalog.parts.find((p) => p.id === part)?.label ?? part;
  const have = { main: check.main?.class ?? 'unarmed', off: check.off?.class ?? 'unarmed' };

  const unusable = new Map<string, string>();
  for (const { key } of check.unusable) {
    const wields = wieldsOf(clips[key]);
    const needs = [
      wields?.main?.length && !wields.main.includes(have.main) ? `${either(wields.main)} na mão principal` : '',
      wields?.off?.length && !wields.off.includes(have.off) ? `${either(wields.off)} na mão secundária` : '',
    ].filter(Boolean);
    unusable.set(key, needs.join(' e '));
  }

  const notes: string[] = [];
  const armed = Object.values(clips).flatMap((clip) => wieldsOf(clip)?.main ?? []);
  if (check.main && armed.length > 0 && !armed.includes(check.main.class)) {
    notes.push(`Nenhum clipe foi feito para ${classNameOf(check.main.class)} na mão principal (${labelOf(check.main.part)}): os golpes são para ${either([...new Set(armed)])}.`);
  }
  const byNeed = new Map<string, string[]>();
  for (const [key, needs] of unusable) byNeed.set(needs, [...(byNeed.get(needs) ?? []), key]);
  for (const [needs, keys] of byNeed) {
    notes.push(keys.length === 1 ? `O clipe ${keys[0]} é feito para ${needs}: não roda com o que o personagem segura.` : `Os clipes ${keys.join(', ')} são feitos para ${needs}: não rodam com o que o personagem segura.`);
  }
  if (check.off && check.off.hands === 1) {
    const info = catalog.parts.find((p) => p.id === check.off!.part);
    const swung = Object.values(clips).some((clip) => wieldsOf(clip)?.off?.includes(check.off!.class));
    if ((info?.wield?.offHand ?? 'swing') === 'swing' && !swung) notes.push(`A mão secundária segura ${labelOf(check.off.part)} (${classNameOf(check.off.class)}), mas nenhum clipe a balança: ela fica parada.`);
  }

  return {
    ...(check.main ? { main: { label: labelOf(check.main.part), class: check.main.class } } : {}),
    ...(check.off ? { off: { label: labelOf(check.off.part), class: check.off.class } } : {}),
    unusable,
    notes,
  };
}
