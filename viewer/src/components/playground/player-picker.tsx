import { AssetThumb } from '@/components/asset-thumb';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Kbd } from '@/components/ui/kbd';
import type { Character } from '@/lib/playground/library';

interface Props {
  characters: Character[];
  player: Character | null;
  onPlayer: (id: string) => void;
}

const coverOf = (c: Character) => (c.idle ?? c.locomotion[0] ?? c.actions[0]).asset;

/** Searchable by name and folder; [ and ] step through the list without opening it. */
export function PlayerPicker({ characters, player, onPlayer }: Props) {
  return (
    <Field>
      <FieldLabel htmlFor="playground-player">
        Controlar
        <span className="ml-auto flex gap-1"><Kbd>[</Kbd><Kbd>]</Kbd></span>
      </FieldLabel>
      <Combobox
        autoHighlight
        items={characters}
        value={player}
        onValueChange={(character) => {
          if (!character) return;
          onPlayer(character.id);
          // Hand the keyboard back to the scene: WASD and Space would otherwise type into the search.
          document.getElementById('playground-player')?.blur();
        }}
        itemToStringValue={(character) => `${character.folder} ${character.name}`}
        itemToStringLabel={(character) => character.name}
      >
        <ComboboxInput id="playground-player" placeholder="Buscar personagem" />
        <ComboboxContent>
          <ComboboxEmpty>Nenhum personagem encontrado.</ComboboxEmpty>
          <ComboboxList>
            {(character: Character) => (
              <ComboboxItem key={character.id} value={character}>
                <div className="w-9 shrink-0 overflow-hidden rounded-sm ring-1 ring-foreground/10">
                  <AssetThumb asset={coverOf(character)} />
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{character.name}</span>
                  <span className="truncate text-muted-foreground">
                    {character.folder} · {character.clips.length} {character.clips.length === 1 ? 'animação' : 'animações'}
                  </span>
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}
