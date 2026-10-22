import { useMemo } from 'react';
import { functionalUpdate, useTable, type ColumnFiltersState, type SortingState } from '@tanstack/react-table';
import { assetColumns, assetFeatures } from './asset-columns';
import { assetsRoute } from './routes';
import { assetsSearchDefaults, isSortId } from './search';
import type { AssetFileMeta } from './types';

/** The asset table. Sorting and filters live in the URL; the table only reads and writes them. */
export function useAssetTable(data: AssetFileMeta[]) {
  const search = assetsRoute.useSearch();
  const navigate = assetsRoute.useNavigate();

  const sorting = useMemo<SortingState>(() => [{ id: search.sort, desc: search.dir === 'desc' }], [search.sort, search.dir]);
  const columnFilters = useMemo<ColumnFiltersState>(
    () => [
      ...(search.q.trim() ? [{ id: 'name', value: search.q.trim() }] : []),
      ...(search.engine ? [{ id: 'engine', value: search.engine }] : []),
      ...(search.folder ? [{ id: 'folder', value: search.folder }] : []),
      ...(search.role ? [{ id: 'role', value: search.role }] : []),
    ],
    [search.q, search.engine, search.folder, search.role],
  );

  return useTable({
    features: assetFeatures,
    columns: assetColumns,
    data,
    getRowId: (asset) => asset.subpath,
    state: { sorting, columnFilters },
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting)[0];
      void navigate({
        search: (prev) => ({
          ...prev,
          sort: next && isSortId(next.id) ? next.id : assetsSearchDefaults.sort,
          dir: next?.desc ? 'desc' : 'asc',
        }),
        replace: true,
      });
    },
    enableSortingRemoval: false,
  });
}

export type AssetTableInstance = ReturnType<typeof useAssetTable>;
