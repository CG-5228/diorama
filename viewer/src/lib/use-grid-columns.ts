import { useLayoutEffect, useState, type RefObject } from 'react';

/** The grid's `p-4` and `gap-3`, in px. */
export const GRID_PADDING = 16;
export const GRID_GAP = 12;

/**
 * How many cards of at least `minCardWidth` fit in a scroll area, as `repeat(auto-fill, minmax(minCardWidth, 1fr))`
 * would pick, and the width each one then gets. A virtualized grid lays out whole rows, so it has to know both in JS.
 */
export function useGridColumns(scrollRef: RefObject<HTMLElement | null>, minCardWidth: number) {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    setWidth(element.clientWidth);
    return () => observer.disconnect();
  }, [scrollRef]);

  const inner = width - 2 * GRID_PADDING;
  const columns = Math.max(1, Math.floor((inner + GRID_GAP) / (minCardWidth + GRID_GAP)));
  return { columns, cardWidth: (inner - GRID_GAP * (columns - 1)) / columns };
}
