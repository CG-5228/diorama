import { useState } from 'react';
import NiceModal from '@ebay/nice-modal-react';
import { useQueries } from '@tanstack/react-query';
import { FileCodeIcon, FileImageIcon, FileJsonIcon, Trash2Icon } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Item, ItemActions, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import { deletePlanQuery } from '@/lib/queries';
import { useDeleteAssets } from '@/lib/mutations';
import { useModalDialog } from '@/lib/use-modal-dialog';
import { plural } from '@/lib/format';
import type { AssetFileMeta, FileKind } from '@/lib/types';

const kindIcon: Record<FileKind, typeof FileImageIcon> = { image: FileImageIcon, atlas: FileJsonIcon, sheet: FileCodeIcon };

interface Props {
  assets: AssetFileMeta[];
}

/** Confirms moving exported assets to the trash, listing exactly the files the server will move. */
export const DeleteAssetsModal = NiceModal.create(({ assets }: Props) => {
  const { modal, rootProps, contentProps } = useModalDialog();
  const remove = useDeleteAssets();
  const [deleteSheet, setDeleteSheet] = useState(false);

  const plans = useQueries({ queries: assets.map((a) => deletePlanQuery(a.project, a.subpath)) });
  const loading = plans.some((p) => p.isPending);
  const failed = plans.find((p) => p.isError);
  const files = plans.flatMap((p) => p.data?.files ?? []);
  const hasSheet = files.some((f) => f.kind === 'sheet');
  const moving = files.filter((f) => !f.optional || deleteSheet);
  const title = assets.length === 1 ? `Excluir ${assets[0].subpath.split('/').pop()}` : `Excluir ${assets.length} animações`;

  return (
    <AlertDialog {...rootProps}>
      <AlertDialogContent {...contentProps} className="data-[size=default]:sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            Estes arquivos vão para <code>.diorama-trash/assets/{assets[0].project}/</code>. Dá para desfazer logo depois pelo aviso.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {loading && <Spinner />}
        {failed?.error && (
          <Alert variant="destructive">
            <AlertDescription>{failed.error.message}</AlertDescription>
          </Alert>
        )}
        <ItemGroup className="max-h-60 gap-1 overflow-auto">
          {files.map((file) => {
            const Icon = kindIcon[file.kind];
            const kept = file.optional && !deleteSheet;
            return (
              <Item key={file.path} variant="muted" size="xs">
                <ItemMedia variant="icon">
                  <Icon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="font-mono break-all">{file.path}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Badge variant={kept ? 'outline' : 'destructive'}>{kept ? 'permanece' : 'lixeira'}</Badge>
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>

        <Field orientation="horizontal" data-disabled={!hasSheet || undefined}>
          <Checkbox id="delete-sheet" checked={deleteSheet} disabled={!hasSheet} onCheckedChange={(checked) => setDeleteSheet(checked === true)} />
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor="delete-sheet">Excluir também o sheet (.ts)</FieldLabel>
            {!hasSheet && !loading && <FieldDescription>Nenhum arquivo em sheets/ para {assets.length === 1 ? 'este asset' : 'estes assets'}.</FieldDescription>}
          </div>
        </Field>
        {deleteSheet && hasSheet && (
          <Alert>
            <AlertDescription>Sem o sheet não dá mais para exportar de novo (só desfazendo). O código em src/ fica.</AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={loading || failed !== undefined || remove.isPending}
            onClick={() => remove.mutate({ assets, deleteSheet }, { onSuccess: () => modal.hide() })}
          >
            {remove.isPending ? <Spinner data-icon="inline-start" /> : <Trash2Icon data-icon="inline-start" />}
            Mover {plural(moving.length, 'arquivo', 'arquivos')} para a lixeira
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});
