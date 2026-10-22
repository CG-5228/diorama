import { useCallback, useState } from 'react';

/** A per-browser preference. Storage can be blocked, so every access is guarded. */
export function usePref<T extends string | number | boolean>(key: string, initial: T) {
  const storageKey = `diorama:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Not persisted; the preference still applies for this session.
      }
    },
    [storageKey],
  );
  return [value, set] as const;
}
