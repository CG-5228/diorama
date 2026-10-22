import { useState, type ReactNode } from 'react';
import type { GearCatalog, OutfitData, PartInfo } from '@core/rig';
import { Trash2Icon } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Field, FieldLabel } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { isPaired, partOf } from '@/lib/outfit/edit';
import { groupLabel, SIDE_LABELS, SLOT_LABELS } from '@/lib/outfit/labels';
import { candidatesFor, mirrorOf, piecesIn, type Candidate, type Place } from '@/lib/outfit/slots';
import type { AssetFileMeta } from '@/lib/types';
import { PartThumb } from './part-thumb';

interface Props {
  catalog: GearCatalog;
  outfit: OutfitData;
  place: Place;
  /** The piece being swapped; none when wearing something in an empty place or adding another one. */
  replacing?: number;
  thumbs: Map<string, AssetFileMeta>;
  /** What opens the list: a row of the board. */
  children: ReactNode;
  /** A part was chosen; `both` says the other side of a pair is to get the same. */
  onChoose: (info: PartInfo, both: boolean) => void;
  /** Takes the piece out (only when swapping one). */
  onRemove?: () => void;
}

/** What a candidate says under its name: the group of the part, what it is waiting for, what keeps its slot, or what it takes out of the hands. */
function Line({ candidate, thumbs, catalog }: { candidate: Candidate; thumbs: Map<string, AssetFileMeta>; catalog: GearCatalog }) {
  const { info } = candidate;
  const host = candidate.blocked ? candidate.blocked.map((id) => partOf(catalog, id)?.label ?? id).join(' ou ') : null;
  const holder = candidate.taken ? (partOf(catalog, candidate.taken)?.label ?? candidate.taken) : null;
  const pushes = candidate.pushes?.map((id) => partOf(catalog, id)?.label ?? id).join(' e ');
  return (
    <>
      <PartThumb asset={thumbs.get(info.id)} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{info.label}</span>
        <span className="truncate text-xs text-muted-foreground">{host ? `Precisa de: ${host}` : holder ? `Vaga ocupada por ${holder}` : pushes ? `Tira ${pushes} das mãos` : groupLabel(info.group)}</span>
      </span>
    </>
  );
}

/** The list itself: computed when the popover opens (a closed row costs nothing), not on every render of the board. */
function Choices({ catalog, outfit, place, replacing, thumbs, paired, both, heading, onPick, onRemove }: Pick<Props, 'catalog' | 'outfit' | 'place' | 'replacing' | 'thumbs' | 'onRemove'> & { paired: boolean; both: boolean; heading: string; onPick: (info: PartInfo, both: boolean) => void }) {
  const { similar, others } = candidatesFor(catalog, outfit, place, replacing);
  // Equipping offers add-ons apart from the parts that stand alone: they are for the piece they rest on.
  const first = replacing === undefined ? 'Peças' : 'Parecidas';
  const second = replacing === undefined ? 'Complementos' : 'Outras';
  const choose = (candidate: Candidate) => {
    if (candidate.blocked || candidate.taken || candidate.current) return;
    onPick(candidate.info, paired && both);
  };

  const items = (list: Candidate[]) =>
    list.map((candidate) => (
      <CommandItem
        key={candidate.info.id}
        value={`${candidate.info.label} ${candidate.info.id} ${groupLabel(candidate.info.group)}`}
        disabled={!!candidate.blocked || !!candidate.taken}
        data-checked={candidate.current || undefined}
        onSelect={() => choose(candidate)}
        className="gap-2 py-1.5"
      >
        <Line candidate={candidate} thumbs={thumbs} catalog={catalog} />
      </CommandItem>
    ));

  return (
    <Command>
      <CommandInput placeholder={`Buscar peça · ${heading}`} />
      <CommandList className="max-h-72">
        <CommandEmpty>Nenhuma peça encontrada.</CommandEmpty>
        {replacing !== undefined && onRemove && (
          <>
            <CommandGroup>
              <CommandItem value="tirar remover nenhuma" onSelect={onRemove} className="gap-2 text-destructive data-selected:text-destructive">
                <Trash2Icon />
                Tirar peça
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {similar.length > 0 && <CommandGroup heading={first}>{items(similar)}</CommandGroup>}
        {others.length > 0 && <CommandGroup heading={second}>{items(others)}</CommandGroup>}
      </CommandList>
    </Command>
  );
}

/**
 * The list of parts that fit a place, opened from the row that shows what is there now: choosing one swaps it in place
 * (or wears it, in an empty place) in one step. The parts that do the same job as the piece come first; a part that rests on
 * another waits, disabled, until that one is worn. For a pair, "Nos dois lados" does the same on the other side.
 */
export function PartPicker({ catalog, outfit, place, replacing, thumbs, children, onChoose, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const paired = isPaired(place.slot);
  // The pair is dressed alike when the other side already wears this part, or when it has nothing yet.
  const opposite: Place = { slot: place.slot, side: place.side === 1 ? -1 : 1 };
  const matching = replacing !== undefined && mirrorOf(outfit, replacing) >= 0;
  const [bothChosen, setBoth] = useState<boolean | null>(null);
  const both = bothChosen ?? (matching || (replacing === undefined && paired && piecesIn(outfit, opposite).length === 0));
  const heading = `${SLOT_LABELS[place.slot]}${paired ? ` · ${SIDE_LABELS[place.side === 0 ? 1 : place.side].toLowerCase()}` : ''}`;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setBoth(null);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 gap-0 p-0">
        <Choices
          catalog={catalog}
          outfit={outfit}
          place={place}
          replacing={replacing}
          thumbs={thumbs}
          paired={paired}
          both={both}
          heading={heading}
          onPick={(info, together) => {
            setOpen(false);
            onChoose(info, together);
          }}
          onRemove={
            onRemove &&
            (() => {
              setOpen(false);
              onRemove();
            })
          }
        />
        {paired && (
          <div className="border-t p-2.5">
            <Field orientation="horizontal">
              <Switch id={`both-${place.slot}-${place.side}`} checked={both} onCheckedChange={setBoth} />
              <FieldLabel htmlFor={`both-${place.slot}-${place.side}`}>Nos dois lados</FieldLabel>
            </Field>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
