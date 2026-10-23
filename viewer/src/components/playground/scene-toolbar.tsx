import { Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useT } from '@/i18n';
import type { Armed } from '@/lib/playground/library';
import type { SceneOptions } from './scene';

const ZOOMS = ['1', '2', '3', '4'] as const;
const SPEEDS = [['1', 'normal'], ['0.25', 'quarter'], ['0.1', 'tenth'], ['0', 'pause']] as const;

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
  const { t } = useT();
  // Where characters can go is the scene's: it has none without one.
  const toggles: Array<keyof Pick<SceneOptions, 'shadow' | 'anchor' | 'bounds' | 'sockets' | 'navigation'>> = ['shadow', 'anchor', 'bounds', 'sockets', ...(scene ? (['navigation'] as const) : [])];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-4 py-2">
      <Field orientation="horizontal" className="w-auto">
        <FieldTitle id="playground-zoom">{t('playground.toolbar.zoom')}</FieldTitle>
        <ToggleGroup type="single" variant="outline" size="sm" spacing={0} aria-labelledby="playground-zoom" value={String(options.zoom)} onValueChange={(zoom) => zoom && onOptions({ zoom: Number(zoom) })}>
          {ZOOMS.map((z) => <ToggleGroupItem key={z} value={z}>{t('units.times', { value: z })}</ToggleGroupItem>)}
        </ToggleGroup>
      </Field>
      <Field orientation="horizontal" className="w-auto">
        <FieldTitle id="playground-speed">{t('playground.toolbar.speed')}</FieldTitle>
        <ToggleGroup type="single" variant="outline" size="sm" spacing={0} aria-labelledby="playground-speed" value={String(options.speed)} onValueChange={(speed) => speed !== '' && onOptions({ speed: Number(speed) })}>
          {SPEEDS.map(([value, name]) => <ToggleGroupItem key={value} value={value}>{t(`playground.toolbar.speeds.${name}`)}</ToggleGroupItem>)}
        </ToggleGroup>
      </Field>
      {toggles.map((key) => (
        <Field key={key} orientation="horizontal" className="w-auto">
          <Switch id={`playground-${key}`} checked={options[key]} onCheckedChange={(checked) => onOptions({ [key]: checked })} />
          <FieldLabel htmlFor={`playground-${key}`}>{t(`playground.toolbar.${key}`)}</FieldLabel>
        </Field>
      ))}
      {scenes.length > 0 && (
        <Field orientation="horizontal" className="w-auto">
          <FieldLabel htmlFor="playground-scene">{t('playground.toolbar.scenery')}</FieldLabel>
          <Select value={scene || NO_SCENE} onValueChange={(name) => onScene(name === NO_SCENE ? '' : name)}>
            <SelectTrigger id="playground-scene" size="sm" className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NO_SCENE}>{t('playground.toolbar.none')}</SelectItem>
                {scenes.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      )}
      {armed && <span className="text-muted-foreground">{t('playground.toolbar.placing')}</span>}
      <Button variant="outline" size="sm" className="ml-auto" onClick={onReset}>
        <Trash2Icon data-icon="inline-start" />
        {t('playground.toolbar.clear')}
      </Button>
    </div>
  );
}
