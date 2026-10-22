import { useEffect, useEffectEvent } from 'react';

/** True when the key press belongs to a text field and must not trigger a shortcut. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Runs the handler on window keydown. The handler always sees the latest props and state. */
export function useWindowKeydown(handler: (event: KeyboardEvent) => void) {
  const onKeyDown = useEffectEvent(handler);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
}
