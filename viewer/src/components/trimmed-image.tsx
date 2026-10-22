import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { trimmedQuery } from '@/lib/trim';
import type { AssetFileMeta } from '@/lib/types';

/** A sheet's preferred facing cut to its drawn pixels: nothing while it loads or when it is empty. */
export function TrimmedImage({ asset, className }: { asset: AssetFileMeta; className?: string }) {
  const { data } = useQuery(trimmedQuery(asset));
  if (!data) return null;
  return <img src={data.src} alt="" draggable={false} className={cn('pixelated object-contain', className)} />;
}
