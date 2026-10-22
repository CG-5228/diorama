import { useCallback, useRef, useState } from 'react';

const LIMIT = 100;
/** Edits with the same merge key closer than this (ms) are one step: a slider dragged, not a hundred undos. */
const MERGE_WINDOW = 800;

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

/**
 * A value with undo and redo. Every `set` that changes the value is one step: a drag of the brush is one `set`, with
 * the scene it leaves behind, made by the canvas when the pointer is up. Sets that share a `merge` key and follow one
 * another closely replace the step instead of adding one. The initial value is made once, on the first render.
 */
export function useHistory<T>(initial: () => T) {
  const [state, setState] = useState<History<T>>(() => ({ past: [], present: initial(), future: [] }));
  const last = useRef<{ key: string; at: number } | null>(null);

  const set = useCallback((update: (value: T) => T, merge?: string) => {
    const now = performance.now();
    const joins = merge !== undefined && last.current?.key === merge && now - last.current.at < MERGE_WINDOW;
    last.current = merge === undefined ? null : { key: merge, at: now };
    setState((s) => {
      const present = update(s.present);
      if (present === s.present) return s;
      return joins && s.past.length ? { ...s, present, future: [] } : { past: [...s.past, s.present].slice(-LIMIT), present, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    last.current = null;
    setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past.at(-1)!, future: [s.present, ...s.future] } : s));
  }, []);
  const redo = useCallback(() => {
    last.current = null;
    setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s));
  }, []);

  return { value: state.present, set, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
