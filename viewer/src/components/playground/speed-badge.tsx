import { TimerIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';

const FRACTIONS: Record<number, string> = { 0.5: '½', 0.25: '¼', 0.125: '⅛', 0.1: '⅒' };

/** Says that the scene is not running at real time, and one click puts it back. Nothing when the speed is 1. */
export function SpeedBadge({ speed, onReset }: { speed: number; onReset: () => void }) {
  const { t, number } = useT();
  if (speed === 1) return null;
  const label = speed === 0 ? t('playground.speedBadge.paused') : t('playground.speedBadge.slow', { speed: `${FRACTIONS[speed] ?? number(speed)}×` });
  return (
    <Button
      variant="outline"
      size="sm"
      className="absolute top-3 right-3 border-warning/40 bg-warning/10 text-warning hover:bg-warning/20 hover:text-warning"
      aria-label={t('playground.speedBadge.reset', { label })}
      onClick={onReset}
    >
      <TimerIcon data-icon="inline-start" />
      {label}
    </Button>
  );
}
