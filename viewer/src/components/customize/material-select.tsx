import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const NONE = '__none';

interface Props {
  id: string;
  /** Names of the theme materials that may play the role. */
  materials: string[];
  value: string | undefined;
  onChange: (name: string | undefined) => void;
  /** What "no material" means here: nothing set, or the outfit's own. */
  noneLabel: string;
}

/** A theme material for a role, or none. */
export function MaterialSelect({ id, materials, value, onChange, noneLabel }: Props) {
  return (
    <Select value={value ?? NONE} onValueChange={(next) => onChange(next === NONE ? undefined : next)}>
      <SelectTrigger id={id} size="sm" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={NONE}>{noneLabel}</SelectItem>
          {materials.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
