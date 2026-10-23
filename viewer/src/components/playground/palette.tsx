import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Field, FieldDescription, FieldLegend, FieldSet, FieldTitle } from '@/components/ui/field';
import { Kbd } from '@/components/ui/kbd';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useT } from '@/i18n';
import type { Entry } from '@/lib/playground/catalog';
import type { Armed, Character, Library } from '@/lib/playground/library';
import { PlacementList } from './placement-list';
import { PlayerPicker } from './player-picker';

interface Props {
  library: Library;
  entries: Entry[];
  recent: string[];
  player: Character | null;
  onPlayer: (id: string) => void;
  armed: Armed | null;
  onArm: (item: Armed | null) => void;
}

export function Palette({ library, entries, recent, player, onPlayer, armed, onArm }: Props) {
  const { t } = useT();
  const directions = armed?.type === 'sprite' ? (armed.clip.atlas.meta.directions ?? []) : [];
  return (
    <aside className="flex min-h-0 w-80 shrink-0 flex-col gap-5 border-r p-4">
      {library.characters.length > 0 && (
        <FieldSet>
          <FieldLegend variant="label" className="mb-0 text-muted-foreground uppercase">{t('playground.palette.character')}</FieldLegend>
          <PlayerPicker characters={library.characters} player={player} onPlayer={onPlayer} />
          {player && <Controls character={player} />}
        </FieldSet>
      )}

      <FieldSet className="min-h-0 flex-1">
        <FieldLegend variant="label" className="mb-0 text-muted-foreground uppercase">{t('playground.palette.place')}</FieldLegend>
        <FieldDescription>{t('playground.palette.placeHint')}</FieldDescription>
        <PlacementList
          entries={entries}
          recent={recent}
          armedKey={armed?.key ?? null}
          playerId={player?.id ?? null}
          onArm={onArm}
          onControl={onPlayer}
        />
        {armed?.type === 'sprite' && directions.length > 1 && (
          <Field>
            <FieldTitle id="playground-facing">{t('playground.palette.direction')}</FieldTitle>
            <ToggleGroup type="single" variant="outline" size="sm" spacing={0} aria-labelledby="playground-facing" value={String(armed.row)} onValueChange={(row) => row && onArm({ ...armed, row: Number(row) })} className="flex-wrap">
              {directions.map((name, row) => <ToggleGroupItem key={name} value={String(row)}>{name}</ToggleGroupItem>)}
            </ToggleGroup>
          </Field>
        )}
      </FieldSet>
    </aside>
  );
}

/** The keys of the controlled character, straight from its manifest controls: what each one plays. */
function Controls({ character }: { character: Character }) {
  const { t } = useT();
  const { locomotion, actions, hit, death, warnings } = character;
  const rows: Array<[keys: Array<string | number>, label: string, kind?: string]> = [
    [['W', 'A', 'S', 'D'], locomotion[0]?.key ?? t('playground.controls.move'), locomotion[0]?.kind],
    ...(locomotion.length > 1 ? [[['Shift'], locomotion.at(-1)!.key, locomotion.at(-1)!.kind] as [string[], string, string]] : []),
    ...actions.map((action, i) => [[i === 0 ? t('keys.space') : i + 1], action.key, action.kind] as [Array<string | number>, string, string]),
    ...(hit ? [[['H'], hit.key, hit.kind] as [string[], string, string]] : []),
    ...(death ? [[['K'], death.key, death.kind] as [string[], string, string]] : []),
    ...(death || actions.some((a) => a.hold) ? [[['R'], t('playground.controls.restart')] as [string[], string]] : []),
  ];
  return (
    <>
      <dl className="flex flex-col gap-1.5 text-muted-foreground">
        {rows.map(([keys, label, kind]) => (
          <div key={`${keys.join('')}-${label}`} className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5">
              <span>{label}</span>
              {kind && kind !== label && <Badge variant="outline">{kind}</Badge>}
            </dt>
            <dd className="flex gap-1">{keys.map((key) => <Kbd key={key}>{key}</Kbd>)}</dd>
          </div>
        ))}
      </dl>
      {warnings.length > 0 && (
        <Alert>
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-0.5 pl-4">
              {warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
