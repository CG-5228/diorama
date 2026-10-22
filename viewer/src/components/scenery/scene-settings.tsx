import { useState } from 'react';
import type { SceneData, SceneryCatalog } from '@core/volume';
import { FilePlusIcon } from 'lucide-react';
import { RoleFields } from '@/components/customize/role-fields';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { splitRoles } from '@/lib/outfit/edit';
import type { SavedScene } from '@/lib/scenery/catalog';
import { MAX_SIZE, MIN_SIZE, clampSize, countCells, emptyScene, resize, rolesInScene, setSceneMaterial } from '@/lib/scenery/edit';
import { plural } from '@/lib/format';

interface Props {
  catalog: SceneryCatalog;
  scene: SceneData;
  saved: SavedScene[];
  /** The saved scene the current one came from, if any. */
  loaded: string | null;
  onEdit: (update: (scene: SceneData) => SceneData) => void;
  /** Replaces the scene with a loaded or a new one: a normal edit, so it can be undone. */
  onLoad: (scene: SceneData, name: string | null) => void;
}

/** A size field that applies when it is left or confirmed: typing "12" must not pass through a scene of 1. */
function SizeField({ id, label, value, onCommit }: { id: string; label: string; value: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null) onCommit(clampSize(Number(draft)));
    setDraft(null);
  };
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="number"
        min={MIN_SIZE}
        max={MAX_SIZE}
        className="font-mono"
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </Field>
  );
}

/** Which scene is open, its size and the materials its pieces are made of. */
export function SceneSettings({ catalog, scene, saved, loaded, onEdit, onLoad }: Props) {
  const roles = splitRoles(rolesInScene(scene, catalog));
  const materials = Object.keys(catalog.materials);

  return (
    <div className="flex flex-col gap-5">
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="scene-open">Cena</FieldLabel>
          <Select value={loaded ?? ''} onValueChange={(name) => { const found = saved.find((s) => s.name === name); if (found) onLoad(found.scene, found.name); }} disabled={saved.length === 0}>
            <SelectTrigger id="scene-open" className="w-full"><SelectValue placeholder={saved.length === 0 ? 'Nenhuma cena salva' : 'Abrir uma cena salva'} /></SelectTrigger>
            <SelectContent>
              <SelectGroup>{saved.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectGroup>
            </SelectContent>
          </Select>
          <FieldDescription>Abrir ou criar substitui o que está na tela; Desfazer traz de volta.</FieldDescription>
        </Field>
        <Button variant="outline" size="sm" onClick={() => onLoad(emptyScene(catalog, scene.cols, scene.rows), null)}>
          <FilePlusIcon data-icon="inline-start" />
          Nova cena em branco
        </Button>
      </FieldGroup>

      <FieldSet className="min-w-0">
        <FieldLegend variant="label">Tamanho</FieldLegend>
        <div className="grid grid-cols-2 gap-3">
          <SizeField id="scene-cols" label="Colunas" value={scene.cols} onCommit={(cols) => onEdit((s) => resize(s, catalog, cols, s.rows))} />
          <SizeField id="scene-rows" label="Linhas" value={scene.rows} onCommit={(rows) => onEdit((s) => resize(s, catalog, s.cols, rows))} />
        </div>
        <p className="text-muted-foreground tabular-nums">
          {plural(countCells(scene.floor), 'célula de chão', 'células de chão')} · {plural(countCells(scene.walls), 'parede ou cerca', 'paredes e cercas')} · {plural(scene.props.length, 'prop ou decal', 'props e decais')}
        </p>
      </FieldSet>

      <FieldSet className="min-w-0">
        <FieldLegend variant="label">Materiais</FieldLegend>
        {roles.main.length + roles.advanced.length === 0 ? (
          <p className="text-muted-foreground">Pinte peças para escolher os materiais.</p>
        ) : (
          <RoleFields
            idPrefix="scene-mat"
            main={roles.main}
            advanced={roles.advanced}
            materials={materials}
            value={scene.materials}
            noneLabel={(role) => (catalog.defaultMaterials[role] ? `Padrão (${catalog.defaultMaterials[role]})` : 'Padrão')}
            advancedTitle="Avançado"
            onChange={(role, name) => onEdit((s) => setSceneMaterial(s, role, name))}
          />
        )}
      </FieldSet>
    </div>
  );
}
