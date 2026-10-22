import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { Engine } from '@/lib/types';

const dot: Record<Engine, string> = {
  volume: 'bg-engine-volume',
  rig: 'bg-engine-rig',
};

export function EngineBadge({ engine }: { engine: Engine }) {
  return (
    <Badge variant="outline">
      <span className={cn('size-1.5 rounded-xs', dot[engine])} />
      {engine}
    </Badge>
  );
}
