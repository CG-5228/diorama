import { useState } from 'react';
import NiceModal from '@ebay/nice-modal-react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Trash2Icon } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { projectsQuery } from '@/lib/queries';
import { useDeleteProject } from '@/lib/mutations';
import { useModalDialog } from '@/lib/use-modal-dialog';
import { formatBytes, plural } from '@/lib/format';

/** Moves a whole project to the trash. Asks for the project name first, like destructive actions on GitHub. */
export const DeleteProjectModal = NiceModal.create(({ project }: { project: string }) => {
  const { modal, rootProps, contentProps } = useModalDialog();
  const { data: projects } = useSuspenseQuery(projectsQuery);
  const remove = useDeleteProject();
  const [typed, setTyped] = useState('');
  const meta = projects.find((p) => p.name === project);

  return (
    <AlertDialog {...rootProps}>
      <AlertDialogContent {...contentProps} className="data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar o projeto {project}</AlertDialogTitle>
          <AlertDialogDescription>
            A pasta inteira vai para <code>.diorama-trash/projects/</code>
            {meta && ` — ${plural(meta.assetCount, 'asset exportado', 'assets exportados')}, ${plural(meta.sheetCount, 'sheet', 'sheets')} em sheets/ (${formatBytes(meta.totalSize)} exportados)`}
            . Dá para desfazer logo depois pelo aviso.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Alert variant="destructive">
          <AlertDescription>Inclui src/, sheets/, exports e STYLE.md.</AlertDescription>
        </Alert>
        <Field>
          <FieldLabel htmlFor="confirm-project">Digite o nome do projeto para confirmar</FieldLabel>
          <Input id="confirm-project" autoComplete="off" placeholder={project} value={typed} onChange={(e) => setTyped(e.target.value)} />
          <FieldDescription>
            Confirme com <code>{project}</code>.
          </FieldDescription>
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={typed !== project || remove.isPending}
            onClick={() => remove.mutate({ project }, { onSuccess: () => modal.hide() })}
          >
            {remove.isPending ? <Spinner data-icon="inline-start" /> : <Trash2Icon data-icon="inline-start" />}
            Apagar projeto
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
});
