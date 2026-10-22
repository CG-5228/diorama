import NiceModal from '@ebay/nice-modal-react';
import type { GearCatalog, OutfitData, PartInfo } from '@core/rig';
import { PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { addPiece, movePiece, removePiece, setHost } from '@/lib/outfit/edit';
import { plural } from '@/lib/format';
import { AddPieceModal, type Placement } from '@/modals/add-piece-modal';
import type { Edit } from '@/lib/outfit/use-draft';
import { PieceCard } from './piece-card';
import { OutfitBasics } from './outfit-basics';

interface Props {
  project: string;
  catalog: GearCatalog;
  outfit: OutfitData;
  onEdit: Edit;
}

/** The outfit as a form: the body underneath, a material for each role, and the pieces in drawing order. */
export function OutfitEditor({ project, catalog, outfit, onEdit }: Props) {
  const remove = (index: number) => {
    const { removed } = removePiece(outfit, catalog, index);
    onEdit((o) => removePiece(o, catalog, index).outfit);
    if (removed > 1) toast(`Removeu também ${plural(removed - 1, 'complemento que dependia', 'complementos que dependiam')} dela`);
  };

  const add = () =>
    void NiceModal.show(AddPieceModal, {
      project,
      catalog,
      outfit,
      onAdd: (info: PartInfo, where: Placement) =>
        onEdit((o) => {
          const start = o.pieces.length;
          let next = addPiece(o, info, { slot: where.slot, sides: where.sides });
          if (where.host !== undefined) for (let i = start; i < next.pieces.length; i++) next = setHost(next, i, where.host);
          return next;
        }),
    });

  return (
    <div className="flex flex-col gap-5">
      <OutfitBasics catalog={catalog} outfit={outfit} onEdit={onEdit} />

      <FieldSet className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <FieldLegend variant="label" className="mb-0">Peças <span className="font-normal text-muted-foreground tabular-nums">{outfit.pieces.length}</span></FieldLegend>
          <Button size="sm" variant="outline" onClick={add}>
            <PlusIcon data-icon="inline-start" />
            Adicionar peça
          </Button>
        </div>
        {outfit.pieces.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyTitle>Nenhuma peça</EmptyTitle>
              <EmptyDescription>O personagem aparece só com o corpo. Adicione peças do kit.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-1.5">
            {outfit.pieces.map((piece, index) => (
              <PieceCard
                key={`${index}-${piece.id ?? piece.part}`}
                catalog={catalog}
                outfit={outfit}
                index={index}
                onEdit={onEdit}
                onMove={(delta) => onEdit((o) => movePiece(o, index, delta))}
                onRemove={() => remove(index)}
              />
            ))}
          </div>
        )}
      </FieldSet>
    </div>
  );
}
