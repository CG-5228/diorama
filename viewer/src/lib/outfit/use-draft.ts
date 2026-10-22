import { useCallback, useEffect } from 'react';
import type { OutfitData } from '@core/rig';
import { useHistory } from '@/lib/scenery/use-history';

/** Unsaved outfits survive leaving the tab (and coming back to the character), but not a reload. */
const drafts = new Map<string, OutfitData>();

/**
 * The outfit being edited for one character of one project, starting from the character's own, with undo and redo: a swap,
 * a removal or a slider is a step (a slider dragged is one step, by its merge key).
 */
export function useDraft(key: string, initial: OutfitData) {
  const history = useHistory<OutfitData>(() => drafts.get(key) ?? initial);
  const { value: outfit, set, undo, redo, canUndo, canRedo } = history;

  useEffect(() => {
    drafts.set(key, outfit);
  }, [key, outfit]);

  const edit = useCallback((update: (outfit: OutfitData) => OutfitData, merge?: string) => set(update, merge), [set]);
  // Going back to the character's own outfit is a step too: it can be undone.
  const reset = useCallback(() => {
    drafts.delete(key);
    set(() => initial);
  }, [key, initial, set]);
  const changed = JSON.stringify(outfit) !== JSON.stringify(initial);
  return { outfit, edit, reset, changed, undo, redo, canUndo, canRedo };
}

export type Edit = ReturnType<typeof useDraft>['edit'];
