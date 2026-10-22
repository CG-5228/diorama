import { Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Armed } from '@/lib/playground/library';
import type { SceneOptions } from './scene';

const ZOOMS = ['1', '2', '3', '4'] as const;
const SPEEDS = [['1', '1×'], ['0.25', '¼×'], ['0.1', '⅒×'], ['0', 'Pausa']] as const;

/** Radix Select cannot hold an empty value: "no scene" is this sentinel. */
const NO_SCENE = '__none';

interface Props {
  options: SceneOptions;
  /** Saved scenes of the project that can stand behind the actors, and the one chosen. */
  scenes: string[];
  scene: string;
  onScene: (name: string) => void;
  onOptions: (patch: Partial<SceneOptions>) => void;
  armed: Armed | null;
  onReset: () => void;
}

export function SceneToolbar({ options, scenes, scene, onScene, onOptions, armed, onReset }: Props) {
  const toggles: Array<[keyof Pick<SceneOptions, 'shadow' | 'anchor' | 'bounds' | 'sockets' | 'navigation'>, string]> = [
    ['shadow', 'Sombra'],
    ['anchor', 'Âncora'],
    ['bounds', 'Bordas'],
    ['sockets', 'Sockets'],
    // Where characters can go is the scene's: it has none without one.
    ...(scene ? [['navigation', 'Navegação'] as [keyof Pick<SceneOptions, 'navigation'>, string]] : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-4 py-2">
      <Field orientation="horizontal" className="w-auto">
        <FieldTitle id="playground-zoom">Zoom</FieldTitle>
        <ToggleGroup type="single" variant="outline" size="sm" spacing={0} aria-labelledby="playground-zoom" value={String(options.zoom)} onValueChange={(zoom) => zoom && onOptions({ zoom: Number(zoom) })}>
          {ZOOMS.map((z) => <ToggleGroupItem key={z} value={z}>{z}×</ToggleGroupItem>)}
        </ToggleGroup>
      </Field>
      <Field orientation="horizontal" className="w-auto">
        <FieldTitle id="playground-speed">Velocidade</FieldTitle>
        <ToggleGroup type="single" variant="outline" size="sm" spacing={0} aria-labelledby="playground-speed" value={String(options.speed)} onValueChange={(speed) => speed !== '' && onOptions({ speed: Number(speed) })}>
          {SPEEDS.map(([value, label]) => <ToggleGroupItem key={value} value={value}>{label}</ToggleGroupItem>)}
        </ToggleGroup>
      </Field>
      {toggles.map(([key, label]) => (
        <Field key={key} orientation="horizontal" className="w-auto">
          <Switch id={`playground-${key}`} checked={options[key]} onCheckedChange={(checked) => onOptions({ [key]: checked })} />
          <FieldLabel htmlFor={`playground-${key}`}>{label}</FieldLabel>
        </Field>
      ))}
      {scenes.length > 0 && (
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor="playground-scene">Cenário</FieldLabel>
          <Select value={scene || NO_SCENE} onValueChange={(name) => onScene(name === NO_SCENE ? '' : name)}>
            <SelectTrigger id="playground-scene" size="sm" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NO_SCENE}>Nenhum</SelectItem>
                {scenes.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      )}
      {armed && <span className="text-muted-foreground">Clique na cena para colocar · Esc cancela</span>}
      <Button variant="outline" size="sm" className="ml-auto" onClick={onReset}>
        <Trash2Icon data-icon="inline-start" />
        Limpar cena
      </Button>
    </div>
  );
}
