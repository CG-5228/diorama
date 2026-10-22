import { useState } from 'react';
import NiceModal from '@ebay/nice-modal-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { SceneData } from '@core/volume';
import { CheckIcon, SaveIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { isValidCharacterName } from '@/lib/outfit/save';
import { useModalDialog } from '@/lib/use-modal-dialog';

interface Props {
  project: string;
  scene: SceneData;
  /** The name of the scene that was opened, to save over it. */
  defaultName: string;
  /** Called once the scene is on disk, to add it to the list of saved scenes. */
  onSaved: (name: string) => void;
}

interface Saved {
  name: string;
  /** What the two scripts printed. */
  output: string;
  exported: boolean;
}

/** Saves the scene as `src/scenes/<name>.ts` (with its sheet in `sheets/scenes/`) and exports its reference image. */
export const SaveSceneModal = NiceModal.create(({ project, scene, defaultName, onSaved }: Props) => {
  const { modal, rootProps, contentProps } = useModalDialog();
  const queryClient = useQueryClient();
  const [name, setName] = useState(defaultName);
  // Saving over a scene that was opened is what the user asked for: no need to tick the box.
  const [force, setForce] = useState(defaultName !== '');
  const valid = isValidCharacterName(name);

  const save = useMutation({
    mutationFn: async (): Promise<Saved> => {
      const created = await api.cli({ command: 'new-scene', project, name, scene, force });
      if (!created.ok) throw new Error(created.output);
      onSaved(name);
      const exported = await api.cli({ command: 'export', project, subpath: `scenes/${name}` });
      return { name, output: [created.output, exported.output].filter(Boolean).join('\n\n'), exported: exported.ok };
    },
    // The catalog changed under the viewer whether or not the export worked.
    onSettled: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['assets'] }), queryClient.invalidateQueries({ queryKey: ['projects'] })]),
  });
  const saved = save.data;

  return (
    <Dialog {...rootProps}>
      <DialogContent {...contentProps} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Salvar cena</DialogTitle>
          <DialogDescription>
            Grava <code>src/scenes/{name || '<nome>'}.ts</code> em <code>{project}</code> (os dados, que dá para abrir e editar aqui) e o sheet <code>sheets/scenes/{name || '<nome>'}.ts</code>, e exporta a imagem de referência.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-3">
          <Field data-invalid={(name !== '' && !valid) || undefined}>
            <FieldLabel htmlFor="scene-name">Nome</FieldLabel>
            <Input
              id="scene-name"
              className="font-mono"
              autoComplete="off"
              placeholder="cantinho-do-cemiterio"
              aria-invalid={name !== '' && !valid}
              value={name}
              disabled={save.isPending}
              onChange={(e) => { setName(e.target.value); save.reset(); }}
            />
            {name !== '' && !valid ? <FieldError>Use letras minúsculas, números e hífen (ex.: cantinho-do-cemiterio).</FieldError> : <FieldDescription>Letras minúsculas, números e hífen.</FieldDescription>}
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="scene-force" checked={force} disabled={save.isPending} onCheckedChange={(checked) => setForce(checked === true)} />
            <FieldLabel htmlFor="scene-force" className="font-normal">Substituir se já existir</FieldLabel>
          </Field>
        </FieldGroup>

        {save.isError && (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível salvar</AlertTitle>
            <AlertDescription><pre className="max-h-40 overflow-auto font-mono whitespace-pre-wrap">{save.error.message}</pre></AlertDescription>
          </Alert>
        )}
        {saved && (
          <Alert variant={saved.exported ? 'default' : 'destructive'}>
            <CheckIcon />
            <AlertTitle>{saved.exported ? `Cena ${saved.name} salva e exportada` : `Cena ${saved.name} salva, mas o export falhou`}</AlertTitle>
            <AlertDescription>
              <pre className="max-h-40 overflow-auto font-mono whitespace-pre-wrap">{saved.output}</pre>
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {saved ? (
            <>
              <Button variant="outline" onClick={() => modal.hide()}>Fechar</Button>
              <Button asChild onClick={() => modal.hide()}>
                <Link to="/p/$project" params={{ project }} search={{ folder: 'scenes' }}>Ver nos assets</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => modal.hide()}>Cancelar</Button>
              <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
                {save.isPending ? 'Salvando e exportando…' : 'Salvar e exportar'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
