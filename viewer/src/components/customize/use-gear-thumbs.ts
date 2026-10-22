import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { assetsQuery } from '@/lib/queries';
import type { AssetFileMeta } from '@/lib/types';

/** The exported sheet of each part of the project's gear kit (`gear/<part>`), by the part's id: what the thumbnails are cut from. A part without a sheet has none. */
export function useGearThumbs(project: string): Map<string, AssetFileMeta> {
  const { data: assets = [] } = useQuery(assetsQuery);
  return useMemo(
    () => new Map(assets.flatMap((a) => (a.project === project && a.atlasInfo?.role === 'gear' && a.atlasInfo.part ? [[a.atlasInfo.part, a] as const] : []))),
    [assets, project],
  );
}
