import { directionName, type SpaceHeight } from '@core/volume';
import { FlipHorizontal2Icon, RotateCcwIcon, RotateCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Rich, useT } from '@/i18n';
import { heightLabel, stateLabel } from '@/lib/scenery/labels';

/** Turns a piece through its facings: back, the name of the one it faces (S, SW, W...), forward. */
export function FacingControl({ count, value, onTurn }: { count: number; value: number; onTurn: (by: 1 | -1) => void }) {
  const { t } = useT();
  return (
    <ButtonGroup aria-label={t('scenery.fields.direction')}>
      <Button variant="outline" size="icon-sm" aria-label={t('scenery.fields.turnLeft')} onClick={() => onTurn(-1)}>
        <RotateCcwIcon />
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <ButtonGroupText className="min-w-10 justify-center tabular-nums">{directionName(value, count)}</ButtonGroupText>
        </TooltipTrigger>
        <TooltipContent><Rich id="scenery.fields.directionHint" /></TooltipContent>
      </Tooltip>
      <Button variant="outline" size="icon-sm" aria-label={t('scenery.fields.turnRight')} onClick={() => onTurn(1)}>
        <RotateCwIcon />
      </Button>
    </ButtonGroup>
  );
}

/**
 * The variants of a piece, named by the kit when it names them (`variantLabels`) and numbered otherwise, and
 * "Automatic" first: no variant at all, which leaves the look to the engine, which picks one from the position.
 */
export function VariantSelect({ id, count, labels, value, onChange, className }: { id?: string; count: number; labels?: string[]; value: number | undefined; onChange: (variant: number | undefined) => void; className?: string }) {
  const { t } = useT();
  return (
    <Select value={value === undefined ? 'auto' : String(value)} onValueChange={(next) => onChange(next === 'auto' ? undefined : Number(next))}>
      <SelectTrigger id={id} size="sm" aria-label={t('scenery.fields.variation')} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="auto">{t('scenery.fields.automatic')}</SelectItem>
          {Array.from({ length: count }, (_, i) => <SelectItem key={i} value={String(i)}>{labels?.[i] ?? t('scenery.fields.variationN', { n: i + 1 })}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** The heights a wall piece comes in, named by the profile's sizes ("Wall", "Low") with the world units; the first is the piece's default and is stored as none. */
export function HeightSelect({ heights, units, value, onChange, className }: { heights: SpaceHeight[]; units: number[]; value: SpaceHeight | undefined; onChange: (height: SpaceHeight | undefined) => void; className?: string }) {
  const { t, number } = useT();
  const index = value === undefined ? 0 : Math.max(0, heights.indexOf(value));
  return (
    <Select value={String(index)} onValueChange={(next) => onChange(Number(next) === 0 ? undefined : heights[Number(next)])}>
      <SelectTrigger size="sm" aria-label={t('scenery.fields.wallHeight')} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {heights.map((height, i) => (
            <SelectItem key={String(height)} value={String(i)}>
              {heightLabel(t, height)}
              {units.length === heights.length && typeof height === 'string' ? ` · ${number(Math.round(units[i]))}` : ''}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** The resting states of a piece (a door: closed, open; an urn: whole, broken); the first is the piece's default and is stored as none. */
export function StateSelect({ id, states, value, onChange, className }: { id?: string; states: string[]; value: string | undefined; onChange: (state: string | undefined) => void; className?: string }) {
  const { t } = useT();
  const current = value !== undefined && states.includes(value) ? value : states[0];
  return (
    <Select value={current} onValueChange={(next) => onChange(next === states[0] ? undefined : next)}>
      <SelectTrigger id={id} size="sm" aria-label={t('scenery.fields.state')} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {states.map((state) => <SelectItem key={state} value={state}>{stateLabel(t, state)}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

/** Turns a door to its other side (it faces across its edge, one way or the other). */
export function SideControl({ flipped, onFlip }: { flipped: boolean; onFlip: () => void }) {
  const { t } = useT();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" aria-label={t('scenery.fields.flipDoor')} onClick={onFlip}>
          <FlipHorizontal2Icon data-icon="inline-start" />
          {t('scenery.fields.side', { side: flipped ? 'B' : 'A' })}
        </Button>
      </TooltipTrigger>
      <TooltipContent><Rich id="scenery.fields.flipHint" /></TooltipContent>
    </Tooltip>
  );
}
