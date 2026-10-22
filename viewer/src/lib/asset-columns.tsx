import {
  columnFilteringFeature, createColumnHelper, createFilteredRowModel, createSortedRowModel,
  rowSortingFeature, tableFeatures,
} from '@tanstack/react-table';
import { AssetThumb } from '@/components/asset-thumb';
import { AssetMenuButton } from '@/components/asset-menu';
import { EngineBadge } from '@/components/engine-badge';
import { StaleBadge } from '@/components/stale-badge';
import { Badge } from '@/components/ui/badge';
import { assetTitle, roleDetail, roleOf, roleSingular, type RoleId } from './asset-role';
import { isStale } from './export-state';
import { dirname, formatBytes, formatRelative } from './format';
import type { AssetFileMeta, Engine } from './types';

/** Stable, module-level inputs: Table v9 recomputes row models whenever these change identity. */
export const assetFeatures = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
});

const helper = createColumnHelper<typeof assetFeatures, AssetFileMeta>();

type Sortable = { original: AssetFileMeta };
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const byNumber = (pick: (a: AssetFileMeta) => number) => (a: Sortable, b: Sortable) => pick(a.original) - pick(b.original);
const byText = (pick: (a: AssetFileMeta) => string) => (a: Sortable, b: Sortable) => collator.compare(pick(a.original), pick(b.original));

const dimensionsOf = (a: AssetFileMeta) => (a.width ?? 0) * (a.height ?? 0);
const frameCountOf = (a: AssetFileMeta) => a.atlasInfo?.frameCount ?? 1;

export const assetColumns = helper.columns([
  helper.display({
    id: 'thumb',
    header: '',
    enableSorting: false,
    cell: ({ row }) => (
      <div className="w-12 overflow-hidden rounded-sm ring-1 ring-foreground/10">
        <AssetThumb asset={row.original} />
      </div>
    ),
  }),
  helper.accessor((a) => a.subpath, {
    id: 'name',
    header: 'Nome',
    sortFn: byText((a) => a.subpath),
    // Every word of the query must appear somewhere in "project/path".
    filterFn: (row, _columnId, query: string) => {
      // A gear item is also found by its label and group ("Elmo", "Cabeça").
      const { label, group } = row.original.atlasInfo ?? {};
      const haystack = `${row.original.project}/${row.original.subpath} ${label ?? ''} ${group ?? ''}`.toLowerCase();
      return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
    },
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <span className="truncate font-medium" title={row.original.subpath}>{assetTitle(row.original)}</span>
        {isStale(row.original) && <StaleBadge />}
      </span>
    ),
  }),
  helper.accessor((a) => dirname(a.subpath), {
    id: 'folder',
    header: 'Pasta',
    sortFn: byText((a) => dirname(a.subpath)),
    filterFn: (row, _columnId, folder: string) => row.original.subpath.startsWith(`${folder}/`),
    cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() || '—'}</span>,
  }),
  helper.accessor(roleOf, {
    id: 'role',
    header: 'Tipo',
    sortFn: byText(roleOf),
    filterFn: (row, _columnId, role: RoleId) => roleOf(row.original) === role,
    cell: ({ row }) => {
      const role = roleOf(row.original);
      if (role === 'other') return <span className="text-muted-foreground">—</span>;
      const detail = roleDetail(row.original);
      return <Badge variant="secondary">{detail ? `${roleSingular[role]} · ${detail}` : roleSingular[role]}</Badge>;
    },
  }),
  helper.accessor((a) => a.engine ?? '', {
    id: 'engine',
    header: 'Engine',
    sortFn: byText((a) => a.engine ?? ''),
    filterFn: (row, _columnId, engine: Engine | 'none') => (engine === 'none' ? row.original.engine === null : row.original.engine === engine),
    cell: ({ row }) => (row.original.engine ? <EngineBadge engine={row.original.engine} /> : <span className="text-muted-foreground">—</span>),
  }),
  helper.accessor(dimensionsOf, {
    id: 'dimensions',
    header: 'Dimensões',
    sortFn: byNumber(dimensionsOf),
    cell: ({ row }) => (row.original.width ? `${row.original.width}×${row.original.height}` : '—'),
  }),
  helper.accessor(frameCountOf, {
    id: 'frames',
    header: 'Frames',
    sortFn: byNumber(frameCountOf),
    cell: ({ row }) => {
      const info = row.original.atlasInfo;
      if (!info || info.mode === 'sheet') return <span className="text-muted-foreground">—</span>;
      return `${info.frameCount}${info.directions.length > 1 ? ` × ${info.directions.length}` : ''}`;
    },
  }),
  helper.accessor((a) => a.size, {
    id: 'fileSize',
    header: 'Tamanho',
    sortFn: byNumber((a) => a.size),
    cell: ({ row }) => formatBytes(row.original.size),
  }),
  helper.accessor((a) => a.mtime, {
    id: 'modified',
    header: 'Modificado',
    sortFn: byNumber((a) => a.mtime),
    cell: ({ row }) => formatRelative(row.original.mtime),
  }),
  helper.display({
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => <AssetMenuButton asset={row.original} />,
  }),
]);
