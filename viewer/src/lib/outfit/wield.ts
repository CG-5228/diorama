import { checkWield, wieldsOf, type CharacterClip, type GearCatalog, type OutfitData } from '@core/rig';
import type { TFn, Translator } from '../../i18n/core';

/**
 * What a character holds and the clips made for it, in the words of the screen. A character's attacks are made for what it holds
 * (a slash swings a blade, a reap a scythe): the engine's `checkWield` says which clips suit the outfit and what is wrong, and this
 * turns that into sentences and a note per clip. The rules are the engine's; a test keeps the two agreeing on when there is
 * something to say.
 */

/** The classes the dictionary names; one it does not know is shown as it is. */
const CLASS_IDS = ['blade', 'polearm', 'shield', 'staff', 'axe', 'hammer', 'bow', 'unarmed'] as const;
const isClassId = (id: string): id is (typeof CLASS_IDS)[number] => (CLASS_IDS as readonly string[]).includes(id);
export const classNameOf = (t: TFn, id: string) => (isClassId(id) ? t(`wield.classes.${id}`) : id);

export interface WieldReport {
  /** What each hand holds: the part's label and its class. */
  main?: { label: string; class: string };
  off?: { label: string; class: string };
  /** The clips made for something else, with what they need ("blade in the main hand"). */
  unusable: ReadonlyMap<string, string>;
  /** What to tell the user, a sentence each; empty when everything suits. */
  notes: string[];
}

export function wieldReport(clips: Record<string, CharacterClip>, outfit: OutfitData, catalog: GearCatalog, { t, plural, list }: Translator): WieldReport {
  const check = checkWield(clips, outfit, catalog);
  const labelOf = (part: string) => catalog.parts.find((p) => p.id === part)?.label ?? part;
  const either = (classes: string[]) => list(classes.map((id) => classNameOf(t, id)), 'or');
  const have = { main: check.main?.class ?? 'unarmed', off: check.off?.class ?? 'unarmed' };

  const unusable = new Map<string, string>();
  for (const { key } of check.unusable) {
    const wields = wieldsOf(clips[key]);
    const needs = [
      wields?.main?.length && !wields.main.includes(have.main) ? t('wield.needsMain', { classes: either(wields.main) }) : '',
      wields?.off?.length && !wields.off.includes(have.off) ? t('wield.needsOff', { classes: either(wields.off) }) : '',
    ].filter(Boolean);
    unusable.set(key, list(needs));
  }

  const notes: string[] = [];
  const armed = Object.values(clips).flatMap((clip) => wieldsOf(clip)?.main ?? []);
  if (check.main && armed.length > 0 && !armed.includes(check.main.class)) {
    notes.push(t('wield.noClipFor', { class: classNameOf(t, check.main.class), label: labelOf(check.main.part), classes: either([...new Set(armed)]) }));
  }
  const byNeed = new Map<string, string[]>();
  for (const [key, needs] of unusable) byNeed.set(needs, [...(byNeed.get(needs) ?? []), key]);
  for (const [needs, keys] of byNeed) {
    notes.push(plural('wield.clipUnusable', keys.length, { keys: keys.join(', '), needs }));
  }
  if (check.off && check.off.hands === 1) {
    const info = catalog.parts.find((p) => p.id === check.off!.part);
    const swung = Object.values(clips).some((clip) => wieldsOf(clip)?.off?.includes(check.off!.class));
    if ((info?.wield?.offHand ?? 'swing') === 'swing' && !swung) notes.push(t('wield.offStill', { label: labelOf(check.off.part), class: classNameOf(t, check.off.class) }));
  }

  return {
    ...(check.main ? { main: { label: labelOf(check.main.part), class: check.main.class } } : {}),
    ...(check.off ? { off: { label: labelOf(check.off.part), class: check.off.class } } : {}),
    unusable,
    notes,
  };
}
