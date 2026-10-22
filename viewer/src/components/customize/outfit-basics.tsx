import type { GearCatalog, OutfitData } from '@core/rig';
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { rolesOf, setBase, setMaterial } from '@/lib/outfit/edit';
import type { Edit } from '@/lib/outfit/use-draft';
import { RoleFields } from './role-fields';

const NO_BASE = '__none';

/** The body underneath and the material that plays each role, for the whole outfit: what both views of the editor start with. */
export function OutfitBasics({ catalog, outfit, onEdit }: { catalog: GearCatalog; outfit: OutfitData; onEdit: Edit }) {
  const materials = Object.keys(catalog.materials);
  const roles = rolesOf(outfit, catalog);
  return (
    <div className="flex flex-col gap-5">
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="outfit-base">Corpo</FieldLabel>
          <Select value={outfit.base ?? NO_BASE} onValueChange={(base) => onEdit((o) => setBase(o, base === NO_BASE ? undefined : base))}>
            <SelectTrigger id="outfit-base" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NO_BASE}>Sem corpo</SelectItem>
                {catalog.bases.map((base) => <SelectItem key={base.id} value={base.id}>{base.label}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      <FieldSet className="min-w-0">
        <FieldLegend variant="label">Materiais</FieldLegend>
        {roles.main.length + roles.advanced.length === 0 ? (
          <p className="text-muted-foreground">Nenhum papel de material em uso.</p>
        ) : (
          <RoleFields
            idPrefix="outfit-mat"
            main={roles.main}
            advanced={roles.advanced}
            materials={materials}
            value={outfit.materials}
            noneLabel={() => 'Nenhum'}
            advancedTitle="Avançado"
            onChange={(role, name) => onEdit((o) => setMaterial(o, role, name))}
          />
        )}
      </FieldSet>
    </div>
  );
}
