import { useSelector } from '@tanstack/react-store';
import type { CanvasStatusStore } from '@/lib/scenery/status';

/** The cell under the pointer. Subscribed to the canvas status on its own, so a pointer move re-renders this and nothing else. */
export function HoverReadout({ status, cols, rows }: { status: CanvasStatusStore; cols: number; rows: number }) {
  const hover = useSelector(status, (s) => s.hover);
  const inside = hover && hover.col >= 0 && hover.row >= 0 && hover.col < cols && hover.row < rows;
  return <span>{inside ? `coluna ${hover.col}, linha ${hover.row}` : '—'}</span>;
}

/** How long the last drawing of the scene took. */
export function DrawReadout({ status }: { status: CanvasStatusStore }) {
  const ms = useSelector(status, (s) => s.ms);
  return ms === null ? null : <span className="ml-auto">desenho {ms} ms</span>;
}
