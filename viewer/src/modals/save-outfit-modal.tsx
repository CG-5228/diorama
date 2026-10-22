import { useState } from 'react';
import NiceModal from '@ebay/nice-modal-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { OutfitData } from '@core/rig';
import { CheckIcon, SaveIcon, TriangleAlertIcon } from 'lucide-react';
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
  /** The id of the character the outfit was made on: the new one gets its skeleton and clips. */
  characterId: string;
  outfit: OutfitData;
  /** The clips made for something this outfit does not hold, with what they need: the new character is not given them. */
  skipped?: Array<[key: string, needs: string]>;
}

interface Saved {
  name: string;
  /** What the two scripts printed. */
  output: string;
  exported: boolean;
}

/** Saves the outfit as a new character of the project, exports its sheets, and links to where to see it. */
export const SaveOutfitModal = NiceModal.create(({ project, characterId, outfit, skipped = [] }: Props) => {
  const { modal, rootProps, contentProps } = useModalDialog();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [force, setForce] = useState(false);
  const valid = isValidCharacterName(name);

  const save = useMutation({
    mutationFn: async (): Promise<Saved> => {
      const created = await api.cli({ command: 'new-outfit-character', project, name, from: characterId, outfit, force });
      if (!created.ok) throw new Error(created.output);
      // The folder is new: export all of it, so the sheets exist when the user opens the playground.
      const exported = await api.cli({ command: 'export', project, subpath: `characters/${name}/` });
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
          <DialogTitle>Salvar como personagem</DialogTitle>
          <DialogDescription>
            Cria <code>src/characters/{name || '<nome>'}/</code> e os sheets em <code>sheets/characters/{name || '<nome>'}/</code> em <code>{project}</code> com este outfit e os clipes do personagem base que ele pode usar, e exporta as folhas.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-3">
          <Field data-invalid={(name !== '' && !valid) || undefined}>
            <FieldLabel htmlFor="outfit-name">Nome</FieldLabel>
            <Input
              id="outfit-name"
              className="font-mono"
              autoComplete="off"
              placeholder="guarda-dourado"
              aria-invalid={name !== '' && !valid}
              value={name}
              disabled={save.isPending}
              onChange={(e) => { setName(e.target.value); save.reset(); }}
            />
            {name !== '' && !valid ? <FieldError>Use letras minúsculas, números e hífen (ex.: guarda-dourado).</FieldError> : <FieldDescription>Letras minúsculas, números e hífen.</FieldDescription>}
          </Field>
          <Field orientation="horizontal">
            <Checkbox id="outfit-force" checked={force} disabled={save.isPending} onCheckedChange={(checked) => setForce(checked === true)} />
            <FieldLabel htmlFor="outfit-force" className="font-normal">Substituir se já existir</FieldLabel>
          </Field>
        </FieldGroup>

        {skipped.length > 0 && !saved && (
          <Alert>
            <TriangleAlertIcon />
            <AlertTitle>{skipped.length === 1 ? 'Um clipe fica de fora' : `${skipped.length} clipes ficam de fora`}</AlertTitle>
            <AlertDescription>
              O personagem novo só ganha os clipes que o que ele segura permite. Não serão gerados: {skipped.map(([key, needs]) => `${key} (feito para ${needs})`).join(', ')}.
            </AlertDescription>
          </Alert>
        )}
        {save.isError && (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível salvar</AlertTitle>
            <AlertDescription><pre className="max-h-40 overflow-auto font-mono whitespace-pre-wrap">{save.error.message}</pre></AlertDescription>
          </Alert>
        )}
        {saved && (
          <Alert variant={saved.exported ? 'default' : 'destructive'}>
            <CheckIcon />
            <AlertTitle>{saved.exported ? `Personagem ${saved.name} salvo e exportado` : `Personagem ${saved.name} salvo, mas o export falhou`}</AlertTitle>
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
                <Link to="/p/$project/playground" params={{ project }}>Abrir no playground</Link>
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
