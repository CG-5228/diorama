import { useState } from 'react';
import type { GearCatalog, OutfitData, PartInfo, SkeletonSpec } from '@core/rig';
import { ArrowLeftRightIcon, PlusIcon, Settings2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { plural } from '@/lib/format';
import { groupLabel, SIDE_LABELS, SLOT_LABELS } from '@/lib/outfit/labels';
import { isPaired, partOf, removePiece } from '@/lib/outfit/edit';
import { equipOrSwap, isBodyPart, placeOf, placesOf, SLOT_ORDER, stacksIn, swapBoth, type Place, type Stack, type Swapped } from '@/lib/outfit/slots';
import type { Edit } from '@/lib/outfit/use-draft';
import { cn } from '@/lib/utils';
import { PartPicker } from './part-picker';
import { PartThumb } from './part-thumb';
import { PieceFields } from './piece-card';
import { useGearThumbs } from './use-gear-thumbs';

interface Props {
  project: string;
  catalog: GearCatalog;
  outfit: OutfitData;
  /** The character's skeleton says which places it has: a wolf has no hands. */
  skeleton: SkeletonSpec;
  onEdit: Edit;
  onUndo: () => void;
}

/**
 * The outfit by place on the body, the way a game's equipment screen reads: each place shows what is worn there, and
 * clicking it opens the parts that fit to swap it in one step. What rests on a piece (a crest on a helm) hangs under it; each
 * piece has its options and materials behind a button. Places the kit has nothing for are not listed, and the body's own parts
 * (bone limbs, a rib cage) stay in the list view.
 */
export function SlotBoard({ project, catalog, outfit, skeleton, onEdit, onUndo }: Props) {
  const thumbs = useGearThumbs(project);
  // Pieces whose options are open, by id: an index would point at another piece after a removal.
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const keyOf = (index: number) => outfit.pieces[index].id ?? `#${index}`;
  const toggle = (index: number) =>
    setOpened((current) => {
      const next = new Set(current);
      if (!next.delete(keyOf(index))) next.add(keyOf(index));
      return next;
    });

  const places = placesOf(skeleton);
  const worn = (place: Place) => stacksIn(outfit, catalog, place);
  // A slot is listed when the kit has a part for it (not counting the body's) or the outfit already wears something there.
  const slots = SLOT_ORDER.map((slot) => ({
    slot,
    places: places.filter((p) => p.slot === slot),
  })).filter(({ slot, places: there }) => there.length > 0 && (catalog.parts.some((part) => part.slots.includes(slot) && !isBodyPart(part)) || there.some((p) => worn(p).length > 0)));

  /** What an edit took out besides the piece it was about, for the toast: add-ons that cannot rest on the new part, and what the hands cannot hold with it. */
  const aftermath = (result: Swapped) => {
    const label = (part: string) => partOf(catalog, part)?.label ?? part;
    return [
      result.dropped.length > 0 ? `Saiu ${plural(result.dropped.length, 'complemento que só servia', 'complementos que só serviam')} na peça trocada.` : '',
      result.pushed.length > 0 ? `Saiu ${result.pushed.map(label).join(' e ')}: as mãos não seguram as duas peças.` : '',
    ]
      .filter(Boolean)
      .join(' ');
  };
  const swap = (index: number, info: PartInfo, both: boolean) => {
    const label = partOf(catalog, outfit.pieces[index].part)?.label ?? outfit.pieces[index].part;
    const result = swapBoth(outfit, catalog, index, info, both);
    if (!result) return;
    onEdit((o) => swapBoth(o, catalog, index, info, both)?.outfit ?? o);
    const description = aftermath(result);
    if (description) toast(`${label} → ${info.label}`, { description, action: { label: 'Desfazer', onClick: onUndo } });
  };
  const equip = (place: Place, info: PartInfo, both: boolean) => {
    const result = equipOrSwap(outfit, catalog, info, place, both);
    if (!result) return;
    onEdit((o) => equipOrSwap(o, catalog, info, place, both)?.outfit ?? o);
    const description = aftermath(result);
    if (description) toast(info.label, { description, action: { label: 'Desfazer', onClick: onUndo } });
  };
  const remove = (index: number) => {
    const { removed } = removePiece(outfit, catalog, index);
    onEdit((o) => removePiece(o, catalog, index).outfit);
    if (removed > 1) toast(`Tirou também ${plural(removed - 1, 'complemento que dependia', 'complementos que dependiam')} dela`, { action: { label: 'Desfazer', onClick: onUndo } });
  };

  const line = (stack: Stack, depth: number) => {
    const index = stack.index;
    const piece = outfit.pieces[index];
    const info = partOf(catalog, piece.part);
    const place = placeOf(piece);
    const open = opened.has(keyOf(index));
    return (
      <div key={keyOf(index)} className={cn('flex flex-col gap-1', depth > 0 && 'ml-4 border-l pl-2')}>
        <div className="flex items-center gap-1">
          <PartPicker catalog={catalog} outfit={outfit} place={place} replacing={index} thumbs={thumbs} onChoose={(next, both) => swap(index, next, both)} onRemove={() => remove(index)}>
            <Button variant="outline" className="h-auto min-w-0 flex-1 justify-start gap-2 p-1.5 text-left font-normal" aria-label={`Trocar ${info?.label ?? piece.part}`} title="Trocar por outra peça">
              <PartThumb asset={thumbs.get(piece.part)} className={depth > 0 ? 'size-7' : undefined} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{info?.label ?? piece.part}</span>
                <span className="truncate text-xs text-muted-foreground">{info ? groupLabel(info.group) : 'peça desconhecida'}</span>
              </span>
              <ArrowLeftRightIcon data-icon="inline-end" className="ml-auto text-muted-foreground" />
            </Button>
          </PartPicker>
          <Button variant={open ? 'secondary' : 'ghost'} size="icon-xs" aria-label={`${open ? 'Fechar' : 'Abrir'} ajustes de ${info?.label ?? piece.part}`} aria-pressed={open} title="Ajustes: opções e materiais" onClick={() => toggle(index)}>
            <Settings2Icon />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label={`Tirar ${info?.label ?? piece.part}`} title="Tirar peça" onClick={() => remove(index)}>
            <XIcon />
          </Button>
        </div>
        {open && info && (
          <div className="rounded-md border bg-card/40">
            <PieceFields uid={`slot-${index}`} catalog={catalog} outfit={outfit} index={index} info={info} onEdit={onEdit} compact />
          </div>
        )}
        {stack.children.map((child) => line(child, depth + 1))}
      </div>
    );
  };

  const placeView = (place: Place) => {
    const stacks = worn(place);
    const paired = isPaired(place.slot);
    return (
      <div key={`${place.slot}:${place.side}`} className="flex flex-col gap-1">
        {paired && <span className="text-xs text-muted-foreground">{SIDE_LABELS[place.side === 0 ? 1 : place.side]}</span>}
        {stacks.map((stack) => line(stack, 0))}
        <PartPicker catalog={catalog} outfit={outfit} place={place} thumbs={thumbs} onChoose={(info, both) => equip(place, info, both)}>
          {stacks.length === 0 ? (
            <Button variant="outline" className="h-auto justify-start gap-2 border-dashed p-1.5 font-normal text-muted-foreground" aria-label={`Vestir ${SLOT_LABELS[place.slot].toLowerCase()}`}>
              <span className="grid size-9 place-items-center rounded-sm bg-muted/50"><PlusIcon /></span>
              Vestir
            </Button>
          ) : (
            <Button variant="ghost" size="xs" className="justify-start text-muted-foreground" aria-label={`Adicionar peça em ${SLOT_LABELS[place.slot].toLowerCase()}`}>
              <PlusIcon data-icon="inline-start" />
              Adicionar
            </Button>
          )}
        </PartPicker>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {slots.map(({ slot, places: there }) => (
        <section key={slot} className="flex flex-col gap-2" aria-label={SLOT_LABELS[slot]}>
          <h3 className="text-xs font-medium text-muted-foreground uppercase">{SLOT_LABELS[slot]}</h3>
          {there.map(placeView)}
        </section>
      ))}
      <p className="text-xs text-muted-foreground">As peças do corpo (ossos, costelas) ficam na aba Lista.</p>
    </div>
  );
}
