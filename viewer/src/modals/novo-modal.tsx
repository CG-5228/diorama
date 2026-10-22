import { useState, type ReactNode } from 'react';
import NiceModal from '@ebay/nice-modal-react';
import { useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { projectsQuery } from '@/lib/queries';
import { useCli } from '@/lib/mutations';
import { useModalDialog } from '@/lib/use-modal-dialog';
import type { Engine, NovoTab } from '@/lib/types';

/** What each engine makes, for the engine select. */
const ENGINES: Array<{ id: Engine; label: string }> = [
  { id: 'volume', label: 'volume · props, cenário, efeitos' },
  { id: 'rig', label: 'rig · personagens e criaturas' },
];

/** Frames a new asset starts with: a prop is still, a clip of a character is a cycle. */
const DEFAULT_FRAMES: Record<Engine, string> = { volume: '1', rig: '8' };

/** The skeletons and clips `new-asset --engine rig` can start from (`@core/rig` presets). */
const SKELETONS = [
  { id: 'humanoid', label: 'humanoid · bípede' },
  { id: 'quadruped', label: 'quadruped · quadrúpede' },
] as const;
const CLIPS = ['walk', 'run', 'idle', 'attack', 'hit', 'death'] as const;
/** The clip's file name picks the preset when it is one of CLIPS, else walk. */
const AUTO_CLIP = 'auto';

/** What `new-asset` accepts as a subpath: kebab-case names (lowercase letters, digits and "-") joined by "/". */
const KEBAB_PATH = '[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*';

interface FormState {
  name: string;
  style: boolean;
  project: string;
  subpath: string;
  engine: Engine;
  size: string;
  frames: string;
  fps: string;
  directions: string;
  skeleton: (typeof SKELETONS)[number]['id'];
  clip: typeof AUTO_CLIP | (typeof CLIPS)[number];
  exportNow: boolean;
  sheet: 'none' | 'grid' | 'compact';
  gap: string;
  cols: string;
  both: boolean;
  mockup: boolean;
}

interface Props {
  tab?: NovoTab;
  /** Project the new asset or export belongs to; defaults to the project whose page is open. */
  project?: string;
  subpath?: string;
}

const tabs: Array<{ id: NovoTab; label: string }> = [
  { id: 'new-project', label: 'Projeto' },
  { id: 'new-asset', label: 'Asset' },
  { id: 'export', label: 'Exportar' },
];

/** Mirrors the npm script the request becomes, so the dialog doubles as a CLI cheat sheet. */
function cliLine(tab: NovoTab, v: FormState): string {
  switch (tab) {
    case 'new-project':
      return `npm run new-project -- ${v.name || '<projeto>'}${v.style ? ' --style' : ''}`;
    case 'new-asset': {
      const frames = Number(v.frames) > 1 ? ` --frames ${v.frames}` : '';
      const dirs = v.directions ? ` --directions ${v.directions}` : '';
      const base = `npm run new-asset -- ${v.project || '<projeto>'} ${v.subpath || '<caminho>'} --engine ${v.engine}`;
      if (v.engine === 'rig') return `${base} --skeleton ${v.skeleton}${v.clip === AUTO_CLIP ? '' : ` --clip ${v.clip}`}${frames}${dirs}`;
      return `${base} --size ${v.size}${dirs}${frames}${Number(v.frames) > 1 ? ` --fps ${v.fps}` : ''}`;
    }
    case 'export': {
      const sheet = v.sheet === 'none' ? '' : ` --${v.sheet}${v.gap ? ` --gap=${v.gap}` : ''}${v.cols ? ` --cols=${v.cols}` : ''}${v.both ? ' --both' : ''}`;
      return `npm run export -- ${v.project || '<projeto>'}${v.subpath ? ` ${v.subpath}` : ''}${sheet}${v.mockup ? ' --mockup' : ''}`;
    }
  }
}

function CheckField({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) {
  return (
    <Field orientation="horizontal">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <FieldLabel htmlFor={id}>{children}</FieldLabel>
    </Field>
  );
}

export const NovoModal = NiceModal.create(({ tab: initialTab = 'new-asset', project: initialProject, subpath }: Props) => {
  const { modal, rootProps, contentProps } = useModalDialog();
  const { data: projects } = useSuspenseQuery(projectsQuery);
  const navigate = useNavigate();
  const cli = useCli();
  const [tab, setTab] = useState<NovoTab>(projects.length ? initialTab : 'new-project');
  const [values, setValues] = useState<FormState>({
    name: '', style: false,
    project: projects.find((p) => p.name === initialProject)?.name ?? projects[0]?.name ?? '',
    subpath: subpath ?? '',
    engine: 'volume', size: '128x128', frames: DEFAULT_FRAMES.volume, fps: '6', directions: '8', skeleton: 'humanoid', clip: AUTO_CLIP, exportNow: true,
    sheet: 'none', gap: '', cols: '', both: false, mockup: false,
  });
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    // The last result belongs to the previous values.
    if (cli.data || cli.isError) cli.reset();
  };
  // Switching engine moves the frames to what that engine starts with, unless they were edited.
  const setEngine = (engine: Engine) => {
    setValues((v) => ({ ...v, engine, frames: v.frames === DEFAULT_FRAMES[v.engine] ? DEFAULT_FRAMES[engine] : v.frames }));
    if (cli.data || cli.isError) cli.reset();
  };
  const text = (key: 'name' | 'subpath' | 'size' | 'frames' | 'fps' | 'directions' | 'gap' | 'cols') => ({
    value: values[key],
    onChange: (e: { target: { value: string } }) => set(key, e.target.value),
  });

  const submit = async () => {
    const payload = { command: tab, ...values, sheet: values.sheet === 'none' ? '' : values.sheet, clip: values.clip === AUTO_CLIP ? '' : values.clip };
    const created = await cli.mutateAsync(payload);
    if (!created.ok) return;
    if (tab === 'new-project') {
      toast.success('Projeto criado', { description: values.name });
      void navigate({ to: '/p/$project', params: { project: values.name } });
      modal.hide();
    } else if (tab === 'new-asset') {
      // The asset lands in its project right away; exporting makes it show up in the list.
      if (values.exportNow) {
        const exported = await cli.mutateAsync({ command: 'export', project: values.project, subpath: values.subpath });
        if (!exported.ok) {
          toast.error('Asset criado, mas o export falhou', { description: exported.output.split('\n').slice(-4).join('\n') });
        }
      }
      toast.success('Asset criado', { description: `${values.project}/${values.subpath}` });
      void navigate({ to: '/p/$project', params: { project: values.project } });
      modal.hide();
    }
  };

  const projectField = (
    <Field>
      <FieldLabel htmlFor="novo-project">Projeto</FieldLabel>
      <Select value={values.project} onValueChange={(value) => set('project', value)}>
        <SelectTrigger id="novo-project" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {projects.map((p) => <SelectItem key={p.name} value={p.name}>{p.root === 'examples' ? `${p.name} (exemplo)` : p.name}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );

  const pending = cli.isPending;
  const verb = tab === 'export' ? 'Exportar' : 'Criar';

  return (
    <Dialog {...rootProps}>
      <DialogContent {...contentProps} className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Novo</DialogTitle>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value as NovoTab);
            cli.reset();
          }}
        >
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id} disabled={t.id !== 'new-project' && projects.length === 0}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <FieldGroup>
            {tab === 'new-project' && (
              <>
                <Field>
                  <FieldLabel htmlFor="novo-name">Nome do projeto</FieldLabel>
                  <Input id="novo-name" placeholder="meu-jogo" pattern="[a-z0-9][a-z0-9_\-]*" autoFocus {...text('name')} />
                  <FieldDescription>Letras minúsculas, números, - e _.</FieldDescription>
                </Field>
                <CheckField id="novo-style" checked={values.style} onChange={(v) => set('style', v)}>Adicionar STYLE.md</CheckField>
              </>
            )}

            {tab === 'new-asset' && (
              <>
                {projectField}
                <Field>
                  <FieldLabel htmlFor="novo-subpath">Caminho do asset</FieldLabel>
                  <Input id="novo-subpath" placeholder={values.engine === 'rig' ? 'characters/wolf/walk' : 'props/barrel'} pattern={KEBAB_PATH} autoFocus {...text('subpath')} />
                  <FieldDescription>
                    {values.engine === 'rig'
                      ? <>Relativo a <code>sheets/</code>, sem extensão, em kebab-case: a pasta é o personagem, o arquivo é o clipe. O primeiro clipe cria o <code>character.ts</code> em <code>src/</code>.</>
                      : <>Relativo a <code>sheets/</code>, sem extensão, em kebab-case. O desenho fica em <code>src/</code> e o sheet o reexporta.</>}
                  </FieldDescription>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="novo-engine">Engine</FieldLabel>
                    <Select value={values.engine} onValueChange={(value) => setEngine(value as Engine)}>
                      <SelectTrigger id="novo-engine" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {ENGINES.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  {values.engine === 'rig' ? (
                    <Field>
                      <FieldLabel htmlFor="novo-skeleton">Esqueleto</FieldLabel>
                      <Select value={values.skeleton} onValueChange={(value) => set('skeleton', value as FormState['skeleton'])}>
                        <SelectTrigger id="novo-skeleton" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {SKELETONS.map((k) => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : (
                    <Field>
                      <FieldLabel htmlFor="novo-size">Tamanho</FieldLabel>
                      <Input id="novo-size" className="font-mono" {...text('size')} />
                    </Field>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field>
                    <FieldLabel htmlFor="novo-frames">Frames</FieldLabel>
                    <Input id="novo-frames" type="number" min={1} className="font-mono" {...text('frames')} />
                  </Field>
                  {values.engine === 'rig' ? (
                    <Field>
                      <FieldLabel htmlFor="novo-clip">Clipe</FieldLabel>
                      <Select value={values.clip} onValueChange={(value) => set('clip', value as FormState['clip'])}>
                        <SelectTrigger id="novo-clip" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value={AUTO_CLIP}>auto</SelectItem>
                            {CLIPS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FieldDescription>Auto: pelo nome do arquivo.</FieldDescription>
                    </Field>
                  ) : (
                    <Field>
                      <FieldLabel htmlFor="novo-fps">FPS</FieldLabel>
                      <Input id="novo-fps" type="number" min={1} className="font-mono" {...text('fps')} />
                    </Field>
                  )}
                  <Field>
                    <FieldLabel htmlFor="novo-directions">Direções</FieldLabel>
                    <Input id="novo-directions" type="number" min={1} className="font-mono" {...text('directions')} />
                    <FieldDescription>1, 4 ou 8.</FieldDescription>
                  </Field>
                </div>
                <CheckField id="novo-export-now" checked={values.exportNow} onChange={(v) => set('exportNow', v)}>
                  Exportar logo após criar (o asset aparece na lista do projeto)
                </CheckField>
              </>
            )}

            {tab === 'export' && (
              <>
                {projectField}
                <Field>
                  <FieldLabel htmlFor="novo-export-path">Caminho</FieldLabel>
                  <Input id="novo-export-path" placeholder="characters/wolf/" {...text('subpath')} />
                  <FieldDescription>
                    Relativo a <code>sheets/</code>. Vazio exporta o projeto inteiro; <code>pasta/</code> exporta uma pasta.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="novo-sheet">Saída</FieldLabel>
                  <Select value={values.sheet} onValueChange={(value) => set('sheet', value as FormState['sheet'])}>
                    <SelectTrigger id="novo-sheet" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">Arquivos individuais</SelectItem>
                        <SelectItem value="grid">Sheet em grade (--grid)</SelectItem>
                        <SelectItem value="compact">Sheet compacto (--compact)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                {values.sheet !== 'none' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel htmlFor="novo-gap">Gap (px)</FieldLabel>
                        <Input id="novo-gap" type="number" min={0} placeholder="0" className="font-mono" {...text('gap')} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="novo-cols">Colunas</FieldLabel>
                        <Input id="novo-cols" type="number" min={1} placeholder="auto" className="font-mono" {...text('cols')} />
                      </Field>
                    </div>
                    <CheckField id="novo-both" checked={values.both} onChange={(v) => set('both', v)}>Também exportar os arquivos individuais</CheckField>
                  </>
                )}
                <CheckField id="novo-mockup" checked={values.mockup} onChange={(v) => set('mockup', v)}>
                  Mockup: grava em review/mockups/, nunca em assets/
                </CheckField>
              </>
            )}
          </FieldGroup>

          <div className="flex items-baseline gap-2 rounded-md bg-muted/50 p-2">
            <Kbd>CLI</Kbd>
            <code className="font-mono text-xs break-all">{cliLine(tab, values)}</code>
          </div>

          {(cli.data || cli.isError) && (
            <Alert variant={cli.data?.ok ? 'default' : 'destructive'}>
              <AlertDescription>
                <pre className="max-h-48 overflow-auto font-mono text-xs whitespace-pre-wrap">
                  {cli.data ? cli.data.output || (cli.data.ok ? 'Pronto.' : 'Falhou.') : cli.error?.message}
                </pre>
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => modal.hide()}>Fechar</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              {pending ? (tab === 'export' ? 'Exportando…' : 'Criando…') : verb}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
