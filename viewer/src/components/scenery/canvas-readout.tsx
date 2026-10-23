import { useSelector } from '@tanstack/react-store';
import { useT } from '@/i18n';
import type { CanvasStatusStore } from '@/lib/scenery/status';

/** The cell under the pointer. Subscribed to the canvas status on its own, so a pointer move re-renders this and nothing else. */
export function HoverReadout({ status, cols, rows }: { status: CanvasStatusStore; cols: number; rows: number }) {
  const hover = useSelector(status, (s) => s.hover);
  const { t } = useT();
  const inside = hover && hover.col >= 0 && hover.row >= 0 && hover.col < cols && hover.row < rows;
  return <span>{inside ? t('scenery.readout.cell', { col: hover.col, row: hover.row }) : '—'}</span>;
}

/** How long the last drawing of the scene took. */
export function DrawReadout({ status }: { status: CanvasStatusStore }) {
  const ms = useSelector(status, (s) => s.ms);
  const { t } = useT();
  return ms === null ? null : <span className="ml-auto">{t('scenery.readout.draw', { ms })}</span>;
}
