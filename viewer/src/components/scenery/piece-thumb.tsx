import { useQuery } from '@tanstack/react-query';
import type { ScenePieceInfo, SceneryCatalog } from '@core/volume';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { pieceThumbQuery } from '@/lib/scenery/thumbs';

const frame = cva('checker grid shrink-0 place-items-center overflow-hidden rounded-sm ring-1 ring-foreground/10', {
  variants: { size: { sm: 'size-8', md: 'size-10', card: 'h-14 w-full', slot: 'h-10 w-full' } },
  defaultVariants: { size: 'md' },
});
const image = cva('pixelated object-contain', { variants: { size: { sm: 'max-h-7 max-w-7', md: 'max-h-9 max-w-9', card: 'max-h-12 max-w-[calc(100%-0.5rem)]', slot: 'max-h-9 max-w-[calc(100%-0.5rem)]' } }, defaultVariants: { size: 'md' } });

/** A piece as the engine draws it, cut to its pixels: nothing while it is being drawn or when it draws nothing. */
export function PieceThumb({ catalog, info, size, className }: { catalog: SceneryCatalog; info: ScenePieceInfo; className?: string } & VariantProps<typeof frame>) {
  const { data } = useQuery(pieceThumbQuery(catalog, info));
  return (
    <span className={cn(frame({ size }), className)}>
      {data && <img src={data.src} alt="" draggable={false} className={image({ size })} />}
    </span>
  );
}
