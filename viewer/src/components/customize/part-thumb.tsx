import { TrimmedImage } from '@/components/trimmed-image';
import type { AssetFileMeta } from '@/lib/types';
import { cn } from '@/lib/utils';

/** A part's picture on a checkerboard, cut to the pixels it draws; empty when the kit has not exported its sheet yet. */
export function PartThumb({ asset, className }: { asset: AssetFileMeta | undefined; className?: string }) {
  return (
    <span className={cn('checker grid size-9 shrink-0 place-items-center overflow-hidden rounded-sm ring-1 ring-foreground/10', className)}>
      {asset && <TrimmedImage asset={asset} className="max-h-[85%] max-w-[85%]" />}
    </span>
  );
}
