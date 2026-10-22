import type { PartOption } from '@core/rig';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface Props {
  id: string;
  option: PartOption;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** One adjustable option of a part: a slider for numbers, a switch for booleans, a list for choices. */
export function OptionField({ id, option, value, onChange }: Props) {
  switch (option.type) {
    case 'number': {
      const current = typeof value === 'number' ? value : option.default;
      return (
        <Field>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
            <span className="font-mono text-muted-foreground tabular-nums">{Number(current.toFixed(3))}</span>
          </div>
          <Slider
            id={id}
            min={option.min}
            max={option.max}
            step={option.step ?? (option.max - option.min) / 100}
            value={[current]}
            onValueChange={([next]) => onChange(next)}
          />
        </Field>
      );
    }
    case 'boolean':
      return (
        <Field orientation="horizontal">
          <Switch id={id} checked={value === true || (value === undefined && option.default)} onCheckedChange={onChange} />
          <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
        </Field>
      );
    case 'select':
      return (
        <Field>
          <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
          <Select value={typeof value === 'string' ? value : option.default} onValueChange={onChange}>
            <SelectTrigger id={id} size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {option.choices.map((choice) => <SelectItem key={choice.value} value={choice.value}>{choice.label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      );
  }
}
