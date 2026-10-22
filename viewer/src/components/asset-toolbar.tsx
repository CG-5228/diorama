import { ArrowDownIcon, ArrowUpIcon, LayersIcon, LayoutGridIcon, Rows3Icon, SearchIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Kbd } from '@/components/ui/kbd';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { isRoleId, roleIds, roleLabels } from '@/lib/asset-role';
import { assetsRoute } from '@/lib/routes';
import { isSortId, sortIds, type SortId } from '@/lib/search';
import { basename } from '@/lib/format';
import type { Engine } from '@/lib/types';

const sortLabels: Record<SortId, string> = {
  name: 'Nome', folder: 'Pasta', role: 'Tipo', engine: 'Engine', dimensions: 'Dimensões', frames: 'Frames', fileSize: 'Tamanho', modified: 'Data',
};

export const gridSizes = { s: 132, m: 176, l: 240 } as const;
export type GridSize = keyof typeof gridSizes;

/** Radix Select cannot hold an empty value, so "no filter" is this sentinel. */
const ALL = 'all';

interface Props {
  /** Every folder prefix in the project with the number of assets below it. */
  folders: Array<[path: string, count: number]>;
  gridSize: GridSize;
  onGridSize: (size: GridSize) => void;
}

export function AssetToolbar({ folders, gridSize, onGridSize }: Props) {
  const search = assetsRoute.useSearch();
  const navigate = assetsRoute.useNavigate();
  const setSearch = (patch: Partial<typeof search>) => void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
      <InputGroup className="w-72">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          id="asset-search"
          type="search"
          placeholder="Filtrar por nome ou caminho"
          aria-label="Filtrar assets"
          autoComplete="off"
          value={search.q}
          onChange={(e) => setSearch({ q: e.target.value })}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            if (search.q) setSearch({ q: '' });
            else e.currentTarget.blur();
          }}
        />
        <InputGroupAddon align="inline-end">
          {search.q ? (
            <InputGroupButton size="icon-xs" aria-label="Limpar busca" onClick={() => setSearch({ q: '' })}>
              <XIcon />
            </InputGroupButton>
          ) : (
            <Kbd>/</Kbd>
          )}
        </InputGroupAddon>
      </InputGroup>

      <Select value={search.engine ?? ALL} onValueChange={(value) => setSearch({ engine: value === ALL ? undefined : (value as Engine | 'none') })}>
        <SelectTrigger size="sm" aria-label="Engine" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={ALL}>Todas as engines</SelectItem>
            <SelectItem value="volume">volume</SelectItem>
            <SelectItem value="rig">rig</SelectItem>
            <SelectItem value="none">sem engine</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select value={search.role ?? ALL} onValueChange={(value) => setSearch({ role: isRoleId(value) ? value : undefined })}>
        <SelectTrigger size="sm" aria-label="Tipo" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={ALL}>Todos os tipos</SelectItem>
            {roleIds.map((id) => <SelectItem key={id} value={id}>{roleLabels[id]}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>

      <Select value={search.folder ?? ALL} onValueChange={(value) => setSearch({ folder: value === ALL ? undefined : value })} disabled={folders.length === 0}>
        <SelectTrigger size="sm" aria-label="Pasta" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={ALL}>Todas as pastas</SelectItem>
            {folders.map(([path, count]) => (
              <SelectItem key={path} value={path}>
                {`${' '.repeat(path.split('/').length - 1)}${basename(path)} (${count})`}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Select value={search.sort} onValueChange={(value) => isSortId(value) && setSearch({ sort: value })}>
          <SelectTrigger size="sm" aria-label="Ordenar por" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {sortIds.map((id) => <SelectItem key={id} value={id}>{sortLabels[id]}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          aria-label={search.dir === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'}
          onClick={() => setSearch({ dir: search.dir === 'asc' ? 'desc' : 'asc' })}
        >
          {search.dir === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />}
        </Button>

        {search.view === 'grid' && (
          <>
            <Toggle
              variant="outline"
              size="sm"
              pressed={search.group}
              onPressedChange={(group) => setSearch({ group })}
              aria-label="Agrupar animações do mesmo personagem"
              title="Agrupar animações do mesmo personagem"
            >
              <LayersIcon />
              Agrupar
            </Toggle>
            <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={gridSize} onValueChange={(size) => size && onGridSize(size as GridSize)} aria-label="Tamanho dos cards">
              {(Object.keys(gridSizes) as GridSize[]).map((size) => (
                <ToggleGroupItem key={size} value={size}>{size.toUpperCase()}</ToggleGroupItem>
              ))}
            </ToggleGroup>
          </>
        )}
        <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={search.view} onValueChange={(view) => (view === 'grid' || view === 'table') && setSearch({ view })} aria-label="Visualização">
          <ToggleGroupItem value="grid" aria-label="Grade"><LayoutGridIcon /></ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Tabela"><Rows3Icon /></ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
